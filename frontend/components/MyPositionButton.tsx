'use client';

import { useState } from 'react';
import { Crosshair, Loader2, MapPin, Clock, Car, Footprints, X } from 'lucide-react';
import { locationApi, navigationApi, Building, NearestResult } from '@/lib/api';

interface MyPositionButtonProps {
    onFind: (lat: number, lng: number) => void;
    onNavigateTo: (building: Building, userLat: number, userLng: number) => void;
}

export default function MyPositionButton({ onFind, onNavigateTo }: MyPositionButtonProps) {
    const [loading, setLoading] = useState(false);
    const [nearest, setNearest] = useState<NearestResult | null>(null);
    const [userPos, setUserPos] = useState<{ lat: number; lng: number } | null>(null);
    const [error, setError] = useState('');
    const [showPanel, setShowPanel] = useState(false);

    const handleClick = async () => {
        if (!navigator.geolocation) {
            setError('Geolocation is not supported by your browser');
            return;
        }

        setLoading(true);
        setError('');

        navigator.geolocation.getCurrentPosition(
            async (pos) => {
                try {
                    const { latitude, longitude } = pos.coords;
                    setUserPos({ lat: latitude, lng: longitude });
                    onFind(latitude, longitude);

                    const result = await locationApi.nearest(latitude, longitude);
                    setNearest(result);
                    setShowPanel(true);
                } catch (err: any) {
                    setError(err.message || 'Could not find nearest building');
                } finally {
                    setLoading(false);
                }
            },
            (err) => {
                setLoading(false);
                switch (err.code) {
                    case err.PERMISSION_DENIED:
                        setError('Location access denied. Please allow GPS access.');
                        break;
                    case err.POSITION_UNAVAILABLE:
                        setError('Location unavailable. Please check your GPS.');
                        break;
                    default:
                        setError('Could not get your location. Please try again.');
                }
            },
            { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 }
        );
    };

    const handleNavigate = () => {
        if (!nearest || !userPos) return;
        onNavigateTo(nearest.building, userPos.lat, userPos.lng);
        setShowPanel(false);
    };

    return (
        <>
            {/* Floating button */}
            <button
                onClick={handleClick}
                disabled={loading}
                className="animate-fade-in flex items-center gap-2 px-4 py-2.5 rounded-2xl font-semibold text-sm transition-all duration-200 disabled:opacity-60"
                style={{
                    background: 'linear-gradient(135deg, #059669, #0891b2)',
                    color: '#fff',
                    boxShadow: '0 4px 20px rgba(5,150,105,0.4)',
                    border: 'none',
                }}
                title="Find my position & nearest building"
            >
                {loading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                    <Crosshair className="w-4 h-4" />
                )}
                <span className="hidden sm:inline">My Position</span>
            </button>

            {/* Error */}
            {error && (
                <div
                    className="absolute bottom-full right-0 mb-2 px-3 py-2 rounded-xl text-xs font-medium animate-fade-in whitespace-nowrap"
                    style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444' }}
                >
                    {error}
                </div>
            )}

            {/* Nearest building panel */}
            {showPanel && nearest && (
                <div
                    className="glass animate-slide-up rounded-2xl p-4 absolute bottom-full right-0 mb-3 z-50"
                    style={{ minWidth: '250px', maxWidth: '300px' }}
                >
                    <div className="flex items-start justify-between mb-3">
                        <div>
                            <p className="text-xs font-medium mb-0.5" style={{ color: 'var(--text-secondary)' }}>
                                📍 {nearest.message}
                            </p>
                            <div
                                className="text-3xl font-black"
                                style={{
                                    background: 'linear-gradient(135deg, #1d4ed8, #0891b2)',
                                    WebkitBackgroundClip: 'text',
                                    WebkitTextFillColor: 'transparent',
                                    backgroundClip: 'text',
                                }}
                            >
                                {nearest.building.number}
                            </div>
                        </div>
                        <button onClick={() => setShowPanel(false)} className="hover:opacity-60 transition-opacity">
                            <X className="w-4 h-4" style={{ color: 'var(--text-secondary)' }} />
                        </button>
                    </div>

                    {/* Distance info */}
                    <div className="grid grid-cols-3 gap-2 mb-3">
                        <div
                            className="rounded-xl p-2 text-center"
                            style={{ background: 'rgba(59,130,246,0.05)', border: '1px solid rgba(59,130,246,0.1)' }}
                        >
                            <MapPin className="w-3 h-3 mx-auto mb-1" style={{ color: '#3b82f6' }} />
                            <div className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>
                                {nearest.distance}
                            </div>
                            <div className="text-[10px]" style={{ color: 'var(--text-secondary)' }}>Distance</div>
                        </div>
                        <div
                            className="rounded-xl p-2 text-center"
                            style={{ background: 'rgba(16,185,129,0.05)', border: '1px solid rgba(16,185,129,0.1)' }}
                        >
                            <Footprints className="w-3 h-3 mx-auto mb-1" style={{ color: '#10b981' }} />
                            <div className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>
                                {nearest.walkingTime}
                            </div>
                            <div className="text-[10px]" style={{ color: 'var(--text-secondary)' }}>Walk</div>
                        </div>
                        <div
                            className="rounded-xl p-2 text-center"
                            style={{ background: 'rgba(245,158,11,0.05)', border: '1px solid rgba(245,158,11,0.1)' }}
                        >
                            <Car className="w-3 h-3 mx-auto mb-1" style={{ color: '#f59e0b' }} />
                            <div className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>
                                {nearest.drivingTime}
                            </div>
                            <div className="text-[10px]" style={{ color: 'var(--text-secondary)' }}>Drive</div>
                        </div>
                    </div>

                    <button
                        onClick={handleNavigate}
                        className="w-full py-2 rounded-xl text-sm font-semibold text-white transition-all duration-200 hover:opacity-90"
                        style={{
                            background: 'linear-gradient(135deg, #1d4ed8, #0891b2)',
                            boxShadow: '0 4px 12px rgba(29,78,216,0.3)',
                        }}
                    >
                        Navigate Here
                    </button>
                </div>
            )}
        </>
    );
}
