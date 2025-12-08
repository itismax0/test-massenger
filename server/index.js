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
app.use(express.json({ limit: '50mb' })); // Increase payload limit for images

// --- MongoDB Connection ---
if (MONGO_URI.includes('<password>')) {
    console.error('================================================================');
    console.error('❌ CRITICAL ERROR: Invalid MONGO_URI');
    console.error('You forgot to replace <password> with your actual password in the connection string.');
    console.error('Please go to Render Environment Variables and fix MONGO_URI.');
    console.error('It should look like: mongodb+srv://user:mypassword123@...');
    console.error('================================================================');
}

// Add connection options to handle timeouts better
const connectDB = async () => {
    try {
        await mongoose.connect(MONGO_URI, {
            serverSelectionTimeoutMS: 5000, // Fail fast if no connection
        });
        console.log('✅ Connected to MongoDB');
    } catch (err) {
        console.error('❌ MongoDB Connection Error:', err.message);
        // Do not exit process, so the static site can still be served (though API will fail)
    }
};
connectDB();

// --- Mongoose Schemas ---
// We store data slightly denormalized to match the existing frontend "UserData" structure
// allowing for a smoother transition without rewriting the entire frontend logic.

const UserSchema = new mongoose.Schema({
    id: { type: String, required: true, unique: true }, // Custom string ID
    name: String,
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true }, // In real app, hash this!
    username: { type: String, unique: true, sparse: true }, // Sparse allows multiple users to have no username (null/undefined)
    avatarUrl: String,
    
    // Storing JSON blobs for frontend state compatibility
    contacts: { type: Array, default: [] },
    chatHistory: { type: Object, default: {} },
    settings: { type: Object, default: {} },
    devices: { type: Array, default: [] }
});

const User = mongoose.model('User', UserSchema);

// --- Routes ---

// Health Check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', db: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected' });
});

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
            // Remove username from here so it defaults to undefined (allowed by sparse index)
            // username: '', 
            avatarUrl: '',
        });

        await newUser.save();

        const { password: _, _id, __v, ...userProfile } = newUser.toObject();
        res.json(userProfile);
    } catch (e) {
        console.error("Registration Error:", e);
        // Send more detailed error if possible
        const msg = e.code === 11000 ? 'Username or Email already taken' : 'Server error during registration';
        res.status(500).json({ error: msg });
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
            $or: [
                { name: regex }, 
                { username: regex },
                { email: regex } // ADDED: Allow searching by email
            ]
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

// Handle generic API 404s to prevent hanging
app.all('/api/*', (req, res) => {
    res.status(404).json({ error: 'API Endpoint not found' });
});

// --- Socket.io ---

const io = new Server(server, {
    maxHttpBufferSize: 1e8, // Increase buffer size for images (100MB)
    cors: {
        origin: "*", // Allow connections from anywhere (Render needs this)
        methods: ["GET", "POST"]
    }
});

// Helper to update chat history in MongoDB
const saveMessageToDB = async (senderId, receiverId, message) => {
    try {
        // SPECIAL CASE: Saved Messages (Cloud Storage)
        if (receiverId === 'saved-messages') {
             const sender = await User.findOne({ id: senderId });
             if (sender) {
                 const history = sender.chatHistory || {};
                 const chat = history['saved-messages'] || [];
                 chat.push({ ...message, status: 'read' }); // Automatically read
                 history['saved-messages'] = chat;
                 await User.updateOne({ id: senderId }, { $set: { chatHistory: history } });
             }
             return;
        }

        // 1. Update Sender's History
        const sender = await User.findOne({ id: senderId });
        if (sender) {
            const history = sender.chatHistory || {};
            const chat = history[receiverId] || [];
            // Ensure no duplicates
            if (!chat.some(m => m.id === message.id)) {
                chat.push({ ...message, status: 'sent' });
                history[receiverId] = chat;
                await User.updateOne({ id: senderId }, { $set: { chatHistory: history } });
            }
        }

        // 2. Update Receiver's History
        const receiver = await User.findOne({ id: receiverId });
        if (receiver) {
            const history = receiver.chatHistory || {};
            const chat = history[senderId] || [];
            if (!chat.some(m => m.id === message.id)) {
                chat.push(message);
                history[senderId] = chat;
                await User.updateOne({ id: receiverId }, { $set: { chatHistory: history } });
            }
        }
    } catch (e) {
        console.error("Failed to save message to DB:", e);
    }
};

io.on('connection', (socket) => {
    // console.log('User connected:', socket.id);

    socket.on('join', (userId) => {
        socket.join(userId);
    });

    socket.on('send_message', async (data) => {
        const { receiverId, message } = data;
        const senderId = message.senderId;

        // Save to DB
        await saveMessageToDB(senderId, receiverId, message);

        // If it's saved messages, we don't need to emit to anyone else
        if (receiverId === 'saved-messages') {
            socket.emit('message_sent', { tempId: message.id, status: 'read' });
            return;
        }

        // Relay to receiver
        io.to(receiverId).emit('receive_message', message);
        
        // Notify sender it was sent (optional)
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