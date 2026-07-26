"""
reimport_failed_chunks.py
=========================
Re-imports only the chunks that had batch failures during the original
import_all_somaliland run. Uses upsert on `number` so rows that were
already inserted are safe (no duplicates).

Failed chunks from the log:
  cell_44_0_8_0  – batches 6,7,8 failed  → rows 6000–8436 of this chunk
  cell_44_0_8_5  – ALL batches 0–8 failed → entire chunk (8,793 rows)
  cell_44_0_9_0  – ALL batches 0–14 failed → entire chunk (14,212 rows)
  cell_44_0_9_5  – batches 0–4 failed    → first 5,000 rows of this chunk

Starting `number` values derived from the import log cumulative totals:
  After chunk 24 (cell_44_0_8_0 started from): last# = 597,079
  After chunk 25 (cell_44_0_8_5 started from): last# = 605,872 (if 44_0_8_0 complete)
  After chunk 26 (cell_44_0_9_0 started from): last# = 614,665
  After chunk 27 (cell_44_0_9_5 started from): last# = 620,084   (but partial; 776,605 end)

  NOTE: The log shows [DONE] for each chunk even with failures — this is because
  the counter `total_buildings` still counts features it tried to upload.
  The ACTUAL numbers assigned are correct because current_number increments
  unconditionally BEFORE upload attempt. So we must use the SAME starting
  numbers to hit the exact same `number` values.

Run from backend/ directory:
    python reimport_failed_chunks.py

Requires:
    pip install supabase python-dotenv shapely httpx
"""

import json
import os
import sys
import time
from dotenv import load_dotenv
from supabase import create_client
from shapely.geometry import shape

load_dotenv()
supabase = create_client(
    os.environ["SUPABASE_URL"],
    os.environ["SUPABASE_SERVICE_ROLE_KEY"]
)

CHUNKS_DIR  = "chunks"
BATCH_SIZE  = 500    # smaller batches to avoid timeouts
RETRY_MAX   = 8
RETRY_SLEEP = 5

def log(msg):
    print(msg, flush=True)

def upload_batch(batch, chunk_name, batch_idx):
    for attempt in range(1, RETRY_MAX + 1):
        try:
            supabase.table("buildings").upsert(batch, on_conflict="number").execute()
            return True
        except Exception as e:
            log(f"\n  [RETRY {attempt}/{RETRY_MAX}] Batch {batch_idx} of {chunk_name}: {e}")
            if attempt < RETRY_MAX:
                time.sleep(RETRY_SLEEP)
            else:
                log(f"  [ERROR] Giving up on batch {batch_idx} of {chunk_name}")
                return False

def count_buildings():
    res = supabase.table("buildings").select("id", count="exact").limit(1).execute()
    return res.count

def load_chunk_rows(chunk_file, start_number):
    """Parse a chunk file and return (rows, next_number)."""
    file_path = os.path.join(CHUNKS_DIR, chunk_file)
    log(f"\n  Loading {chunk_file}  ({os.path.getsize(file_path)//1024:,} KB)…")
    with open(file_path, "r", encoding="utf-8") as fh:
        geojson = json.load(fh)
    features = geojson.get("features", [])
    log(f"  Features: {len(features):,}")
    rows = []
    current_number = start_number
    for feat in features:
        try:
            geom   = shape(feat["geometry"])
            center = geom.centroid
            if not center.is_valid or center.is_empty:
                current_number += 1
                continue
            rows.append({
                "number"   : current_number,
                "latitude" : round(center.y, 8),
                "longitude": round(center.x, 8),
                "city"     : "Somaliland",
            })
        except Exception:
            pass
        current_number += 1
    log(f"  Valid rows: {len(rows):,}  (numbers {start_number} – {current_number-1})")
    return rows, current_number

