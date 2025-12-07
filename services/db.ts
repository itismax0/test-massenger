
import { AppSettings, Contact, Message, UserData, UserProfile, DeviceSession } from '../types';
import { CONTACTS, INITIAL_SETTINGS, INITIAL_DEVICES } from '../constants';

const USERS_KEY = 'zenchat_users';
const DATA_PREFIX = 'zenchat_data_';
const SESSION_KEY = 'zenchat_session';

interface StoredUser {
    id: string;
    email: string;
    password: string; // In a real app, this would be hashed
    name: string;
    username?: string;
}

// Helper to simulate network delay
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const db = {
    // --- Auth ---

    async register(name: string, email: string, password: string): Promise<UserProfile> {
        await delay(800); // Simulate server request

        const safeEmail = email.trim();
        let users: StoredUser[] = [];
        
        try {
            const usersRaw = localStorage.getItem(USERS_KEY);
            users = usersRaw ? JSON.parse(usersRaw) : [];
        } catch (e) {
            console.error("Error parsing users, resetting:", e);
            users = [];
        }

        // Check if user exists (case-insensitive and trimmed)
        if (users.find(u => u.email.trim().toLowerCase() === safeEmail.toLowerCase())) {
            throw new Error('Пользователь с таким email уже существует');
        }

        // Generate sequential ID (1, 2, 3...)
        const newId = (users.length + 1).toString();

        const newUser: StoredUser = {
            id: newId,
            email: safeEmail,
            password: password, // Store password (should be hashed in prod)
            name: name.trim(),
            username: ''
        };

        users.push(newUser);
        localStorage.setItem(USERS_KEY, JSON.stringify(users));
        
        console.log('User registered:', newUser.email, 'ID:', newUser.id);

        // Initialize default data for new user
        const initialData = this._getDefaultData(newUser.id, newUser.name, newUser.email);

        localStorage.setItem(DATA_PREFIX + newUser.id, JSON.stringify(initialData));
        
        // Set session
        localStorage.setItem(SESSION_KEY, newUser.id);

        return initialData.profile;
    },

    async login(email: string, password: string): Promise<UserProfile> {
        await delay(800);

        const safeEmail = email.trim();
        let users: StoredUser[] = [];
        
        try {
            const usersRaw = localStorage.getItem(USERS_KEY);
            users = usersRaw ? JSON.parse(usersRaw) : [];
        } catch (e) {
            console.error("Error parsing users:", e);
            users = [];
        }

        console.log('Attempting login for:', safeEmail);

        // Find user by email first
        const user = users.find(u => 
            u.email.trim().toLowerCase() === safeEmail.toLowerCase()
        );

        if (!user) {
            throw new Error('Пользователь с таким email не найден');
        }

        // Check password (try exact match, then trimmed match for mobile/legacy issues)
        const isPasswordValid = user.password === password || (user.password && user.password.trim() === password.trim());

        if (!isPasswordValid) {
            throw new Error('Неверный пароль');
        }

        localStorage.setItem(SESSION_KEY, user.id);
        
        // Return profile (fetch fresh from data in case name changed)
        const data = this.getData(user.id);
        return data.profile;
    },

    async logout() {
        await delay(300);
        localStorage.removeItem(SESSION_KEY);
    },

    checkSession(): string | null {
        return localStorage.getItem(SESSION_KEY);
    },

    // --- Data Management ---

    async updateProfile(userId: string, updates: Partial<UserProfile>): Promise<UserProfile> {
        await delay(500);
        
        const usersRaw = localStorage.getItem(USERS_KEY);
        let users: StoredUser[] = usersRaw ? JSON.parse(usersRaw) : [];
        
        const userIndex = users.findIndex(u => u.id === userId);
        if (userIndex === -1) throw new Error('User not found');
        
        const currentUser = users[userIndex];

        // Check username uniqueness if changing
        if (updates.username && updates.username !== currentUser.username) {
            const safeUsername = updates.username.trim().toLowerCase();
            // Validations
            if (safeUsername.length < 5) throw new Error('Имя пользователя должно быть не короче 5 символов');
            if (!/^[a-zA-Z0-9_]+$/.test(safeUsername)) throw new Error('Можно использовать только латинские буквы, цифры и подчеркивания');

            const usernameTaken = users.some(u => 
                u.username?.trim().toLowerCase() === safeUsername && u.id !== userId
            );
            if (usernameTaken) {
                throw new Error('Это имя пользователя уже занято');
            }
        }

        // Update master list
        const updatedStoredUser = { ...currentUser, ...updates };
        // Ensure we save the specific fields needed in stored user
        if (updates.name) updatedStoredUser.name = updates.name;
        if (updates.username) updatedStoredUser.username = updates.username;

        users[userIndex] = updatedStoredUser;
        localStorage.setItem(USERS_KEY, JSON.stringify(users));

        // Update individual data blob
        const userData = this.getData(userId);
        userData.profile = { ...userData.profile, ...updates };
        this.saveData(userId, userData);

        return userData.profile;
    },

    // Global Search for users
    async searchUsers(query: string, currentUserId: string): Promise<UserProfile[]> {
        await delay(400); // Simulate network latency

        if (!query || query.length < 3) return [];

        const cleanQuery = query.toLowerCase().replace('@', '');
        
        let users: StoredUser[] = [];
        try {
            const usersRaw = localStorage.getItem(USERS_KEY);
            users = usersRaw ? JSON.parse(usersRaw) : [];
        } catch (e) { return []; }

        // Filter users
        const matches = users.filter(u => {
            // Don't show myself
            if (u.id === currentUserId) return false;

            const nameMatch = u.name.toLowerCase().includes(cleanQuery);
            const usernameMatch = u.username && u.username.toLowerCase().includes(cleanQuery);
            
            return nameMatch || usernameMatch;
        });

        // Map to Safe UserProfile (no passwords)
        return matches.map(u => ({
            id: u.id,
            name: u.name,
            email: u.email,
            username: u.username,
            // Try to get avatar from their specific data block if possible
            avatarUrl: this._getUserAvatar(u.id) 
        }));
    },

    _getUserAvatar(userId: string): string {
        try {
            const raw = localStorage.getItem(DATA_PREFIX + userId);
            if (raw) {
                const data = JSON.parse(raw);
                return data.profile?.avatarUrl || '';
            }
        } catch (e) {}
        return '';
    },

    getData(userId: string): UserData {
        const raw = localStorage.getItem(DATA_PREFIX + userId);
        if (!raw) {
            return this._getDefaultData(userId);
        }
        try {
            return JSON.parse(raw);
        } catch (e) {
            console.error("Failed to parse user data, resetting:", e);
            return this._getDefaultData(userId);
        }
    },

    saveData(userId: string, data: Partial<UserData>) {
        try {
            const current = this.getData(userId);
            const updated = { ...current, ...data };
            localStorage.setItem(DATA_PREFIX + userId, JSON.stringify(updated));
        } catch (e) {
            console.error("Failed to save data:", e);
        }
    },

    // Internal Helper for default data structure
    _getDefaultData(userId: string, name: string = 'User', email: string = ''): UserData {
        // Try to find username from stored users if possible
        let username = '';
        try {
             const usersRaw = localStorage.getItem(USERS_KEY);
             const users: StoredUser[] = usersRaw ? JSON.parse(usersRaw) : [];
             const u = users.find(user => user.id === userId);
             if (u && u.username) username = u.username;
        } catch (e) {}

         const initialData: UserData = {
            profile: { id: userId, name: name, email: email, avatarUrl: '', username: username },
            contacts: CONTACTS, // Start with Gemini
            chatHistory: {}, // Empty chats
            settings: INITIAL_SETTINGS,
            devices: INITIAL_DEVICES
        };
        
        // Initialize chat history for default contacts
        CONTACTS.forEach(c => {
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
        });
        
        return initialData;
    }
};
