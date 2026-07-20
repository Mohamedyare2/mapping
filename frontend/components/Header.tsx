'use client';

import { useTheme } from './ThemeProvider';
import { MapPin, Sun, Moon, Building2 } from 'lucide-react';

interface HeaderProps {
    buildingCount: number;
}

export default function Header({ buildingCount }: HeaderProps) {
    const { theme, toggle } = useTheme();

    return (
        <header className="glass fixed top-0 left-0 right-0 z-[1000] h-14 flex items-center justify-between px-4 md:px-6">
            {/* Logo */}
            <div className="flex items-center gap-3">
                <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{
                        background: 'linear-gradient(135deg, #1d4ed8, #0891b2)',
                        boxShadow: '0 4px 12px rgba(29,78,216,0.4)',
                    }}
                >
                    <MapPin className="w-4 h-4 text-white" />
                </div>
                <div className="hidden sm:block">
                    <h1 className="text-sm font-800 leading-tight" style={{ color: 'var(--text-primary)', fontWeight: 800 }}>
                        Berbera Smart House
                    </h1>
                    <p className="text-[10px] leading-tight" style={{ color: 'var(--text-secondary)' }}>
                        Numbering System
                    </p>
                </div>
            </div>

            {/* Stats */}
            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-xl" style={{ background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)' }}>
                <Building2 className="w-3.5 h-3.5" style={{ color: 'var(--primary)' }} />
                <span className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>
                    {buildingCount.toLocaleString()} Buildings
                </span>
            </div>

            {/* Theme toggle */}
            <button
                onClick={toggle}
                className="w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-200 hover:scale-105"
                style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
                title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            >
                {theme === 'dark' ? (
                    <Sun className="w-4 h-4" style={{ color: '#f59e0b' }} />
                ) : (
                    <Moon className="w-4 h-4" style={{ color: '#6366f1' }} />
                )}
            </button>
        </header>
    );
}