def upload_rows(rows, chunk_name, start_row=0, end_row=None):
    """Upload rows[start_row:end_row] in batches. Returns count uploaded."""
    subset = rows[start_row:end_row]
    if not subset:
        log(f"  No rows to upload for range [{start_row}:{end_row}].")
        return 0
    uploaded = 0
    for i in range(0, len(subset), BATCH_SIZE):
        batch = subset[i:i + BATCH_SIZE]
        ok = upload_batch(batch, chunk_name, i // BATCH_SIZE)
        if ok:
            uploaded += len(batch)
        print(f"\r  Uploaded {uploaded}/{len(subset)} rows…", end="", flush=True)
    print()
    return uploaded

# ─────────────────────────────────────────────────────────────────────────────
log("=" * 65)
log("  Re-import of Failed Somaliland Chunk Batches")
log(f"  Started: {time.strftime('%Y-%m-%d %H:%M:%S')}")
log("=" * 65)

before = count_buildings()
log(f"\nBuildings in DB before: {before:,}")

total_uploaded = 0

# ══════════════════════════════════════════════════════════════
# CHUNK 1: cell_44_0_8_0
# Batches 6, 7, 8 failed → rows 6000–8436 of this chunk
# Starting number in the full sequence: 597,080
# (cumulative was 588,642 after chunk 23, then chunk 25 had 8,437 features)
# From log: chunk 25 [cell_44_0_8_0] starts at number 588,643
# ══════════════════════════════════════════════════════════════
log("\n[1/4] cell_44_0_8_0 — re-uploading failed batches 6,7,8 (rows 6000–8436)")
START_44_0_8_0 = 588_643  # The number assigned to the FIRST row of this chunk
rows_44_0_8_0, _ = load_chunk_rows("cell_44_0_8_0.geojson", START_44_0_8_0)
# Batches 6,7,8 at BATCH_SIZE=1000 → rows [6000:end]
# But we are using BATCH_SIZE=500 here, so upload rows[6000:] which covers the failed data
n = upload_rows(rows_44_0_8_0, "cell_44_0_8_0", start_row=6000)
log(f"  Uploaded {n} rows for cell_44_0_8_0")
total_uploaded += n

# ══════════════════════════════════════════════════════════════
# CHUNK 2: cell_44_0_8_5
# ALL batches failed → all 8,793 rows missing
# Starting number: 597,080 (after cell_44_0_8_0's 8,437 rows) = 597,080
# From log: chunk 26 starts at 597,080
# ══════════════════════════════════════════════════════════════
log("\n[2/4] cell_44_0_8_5 — re-uploading ALL rows (entire chunk failed)")
START_44_0_8_5 = 597_080
rows_44_0_8_5, _ = load_chunk_rows("cell_44_0_8_5.geojson", START_44_0_8_5)
n = upload_rows(rows_44_0_8_5, "cell_44_0_8_5")
log(f"  Uploaded {n} rows for cell_44_0_8_5")
total_uploaded += n

# ══════════════════════════════════════════════════════════════
# CHUNK 3: cell_44_0_9_0
# ALL batches failed → all 14,212 rows missing
# Starting number: 597,080 + 8,793 = 605,873
# From log: chunk 27 starts at 605,873
# ══════════════════════════════════════════════════════════════
log("\n[3/4] cell_44_0_9_0 — re-uploading ALL rows (entire chunk failed)")
START_44_0_9_0 = 605_873
rows_44_0_9_0, _ = load_chunk_rows("cell_44_0_9_0.geojson", START_44_0_9_0)
n = upload_rows(rows_44_0_9_0, "cell_44_0_9_0")
log(f"  Uploaded {n} rows for cell_44_0_9_0")
total_uploaded += n

# ══════════════════════════════════════════════════════════════
# CHUNK 4: cell_44_0_9_5
# Batches 0–4 failed → first 5,000 rows missing (at original BATCH_SIZE=1000)
# Starting number: 605,873 + 14,212 = 620,085
# From log: chunk 28 starts at 620,085
# ══════════════════════════════════════════════════════════════
log("\n[4/4] cell_44_0_9_5 — re-uploading failed batches 0–4 (first 5,000 rows)")
START_44_0_9_5 = 620_085
rows_44_0_9_5, _ = load_chunk_rows("cell_44_0_9_5.geojson", START_44_0_9_5)
# Batches 0–4 at original BATCH_SIZE=1000 → rows [0:5000]
n = upload_rows(rows_44_0_9_5, "cell_44_0_9_5", start_row=0, end_row=5000)
log(f"  Uploaded {n} rows for cell_44_0_9_5")
total_uploaded += n

# ─────────────────────────────────────────────────────────────────────────────
after = count_buildings()
log("\n" + "=" * 65)
log(f"  Re-import COMPLETE")
log(f"  Buildings before : {before:,}")
log(f"  Buildings after  : {after:,}")
log(f"  Net added        : {after - before:,}")
log(f"  Uploaded rows    : {total_uploaded:,}")
log(f"  Finished: {time.strftime('%Y-%m-%d %H:%M:%S')}")
log("=" * 65)
