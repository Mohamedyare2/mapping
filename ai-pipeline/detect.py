#!/usr/bin/env python3
"""
Somaliland Smart House Numbering System — AI Building Detection Pipeline
========================================================================
Uses YOLOv8 segmentation to detect buildings from satellite imagery,
extracts center points, assigns sequential numbers, and inserts into Supabase.

Supported Cities:
  berbera, burao, hargeisa, borama, erigavo, las_anod, gabiley

Usage:
  python detect.py                        # process ALL cities
  python detect.py --city hargeisa        # process one city
  python detect.py --city all --zoom 16   # explicit all
  python detect.py --zoom 16 --batch-size 32

Requirements:
  pip install -r requirements.txt
  Copy .env.example to .env and fill in SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
"""

import os
import sys
import time
import math
import logging
import argparse
from pathlib import Path
from typing import List, Tuple, Dict, Any

import cv2
import numpy as np
from PIL import Image
import mercantile
import requests
from tqdm import tqdm
from dotenv import load_dotenv
from supabase import create_client, Client

# ─── Load env ────────────────────────────────────────────────
load_dotenv()

# ─── City bounding boxes ─────────────────────────────────────
# Format: (longitude_min, latitude_min, longitude_max, latitude_max)
# All cities are within Somaliland boundaries.
CITY_BBOXES: Dict[str, Tuple[float, float, float, float]] = {
    "berbera":  (44.90,  10.30,  45.10,  10.55),
    "burao":    (45.38,   9.37,  45.70,   9.69),
    "hargeisa": (43.95,   9.47,  44.17,   9.67),
    "borama":   (43.02,   9.78,  43.34,  10.10),
    "erigavo":  (47.21,  10.46,  47.53,  10.78),
    "las_anod": (47.32,   8.43,  47.40,   8.52),
    "gabiley":  (43.50,   9.60,  43.75,   9.82),
}

# Tile server — Esri World Imagery (free, no API key required)
# For higher resolution you can switch to Mapbox satellite:
# TILE_URL = "https://api.mapbox.com/v4/mapbox.satellite/{z}/{x}/{y}.jpg?access_token=YOUR_TOKEN"
TILE_URL = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"

TILE_SIZE       = 256     # pixels
IOU_THRESHOLD   = 0.35    # dedup
CONF_THRESHOLD  = 0.25    # YOLOv8 confidence
TILE_DIR        = Path("tiles")
MODEL_PATH      = "yolov8n-seg.pt"   # auto-downloaded on first run

# ─── Logging ─────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler("detection.log"),
    ],
)
logger = logging.getLogger(__name__)

# ─── Supabase client ─────────────────────────────────────────
def get_supabase() -> Client:
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        raise RuntimeError(
            "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. "
            "Copy .env.example to .env and fill in your credentials."
        )
    return create_client(url, key)


# ─── Tile utilities ───────────────────────────────────────────
def get_tiles(bbox: Tuple[float, float, float, float], zoom: int) -> List[mercantile.Tile]:
    """Return all tiles covering the bounding box at given zoom level."""
    lng_min, lat_min, lng_max, lat_max = bbox
    tiles = list(mercantile.tiles(lng_min, lat_min, lng_max, lat_max, zooms=zoom))
    logger.info(f"Zoom {zoom}: {len(tiles)} tiles to process")
    return tiles


def download_tile(tile: mercantile.Tile, session: requests.Session) -> np.ndarray | None:
    """Download a single map tile and return as OpenCV BGR image."""
    url  = TILE_URL.format(z=tile.z, x=tile.x, y=tile.y)
    path = TILE_DIR / f"{tile.z}_{tile.x}_{tile.y}.png"

    if path.exists():
        img = cv2.imread(str(path))
        return img

    try:
        resp = session.get(url, timeout=15)
        resp.raise_for_status()
    except Exception as e:
        logger.warning(f"Failed to download tile {tile}: {e}")
        return None

    img_array = np.frombuffer(resp.content, np.uint8)
    img       = cv2.imdecode(img_array, cv2.IMREAD_COLOR)
    if img is not None:
        path.parent.mkdir(parents=True, exist_ok=True)
        cv2.imwrite(str(path), img)
    return img


