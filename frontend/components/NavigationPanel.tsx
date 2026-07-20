'use client';

import { X, Navigation, AlertTriangle, Footprints, Car, ChevronRight } from 'lucide-react';
import { NavigationResult } from '@/lib/api';

interface NavigationPanelProps {
    target: number; // building number
    result: NavigationResult | null;
    loading: boolean;
    error: string;
    onClose: () => void;
}

export default function NavigationPanel({
    target,
    result,
    loading,
    error,
    onClose,
}: NavigationPanelProps) {
    return (
        <div
            className="glass animate-slide-up rounded-2xl flex flex-col overflow-hidden"
            style={{ maxHeight: '70vh', width: '300px' }}
        >
            {/* Header */}
            <div
                className="flex items-center justify-between px-4 py-3 flex-shrink-0"
                style={{
                    background: 'linear-gradient(135deg, rgba(29,78,216,0.3), rgba(8,145,178,0.2))',
                    borderBottom: '1px solid var(--border)',
                }}
            >
                <div className="flex items-center gap-2">
                    <Navigation className="w-4 h-4" style={{ color: '#60a5fa' }} />
                    <span className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
                        Navigate → Building {target}
                    </span>
                </div>
                <button onClick={onClose} className="hover:opacity-60 transition-opacity">
                    <X className="w-4 h-4" style={{ color: 'var(--text-secondary)' }} />
                </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {loading && (
                    <div className="flex items-center justify-center py-8">
                        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                    </div>
                )}

                {error && (
                    <div
                        className="flex items-center gap-2 p-3 rounded-xl"
                        style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444' }}
                    >
                        <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                        <span className="text-sm">{error}</span>
                    </div>
                )}

                {result && (
                    <>
                        {/* Summary row */}
                        <div className="grid grid-cols-2 gap-2">
                            <div
                                className="rounded-xl p-3 text-center"
                                style={{ background: 'rgba(16,185,129,0.05)', border: '1px solid rgba(16,185,129,0.15)' }}
                            >
                                <Footprints className="w-4 h-4 mx-auto mb-1" style={{ color: '#10b981' }} />
                                <div className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
                                    {result.walkingTime}
                                </div>
                                <div className="text-[10px]" style={{ color: 'var(--text-secondary)' }}>Walking</div>
                            </div>
                            <div
                                className="rounded-xl p-3 text-center"
                                style={{ background: 'rgba(245,158,11,0.05)', border: '1px solid rgba(245,158,11,0.15)' }}
                            >
                                <Car className="w-4 h-4 mx-auto mb-1" style={{ color: '#f59e0b' }} />
                                <div className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
                                    {result.drivingTime}
                                </div>
                                <div className="text-[10px]" style={{ color: 'var(--text-secondary)' }}>Driving</div>
                            </div>
                        </div>

                        {/* Distance */}
                        <div
                            className="flex items-center justify-between px-3 py-2 rounded-xl"
                            style={{ background: 'rgba(59,130,246,0.05)', border: '1px solid rgba(59,130,246,0.1)' }}
                        >
                            <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
                                Total Distance
                            </span>
                            <span className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
                                {result.distance}
                            </span>
                        </div>

                        {/* Turn-by-turn steps */}
                        <div>
                            <p className="text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-secondary)' }}>
                                Turn-by-Turn Directions
                            </p>
                            <div className="space-y-1">
                                {result.steps.map((step, i) => (
                                    <div
                                        key={i}
                                        className="flex items-start gap-2 p-2.5 rounded-xl transition-colors duration-150"
                                        style={{ background: i % 2 === 0 ? 'rgba(59,130,246,0.04)' : 'transparent' }}
                                    >
                                        <div
                                            className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                                            style={{ background: 'rgba(59,130,246,0.15)', color: '#3b82f6', fontSize: '10px', fontWeight: 700 }}
                                        >
                                            {i + 1}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-xs font-medium leading-snug" style={{ color: 'var(--text-primary)' }}>
                                                {step.instruction}
                                            </p>
                                            <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                                                {step.distance} · {step.duration}
                                            </p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
