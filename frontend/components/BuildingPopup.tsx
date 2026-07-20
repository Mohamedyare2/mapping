'use client';

import { useState } from 'react';
import { Building } from '@/lib/api';
import { Copy, Navigation, Share2, X, CheckCircle, ExternalLink } from 'lucide-react';

interface BuildingPopupProps {
    building: Building;
    onNavigate: (building: Building) => void;
    onClose: () => void;
}

export default function BuildingPopup({ building, onNavigate, onClose }: BuildingPopupProps) {
    const [copied, setCopied] = useState(false);

    const copyCoords = async () => {
        const text = `${building.latitude}, ${building.longitude}`;
        try {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            // Fallback
            const el = document.createElement('textarea');
            el.value = text;
            document.body.appendChild(el);
            el.select();
            document.execCommand('copy');
            document.body.removeChild(el);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    const shareLocation = async () => {
        const url = `https://www.openstreetmap.org/?mlat=${building.latitude}&mlon=${building.longitude}&zoom=17`;
        const shareData = {
            title: `Building ${building.number} — Berbera`,
            text: `Building ${building.number} is at ${building.latitude.toFixed(6)}, ${building.longitude.toFixed(6)}`,
            url,
        };
        if (navigator.share) {
            await navigator.share(shareData);
        } else {
            window.open(url, '_blank');
        }
    };

    const openInMaps = () => {
        window.open(
            `https://www.google.com/maps/search/?api=1&query=${building.latitude},${building.longitude}`,
            '_blank'
        );
    };

    return (
        <div className="animate-fade-in p-4" style={{ minWidth: '220px', maxWidth: '280px' }}>
            {/* Header */}
            <div className="flex items-start justify-between mb-3">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <div
                            className="w-10 h-10 rounded-xl flex items-center justify-center"
                            style={{
                                background: 'linear-gradient(135deg, #1d4ed8, #0891b2)',
                                boxShadow: '0 4px 12px rgba(29,78,216,0.35)',
                            }}
                        >
                            <span className="text-white font-black text-sm">#</span>
                        </div>
                        <div>
                            <div className="text-2xl font-black" style={{ color: 'var(--text-primary)', lineHeight: 1 }}>
                                {building.number}
                            </div>
                            <div className="text-[10px] font-medium" style={{ color: 'var(--text-secondary)' }}>
                                Building Number
                            </div>
                        </div>
                    </div>
                </div>
                <button onClick={onClose} className="hover:opacity-60 transition-opacity mt-1">
                    <X className="w-4 h-4" style={{ color: 'var(--text-secondary)' }} />
                </button>
            </div>

            {/* Coordinates */}
            <div
                className="rounded-xl p-3 mb-3 space-y-1.5"
                style={{ background: 'rgba(59,130,246,0.05)', border: '1px solid rgba(59,130,246,0.12)' }}
            >
                <div className="flex justify-between items-center">
                    <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>
                        Latitude
                    </span>
                    <span className="text-xs font-mono font-semibold" style={{ color: 'var(--text-primary)' }}>
                        {building.latitude.toFixed(6)}
                    </span>
                </div>
                <div className="flex justify-between items-center">
                    <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>
                        Longitude
                    </span>
                    <span className="text-xs font-mono font-semibold" style={{ color: 'var(--text-primary)' }}>
                        {building.longitude.toFixed(6)}
                    </span>
                </div>
                <div className="flex justify-between items-center pt-1">
                    <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>
                        Added
                    </span>
                    <span className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>
                        {new Date(building.created_at).toLocaleDateString()}
                    </span>
                </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2 flex-wrap">
                <button
                    onClick={copyCoords}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 flex-1 justify-center"
                    style={{
                        background: copied ? 'rgba(16,185,129,0.1)' : 'rgba(59,130,246,0.1)',
                        border: `1px solid ${copied ? 'rgba(16,185,129,0.3)' : 'rgba(59,130,246,0.2)'}`,
                        color: copied ? '#10b981' : '#3b82f6',
                    }}
                >
                    {copied ? <CheckCircle className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    {copied ? 'Copied!' : 'Copy'}
                </button>

                <button
                    onClick={() => onNavigate(building)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 flex-1 justify-center"
                    style={{
                        background: 'linear-gradient(135deg, #1d4ed8, #0891b2)',
                        color: '#fff',
                        boxShadow: '0 2px 8px rgba(29,78,216,0.3)',
                    }}
                >
                    <Navigation className="w-3 h-3" />
                    Navigate
                </button>

                <button
                    onClick={shareLocation}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200"
                    style={{
                        background: 'rgba(99,102,241,0.1)',
                        border: '1px solid rgba(99,102,241,0.2)',
                        color: '#6366f1',
                    }}
                    title="Share Location"
                >
                    <Share2 className="w-3 h-3" />
                </button>

                <button
                    onClick={openInMaps}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200"
                    style={{
                        background: 'rgba(16,185,129,0.1)',
                        border: '1px solid rgba(16,185,129,0.2)',
                        color: '#10b981',
                    }}
                    title="Open in Google Maps"
                >
                    <ExternalLink className="w-3 h-3" />
                </button>
            </div>
        </div>
    );
}
