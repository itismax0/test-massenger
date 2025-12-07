
// Determine API URL:
// If VITE_API_URL is set (prod), use it.
// Otherwise, assume local dev server.
const API_URL = (import.meta as any).env?.VITE_API_URL || 'http://127.0.0.1:3001';

// Helper to handle requests
const request = async (endpoint: string, options: RequestInit = {}) => {
    try {
        const url = `${API_URL}${endpoint}`;
        const headers = {
            'Content-Type': 'application/json',
            ...options.headers,
        };

        // Add timeout
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), 8000); // 8s timeout

        const response = await fetch(url, { 
            ...options, 
            headers,
            signal: controller.signal
        });
        
        clearTimeout(id);

        const contentType = response.headers.get("content-type");
        if (!contentType || !contentType.includes("application/json")) {
            throw new Error("Server Error: Received HTML instead of JSON. Backend might be offline.");
        }

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'API Request failed');
        }

        return data;
    } catch (error: any) {
        if (error.name === 'AbortError') {
            throw new Error('Connection timeout. Server is slow or offline.');
        }
        console.error(`API Error (${endpoint}):`, error);
        throw error;
    }
};

export const api = {
    register: (name: string, email: string, password: string) => 
        request('/api/register', {
            method: 'POST',
            body: JSON.stringify({ name, email, password })
        }),

    login: (email: string, password: string) => 
        request('/api/login', {
            method: 'POST',
            body: JSON.stringify({ email, password })
        }),

    updateProfile: (id: string, updates: any) =>
        request(`/api/users/${id}`, {
            method: 'POST',
            body: JSON.stringify(updates)
        }),

    searchUsers: (query: string, currentUserId: string) =>
        request(`/api/users/search?query=${encodeURIComponent(query)}&currentUserId=${currentUserId}`),

    syncData: (userId: string) =>
        request(`/api/sync/${userId}`)
};
