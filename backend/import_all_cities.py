import json
import os
import math
import subprocess
import time
from dotenv import load_dotenv
from supabase import create_client
from shapely.geometry import shape

# Ensure chunks directory exists
os.makedirs("chunks", exist_ok=True)

# Path to overturemaps CLI from the venv
VENV_CLI = r"C:\Users\Administrator\Desktop\Hanaqaad\Mapping\ai-pipeline\venv\Scripts\overturemaps"

load_dotenv()
supabase_url = os.environ.get("SUPABASE_URL")
supabase_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
supabase = create_client(supabase_url, supabase_key)

# The same bounding boxes used previously, format: (lng_min, lat_min, lng_max, lat_max)
CITY_BBOXES = {
    "berbera":  (44.90,  10.30,  45.10,  10.55),
    "burao":    (45.38,   9.37,  45.70,   9.69),
    "hargeisa": (43.95,   9.47,  44.17,   9.67),
    "borama":   (43.02,   9.78,  43.34,  10.10),
    "erigavo":  (47.21,  10.46,  47.53,  10.78),
    "las_anod": (47.32,   8.43,  47.40,   8.52),
    "gabiley":  (43.50,   9.60,  43.75,   9.82),
}

def download_city_geojson(city_name, bbox):
    """Downloads building polygons for a city using Overture Maps."""
    outfile = f"chunks/{city_name}.geojson"
    if os.path.exists(outfile) and os.path.getsize(outfile) > 10000:
        print(f"  [SKIP] {city_name}.geojson already exists ({os.path.getsize(outfile)//1024} KB)")
        return outfile

    lng_min, lat_min, lng_max, lat_max = bbox
    bbox_str = f"{lng_min},{lat_min},{lng_max},{lat_max}"
    
    cmd = [VENV_CLI, "download", "--bbox", bbox_str, "-f", "geojson", "--type", "building", "-o", outfile]
    print(f"  [DOWNLOADING] Downloading accurate footprints for {city_name} (bbox: {bbox_str}) ...")
    
    for attempt in range(1, 4):
        result = subprocess.run(cmd, capture_output=False, text=True)
        if result.returncode == 0 and os.path.exists(outfile):
            print(f"    [OK] Downloaded successfully: {city_name}")
            return outfile
        else:
            print(f"    [WARN] Attempt {attempt} failed for {city_name}, retrying in 5s...")
            time.sleep(5)
            
    print(f"  [FAIL] Could not download {city_name}.")
    return None


print("=" * 60)
print("Somaliland High-Accuracy Building Ingestion (Overture Maps)")
print("=" * 60)

# 1. Skip confirmation as user already approved
# 2. Wipe existing detections
print("\n[WIPING] Wiping all old buildings to ensure clean sequencing...")
while True:
    res = supabase.table("buildings").select("id").limit(1000).execute()
    if not res.data:
        break
    ids = [r["id"] for r in res.data]
    supabase.table("buildings").delete().in_("id", ids).execute()
print("   [OK] Old buildings wiped.")

# 3. Process each city
current_number = 1
total_inserted = 0

for city_name, bbox in CITY_BBOXES.items():
    print(f"\n[CITY] Processing {city_name.upper()}...")
    
    outfile = download_city_geojson(city_name, bbox)
    if not outfile:
        continue
        
    print(f"   Reading {outfile}...")
    with open(outfile, "r", encoding="utf-8") as f:
        geojson = json.load(f)
        
    features = geojson.get("features", [])
    print(f"   Building count from Overture for {city_name}: {len(features)}")
    
    if len(features) == 0:
        print("   [WARN] No buildings found, skipping.")
        continue
        
    # Extract centroids
    rows = []
    for feat in features:
        try:
            geom = shape(feat["geometry"])
            center = geom.centroid # Extracts a point from the footprint polygon
            rows.append({
                "number": current_number,
                "latitude": round(center.y, 8),
                "longitude": round(center.x, 8),
                "city": city_name
            })
            current_number += 1
        except Exception as e:
            # Skip invalid geometries
            continue
            
    # Insert in batches
    CHUNK = 1000
    print(f"   Uploading {len(rows)} footprints to Supabase...")
    for i in range(0, len(rows), CHUNK):
        chunk = rows[i:i+CHUNK]
        supabase.table("buildings").upsert(chunk, on_conflict="number").execute()
    
    total_inserted += len(rows)
    print(f"   [DONE] Done with {city_name} (Ended at number {current_number-1})")

print("=" * 60)
print(f"[FINISH] ALL DONE! Grand total of {total_inserted} high-accuracy buildings inserted.")
print("=" * 60)
