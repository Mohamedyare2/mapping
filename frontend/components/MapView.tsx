'use client';

/**
 * MapView — Leaflet interactive map with:
 * - Building number markers (DivIcon labels)
 * - Marker clustering (react-leaflet-cluster)
 * - Highlighted / searched building
 * - User GPS position marker
 * - Route polyline overlay
 * - Popup integration
 *
 * NOTE: This component is dynamically imported (no SSR) because Leaflet
 *       requires a browser DOM environment.
 */

import { useEffect, useRef, useCallback } from 'react';
import { Building, NavigationResult } from '@/lib/api';

interface MapViewProps {
    buildings: Building[];
    highlightedBuilding: Building | null;
    userPosition: { lat: number; lng: number } | null;
    navigationResult: NavigationResult | null;
    onBuildingClick: (building: Building) => void;
    onMapMove: (bounds: {
        minLat: number; maxLat: number;
        minLng: number; maxLng: number;
    }) => void;
}

// ─── Somaliland center (Hargeisa capital) ────────────────────────────────
const BERBERA_CENTER: [number, number] = [9.56, 44.06]; // Hargeisa
const BERBERA_ZOOM = 7; // Country-level view

export default function MapView({
    buildings,
    highlightedBuilding,
    userPosition,
    navigationResult,
    onBuildingClick,
    onMapMove,
}: MapViewProps) {
    const mapRef = useRef<any>(null);
    const markersRef = useRef<Map<number, any>>(new Map());
    const clusterRef = useRef<any>(null);
    const routeLineRef = useRef<any>(null);
    const userMarkerRef = useRef<any>(null);
    const mapDivRef = useRef<HTMLDivElement>(null);

    // ─── Initialize map ─────────────────────────────────────────
    useEffect(() => {
        if (mapRef.current || !mapDivRef.current) return;

        // Lazy-load Leaflet and plugins in browser only
        (async () => {
            const L = (await import('leaflet')).default;
            await import('leaflet.markercluster');

            // Fix default icon path for Next.js
            delete (L.Icon.Default.prototype as any)._getIconUrl;
            L.Icon.Default.mergeOptions({
                iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
                iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
                shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
            });

            const SomalilandBounds = [
                [7.9, 42.5], // SouthWest corner
                [11.5, 49.0] // NorthEast corner
            ];

            const map = L.map(mapDivRef.current!, {
                center: BERBERA_CENTER,
                zoom: BERBERA_ZOOM,
                zoomControl: false,
                attributionControl: false,
                maxBounds: SomalilandBounds as any,
                maxBoundsViscosity: 1.0,
                minZoom: 6,
            });

            // Dynamic Tile layer: Hybrid (with city/village labels) at low zoom, 
            // Pure Satellite (no text) at high zoom to avoid cluttering building numbers.
            const initialZoom = map.getZoom();
            const getTileUrl = (z: number) => z >= 14
                ? 'https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}' // Pure Satellite
                : 'https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}'; // Satellite + Labels (Cities & Villages)

            const tileLayer = L.tileLayer(getTileUrl(initialZoom), {
                maxZoom: 20,
                attribution: 'Map data &copy; Google',
            }).addTo(map);

            map.on('zoomend', () => {
                tileLayer.setUrl(getTileUrl(map.getZoom()));
            });

            // Attribution (bottom-right, minimal)
            L.control.attribution({ position: 'bottomright', prefix: false }).addTo(map);

            // Zoom control (bottom-right)
            L.control.zoom({ position: 'bottomright' }).addTo(map);

            // Marker cluster group
            const cluster = (L as any).markerClusterGroup({
                chunkedLoading: true,
                maxClusterRadius: 50,
                disableClusteringAtZoom: 16,
                spiderfyOnMaxZoom: false,
                showCoverageOnHover: false,
                iconCreateFunction: (c: any) => {
                    const count = c.getChildCount();
                    const size = count > 1000 ? 44 : count > 100 ? 38 : 32;
                    return L.divIcon({
                        html: `<div style="
              width:${size}px;height:${size}px;
              background:linear-gradient(135deg,#1d4ed8,#0891b2);
              border-radius:50%;
              display:flex;align-items:center;justify-content:center;
              color:#fff;font-weight:800;font-size:${count > 999 ? 9 : count > 99 ? 10 : 12}px;
              font-family:Outfit,sans-serif;
              box-shadow:0 4px 14px rgba(29,78,216,0.5);
              border:2px solid rgba(255,255,255,0.3);
            ">${count > 9999 ? '10k+' : count}</div>`,
                        className: '',
                        iconSize: [size, size],
                        iconAnchor: [size / 2, size / 2],
                    });
                },
            });

            map.addLayer(cluster);
            mapRef.current = map;
            clusterRef.current = cluster;

            // Emit bounds on move
            const emitBounds = () => {
                const b = map.getBounds();
                onMapMove({
                    minLat: b.getSouth(),
                    maxLat: b.getNorth(),
                    minLng: b.getWest(),
                    maxLng: b.getEast(),
                });
            };
            map.on('moveend zoomend', emitBounds);
            emitBounds();
        })();

        return () => {
            if (mapRef.current) {
                mapRef.current.remove();
                mapRef.current = null;
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // ─── Update markers when buildings change ───────────────────
    useEffect(() => {
        if (!mapRef.current || !clusterRef.current) return;

        (async () => {
            const L = (await import('leaflet')).default;
            const map = mapRef.current;
            const cluster = clusterRef.current;
            const prevIds = new Set(markersRef.current.keys());
            const newIds = new Set(buildings.map((b) => b.id));

            // Remove stale markers
            prevIds.forEach((id) => {
                if (!newIds.has(id)) {
                    const m = markersRef.current.get(id)!;
                    cluster.removeLayer(m);
                    markersRef.current.delete(id);
                }
            });

            // Add new markers
            const toAdd: any[] = [];
            buildings.forEach((building) => {
                if (markersRef.current.has(building.id)) return;

                const isHighlighted = highlightedBuilding?.id === building.id;
                const marker = L.marker([building.latitude, building.longitude], {
                    icon: buildingIcon(L, building.number, isHighlighted),
                });

                marker.on('click', () => onBuildingClick(building));
                markersRef.current.set(building.id, marker);
                toAdd.push(marker);
            });

            if (toAdd.length > 0) cluster.addLayers(toAdd);
        })();
    }, [buildings, highlightedBuilding, onBuildingClick]);

    // ─── Highlight building (zoom + update icon) ──────────────
    useEffect(() => {
        if (!mapRef.current || !highlightedBuilding) return;

        (async () => {
            const L = (await import('leaflet')).default;
            const map = mapRef.current;

            // Reset all icons
            markersRef.current.forEach((marker, id) => {
                const b = buildings.find((b) => b.id === id);
                if (!b) return;
                marker.setIcon(buildingIcon(L, b.number, false));
            });

            // Update highlighted
            const marker = markersRef.current.get(highlightedBuilding.id);
            if (marker) {
                marker.setIcon(buildingIcon(L, highlightedBuilding.number, true));
                map.flyTo([highlightedBuilding.latitude, highlightedBuilding.longitude], 17, {
                    duration: 1.5,
                    easeLinearity: 0.2,
                });
            }
        })();
    }, [highlightedBuilding, buildings]);

    // ─── User position marker ──────────────────────────────────
    useEffect(() => {
        if (!mapRef.current || !userPosition) return;

        (async () => {
            const L = (await import('leaflet')).default;
            const map = mapRef.current;

            if (userMarkerRef.current) {
                userMarkerRef.current.remove();
            }

            const icon = L.divIcon({
                html: `<div style="
          width:18px;height:18px;
          background:#3b82f6;border-radius:50%;
          border:3px solid #fff;
          box-shadow:0 0 0 6px rgba(59,130,246,0.25),0 4px 12px rgba(59,130,246,0.5);
          position:relative;
        "></div>`,
                className: 'gps-pulse',
                iconSize: [18, 18],
                iconAnchor: [9, 9],
            });

            userMarkerRef.current = L.marker([userPosition.lat, userPosition.lng], { icon })
                .bindTooltip('You are here', { permanent: false, direction: 'top' })
                .addTo(map);

            map.flyTo([userPosition.lat, userPosition.lng], 16, { duration: 1.2 });
        })();
    }, [userPosition]);

    // ─── Draw navigation route ─────────────────────────────────
    useEffect(() => {
        if (!mapRef.current) return;

        (async () => {
            const L = (await import('leaflet')).default;
            const map = mapRef.current;

            if (routeLineRef.current) {
                routeLineRef.current.remove();
                routeLineRef.current = null;
            }

            if (!navigationResult?.geometry) return;

            const coords = navigationResult.geometry.coordinates.map(
                (coord: any) => [coord[1], coord[0]] as [number, number]
            );

            routeLineRef.current = L.polyline(coords, {
                color: '#3b82f6',
                weight: 4,
                opacity: 0.85,
                dashArray: undefined,
                lineCap: 'round',
                lineJoin: 'round',
            }).addTo(map);

            map.fitBounds(routeLineRef.current.getBounds(), { padding: [60, 60] });
        })();
    }, [navigationResult]);

    return (
        <div
            ref={mapDivRef}
            style={{ width: '100%', height: '100%', position: 'absolute', inset: 0 }}
        />
    );
}

// ─── Helper: build DivIcon for a building ─────────────────────
function buildingIcon(L: any, number: number, highlighted: boolean) {
    return L.divIcon({
        html: `<div class="building-label${highlighted ? ' building-label-highlight' : ''}">${number}</div>`,
        className: 'building-marker-container',
        iconSize: [40, 40],
        iconAnchor: [20, 20],
    });
}
