'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { MapPin, Lock, User, Loader2, Eye, EyeOff } from 'lucide-react';
import { adminApi } from '@/lib/api';

export default function AdminLoginPage() {
    const router = useRouter();
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [showPw, setShowPw] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!username || !password) return;

        setLoading(true);
        setError('');

        try {
            const { token } = await adminApi.login(username, password);
            localStorage.setItem('berbera_admin_token', token);
            localStorage.setItem('berbera_admin_user', username);
            router.push('/admin/dashboard');
        } catch (err: any) {
            setError(err.message || 'Login failed');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div
            className="min-h-screen flex items-center justify-center p-4"
            style={{
                background: 'radial-gradient(ellipse at 30% 30%, rgba(29,78,216,0.15) 0%, transparent 60%), radial-gradient(ellipse at 80% 80%, rgba(8,145,178,0.1) 0%, transparent 50%), var(--bg)',
            }}
        >
            {/* Animated background orbs */}
            <div
                style={{
                    position: 'fixed', inset: 0, pointerEvents: 'none', overflow: 'hidden', zIndex: 0,
                }}
            >
                {[...Array(3)].map((_, i) => (
                    <div
                        key={i}
                        style={{
                            position: 'absolute',
                            borderRadius: '50%',
                            background: `radial-gradient(circle, rgba(${i === 0 ? '29,78,216' : i === 1 ? '8,145,178' : '99,102,241'},0.12) 0%, transparent 70%)`,
                            width: `${300 + i * 100}px`,
                            height: `${300 + i * 100}px`,
                            top: `${[10, 60, 30][i]}%`,
                            left: `${[70, 10, 50][i]}%`,
                            animation: `pulse ${4 + i}s ease-in-out infinite alternate`,
                        }}
                    />
                ))}
            </div>

            <div className="glass rounded-3xl p-8 w-full max-w-md relative z-10 animate-fade-in">
                {/* Logo */}
                <div className="flex flex-col items-center mb-8">
                    <div
                        className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
                        style={{
                            background: 'linear-gradient(135deg, #1d4ed8, #0891b2)',
                            boxShadow: '0 8px 32px rgba(29,78,216,0.4)',
                        }}
                    >
                        <MapPin className="w-8 h-8 text-white" />
                    </div>
                    <h1 className="text-2xl font-black mb-1" style={{ color: 'var(--text-primary)' }}>
                        Berbera Admin
                    </h1>
                    <p className="text-sm text-center" style={{ color: 'var(--text-secondary)' }}>
                        Smart House Numbering System
                    </p>
                </div>

                {/* Form */}
                <form onSubmit={handleLogin} className="space-y-4">
                    <div>
                        <label className="text-xs font-semibold uppercase tracking-wider mb-2 block" style={{ color: 'var(--text-secondary)' }}>
                            Username
                        </label>
                        <div className="relative">
                            <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-secondary)' }} />
                            <input
                                type="text"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                className="input-field pl-10"
                                placeholder="admin"
                                autoComplete="username"
                                required
                            />
                        </div>
                    </div>

                    <div>
                        <label className="text-xs font-semibold uppercase tracking-wider mb-2 block" style={{ color: 'var(--text-secondary)' }}>
                            Password
                        </label>
                        <div className="relative">
                            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-secondary)' }} />
                            <input
                                type={showPw ? 'text' : 'password'}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="input-field pl-10 pr-10"
                                placeholder="••••••••"
                                autoComplete="current-password"
                                required
                            />
                            <button
                                type="button"
                                onClick={() => setShowPw((p) => !p)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 hover:opacity-70 transition-opacity"
                            >
                                {showPw ? (
                                    <EyeOff className="w-4 h-4" style={{ color: 'var(--text-secondary)' }} />
                                ) : (
                                    <Eye className="w-4 h-4" style={{ color: 'var(--text-secondary)' }} />
                                )}
                            </button>
                        </div>
                    </div>

                    {error && (
                        <div
                            className="px-4 py-3 rounded-xl text-sm animate-fade-in"
                            style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444' }}
                        >
                            {error}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={loading || !username || !password}
                        className="w-full py-3 rounded-xl font-bold text-sm text-white transition-all duration-200 hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-2"
                        style={{
                            background: 'linear-gradient(135deg, #1d4ed8, #0891b2)',
                            boxShadow: '0 4px 20px rgba(29,78,216,0.35)',
                        }}
                    >
                        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
                        {loading ? 'Signing in…' : 'Sign In'}
                    </button>
                </form>

                <p className="text-center mt-4 text-xs" style={{ color: 'var(--text-secondary)' }}>
                    <a href="/" className="hover:underline">← Back to Map</a>
                </p>
            </div>
        </div>
    );
}
