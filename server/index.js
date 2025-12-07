import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';

// Define __dirname for ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = createServer(app);

// Environment
const PORT = process.env.PORT || 3001;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/zenchat_local'; // Fallback for local testing

// Middleware
app.use(cors());
app.use(express.json());

// --- MongoDB Connection ---
mongoose.connect(MONGO_URI)
  .then(() => console.log('✅ Connected to MongoDB'))
  .catch(err => console.error('❌ MongoDB Connection Error:', err));

// --- Mongoose Schemas ---
// We store data slightly denormalized to match the existing frontend "UserData" structure
// allowing for a smoother transition without rewriting the entire frontend logic.

const UserSchema = new mongoose.Schema({
    id: { type: String, required: true, unique: true }, // Custom string ID
    name: String,
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true }, // In real app, hash this!
    username: { type: String, unique: true, sparse: true },
    avatarUrl: String,
    
    // Storing JSON blobs for frontend state compatibility
    contacts: { type: Array, default: [] },
    chatHistory: { type: Object, default: {} },
    settings: { type: Object, default: {} },
    devices: { type: Array, default: [] }
});

const User = mongoose.model('User', UserSchema);

// --- Routes ---

// Register
app.post('/api/register', async (req, res) => {
    try {
        const { name, email, password } = req.body;
        
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ error: 'Email already exists' });
        }

        const newUser = new User({
            id: Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
            name,
            email,
            password,
            username: '',
            avatarUrl: '',
            // Defaults will be applied from Schema
        });

        await newUser.save();

        const { password: _, _id, __v, ...userProfile } = newUser.toObject();
        res.json(userProfile);
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Server error during registration' });
    }
});

// Login
app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email });

        if (!user) {
            // Security: don't reveal user doesn't exist
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        // Check password (direct comparison for now, should be bcrypt in future)
        if (user.password !== password) {
             return res.status(401).json({ error: 'Invalid email or password' });
        }

        const { password: _, _id, __v, ...userProfile } = user.toObject();
        res.json(userProfile);
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Server error during login' });
    }
});

// Update Profile
app.post('/api/users/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;

        // Check username uniqueness if changing
        if (updates.username) {
            const taken = await User.findOne({ username: updates.username, id: { $ne: id } });
            if (taken) return res.status(400).json({ error: 'Username taken' });
        }

        const user = await User.findOneAndUpdate(
            { id: id },
            { $set: updates },
            { new: true } // Return updated doc
        );

        if (!user) return res.status(404).json({ error: 'User not found' });

        const { password: _, _id, __v, ...userProfile } = user.toObject();
        res.json(userProfile);
    } catch (e) {
        res.status(500).json({ error: 'Failed to update profile' });
    }
});

// Search
app.get('/api/users/search', async (req, res) => {
    try {
        const { query, currentUserId } = req.query;
        if (!query) return res.json([]);

        // Regex for case-insensitive partial match
        const regex = new RegExp(query, 'i');

        const users = await User.find({
            id: { $ne: currentUserId },
            $or: [{ name: regex }, { username: regex }]
        }).select('-password -_id -__v -chatHistory -contacts -settings -devices').limit(20);

        res.json(users);
    } catch (e) {
        res.status(500).json({ error: 'Search failed' });
    }
});

// Sync Data (Download)
app.get('/api/sync/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const user = await User.findOne({ id: userId });

        if (!user) return res.status(404).json({ error: 'User not found' });

        const { password: _, _id, __v, ...fullData } = user.toObject();
        
        // Return structure matching UserData interface
        res.json({
            profile: {
                id: fullData.id,
                name: fullData.name,
                email: fullData.email,
                avatarUrl: fullData.avatarUrl,
                username: fullData.username
            },
            contacts: fullData.contacts || [], 
            chatHistory: fullData.chatHistory || {},
            settings: fullData.settings || {}, 
            devices: fullData.devices || []
        });
    } catch (e) {
        res.status(500).json({ error: 'Sync failed' });
    }
});

// --- Socket.io ---

const io = new Server(server, {
    cors: {
        origin: "*", // Allow connections from anywhere (Render needs this)
        methods: ["GET", "POST"]
    }
});

io.on('connection', (socket) => {
    // console.log('User connected:', socket.id);

    socket.on('join', (userId) => {
        socket.join(userId);
    });

    socket.on('send_message', (data) => {
        const { receiverId, message } = data;
        io.to(receiverId).emit('receive_message', message);
        socket.emit('message_sent', { tempId: message.id, status: 'sent' });
    });

    socket.on('typing', ({ to, from, isTyping }) => {
        io.to(to).emit('typing', { from, isTyping });
    });

    // WebRTC
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
});

// --- SERVE STATIC FRONTEND (Production) ---
// This is critical for Render. The Node server serves the built React app.
if (process.env.NODE_ENV === 'production' || process.env.RENDER) {
    // Vite builds to 'dist' folder in root
    const distPath = path.join(__dirname, '../dist');
    
    app.use(express.static(distPath));

    // Handle React routing, return all requests to React app
    app.get('*', (req, res) => {
        // Skip API routes
        if (req.path.startsWith('/api') || req.path.startsWith('/socket.io')) return;
        
        res.sendFile(path.join(distPath, 'index.html'));
    });
}

// Start Server
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});