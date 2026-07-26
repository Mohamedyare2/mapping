/**
 * API client — wraps all backend endpoints
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

function getAuthHeader(): Record<string, string> {
    if (typeof window === 'undefined') return {};
    const token = localStorage.getItem('berbera_admin_token');
    return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request<T>(
    path: string,
    options: RequestInit = {}
): Promise<T> {
    const res = await fetch(`${API_URL}${path}`, {
        cache: 'no-store', // Prevent Next.js from caching the API responses (which causes 0 buildings)
        headers: {
            'Content-Type': 'application/json',
            ...getAuthHeader(),
            ...(options.headers as Record<string, string>),
        },
        ...options,
    });

    if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(err.error || 'Request failed');
    }

    // For CSV export, return raw text
    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('text/csv')) {
        return res.text() as unknown as T;
    }

    return res.json();
}

// ─── Types ───────────────────────────────────────────────────
export interface Building {
    id: number;
    number: number;
    latitude: number;
    longitude: number;
    created_at: string;
    updated_at: string;
}

export interface BuildingsResponse {
    buildings: Building[];
    total: number;
    page: number;
    limit: number;
    pages: number;
}

export interface NearestResult {
    building: Building;
    distance: string;
    walkingTime: string;
    drivingTime: string;
    message: string;
}

export interface NavigationResult {
    distance: string;
    duration: string;
    walkingTime: string;
    drivingTime: string;
    mode: string;
    geometry: GeoJSON.LineString;
    steps: Array<{
        instruction: string;
        distance: string;
        duration: string;
        direction: string;
    }>;
}

// ─── Buildings ───────────────────────────────────────────────
export const buildingsApi = {
    list: (params?: {
        page?: number;
        limit?: number;
        minLat?: number;
        maxLat?: number;
        minLng?: number;
        maxLng?: number;
    }) => {
        const q = new URLSearchParams(
            Object.entries(params || {})
                .filter(([, v]) => v != null)
                .map(([k, v]) => [k, String(v)])
        );
        return request<BuildingsResponse>(`/buildings?${q}`);
    },

    get: (id: number) => request<Building>(`/buildings/${id}`),

    create: (data: { latitude: number; longitude: number; number?: number }) =>
        request<Building>('/buildings', { method: 'POST', body: JSON.stringify(data) }),

    update: (id: number, data: Partial<Building>) =>
        request<Building>(`/buildings/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

    delete: (id: number) =>
        request<{ message: string }>(`/buildings/${id}`, { method: 'DELETE' }),
};

// ─── Search ──────────────────────────────────────────────────
export const searchApi = {
    byNumber: (q: string | number) => request<Building>(`/search?q=${q}`),
};

// ─── Navigation ──────────────────────────────────────────────
export const navigationApi = {
    route: (params: {
        fromLat: number;
        fromLng: number;
        toLat: number;
        toLng: number;
        mode?: 'walking' | 'driving';
    }) => {
        const q = new URLSearchParams(
            Object.entries(params).map(([k, v]) => [k, String(v)])
        );
        return request<NavigationResult>(`/navigation?${q}`);
    },
};

// ─── My Location ─────────────────────────────────────────────
export const locationApi = {
    nearest: (latitude: number, longitude: number) =>
        request<NearestResult>('/my-location', {
            method: 'POST',
            body: JSON.stringify({ latitude, longitude }),
        }),
};

// ─── Admin ───────────────────────────────────────────────────
export const adminApi = {
    login: (username: string, password: string) =>
        request<{ token: string; username: string; expiresIn: string }>('/admin/login', {
            method: 'POST',
            body: JSON.stringify({ username, password }),
        }),

    verify: () => request<{ valid: boolean; username: string }>('/admin/verify'),

    exportCSV: async () => {
        const text = await request<string>('/export');
        const blob = new Blob([text], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `berbera_buildings_${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    },

    importCSV: async (file: File) => {
        const formData = new FormData();
        formData.append('file', file);
        const res = await fetch(`${API_URL}/import`, {
            method: 'POST',
            headers: { ...getAuthHeader() },
            body: formData,
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.error || 'Import failed');
        }
        return res.json();
    },
};
