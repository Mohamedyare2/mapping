"""
Download Somaliland buildings in small regional chunks to avoid network timeouts.
Each chunk covers roughly one region/district of Somaliland.
"""
import subprocess
import json
import os
import sys
import time

# Auto-generate small 0.5°×0.5° grid cells covering Somaliland
SOMALILAND_LNG = (42.5, 49.5)
SOMALILAND_LAT = (8.0, 11.5)
STEP = 0.5  # degrees

CHUNKS = []
lng = SOMALILAND_LNG[0]
while lng < SOMALILAND_LNG[1]:
    lat = SOMALILAND_LAT[0]
    while lat < SOMALILAND_LAT[1]:
        name = f"cell_{lng:.1f}_{lat:.1f}".replace(".", "_")
        CHUNKS.append((lng, lat, min(lng + STEP, SOMALILAND_LNG[1]), min(lat + STEP, SOMALILAND_LAT[1]), name))
        lat += STEP
    lng += STEP

VENV_CLI = r"C:\Users\Administrator\Desktop\Hanaqaad\Mapping\ai-pipeline\venv\Scripts\overturemaps"
OUTPUT_DIR = "chunks"
os.makedirs(OUTPUT_DIR, exist_ok=True)

def download_chunk(lng_min, lat_min, lng_max, lat_max, name):
    outfile = os.path.join(OUTPUT_DIR, f"{name}.geojson")
    if os.path.exists(outfile) and os.path.getsize(outfile) > 1000:
        print(f"  [SKIP] {name}.geojson already exists ({os.path.getsize(outfile)//1024} KB)")
        return outfile
    
    bbox = f"{lng_min},{lat_min},{lng_max},{lat_max}"
    cmd = [VENV_CLI, "download", "--bbox", bbox, "-f", "geojson", "--type", "building", "-o", outfile]
    
    print(f"  Downloading chunk: {name} (bbox: {bbox}) ...")
    
    for attempt in range(1, 4):  # up to 3 retries per chunk
        result = subprocess.run(cmd, capture_output=False, text=True)
        if result.returncode == 0 and os.path.exists(outfile) and os.path.getsize(outfile) > 100:
            print(f"    OK: {name}")
            return outfile
        else:
            print(f"    Attempt {attempt} failed for {name}, retrying in 5s...")
            time.sleep(5)
    
    print(f"  FAILED: Could not download {name} after 3 attempts.")
    return None

def merge_chunks():
    """Merge all chunk GeoJSON files into one."""
    print("\nMerging all chunks...")
    all_features = []
    for _, _, _, _, name in CHUNKS:
        outfile = os.path.join(OUTPUT_DIR, f"{name}.geojson")
        if not os.path.exists(outfile):
            print(f"  WARNING: {name}.geojson missing, skipping.")
            continue
        with open(outfile, "r", encoding="utf-8") as f:
            data = json.load(f)
        feats = data.get("features", [])
        print(f"  {name}: {len(feats)} features")
        all_features.extend(feats)
    
    merged = {
        "type": "FeatureCollection",
        "features": all_features
    }
    
    output_file = "somaliland_buildings.geojson"
    with open(output_file, "w", encoding="utf-8") as f:
        json.dump(merged, f)
    
    print(f"\nMerge complete! Total buildings: {len(all_features)}")
    print(f"Written to: {output_file}")
    return len(all_features)

# --- Main ---
print("=" * 60)
print("Downloading Somaliland buildings in regional chunks...")
print("=" * 60)

for lng_min, lat_min, lng_max, lat_max, name in CHUNKS:
    download_chunk(lng_min, lat_min, lng_max, lat_max, name)

total = merge_chunks()
print(f"\nDone! {total} buildings ready to import. Now run: python import_geojson.py")
