
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const server = http.createServer(app);

// Use environment variable for allowed origin in production
const ALLOWED_ORIGIN = process.env.CLIENT_URL || "http://localhost:3000";

app.use(cors({
    origin: "*", // Allow all for simplicity in this demo, strict in prod
    methods: ["GET", "POST"]
}));
app.use(express.json());

const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

const DB_FILE = path.join(__dirname, 'data.json');

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
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

// --- Routes ---

// Health check
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
        id: Date.now().toString(),
        name,
        email,
        password, // In prod, hash this!
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

    // Username uniqueness
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

// Sync Data (Simple implementation)
app.get('/api/sync/:userId', (req, res) => {
    const { userId } = req.params;
    const db = getDb();
    
    // In a real DB, you'd fetch relations properly
    // Here we just mock the structure expected by frontend
    const user = db.users.find(u => u.id === userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    // For this simple file DB, we aren't storing contacts relation persistently 
    // effectively in a relational way, so we return basic profile.
    // The frontend handles local contacts merging for this demo.
    
    const { password: _, ...profile } = user;
    
    res.json({
        profile,
        contacts: [], 
        chatHistory: {},
        settings: {}, // Frontend defaults
        devices: []
    });
});

// --- Socket.io (Realtime & Signaling) ---

const onlineUsers = new Map(); // userId -> socketId

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    socket.on('join', (userId) => {
        onlineUsers.set(userId, socket.id);
        socket.join(userId);
        console.log(`User ${userId} joined room`);
        io.emit('user_status', { userId, isOnline: true });
    });

    socket.on('send_message', (data) => {
        const { receiverId, message } = data;
        
        // Send to receiver
        io.to(receiverId).emit('receive_message', message);
        
        // Send back to sender (confirm sent)
        socket.emit('message_sent', { tempId: message.id, status: 'sent' });
    });

    socket.on('typing', ({ to, from, isTyping }) => {
        io.to(to).emit('typing', { from, isTyping });
    });

    // --- WebRTC Signaling for Calls ---
    
    // 1. Initiator calls a user
    socket.on("callUser", ({ userToCall, signalData, from, name }) => {
        io.to(userToCall).emit("callUser", { 
            signal: signalData, 
            from, 
            name 
        });
    });

    // 2. Receiver answers
    socket.on("answerCall", (data) => {
        io.to(data.to).emit("callAccepted", data.signal);
    });

    // 3. ICE Candidates (Network path discovery)
    socket.on("iceCandidate", ({ target, candidate }) => {
        io.to(target).emit("iceCandidate", { candidate });
    });

    // 4. End Call
    socket.on("endCall", ({ to }) => {
        io.to(to).emit("callEnded");
    });

    socket.on('disconnect', () => {
        let disconnectedUserId;
        for (const [uid, sid] of onlineUsers.entries()) {
            if (sid === socket.id) {
                disconnectedUserId = uid;
                onlineUsers.delete(uid);
                break;
            }
        }
        if (disconnectedUserId) {
            io.emit('user_status', { userId: disconnectedUserId, isOnline: false });
        }
        console.log('User disconnected:', socket.id);
    });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
