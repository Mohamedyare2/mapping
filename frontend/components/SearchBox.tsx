'use client';

import { useState, useRef, useEffect } from 'react';
import { Search, X, Loader2 } from 'lucide-react';
import { searchApi, Building } from '@/lib/api';

interface SearchBoxProps {
    onResult: (building: Building) => void;
    onClear: () => void;
}

export default function SearchBox({ onResult, onClear }: SearchBoxProps) {
    const [query, setQuery] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);

    const handleSearch = async (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!query.trim()) return;

        setLoading(true);
        setError('');

        try {
            const building = await searchApi.byNumber(query.trim());
            onResult(building);
        } catch (err: any) {
            setError(err.message || 'Building not found');
        } finally {
            setLoading(false);
        }
    };

    const handleClear = () => {
        setQuery('');
        setError('');
        onClear();
        inputRef.current?.focus();
    };

    // Search on Enter key
    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') handleSearch();
    };

    return (
        <div className="animate-fade-in" style={{ position: 'relative' }}>
            <form onSubmit={handleSearch} className="flex items-center gap-2">
                <div
                    className="glass flex items-center gap-2 px-3 py-2 rounded-2xl flex-1 transition-all duration-200"
                    style={{
                        minWidth: '220px',
                        boxShadow: error ? '0 0 0 2px rgba(239,68,68,0.4)' : undefined,
                    }}
                >
                    <Search className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--text-secondary)' }} />
                    <input
                        ref={inputRef}
                        type="number"
                        inputMode="numeric"
                        placeholder="Search building #..."
                        value={query}
                        onChange={(e) => { setQuery(e.target.value); setError(''); }}
                        onKeyDown={handleKeyDown}
                        className="bg-transparent outline-none text-sm font-medium flex-1 min-w-0"
                        style={{ color: 'var(--text-primary)' }}
                        min={1}
                    />
                    {query && (
                        <button type="button" onClick={handleClear} className="flex-shrink-0 hover:opacity-70 transition-opacity">
                            <X className="w-3.5 h-3.5" style={{ color: 'var(--text-secondary)' }} />
                        </button>
                    )}
                </div>

                <button
                    type="submit"
                    disabled={!query.trim() || loading}
                    className="btn-primary px-4 py-2.5 rounded-2xl disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Go'}
                </button>
            </form>

            {/* Error tooltip */}
            {error && (
                <div
                    className="absolute top-full mt-2 left-0 right-0 px-3 py-2 rounded-xl text-xs font-medium animate-fade-in"
                    style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444' }}
                >
                    {error}
                </div>
            )}
        </div>
    );
}
