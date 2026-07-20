import json
import os
import time
from dotenv import load_dotenv
from supabase import create_client
from shapely.geometry import shape

os.makedirs("chunks", exist_ok=True)

load_dotenv()
supabase_url = os.environ.get("SUPABASE_URL")
supabase_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
supabase = create_client(supabase_url, supabase_key)

print("=" * 60)
print("Somaliland-Wide Building Ingestion (Overture Maps)")
print("=" * 60)

# 1. Wipe existing detections to ensure clean sequencing globally
print("\n[WIPING] Wiping all old buildings to ensure clean sequencing...")
while True:
    try:
        res = supabase.table("buildings").select("id").limit(1000).execute()
        if not res.data:
            break
        ids = [r["id"] for r in res.data]
        supabase.table("buildings").delete().in_("id", ids).execute()
        print(f"   Deleted {len(ids)} buildings...", end="\r")
    except Exception as e:
        print(f"\n   [WARN] Error deleting: {e}, retrying...")
        time.sleep(2)
print("\n   [OK] Old buildings wiped globally.")

# 2. Iterate through every downloaded chunk
total_inserted = 0
current_number = 1

geojson_files = [f for f in os.listdir("chunks") if f.endswith(".geojson")]
geojson_files.sort()  # Sort to ensure consistent numbering order

print(f"\n[IMPORT] Found {len(geojson_files)} chunk files to process.")

for chunk_file in geojson_files:
    file_path = os.path.join("chunks", chunk_file)
    print(f"\n[CHUNK] Processing {chunk_file}...")
    
    with open(file_path, "r", encoding="utf-8") as f:
        geojson = json.load(f)
        
    features = geojson.get("features", [])
    if len(features) == 0:
        print("   [SKIP] No buildings found in this chunk.")
        continue
        
    print(f"   Found {len(features)} buildings. Extracting centroids...")
    
    # Extract centroids
    rows = []
    for feat in features:
        try:
            geom = shape(feat["geometry"])
            center = geom.centroid 
            rows.append({
                "number": current_number,
                "latitude": round(center.y, 8),
                "longitude": round(center.x, 8),
                # If city field exists we could populate it, but rural areas have no strict city
                "city": "Somaliland" 
            })
            current_number += 1
        except Exception:
            continue
            
    # Insert in batches
    CHUNK_SIZE = 1000
    for i in range(0, len(rows), CHUNK_SIZE):
        chunk = rows[i:i+CHUNK_SIZE]
        # Allow retry on failure
        for attempt in range(3):
            try:
                supabase.table("buildings").upsert(chunk, on_conflict="number").execute()
                break
            except Exception as e:
                print(f"   [WARN] Upload failed: {e}. Retrying {attempt+1}/3...")
                time.sleep(2)
                
    total_inserted += len(rows)
    print(f"   [DONE] {chunk_file} entirely processed. (Ended at number {current_number-1})")

print("=" * 60)
print(f"[FINISH] ALL DONE! Grand total of {total_inserted} buildings inserted across Somaliland.")
print("=" * 60)
