
// Determine API URL:
// If VITE_API_URL is set (prod), use it.
// Otherwise, use empty string to allow Vite proxy to handle routing to localhost:3001
const API_URL = (import.meta as any).env?.VITE_API_URL || '';

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
        const id = setTimeout(() => controller.abort(), 10000); // 10s timeout

        const response = await fetch(url, { 
            ...options, 
            headers,
            signal: controller.signal
        });
        
        clearTimeout(id);

        const text = await response.text();

        // Try to parse JSON
        let data;
        try {
            data = JSON.parse(text);
        } catch (e) {
            // If parsing fails, it's likely an HTML error page (404/500)
            console.error("Server returned non-JSON response:", text.substring(0, 200));
            throw new Error(`Server Error: ${response.status} ${response.statusText}. The backend might be offline or returning HTML.`);
        }

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
