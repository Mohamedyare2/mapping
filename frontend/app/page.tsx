'use client';

import dynamic from 'next/dynamic';
import { useState, useCallback, useRef, useEffect } from 'react';
import Link from 'next/link';
import { Shield, Loader2 } from 'lucide-react';

import Header from '@/components/Header';
import SearchBox from '@/components/SearchBox';
import MyPositionButton from '@/components/MyPositionButton';
import BuildingPopup from '@/components/BuildingPopup';
import NavigationPanel from '@/components/NavigationPanel';

import { buildingsApi, navigationApi, Building, NavigationResult } from '@/lib/api';

// Dynamic import — Leaflet needs browser DOM
const MapView = dynamic(() => import('@/components/MapView'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center" style={{ background: 'var(--bg)' }}>
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: 'var(--primary)' }} />
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Loading map…</p>
      </div>
    </div>
  ),
});

export default function HomePage() {
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [totalBuildings, setTotalBuildings] = useState(0);
  const [highlighted, setHighlighted] = useState<Building | null>(null);
  const [selectedBuilding, setSelectedBuilding] = useState<Building | null>(null);
  const [userPos, setUserPos] = useState<{ lat: number; lng: number } | null>(null);
  const [navResult, setNavResult] = useState<NavigationResult | null>(null);
  const [navLoading, setNavLoading] = useState(false);
  const [navError, setNavError] = useState('');
  const [navTarget, setNavTarget] = useState<Building | null>(null);
  const [showNav, setShowNav] = useState(false);
  const boundsRef = useRef<{ minLat: number; maxLat: number; minLng: number; maxLng: number } | null>(null);
  const fetchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ─── Fetch total count once ────────────────────────────────
  useEffect(() => {
    buildingsApi.list({ page: 1, limit: 1 }).then((r) => setTotalBuildings(r.total)).catch(() => { });
  }, []);

  // ─── Debounced viewport fetch ──────────────────────────────
  const handleMapMove = useCallback((bounds: typeof boundsRef.current) => {
    boundsRef.current = bounds!;
    if (fetchTimer.current) clearTimeout(fetchTimer.current);
    fetchTimer.current = setTimeout(async () => {
      if (!boundsRef.current) return;
      try {
        const res = await buildingsApi.list({ limit: 3000, ...boundsRef.current });
        setBuildings(res.buildings);
        setTotalBuildings(res.total);
      } catch { }
    }, 400);
  }, []);

  // ─── Search result ─────────────────────────────────────────
  const handleSearchResult = useCallback((building: Building) => {
    setHighlighted(building);
    setSelectedBuilding(building);
  }, []);

  // ─── Building click on map ─────────────────────────────────
  const handleBuildingClick = useCallback((building: Building) => {
    setSelectedBuilding(building);
  }, []);

  // ─── Navigate ──────────────────────────────────────────────
  const handleNavigate = useCallback(
    async (building: Building, fromLat?: number, fromLng?: number) => {
      const lat = fromLat ?? userPos?.lat;
      const lng = fromLng ?? userPos?.lng;

      if (!lat || !lng) {
        // Trigger GPS first
        alert('Please click "My Position" first to get your GPS location.');
        return;
      }

      setNavTarget(building);
      setShowNav(true);
      setNavLoading(true);
      setNavError('');
      setNavResult(null);

      try {
        const result = await navigationApi.route({
          fromLat: lat,
          fromLng: lng,
          toLat: building.latitude,
          toLng: building.longitude,
          mode: 'walking',
        });
        setNavResult(result);
      } catch (err: any) {
        setNavError(err.message || 'Could not calculate route');
      } finally {
        setNavLoading(false);
      }
    },
    [userPos]
  );

  return (
    <div style={{ height: '100vh', width: '100vw', overflow: 'hidden', position: 'relative' }}>
      {/* Header */}
      <Header buildingCount={totalBuildings} />

      {/* Map — full screen */}
      <div style={{ position: 'absolute', inset: 0, paddingTop: '56px' }}>
        <MapView
          buildings={buildings}
          highlightedBuilding={highlighted}
          userPosition={userPos}
          navigationResult={navResult}
          onBuildingClick={handleBuildingClick}
          onMapMove={handleMapMove}
        />
      </div>

      {/* Top-left controls bar */}
      <div
        className="absolute z-[999] flex items-start gap-2 flex-wrap"
        style={{ top: '70px', left: '12px', right: '12px', maxWidth: '480px' }}
      >
        <SearchBox
          onResult={handleSearchResult}
          onClear={() => { setHighlighted(null); setSelectedBuilding(null); }}
        />
      </div>

      {/* Bottom-right buttons */}
      <div
        className="absolute z-[999] flex flex-col items-end gap-2"
        style={{ bottom: '80px', right: '12px' }}
      >
        {/* Admin link */}
        <Link
          href="/admin"
          className="flex items-center gap-2 px-3 py-2 rounded-2xl text-xs font-semibold glass transition-all duration-200 hover:scale-105"
          style={{ color: 'var(--text-secondary)', border: '1px solid var(--border)' }}
        >
          <Shield className="w-3.5 h-3.5" />
          Admin
        </Link>

        {/* My Position — relative so dropdown can be relative to it */}
        <div className="relative">
          <MyPositionButton
            onFind={(lat, lng) => setUserPos({ lat, lng })}
            onNavigateTo={(building, fromLat, fromLng) => {
              setUserPos({ lat: fromLat, lng: fromLng });
              handleNavigate(building, fromLat, fromLng);
            }}
          />
        </div>
      </div>

      {/* Building popup (flyout card) */}
      {selectedBuilding && (
        <div
          className="absolute z-[999] animate-slide-up"
          style={{ bottom: '80px', left: '12px', maxWidth: '300px' }}
        >
          <div className="glass rounded-2xl overflow-hidden">
            <BuildingPopup
              building={selectedBuilding}
              onNavigate={(b) => handleNavigate(b)}
              onClose={() => { setSelectedBuilding(null); setHighlighted(null); }}
            />
          </div>
        </div>
      )}

      {/* Navigation panel */}
      {showNav && navTarget && (
        <div
          className="absolute z-[999]"
          style={{ bottom: '80px', right: '12px' }}
        >
          <NavigationPanel
            target={navTarget.number}
            result={navResult}
            loading={navLoading}
            error={navError}
            onClose={() => {
              setShowNav(false);
              setNavResult(null);
              setNavTarget(null);
            }}
          />
        </div>
      )}
    </div>
  );
}
