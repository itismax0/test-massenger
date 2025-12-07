import { UserData, UserProfile } from '../types';
import { CONTACTS, INITIAL_SETTINGS, INITIAL_DEVICES } from '../constants';

// This service now acts as a facade for the REST API
export const db = {
    async register(name: string, email: string, password: string): Promise<UserProfile> {
        const res = await fetch('/api/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, email, password })
        });
        
        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error || 'Ошибка регистрации');
        }
        
        const profile = await res.json();
        localStorage.setItem('zenchat_session', profile.id);
        return profile;
    },

    async login(email: string, password: string): Promise<UserProfile> {
        const res = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });

        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error || 'Ошибка входа');
        }

        const profile = await res.json();
        localStorage.setItem('zenchat_session', profile.id);
        return profile;
    },

    async logout() {
        localStorage.removeItem('zenchat_session');
    },

    checkSession(): string | null {
        return localStorage.getItem('zenchat_session');
    },

    async updateProfile(userId: string, updates: Partial<UserProfile>): Promise<UserProfile> {
        const res = await fetch(`/api/user/${userId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updates)
        });

        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error || 'Failed update');
        }
        
        return await res.json();
    },

    async searchUsers(query: string, currentUserId: string): Promise<UserProfile[]> {
        const res = await fetch(`/api/users/search?query=${encodeURIComponent(query)}&currentUserId=${currentUserId}`);
        return await res.json();
    },

    // Fetches full user state from server
    async fetchUserData(userId: string): Promise<UserData> {
        const res = await fetch(`/api/sync/${userId}`);
        if (!res.ok) {
             throw new Error('Failed to sync');
        }
        
        const data = await res.json();
        
        // Merge defaults for things not fully on server yet
        return {
            profile: data.profile,
            contacts: [...CONTACTS, ...data.contacts], // Keep Gemini + Server contacts
            chatHistory: data.chatHistory,
            settings: { ...INITIAL_SETTINGS, ...data.settings },
            devices: INITIAL_DEVICES // Mock devices for now
        };
    },
    
    // No-op for now, as we save via API calls
    saveData(userId: string, data: Partial<UserData>) {
        // Implementation would involve sending partial updates to server
    }
};
