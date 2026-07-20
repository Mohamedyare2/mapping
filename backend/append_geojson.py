import json
import os
from dotenv import load_dotenv
from supabase import create_client
from shapely.geometry import shape

load_dotenv()

supabase_url = os.environ.get("SUPABASE_URL")
supabase_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
supabase = create_client(supabase_url, supabase_key)

file_path = "berbera_buildings.geojson"
print(f"Reading {file_path}...")
with open(file_path, "r", encoding="utf-8") as f:
    geojson = json.load(f)
    
features = geojson.get("features", [])
print(f"Loaded {len(features)} buildings from {file_path}.")

# Get max number safely so we don't wipe existing DB
response = supabase.table("buildings").select("number").order("number", desc=True).limit(1).execute()
if response.data:
    current_max = response.data[0]["number"]
else:
    current_max = 0

number = current_max + 1
print(f"Found current max number {current_max}. Starting insertion from number {number}...")

rows = []
for feat in features:
    geom = shape(feat["geometry"])
    center = geom.centroid # Extract exact lat/lng point from Google Open Buildings polygon
    
    rows.append({
        "number": number,
        "longitude": round(center.x, 8),
        "latitude": round(center.y, 8)
    })
    number += 1

print(f"Inserting {len(rows)} buildings...")
CHUNK = 1000
for i in range(0, len(rows), CHUNK):
    chunk = rows[i:i+CHUNK]
    # use upsert to cleanly append and avoid errors
    res = supabase.table("buildings").upsert(chunk, on_conflict="number").execute()
    print(f"Inserted up to {i + len(chunk)} / {len(rows)}...")

print("✅ Successfully appended all Berbera buildings!")