def tile_pixel_to_latlon(
    tile: mercantile.Tile, px: float, py: float
) -> Tuple[float, float]:
    """Convert pixel coordinates within a tile to lat/lon."""
    n        = 2 ** tile.z
    tile_lng = (tile.x + px / TILE_SIZE) / n * 360.0 - 180.0
    lat_rad  = math.atan(math.sinh(math.pi * (1 - 2 * (tile.y + py / TILE_SIZE) / n)))
    tile_lat = math.degrees(lat_rad)
    return tile_lat, tile_lng


# ─── Building detection ───────────────────────────────────────
def detect_buildings_yolov8(
    image: np.ndarray,
    model: Any,
    conf_threshold: float = CONF_THRESHOLD,
) -> List[Tuple[float, float, np.ndarray]]:
    """
    Run YOLOv8 segmentation on an image.
    Returns list of (center_x_pixel, center_y_pixel, mask_array).
    Falls back to contour-based detection if YOLO finds nothing.
    """
    results = model.predict(
        image,
        conf=conf_threshold,
        classes=None,
        verbose=False,
        imgsz=TILE_SIZE,
    )

    detections = []
    for result in results:
        if result.masks is None:
            continue
        for mask_tensor in result.masks.data:
            mask = mask_tensor.cpu().numpy()
            mask = cv2.resize(mask.astype(np.uint8), (image.shape[1], image.shape[0]))
            moments = cv2.moments(mask)
            if moments["m00"] == 0:
                continue
            cx = moments["m10"] / moments["m00"]
            cy = moments["m01"] / moments["m00"]
            detections.append((cx, cy, mask))

    if not detections:
        detections = fallback_detect(image)

    return detections


