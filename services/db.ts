import { api } from './api';
import { AppSettings, Contact, Message, UserData, UserProfile, DeviceSession } from '../types';
import { CONTACTS, INITIAL_SETTINGS, INITIAL_DEVICES, SAVED_MESSAGES_ID } from '../constants';

const DATA_PREFIX = 'zenchat_data_';
const SESSION_KEY = 'zenchat_session';

export const db = {
    // --- Auth (Remote) ---

    async register(name: string, email: string, password: string): Promise<UserProfile> {
        // Call the backend API
        const profile = await api.register(name, email, password);
        
        // Save session ID locally
        localStorage.setItem(SESSION_KEY, profile.id);
        
        // Initialize local cache for this user
        this._initLocalCache(profile.id, profile);
        
        return profile;
    },

    async login(email: string, password: string): Promise<UserProfile> {
        // Call the backend API
        const profile = await api.login(email, password);
        
        localStorage.setItem(SESSION_KEY, profile.id);
        
        // Sync latest data from server
        try {
            await this.syncWithServer(profile.id);
        } catch (e) {
            console.error("Initial sync failed", e);
        }

        return profile;
    },

    // --- DEV MODE: Skip Registration ---
    loginAsDev(): UserProfile {
        const devId = 'dev-' + Math.random().toString(36).substr(2, 9);
        const profile: UserProfile = {
            id: devId,
            name: 'Developer',
            email: `dev_${devId}@local.test`,
            avatarUrl: '',
            username: `dev_${Math.floor(Math.random() * 1000)}`
        };

        localStorage.setItem(SESSION_KEY, profile.id);
        this._initLocalCache(profile.id, profile);
        console.log("Logged in as Dev User:", profile);
        return profile;
    },

    async logout() {
        localStorage.removeItem(SESSION_KEY);
        // Optional: Call api.logout() if you implement server-side session clearing
    },

    checkSession(): string | null {
        return localStorage.getItem(SESSION_KEY);
    },

    // --- Data Management ---

    async updateProfile(userId: string, updates: Partial<UserProfile>): Promise<UserProfile> {
        // update on server
        // If it's a dev user, just update locally
        if (userId.startsWith('dev-')) {
            const userData = this.getData(userId);
            const updatedProfile = { ...userData.profile, ...updates };
            userData.profile = updatedProfile;
            this.saveData(userId, userData);
            return updatedProfile;
        }

        const updatedProfile = await api.updateProfile(userId, updates);
        
        // update local cache
        const userData = this.getData(userId);
        userData.profile = updatedProfile;
        this.saveData(userId, userData);

        return updatedProfile;
    },

    async searchUsers(query: string, currentUserId: string): Promise<UserProfile[]> {
        return await api.searchUsers(query, currentUserId);
    },

    // --- Sync & Local Cache ---
    
    // We keep a local copy of data for speed/offline, but sync with server on load
    async syncWithServer(userId: string) {
        if (userId.startsWith('dev-')) return; // Skip sync for dev users

        try {
            const serverData = await api.syncData(userId);
            
            // Merge server profile with local data
            const localData = this.getData(userId);
            
            const mergedData: UserData = {
                ...localData,
                profile: serverData.profile || localData.profile,
                // In a real app, you would merge contacts/chats carefully here.
                // For now, we trust local for chats/settings to keep it simple,
                // or you could trust server if you implement full cloud storage.
            };
            
            this.saveData(userId, mergedData);
        } catch (e) {
            console.warn("Sync failed, using local data", e);
        }
    },

    getData(userId: string): UserData {
        const raw = localStorage.getItem(DATA_PREFIX + userId);
        if (!raw) {
            return this._getDefaultData(userId);
        }
        try {
            return JSON.parse(raw);
        } catch (e) {
            return this._getDefaultData(userId);
        }
    },

    saveData(userId: string, data: Partial<UserData>) {
        try {
            const current = this.getData(userId);
            const updated = { ...current, ...data };
            localStorage.setItem(DATA_PREFIX + userId, JSON.stringify(updated));
        } catch (e) {
            console.error("Failed to save local data:", e);
        }
    },

    _initLocalCache(userId: string, profile: UserProfile) {
        const initialData = this._getDefaultData(userId);
        initialData.profile = profile;
        localStorage.setItem(DATA_PREFIX + userId, JSON.stringify(initialData));
    },

    _getDefaultData(userId: string): UserData {
         const initialData: UserData = {
            profile: { id: userId, name: '', email: '', avatarUrl: '' },
            contacts: CONTACTS, 
            chatHistory: {},
            settings: INITIAL_SETTINGS,
            devices: INITIAL_DEVICES
        };
        
        // Init default chats
        CONTACTS.forEach(c => {
            // For Saved Messages, we might want an empty history or a welcome message
            if (c.id === SAVED_MESSAGES_ID) {
                initialData.chatHistory[c.id] = [];
            } else {
                 initialData.chatHistory[c.id] = [
                    {
                        id: `msg-${c.id}-init`,
                        text: c.lastMessage || 'Привет!',
                        senderId: c.id,
                        timestamp: c.lastMessageTime || Date.now(),
                        status: 'read',
                        type: 'text'
                    }
                ];
            }
        });
        
        return initialData;
    }
};