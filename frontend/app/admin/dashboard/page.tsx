'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
    Search, Plus, Edit3, Trash2, Download, Upload, LogOut,
    MapPin, Loader2, X, Check, AlertTriangle, Building2, ChevronLeft, ChevronRight,
} from 'lucide-react';
import { buildingsApi, adminApi, Building } from '@/lib/api';
import Link from 'next/link';

// ─── Admin Dashboard ──────────────────────────────────────────
export default function AdminDashboard() {
    const router = useRouter();

    // Auth
    const [user, setUser] = useState('');
    const [authOk, setAuthOk] = useState(false);

    // Buildings
    const [buildings, setBuildings] = useState<Building[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [pages, setPages] = useState(1);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');

    // Modals
    const [editBuilding, setEditBuilding] = useState<Building | null>(null);
    const [addMode, setAddMode] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState<Building | null>(null);
    const [importLoading, setImportLoading] = useState(false);
    const [notification, setNotification] = useState('');
    const [notifType, setNotifType] = useState<'success' | 'error'>('success');

    // Form state for add/edit
    const [formLat, setFormLat] = useState('');
    const [formLng, setFormLng] = useState('');
    const [formNum, setFormNum] = useState('');
    const LIMIT = 50;

    // ─── Verify auth ──────────────────────────────────────────
    useEffect(() => {
        (async () => {
            try {
                const res = await adminApi.verify();
                if (res.valid) {
                    setUser(res.username);
                    setAuthOk(true);
                } else {
                    router.push('/admin');
                }
            } catch {
                router.push('/admin');
            }
        })();
    }, [router]);

    // ─── Fetch buildings ─────────────────────────────────────
    const fetchBuildings = useCallback(async (pg = page) => {
        setLoading(true);
        try {
            const res = await buildingsApi.list({ page: pg, limit: LIMIT });
            setBuildings(res.buildings);
            setTotal(res.total);
            setPages(res.pages);
        } catch (err: any) {
            showNotif('Failed to load buildings: ' + err.message, 'error');
        } finally {
            setLoading(false);
        }
    }, [page]);

    useEffect(() => { if (authOk) fetchBuildings(); }, [authOk, fetchBuildings]);

    function showNotif(msg: string, type: 'success' | 'error' = 'success') {
        setNotification(msg);
        setNotifType(type);
        setTimeout(() => setNotification(''), 4000);
    }

    // ─── Add building ────────────────────────────────────────
    const handleAdd = async () => {
        try {
            await buildingsApi.create({
                latitude: parseFloat(formLat),
                longitude: parseFloat(formLng),
                ...(formNum ? { number: parseInt(formNum) } : {}),
            });
            setAddMode(false);
            setFormLat(''); setFormLng(''); setFormNum('');
            fetchBuildings(1);
            showNotif('Building added successfully');
        } catch (err: any) {
            showNotif(err.message, 'error');
        }
    };

    // ─── Edit building ───────────────────────────────────────
    const handleEdit = async () => {
        if (!editBuilding) return;
        try {
            await buildingsApi.update(editBuilding.id, {
                latitude: parseFloat(formLat),
                longitude: parseFloat(formLng),
                ...(formNum ? { number: parseInt(formNum) } : {}),
            });
            setEditBuilding(null);
            fetchBuildings();
            showNotif('Building updated successfully');
        } catch (err: any) {
            showNotif(err.message, 'error');
        }
    };

    // ─── Delete building ─────────────────────────────────────
    const handleDelete = async () => {
        if (!deleteTarget) return;
        try {
            await buildingsApi.delete(deleteTarget.id);
            setDeleteTarget(null);
            fetchBuildings();
            showNotif(`Building ${deleteTarget.number} deleted`);
        } catch (err: any) {
            showNotif(err.message, 'error');
        }
    };

    // ─── Open edit modal ─────────────────────────────────────
    const openEdit = (b: Building) => {
        setEditBuilding(b);
        setFormLat(String(b.latitude));
        setFormLng(String(b.longitude));
        setFormNum(String(b.number));
        setAddMode(false);
    };

    const openAdd = () => {
        setAddMode(true);
        setEditBuilding(null);
        setFormLat(''); setFormLng(''); setFormNum('');
    };

    // ─── CSV Export ──────────────────────────────────────────
    const handleExport = async () => {
        try {
            await adminApi.exportCSV();
            showNotif('CSV exported successfully');
        } catch (err: any) {
            showNotif(err.message, 'error');
        }
    };

    // ─── CSV Import ──────────────────────────────────────────
    const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setImportLoading(true);
        try {
            const res = await adminApi.importCSV(file);
            showNotif(`Imported ${res.inserted} buildings`);
            fetchBuildings(1);
        } catch (err: any) {
            showNotif(err.message, 'error');
        } finally {
            setImportLoading(false);
            e.target.value = '';
        }
    };

    // ─── Logout ──────────────────────────────────────────────
    const handleLogout = () => {
        localStorage.removeItem('berbera_admin_token');
        localStorage.removeItem('berbera_admin_user');
        router.push('/admin');
    };

    // ─── Filtered buildings ──────────────────────────────────
    const filtered = search
        ? buildings.filter((b) => String(b.number).includes(search))
        : buildings;

    if (!authOk) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin" style={{ color: 'var(--primary)' }} />
            </div>
        );
    }

    return (
        <div className="min-h-screen" style={{ background: 'var(--bg)' }}>
            {/* ── Sidebar ── */}
            <aside
                className="glass fixed left-0 top-0 bottom-0 w-56 flex flex-col z-50"
                style={{ borderRight: '1px solid var(--border)' }}
            >
                {/* Logo */}
                <div
                    className="flex items-center gap-3 px-4 py-4"
                    style={{ borderBottom: '1px solid var(--border)' }}
                >
                    <div
                        className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                        style={{ background: 'linear-gradient(135deg,#1d4ed8,#0891b2)', boxShadow: '0 4px 12px rgba(29,78,216,0.4)' }}
                    >
                        <MapPin className="w-4 h-4 text-white" />
                    </div>
                    <div>
                        <div className="text-sm font-black" style={{ color: 'var(--text-primary)' }}>Berbera</div>
                        <div className="text-[10px]" style={{ color: 'var(--text-secondary)' }}>Admin Panel</div>
                    </div>
                </div>

                {/* Nav items */}
                <nav className="flex-1 p-3 space-y-1">
                    <div
                        className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold"
                        style={{ background: 'rgba(59,130,246,0.15)', color: '#60a5fa', border: '1px solid rgba(59,130,246,0.2)' }}
                    >
                        <Building2 className="w-4 h-4" />
                        Buildings
                    </div>
                    <Link
                        href="/"
                        className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 hover:bg-blue-500/5"
                        style={{ color: 'var(--text-secondary)' }}
                    >
                        <MapPin className="w-4 h-4" />
                        View Map
                    </Link>
                </nav>

                {/* User + Logout */}
                <div className="p-3" style={{ borderTop: '1px solid var(--border)' }}>
                    <div
                        className="flex items-center justify-between px-3 py-2 rounded-xl"
                        style={{ background: 'var(--bg-card)' }}
                    >
                        <div>
                            <div className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>{user}</div>
                            <div className="text-[10px]" style={{ color: 'var(--text-secondary)' }}>Administrator</div>
                        </div>
                        <button
                            onClick={handleLogout}
                            className="p-1.5 rounded-lg hover:bg-red-500/10 transition-colors"
                            title="Logout"
                        >
                            <LogOut className="w-3.5 h-3.5" style={{ color: '#ef4444' }} />
                        </button>
                    </div>
                </div>
            </aside>

            {/* ── Main content ── */}
            <main className="ml-56 p-6">
                {/* Top bar */}
                <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
                    <div>
                        <h2 className="text-2xl font-black" style={{ color: 'var(--text-primary)' }}>Buildings</h2>
                        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                            {total.toLocaleString()} total buildings in Berbera
                        </p>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                        {/* Search */}
                        <div className="glass flex items-center gap-2 px-3 py-2 rounded-xl">
                            <Search className="w-3.5 h-3.5" style={{ color: 'var(--text-secondary)' }} />
                            <input
                                type="number"
                                placeholder="Filter by number…"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="bg-transparent text-sm outline-none w-36"
                                style={{ color: 'var(--text-primary)' }}
                            />
                        </div>

                        {/* Import */}
                        <label
                            className="btn-ghost cursor-pointer relative"
                            title="Import CSV"
                        >
                            {importLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                            <span className="hidden sm:inline">Import</span>
                            <input type="file" accept=".csv" onChange={handleImport} className="absolute inset-0 opacity-0 cursor-pointer" />
                        </label>

                        {/* Export */}
                        <button onClick={handleExport} className="btn-ghost">
                            <Download className="w-4 h-4" />
                            <span className="hidden sm:inline">Export</span>
                        </button>

                        {/* Add */}
                        <button onClick={openAdd} className="btn-primary">
                            <Plus className="w-4 h-4" />
                            Add Building
                        </button>
                    </div>
                </div>

                {/* Add / Edit form */}
                {(addMode || editBuilding) && (
                    <div className="card mb-6 animate-fade-in">
                        <h3 className="text-sm font-bold mb-4" style={{ color: 'var(--text-primary)' }}>
                            {addMode ? '➕ Add New Building' : `✏️ Edit Building ${editBuilding?.number}`}
                        </h3>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <div>
                                <label className="text-xs font-semibold uppercase tracking-wider mb-1 block" style={{ color: 'var(--text-secondary)' }}>
                                    Number (optional)
                                </label>
                                <input
                                    type="number"
                                    value={formNum}
                                    onChange={(e) => setFormNum(e.target.value)}
                                    className="input-field"
                                    placeholder="Auto-assigned"
                                    min={1}
                                />
                            </div>
                            <div>
                                <label className="text-xs font-semibold uppercase tracking-wider mb-1 block" style={{ color: 'var(--text-secondary)' }}>
                                    Latitude *
                                </label>
                                <input
                                    type="number"
                                    value={formLat}
                                    onChange={(e) => setFormLat(e.target.value)}
                                    className="input-field"
                                    placeholder="10.4246"
                                    step="any"
                                    required
                                />
                            </div>
                            <div>
                                <label className="text-xs font-semibold uppercase tracking-wider mb-1 block" style={{ color: 'var(--text-secondary)' }}>
                                    Longitude *
                                </label>
                                <input
                                    type="number"
                                    value={formLng}
                                    onChange={(e) => setFormLng(e.target.value)}
                                    className="input-field"
                                    placeholder="45.0143"
                                    step="any"
                                    required
                                />
                            </div>
                        </div>
                        <div className="flex gap-2 mt-4">
                            <button
                                onClick={addMode ? handleAdd : handleEdit}
                                className="btn-primary"
                                disabled={!formLat || !formLng}
                            >
                                <Check className="w-4 h-4" />
                                {addMode ? 'Add Building' : 'Save Changes'}
                            </button>
                            <button
                                onClick={() => { setAddMode(false); setEditBuilding(null); }}
                                className="btn-ghost"
                            >
                                <X className="w-4 h-4" />
                                Cancel
                            </button>
                        </div>
                    </div>
                )}

                {/* Table */}
                <div className="card overflow-hidden p-0">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr style={{ borderBottom: '1px solid var(--border)', background: 'rgba(59,130,246,0.04)' }}>
                                    {['#', 'Number', 'Latitude', 'Longitude', 'Date Added', 'Actions'].map((h) => (
                                        <th
                                            key={h}
                                            className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider"
                                            style={{ color: 'var(--text-secondary)' }}
                                        >
                                            {h}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr>
                                        <td colSpan={6} className="py-12 text-center">
                                            <Loader2 className="w-6 h-6 animate-spin mx-auto" style={{ color: 'var(--primary)' }} />
                                        </td>
                                    </tr>
                                ) : filtered.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="py-12 text-center text-sm" style={{ color: 'var(--text-secondary)' }}>
                                            No buildings found
                                        </td>
                                    </tr>
                                ) : (
                                    filtered.map((b, i) => (
                                        <tr
                                            key={b.id}
                                            className="transition-colors duration-100 hover:bg-blue-500/5"
                                            style={{ borderBottom: '1px solid var(--border)' }}
                                        >
                                            <td className="px-4 py-3 text-xs" style={{ color: 'var(--text-secondary)' }}>
                                                {(page - 1) * LIMIT + i + 1}
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className="badge">{b.number}</span>
                                            </td>
                                            <td className="px-4 py-3 font-mono text-xs" style={{ color: 'var(--text-primary)' }}>
                                                {b.latitude.toFixed(6)}
                                            </td>
                                            <td className="px-4 py-3 font-mono text-xs" style={{ color: 'var(--text-primary)' }}>
                                                {b.longitude.toFixed(6)}
                                            </td>
                                            <td className="px-4 py-3 text-xs" style={{ color: 'var(--text-secondary)' }}>
                                                {new Date(b.created_at).toLocaleDateString()}
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-1">
                                                    <button
                                                        onClick={() => openEdit(b)}
                                                        className="p-1.5 rounded-lg hover:bg-blue-500/10 transition-colors"
                                                        title="Edit"
                                                    >
                                                        <Edit3 className="w-3.5 h-3.5" style={{ color: '#3b82f6' }} />
                                                    </button>
                                                    <button
                                                        onClick={() => setDeleteTarget(b)}
                                                        className="p-1.5 rounded-lg hover:bg-red-500/10 transition-colors"
                                                        title="Delete"
                                                    >
                                                        <Trash2 className="w-3.5 h-3.5" style={{ color: '#ef4444' }} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination */}
                    {pages > 1 && (
                        <div
                            className="flex items-center justify-between px-4 py-3"
                            style={{ borderTop: '1px solid var(--border)' }}
                        >
                            <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                                Page {page} of {pages} ({total.toLocaleString()} total)
                            </span>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => { setPage((p) => p - 1); fetchBuildings(page - 1); }}
                                    disabled={page <= 1}
                                    className="btn-ghost px-2 py-1.5 disabled:opacity-40"
                                >
                                    <ChevronLeft className="w-4 h-4" />
                                </button>
                                <button
                                    onClick={() => { setPage((p) => p + 1); fetchBuildings(page + 1); }}
                                    disabled={page >= pages}
                                    className="btn-ghost px-2 py-1.5 disabled:opacity-40"
                                >
                                    <ChevronRight className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </main>

            {/* ── Delete confirm modal ── */}
            {deleteTarget && (
                <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}>
                    <div className="glass rounded-2xl p-6 max-w-sm w-full animate-fade-in">
                        <div className="flex items-center gap-3 mb-4">
                            <AlertTriangle className="w-6 h-6 text-red-400 flex-shrink-0" />
                            <h3 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>Delete Building</h3>
                        </div>
                        <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>
                            Are you sure you want to delete Building <strong style={{ color: 'var(--text-primary)' }}>{deleteTarget.number}</strong>?
                            This action cannot be undone.
                        </p>
                        <div className="flex gap-2">
                            <button onClick={handleDelete} className="btn-danger flex-1 justify-center">
                                <Trash2 className="w-4 h-4" />
                                Delete
                            </button>
                            <button onClick={() => setDeleteTarget(null)} className="btn-ghost flex-1 justify-center">
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Notification toast ── */}
            {notification && (
                <div
                    className="fixed bottom-6 right-6 z-[3000] flex items-center gap-3 px-4 py-3 rounded-2xl animate-slide-up"
                    style={{
                        background: notifType === 'success' ? 'rgba(16,185,129,0.9)' : 'rgba(239,68,68,0.9)',
                        backdropFilter: 'blur(20px)',
                        color: '#fff',
                        boxShadow: `0 8px 32px ${notifType === 'success' ? 'rgba(16,185,129,0.4)' : 'rgba(239,68,68,0.4)'}`,
                        border: '1px solid rgba(255,255,255,0.2)',
                        maxWidth: '320px',
                    }}
                >
                    {notifType === 'success'
                        ? <Check className="w-4 h-4 flex-shrink-0" />
                        : <AlertTriangle className="w-4 h-4 flex-shrink-0" />}
                    <span className="text-sm font-semibold">{notification}</span>
                </div>
            )}
        </div>
    );
}
