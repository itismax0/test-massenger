
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Define __dirname for ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = createServer(app);

// Use environment variable for allowed origin in production
const ALLOWED_ORIGIN = process.env.CLIENT_URL || "*";

app.use(cors({
    origin: ALLOWED_ORIGIN,
    methods: ["GET", "POST"]
}));
app.use(express.json());

const io = new Server(server, {
    cors: {
        origin: ALLOWED_ORIGIN,
        methods: ["GET", "POST"]
    }
});

// Use /tmp for writable storage in Vercel (Serverless), or local file for dev
// WARNING: /tmp on Vercel is ephemeral. Data will be lost when the function sleeps.
// For production, connect to a real database (MongoDB/Postgres).
const DB_FILE = process.env.VERCEL ? '/tmp/data.json' : path.join(__dirname, 'data.json');

// --- Database Helpers ---
function getDb() {
    if (!fs.existsSync(DB_FILE)) {
        return { users: [], chats: {} };
    }
    try {
        return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    } catch (e) {
        return { users: [], chats: {} };
    }
}

function saveDb(data) {
    try {
        fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
    } catch (e) {
        console.error("Failed to write DB:", e);
    }
}

// Generate unique ID
const generateId = () => {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
};

// --- Routes ---

app.get('/', (req, res) => {
    res.send('ZenChat Backend is Running');
});

// Register
app.post('/api/register', (req, res) => {
    const { name, email, password } = req.body;
    const db = getDb();
    
    if (db.users.find(u => u.email === email)) {
        return res.status(400).json({ error: 'Email already exists' });
    }

    const newUser = {
        id: generateId(),
        name,
        email,
        password,
        username: '',
        avatarUrl: ''
    };

    db.users.push(newUser);
    saveDb(db);

    const { password: _, ...userProfile } = newUser;
    res.json(userProfile);
});

// Login
app.post('/api/login', (req, res) => {
    const { email, password } = req.body;
    const db = getDb();

    const user = db.users.find(u => u.email === email && u.password === password);
    
    if (!user) {
        return res.status(401).json({ error: 'Invalid credentials' });
    }

    const { password: _, ...userProfile } = user;
    res.json(userProfile);
});

// Update Profile
app.post('/api/users/:id', (req, res) => {
    const { id } = req.params;
    const updates = req.body;
    const db = getDb();

    const userIndex = db.users.findIndex(u => u.id === id);
    if (userIndex === -1) return res.status(404).json({ error: 'User not found' });

    if (updates.username) {
        const taken = db.users.find(u => u.username === updates.username && u.id !== id);
        if (taken) return res.status(400).json({ error: 'Username taken' });
    }

    db.users[userIndex] = { ...db.users[userIndex], ...updates };
    saveDb(db);

    const { password: _, ...userProfile } = db.users[userIndex];
    res.json(userProfile);
});

// Search
app.get('/api/users/search', (req, res) => {
    const { query, currentUserId } = req.query;
    const db = getDb();
    
    if (!query) return res.json([]);

    const lowerQ = query.toLowerCase();
    const results = db.users
        .filter(u => u.id !== currentUserId && (u.name.toLowerCase().includes(lowerQ) || (u.username && u.username.toLowerCase().includes(lowerQ))))
        .map(({ password, ...u }) => u);

    res.json(results);
});

// Sync Data
app.get('/api/sync/:userId', (req, res) => {
    const { userId } = req.params;
    const db = getDb();
    
    const user = db.users.find(u => u.id === userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const { password: _, ...profile } = user;
    
    res.json({
        profile,
        contacts: [], 
        chatHistory: {},
        settings: {}, 
        devices: []
    });
});

// --- Socket.io ---

const onlineUsers = new Map();

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    socket.on('join', (userId) => {
        onlineUsers.set(userId, socket.id);
        socket.join(userId);
        io.emit('user_status', { userId, isOnline: true });
    });

    socket.on('send_message', (data) => {
        const { receiverId, message } = data;
        io.to(receiverId).emit('receive_message', message);
        socket.emit('message_sent', { tempId: message.id, status: 'sent' });
    });

    socket.on('typing', ({ to, from, isTyping }) => {
        io.to(to).emit('typing', { from, isTyping });
    });

    // WebRTC Signaling
    socket.on("callUser", ({ userToCall, signalData, from, name }) => {
        io.to(userToCall).emit("callUser", { signal: signalData, from, name });
    });

    socket.on("answerCall", (data) => {
        io.to(data.to).emit("callAccepted", data.signal);
    });

    socket.on("iceCandidate", ({ target, candidate }) => {
        io.to(target).emit("iceCandidate", { candidate });
    });

    socket.on("endCall", ({ to }) => {
        io.to(to).emit("callEnded");
    });

    socket.on('disconnect', () => {
        // cleanup
    });
});

// --- Server Startup ---

// Export app for Vercel Serverless
export default app;

// Only listen on port if running locally (not in Vercel environment)
const PORT = process.env.PORT || 3001;
if (!process.env.VERCEL) {
    server.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });
}
