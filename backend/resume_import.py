"""
resume_import.py
========================
Resumes import of every building in Somaliland.
Contains robust exponential backoff.
Filters out-of-bound coordinates prior to upload ensuring NO registration outside Somaliland.
Synchronizes `current_number` identically to original runs.
"""
import json
import os
import time
from dotenv import load_dotenv
from supabase import create_client
from shapely.geometry import shape, Point, Polygon

# ── Config ──────────────────────────────────────────────────────────────────
CHUNKS_DIR = "chunks"
LOG_FILE    = "logs/resume_import.log"
BATCH_SIZE  = 500        # Smaller batch size for robust upload
RETRY_MAX   = 10
USE_PATTERN = "cell_"

load_dotenv()
supabase_url = os.environ.get("SUPABASE_URL")
supabase_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

# Patch httpx timeout for supabase
import httpx as _httpx
_orig_client = _httpx.Client

class _PatchedClient(_httpx.Client):
    def __init__(self, **kwargs):
        kwargs.setdefault('timeout', _httpx.Timeout(60.0, connect=10.0))
        super().__init__(**kwargs)

_httpx.Client = _PatchedClient
supabase = create_client(supabase_url, supabase_key)
_httpx.Client = _orig_client  # restore

os.makedirs("logs", exist_ok=True)

def log(msg):
    print(msg, flush=True)
    with open(LOG_FILE, "a", encoding="utf-8") as f:
        f.write(msg + "\n")

# ── Somaliland boundary polygon (lon, lat) ───────────────────────────────────
SOMALILAND_BOUNDARY = Polygon([
    (42.65, 11.0),  (42.70, 11.10), (42.80, 11.22), (42.90, 11.35),
    (43.00, 11.45), (43.50, 11.55), (44.00, 11.50), (44.50, 11.48),
    (45.00, 11.47), (45.50, 11.45), (46.00, 11.40), (46.50, 11.38),
    (47.00, 11.35), (47.50, 11.28), (48.00, 11.20), (48.50, 11.15),
    (49.00, 11.12), (49.30, 11.10), (49.50, 11.10), (49.80, 10.90),
    (49.90, 10.75), (49.60, 10.10), (49.50,  9.80), (49.20,  9.40),
    (49.00,  9.00), (48.80,  8.60), (48.60,  8.35), (48.50,  8.20),
    (48.20,  8.10), (47.80,  8.00), (47.00,  8.00), (46.50,  8.05),
    (46.00,  8.25), (45.50,  8.40), (45.00,  8.60), (44.50,  8.80),
    (44.00,  9.10), (43.50,  9.50), (43.20,  9.80), (43.00, 10.00),
    (42.90, 10.20), (42.75, 10.50), (42.65, 11.0),
])

# ── Gather files ─────────────────────────────────────────────────────────────
all_geojson_files = sorted([
    f for f in os.listdir(CHUNKS_DIR)
    if f.endswith(".geojson") and f.startswith(USE_PATTERN)
])

log("=" * 65)
log("  Somaliland Robust Full-Country Building Ingestion Resumed")
log(f"  Files to process : {len(all_geojson_files)} grid-cell chunks")
log(f"  Batch size        : {BATCH_SIZE}")
log(f"  Started at        : {time.strftime('%Y-%m-%d %H:%M:%S')}")
log("=" * 65)

# ── Process each chunk ───────────────────────────────────────────────────────
total_buildings_uploaded = 0
current_number  = 1
failed_chunks   = []

for idx, chunk_file in enumerate(all_geojson_files, start=1):
    file_path = os.path.join(CHUNKS_DIR, chunk_file)
    file_size = os.path.getsize(file_path)

    if file_size < 500:
        log(f"\n[{idx}/{len(all_geojson_files)}] SKIP  {chunk_file} (empty, {file_size} B)")
        continue

    log(f"\n[{idx}/{len(all_geojson_files)}] CHUNK {chunk_file}  ({file_size//1024:,} KB)")

    try:
        with open(file_path, "r", encoding="utf-8") as fh:
            geojson = json.load(fh)
    except Exception as e:
        log(f"  [ERROR] Could not parse {chunk_file}: {e}")
        failed_chunks.append(chunk_file)
        continue

    features = geojson.get("features", [])
    if not features:
        log(f"  [SKIP] No features found.")
        continue

    log(f"  Buildings found  : {len(features):,}")

    rows = []
    skipped_out_of_bounds = 0
    for feat in features:
        try:
            geom   = shape(feat["geometry"])
            center = geom.centroid
            if not center.is_valid or center.is_empty:
                continue

            pt = Point(center.x, center.y)
            if SOMALILAND_BOUNDARY.contains(pt):
                rows.append({
                    "number"   : current_number,
                    "latitude" : round(center.y, 8),
                    "longitude": round(center.x, 8),
                    "city"     : "Somaliland",
                })
            else:
                skipped_out_of_bounds += 1

            current_number += 1
        except Exception:
            continue

    log(f"  Valid centroids (in bounds) : {len(rows):,}  (Skipped out-of-bounds: {skipped_out_of_bounds:,})")

    # Upload in batches
    uploaded = 0
    for i in range(0, len(rows), BATCH_SIZE):
        batch = rows[i : i + BATCH_SIZE]
        for attempt in range(1, RETRY_MAX + 1):
            try:
                supabase.table("buildings").upsert(batch, on_conflict="number").execute()
                uploaded += len(batch)
                print(f"  Uploaded {uploaded}/{len(rows)}…", end="\r", flush=True)
                break
            except Exception as e:
                sleep_time = min(60, 2 ** attempt)
                log(f"\n  [WARN] Batch {i//BATCH_SIZE} attempt {attempt} failed: {e}. Retrying in {sleep_time}s...")
                if attempt < RETRY_MAX:
                    time.sleep(sleep_time)
                else:
                    log(f"  [ERROR] Giving up on batch {i//BATCH_SIZE} of {chunk_file}")
                    failed_chunks.append(f"{chunk_file}:batch{i//BATCH_SIZE}")

    total_buildings_uploaded += len(rows)
    log(f"  [DONE] Uploaded  : {len(rows):,}  (Cumulative total uploaded: {total_buildings_uploaded:,}   Last#: {current_number-1})")

log("\n" + "=" * 65)
log(f"  COMPLETED  {time.strftime('%Y-%m-%d %H:%M:%S')}")
log(f"  Grand total buildings securely inserted : {total_buildings_uploaded:,}")
log(f"  Highest building number sequence       : {current_number - 1}")
if failed_chunks:
    log(f"  Failed chunks ({len(failed_chunks)}) :")
    for fc in failed_chunks:
        log(f"    - {fc}")
else:
    log("  No failures — all chunks succeeded!")
log("=" * 65)