def fallback_detect(image: np.ndarray) -> List[Tuple[float, float, np.ndarray]]:
    """
    Simple fallback: edge detection + morphological ops to find rectangular shapes.
    """
    gray     = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    blurred  = cv2.GaussianBlur(gray, (5, 5), 0)
    edges    = cv2.Canny(blurred, 50, 150)
    dilated  = cv2.dilate(edges, np.ones((3, 3)), iterations=2)
    contours, _ = cv2.findContours(dilated, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    detections = []
    h, w       = image.shape[:2]
    min_area   = (w * h) * 0.001
    max_area   = (w * h) * 0.4

    for cnt in contours:
        area = cv2.contourArea(cnt)
        if area < min_area or area > max_area:
            continue
        M = cv2.moments(cnt)
        if M["m00"] == 0:
            continue
        cx = M["m10"] / M["m00"]
        cy = M["m01"] / M["m00"]
        mask = np.zeros((h, w), dtype=np.uint8)
        cv2.drawContours(mask, [cnt], -1, 1, -1)
        detections.append((cx, cy, mask))

    return detections


def deduplicate(
    points: List[Tuple[float, float]],
    threshold_meters: float = 15.0,
) -> List[Tuple[float, float]]:
    """Remove GPS-space duplicates closer than threshold_meters."""
    if not points:
        return []

    def dist_m(a: Tuple[float, float], b: Tuple[float, float]) -> float:
        R = 6371000
        dlat = math.radians(b[0] - a[0])
        dlng = math.radians(b[1] - a[1])
        x = (math.sin(dlat / 2) ** 2 +
             math.cos(math.radians(a[0])) * math.cos(math.radians(b[0])) *
             math.sin(dlng / 2) ** 2)
        return R * 2 * math.atan2(math.sqrt(x), math.sqrt(1 - x))

    kept = [points[0]]
    for pt in points[1:]:
        if all(dist_m(pt, k) > threshold_meters for k in kept):
            kept.append(pt)
    return kept


# ─── Database ─────────────────────────────────────────────────
def get_next_number(supabase: Client) -> int:
    """Return max(number) + 1, or 1 if table is empty."""
    try:
        res = (
            supabase.table("buildings")
            .select("number")
            .order("number", desc=True)
            .limit(1)
            .execute()
        )
        if res.data:
            return res.data[0]["number"] + 1
    except Exception as e:
        logger.warning(f"Could not get max number: {e}")
    return 1


def batch_insert(supabase: Client, rows: List[Dict], start_number: int) -> int:
    """Insert buildings in chunks of 500. Returns count inserted."""
    CHUNK = 500
    inserted = 0
    for i in range(0, len(rows), CHUNK):
        chunk = rows[i : i + CHUNK]
        try:
            supabase.table("buildings").upsert(chunk, on_conflict="number").execute()
            inserted += len(chunk)
        except Exception as e:
            logger.error(f"Insert error at chunk {i}: {e}")
    return inserted


# ─── Per-city pipeline ────────────────────────────────────────
def run_city(city_name: str, bbox: Tuple[float, float, float, float], model: Any, zoom: int) -> int:
    """
    Detect buildings for a single city and insert into Supabase.
    Returns the count of buildings inserted.
    """
    logger.info("-" * 60)
    logger.info(f"[City] Processing: {city_name.upper()}")
    logger.info(f"   Bounding box: lng({bbox[0]}-{bbox[2]}) lat({bbox[1]}-{bbox[3]})")

    session = requests.Session()
    session.headers.update({"User-Agent": "SomalilandHouseNumberingBot/2.0"})

    tiles = get_tiles(bbox, zoom)
    all_points: List[Tuple[float, float]] = []

    for tile in tqdm(tiles, desc=f"  {city_name}", unit="tile"):
        img = download_tile(tile, session)
        if img is None:
            continue
        try:
            detections = detect_buildings_yolov8(img, model)
        except Exception as e:
            logger.warning(f"Detection failed on tile {tile}: {e}")
            continue

        for (cx, cy, _mask) in detections:
            lat, lng = tile_pixel_to_latlon(tile, cx, cy)
            # Keep only points within the city bbox
            if bbox[1] <= lat <= bbox[3] and bbox[0] <= lng <= bbox[2]:
                all_points.append((lat, lng))

    logger.info(f"  Raw detections: {len(all_points)}")
    unique_points = deduplicate(all_points, threshold_meters=12.0)
    logger.info(f"  After dedup:    {len(unique_points)} buildings")

    if not unique_points:
        logger.warning(f"  ⚠️  No buildings detected for {city_name}.")
        return 0

    db = get_supabase()
    next_number = get_next_number(db)
    logger.info(f"  Starting number: {next_number}")

    rows = [
        {
            "number":    next_number + i,
            "latitude":  round(lat, 8),
            "longitude": round(lng, 8),
            "city":      city_name,
        }
        for i, (lat, lng) in enumerate(unique_points)
    ]

    inserted = batch_insert(db, rows, next_number)
    logger.info(f"  [OK] Inserted {inserted} buildings (#{next_number}-#{next_number + inserted - 1})")
    return inserted


# ─── Main pipeline ────────────────────────────────────────────
def run_pipeline(city_arg: str = "all", zoom: int = 16, batch_size: int = 32):
    logger.info("=" * 60)
    logger.info("Somaliland Building Detection Pipeline  v2.0")
    logger.info("=" * 60)

    # ── Validate city selection ──
    if city_arg == "all":
        cities_to_run = list(CITY_BBOXES.items())
    elif city_arg in CITY_BBOXES:
        cities_to_run = [(city_arg, CITY_BBOXES[city_arg])]
    else:
        logger.error(
            f"Unknown city: '{city_arg}'. "
            f"Valid options: all, {', '.join(CITY_BBOXES.keys())}"
        )
        sys.exit(1)

    logger.info(f"Cities to process: {[c for c, _ in cities_to_run]}")
    logger.info(f"Zoom level: {zoom}")

    # ── Load model once ──
    try:
        from ultralytics import YOLO
    except ImportError:
        logger.error("ultralytics not installed. Run: pip install ultralytics")
        sys.exit(1)

    logger.info(f"Loading YOLOv8 model: {MODEL_PATH}")
    model = YOLO(MODEL_PATH)

    # ── Process each city ──
    total_inserted = 0
    for city_name, bbox in cities_to_run:
        count = run_city(city_name, bbox, model, zoom)
        total_inserted += count

    logger.info("=" * 60)
    logger.info(f"[DONE] All done! Total buildings inserted: {total_inserted}")
    logger.info("=" * 60)


# ─── Entry point ─────────────────────────────────────────────
if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Somaliland Building Detection Pipeline",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=f"Available cities: all, {', '.join(CITY_BBOXES.keys())}",
    )
    parser.add_argument(
        "--city",
        type=str,
        default="all",
        help="City to process (default: all). E.g. --city hargeisa",
    )
    parser.add_argument(
        "--zoom",
        type=int,
        default=16,
        help="Tile zoom level (default: 16)",
    )
    parser.add_argument(
        "--batch-size",
        type=int,
        default=32,
        help="Processing batch size",
    )
    args = parser.parse_args()

    run_pipeline(city_arg=args.city, zoom=args.zoom, batch_size=args.batch_size)
