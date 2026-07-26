"""
filter_boundary_chunked.py
==========================
Deletes buildings outside Somaliland using chunked scanning
with small pages (500 rows) and explicit timeout config to
avoid httpx ReadTimeout on large tables.

Run from backend/ directory:
    python filter_boundary_chunked.py

Requires:
    pip install supabase python-dotenv shapely httpx
"""

import os
import sys
import time
import httpx
from dotenv import load_dotenv
from supabase import create_client, Client
from shapely.geometry import Point, Polygon

load_dotenv()

# ── Configure httpx with longer timeout ──────────────────────────────────────
# Supabase client uses httpx internally. We patch the timeout before creating.
import httpx as _httpx
_orig_client = _httpx.Client

class _PatchedClient(_httpx.Client):
    def __init__(self, **kwargs):
        kwargs.setdefault('timeout', _httpx.Timeout(60.0, connect=10.0))
        super().__init__(**kwargs)

_httpx.Client = _PatchedClient

supabase: Client = create_client(
    os.environ["SUPABASE_URL"],
    os.environ["SUPABASE_SERVICE_ROLE_KEY"]
)

_httpx.Client = _orig_client  # restore

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

PAGE_SIZE   = 300    # rows per API call (small to avoid timeout)
BATCH_SIZE  = 300    # rows per DELETE call
RETRY_MAX   = 5
RETRY_SLEEP = 5

def log(msg):
    print(msg, flush=True)

def fetch_page(last_id, page_size=PAGE_SIZE):
    for attempt in range(1, RETRY_MAX + 1):
        try:
            res = supabase.table("buildings") \
                .select("id, latitude, longitude") \
                .gt("id", last_id) \
                .order("id", desc=False) \
                .limit(page_size) \
                .execute()
            return res.data
        except Exception as e:
            log(f"\n  [RETRY {attempt}/{RETRY_MAX}] Fetch error: {e}")
            if attempt < RETRY_MAX:
                time.sleep(RETRY_SLEEP)
            else:
                raise

def delete_batch(ids):
    for attempt in range(1, RETRY_MAX + 1):
        try:
            supabase.table("buildings").delete().in_("id", ids).execute()
            return
        except Exception as e:
            log(f"\n  [RETRY {attempt}/{RETRY_MAX}] Delete error: {e}")
            if attempt < RETRY_MAX:
                time.sleep(RETRY_SLEEP)
            else:
                raise

def count_buildings():
    res = supabase.table("buildings").select("id", count="exact").limit(1).execute()
    return res.count

# ── MAIN ─────────────────────────────────────────────────────────────────────
log("=" * 65)
log("  Somaliland Boundary Filter (Chunked + Retry)")
log(f"  Page size  : {PAGE_SIZE} rows")
log(f"  Batch size : {BATCH_SIZE} rows")
log(f"  Started    : {time.strftime('%Y-%m-%d %H:%M:%S')}")
log("=" * 65)

total_in_db = count_buildings()
log(f"\nTotal buildings in DB: {total_in_db:,}")
log("\n[SCAN] Scanning all buildings for boundary violations…")

outside_ids = []
scanned     = 0
last_id     = 0
pages       = 0

while True:
    rows = fetch_page(last_id)
    if not rows:
        break

    pages += 1
    for row in rows:
        pt = Point(row["longitude"], row["latitude"])
        if not SOMALILAND_BOUNDARY.contains(pt):
            outside_ids.append(row["id"])

    scanned += len(rows)
    last_id  = rows[-1]["id"]
    pct      = 100 * scanned / total_in_db if total_in_db else 0
    print(
        f"\r  Scanned {scanned:,}/{total_in_db:,} ({pct:.1f}%) "
        f"| Outside: {len(outside_ids):,} "
        f"| Pages: {pages}",
        end="", flush=True
    )

    # Delete in batches as we scan to keep memory usage low
    while len(outside_ids) >= BATCH_SIZE:
        batch = outside_ids[:BATCH_SIZE]
        outside_ids = outside_ids[BATCH_SIZE:]
        delete_batch(batch)

log(f"\n\n[SCAN DONE] Remaining to delete: {len(outside_ids):,}")

# Delete any remaining
if outside_ids:
    log(f"[DELETE] Deleting final {len(outside_ids)} buildings…")
    for i in range(0, len(outside_ids), BATCH_SIZE):
        delete_batch(outside_ids[i:i + BATCH_SIZE])

final_count = count_buildings()
deleted_total = total_in_db - final_count

log(f"\n✓ Done!")
log(f"  Before  : {total_in_db:,}")
log(f"  After   : {final_count:,}")
log(f"  Deleted : {deleted_total:,}")
log("\n" + "=" * 65)
log(f"  Finished: {time.strftime('%Y-%m-%d %H:%M:%S')}")
log("=" * 65)
