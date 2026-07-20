import json
import os
import math
from dotenv import load_dotenv
from supabase import create_client

# We also have shapely installed from overturemaps
from shapely.geometry import shape

load_dotenv()

supabase_url = os.environ.get("SUPABASE_URL")
supabase_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
supabase = create_client(supabase_url, supabase_key)

print("Reading Awdal chunk...")
with open("chunks/awdal.geojson", "r", encoding="utf-8") as f:
    geojson = json.load(f)
    
features = geojson.get("features", [])
print(f"Loaded {len(features)} buildings from Google/Overture Maps.")

print("Wiping old buildings...")
# Delete all buildings to prevent duplicates or messy data
# This handles Supabase limit by looping if necessary
while True:
    res = supabase.table("buildings").select("id").limit(1000).execute()
    if not res.data:
        break
    ids = [r["id"] for r in res.data]
    supabase.table("buildings").delete().in_("id", ids).execute()

print("Old buildings wiped. Preparing new inserts...")
rows = []
number = 1

for feat in features:
    geom = shape(feat["geometry"])
    center = geom.centroid
    
    rows.append({
        "number": number,
        "longitude": round(center.x, 8),
        "latitude": round(center.y, 8)
    })
    number += 1

print(f"Inserting {len(rows)} buildings...")
CHUNK = 500
for i in range(0, len(rows), CHUNK):
    chunk = rows[i:i+CHUNK]
    supabase.table("buildings").insert(chunk).execute()
    if i % 2500 == 0:
        print(f"Inserted {i} / {len(rows)}...")

print("Successfully inserted all buildings!")
