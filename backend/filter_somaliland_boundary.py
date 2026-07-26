"""
filter_somaliland_boundary.py
=============================
Deletes all buildings in the Supabase database that fall OUTSIDE
the real Somaliland administrative boundary polygon.

Uses shapely point-in-polygon test against a simplified but accurate
Somaliland boundary (based on official UN / OSM data).

Run from the backend/ directory:
    python filter_somaliland_boundary.py

Requires:
    pip install supabase python-dotenv shapely
"""

import os
import time
from dotenv import load_dotenv
from supabase import create_client
from shapely.geometry import Point, Polygon

load_dotenv()

supabase = create_client(
    os.environ["SUPABASE_URL"],
    os.environ["SUPABASE_SERVICE_ROLE_KEY"]
)

# ── Somaliland boundary polygon ──────────────────────────────────────────────
# Approximate boundary based on UN OCHA / OpenStreetMap administrative data.
# Points are (longitude, latitude). Clockwise from NW corner.
SOMALILAND_BOUNDARY = Polygon([
    # NW Djibouti border corner
    (42.65, 11.0),
    (42.70, 11.10),
    (42.80, 11.22),
    (42.90, 11.35),
    (43.00, 11.45),
    # North coast along Gulf of Aden
    (43.50, 11.55),
    (44.00, 11.50),
    (44.50, 11.48),
    (45.00, 11.47),
    (45.50, 11.45),
    (46.00, 11.40),
    (46.50, 11.38),
    (47.00, 11.35),
    (47.50, 11.28),
    (48.00, 11.20),
    (48.50, 11.15),
    (49.00, 11.12),
    (49.30, 11.10),
    # Maakhir / NE tip  
    (49.50, 11.10),
    (49.80, 10.90),
    (49.90, 10.75),
    # East border (Puntland boundary)
    (49.60, 10.10),
    (49.50,  9.80),
    (49.20,  9.40),
    (49.00,  9.00),
    (48.80,  8.60),
    (48.60,  8.35),
    (48.50,  8.20),
    # SE corner (Sool/Nugal border)
    (48.20,  8.10),
    (47.80,  8.00),
    # Haud / South border (Ethiopia)
    (47.00,  8.00),
    (46.50,  8.05),
    (46.00,  8.25),
    (45.50,  8.40),
    (45.00,  8.60),
    (44.50,  8.80),
    (44.00,  9.10),
    # SW corner Ethiopia border
    (43.50,  9.50),
    (43.20,  9.80),
    (43.00, 10.00),
    (42.90, 10.20),
    (42.75, 10.50),
    # Back to NW Djibouti corner
    (42.65, 11.0),
])

# ── Config ───────────────────────────────────────────────────────────────────
BATCH_SIZE  = 1000
PAGE_SIZE   = 2000   # rows fetched per query round
RETRY_MAX   = 3
RETRY_SLEEP = 3

def log(msg):
    print(msg, flush=True)

log("=" * 65)
log("  Somaliland Boundary Filter — Remove Out-of-Country Buildings")
log(f"  Boundary vertices : {len(SOMALILAND_BOUNDARY.exterior.coords)}")
log(f"  Started at        : {time.strftime('%Y-%m-%d %H:%M:%S')}")
log("=" * 65)

# Count total buildings for progress reporting
res = supabase.table("buildings").select("id", count="exact").limit(1).execute()
total_in_db = res.count
log(f"\nTotal buildings in DB: {total_in_db:,}")

# ── Paginate through ALL buildings, collect IDs outside boundary ──────────────
log("\n[SCAN] Scanning all buildings for boundary violations…")

outside_ids = []
scanned     = 0
last_id     = 0   # cursor-based pagination

while True:
    res = supabase.table("buildings") \
        .select("id, latitude, longitude") \
        .gt("id", last_id) \
        .order("id", desc=False) \
        .limit(PAGE_SIZE) \
        .execute()

    rows = res.data
    if not rows:
        break

    for row in rows:
        pt = Point(row["longitude"], row["latitude"])
        if not SOMALILAND_BOUNDARY.contains(pt):
            outside_ids.append(row["id"])

    scanned += len(rows)
    last_id  = rows[-1]["id"]
    print(f"  Scanned {scanned:,} / {total_in_db:,} — outside so far: {len(outside_ids):,}", end="\r", flush=True)

log(f"\n\n[SCAN DONE] Total outside boundary: {len(outside_ids):,}")
log(f"            Will keep            : {total_in_db - len(outside_ids):,}")

if not outside_ids:
    log("\n✓ No out-of-boundary buildings found. Database is clean!")
else:
    log(f"\n[DELETE] Deleting {len(outside_ids):,} out-of-boundary buildings…")
    deleted = 0
    for i in range(0, len(outside_ids), BATCH_SIZE):
        batch = outside_ids[i : i + BATCH_SIZE]
        for attempt in range(1, RETRY_MAX + 1):
            try:
                supabase.table("buildings").delete().in_("id", batch).execute()
                deleted += len(batch)
                print(f"  Deleted {deleted:,} / {len(outside_ids):,}…", end="\r", flush=True)
                break
            except Exception as e:
                log(f"\n  [WARN] Attempt {attempt} failed: {e}")
                if attempt < RETRY_MAX:
                    time.sleep(RETRY_SLEEP)
                else:
                    log(f"  [ERROR] Giving up on batch {i // BATCH_SIZE}")

    log(f"\n\n✓ Done. Deleted {deleted:,} buildings outside Somaliland.")
    log(f"  Remaining in DB: {total_in_db - deleted:,}")

log("\n" + "=" * 65)
log(f"  Finished at: {time.strftime('%Y-%m-%d %H:%M:%S')}")
log("=" * 65)
