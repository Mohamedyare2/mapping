"""
import_all_somaliland.py
========================
Import EVERY building in Somaliland from the downloaded grid-cell chunks.
Uses only the cell_* files (which cover all of Somaliland uniformly) to avoid
double-counting buildings that also appear in the named city geojsons.

Progress is logged to: logs/import_progress.log
"""
import json
import os
import time
import sys
from dotenv import load_dotenv
from supabase import create_client
from shapely.geometry import shape

# ── Config ──────────────────────────────────────────────────────────────────
CHUNKS_DIR = "chunks"
LOG_FILE    = "logs/import_all_somaliland.log"
BATCH_SIZE  = 1000        # rows per upsert call
RETRY_MAX   = 3
RETRY_SLEEP = 3

# Only use the systematic grid cells — these cover the ENTIRE country uniformly.
# Named city files (berbera, hargeisa …) overlap with the cells and would
# cause duplicate numbers.
USE_PATTERN = "cell_"

load_dotenv()
supabase_url = os.environ.get("SUPABASE_URL")
supabase_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
supabase     = create_client(supabase_url, supabase_key)

os.makedirs("logs", exist_ok=True)

def log(msg):
    print(msg, flush=True)
    with open(LOG_FILE, "a", encoding="utf-8") as f:
        f.write(msg + "\n")

# ── Gather files ─────────────────────────────────────────────────────────────
all_geojson_files = sorted([
    f for f in os.listdir(CHUNKS_DIR)
    if f.endswith(".geojson") and f.startswith(USE_PATTERN)
])

log("=" * 65)
log("  Somaliland Full-Country Building Ingestion")
log(f"  Files to process : {len(all_geojson_files)} grid-cell chunks")
log(f"  Batch size        : {BATCH_SIZE}")
log(f"  Started at        : {time.strftime('%Y-%m-%d %H:%M:%S')}")
log("=" * 65)

# ── Step 1 : Wipe existing buildings ─────────────────────────────────────────
log("\n[WIPE] Deleting all existing buildings from Supabase…")
deleted = 0
while True:
    try:
        res = supabase.table("buildings").select("id").limit(1000).execute()
        if not res.data:
            break
        ids = [r["id"] for r in res.data]
        supabase.table("buildings").delete().in_("id", ids).execute()
        deleted += len(ids)
        print(f"  Deleted {deleted} so far…", end="\r", flush=True)
    except Exception as e:
        log(f"\n  [WARN] Error during delete: {e}  — retrying in {RETRY_SLEEP}s…")
        time.sleep(RETRY_SLEEP)

log(f"\n  [OK] Cleared {deleted} old records.")

# ── Step 2 : Process each chunk ───────────────────────────────────────────────
total_buildings = 0
current_number  = 1
failed_chunks   = []

for idx, chunk_file in enumerate(all_geojson_files, start=1):
    file_path = os.path.join(CHUNKS_DIR, chunk_file)
    file_size = os.path.getsize(file_path)

    # Skip empty placeholder files (Overture returns 47-byte empty geojson)
    if file_size < 500:
        log(f"\n[{idx}/{len(all_geojson_files)}] SKIP  {chunk_file} (empty, {file_size} B)")
        continue

    log(f"\n[{idx}/{len(all_geojson_files)}] CHUNK {chunk_file}  ({file_size//1024:,} KB)")

    # Parse GeoJSON
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

    # Extract centroids
    rows = []
    for feat in features:
        try:
            geom   = shape(feat["geometry"])
            center = geom.centroid
            if not center.is_valid or center.is_empty:
                continue
            rows.append({
                "number"   : current_number,
                "latitude" : round(center.y, 8),
                "longitude": round(center.x, 8),
                "city"     : "Somaliland",
            })
            current_number += 1
        except Exception:
            continue

    log(f"  Valid centroids  : {len(rows):,}")

    # Upload in batches with retry
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
                log(f"\n  [WARN] Batch {i//BATCH_SIZE} attempt {attempt} failed: {e}")
                if attempt < RETRY_MAX:
                    time.sleep(RETRY_SLEEP)
                else:
                    log(f"  [ERROR] Giving up on batch {i//BATCH_SIZE} of {chunk_file}")
                    failed_chunks.append(f"{chunk_file}:batch{i//BATCH_SIZE}")

    total_buildings += len(rows)
    log(f"  [DONE] Uploaded  : {len(rows):,}  (Cumulative total: {total_buildings:,}   Last#: {current_number-1})")

# ── Summary ───────────────────────────────────────────────────────────────────
log("\n" + "=" * 65)
log(f"  COMPLETED  {time.strftime('%Y-%m-%d %H:%M:%S')}")
log(f"  Grand total buildings inserted : {total_buildings:,}")
log(f"  Highest building number        : {current_number - 1}")
if failed_chunks:
    log(f"  Failed chunks ({len(failed_chunks)}) :")
    for fc in failed_chunks:
        log(f"    - {fc}")
else:
    log("  No failures — all chunks succeeded!")
log("=" * 65)
