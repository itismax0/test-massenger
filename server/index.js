
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

const GroupSchema = new mongoose.Schema({
    id: { type: String, required: true, unique: true },
    name: String,
    avatarUrl: String,
    type: { type: String, enum: ['group', 'channel'], default: 'group' },
    members: [{ type: String }], // Array of User IDs
    admins: [{ type: String }], // Array of User IDs
    ownerId: String,
    settings: {
        historyVisible: { type: Boolean, default: true },
        sendMessages: { type: Boolean, default: true },
        autoDeleteMessages: { type: Number, default: 0 }
    },
    chatHistory: { type: Array, default: [] }, // Array of Messages
    createdAt: { type: Number, default: Date.now }
});

const Group = mongoose.model('Group', GroupSchema);

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
            avatarUrl: '',
        });

        await newUser.save();

        const { password: _, _id, __v, ...userProfile } = newUser.toObject();
        res.json(userProfile);
    } catch (e) {
        console.error("Registration Error:", e);
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
            return res.status(401).json({ error: 'Invalid email or password' });
        }

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

        if (updates.username) {
            const taken = await User.findOne({ username: updates.username, id: { $ne: id } });
            if (taken) return res.status(400).json({ error: 'Username taken' });
        }

        const user = await User.findOneAndUpdate(
            { id: id },
            { $set: updates },
            { new: true }
        );

        if (!user) return res.status(404).json({ error: 'User not found' });

        const { password: _, _id, __v, ...userProfile } = user.toObject();
        res.json(userProfile);
    } catch (e) {
        res.status(500).json({ error: 'Failed to update profile' });
    }
});

// Create Group
app.post('/api/groups', async (req, res) => {
    try {
        const { name, type, members, avatarUrl, ownerId, settings } = req.body;
        
        // Ensure owner is in members
        const allMembers = Array.from(new Set([...members, ownerId]));

        const newGroup = new Group({
            id: Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
            name,
            type: type || 'group',
            avatarUrl: avatarUrl || '',
            members: allMembers,
            admins: [ownerId],
            ownerId,
            settings: settings || {
                historyVisible: true, 
                sendMessages: true,
                autoDeleteMessages: 0
            },
            chatHistory: [{
                id: Date.now().toString(),
                text: type === 'channel' ? 'Канал создан' : 'Группа создана',
                senderId: ownerId,
                timestamp: Date.now(),
                status: 'read',
                type: 'text'
            }]
        });

        await newGroup.save();
        res.json(newGroup);
    } catch(e) {
        console.error("Create Group Error:", e);
        res.status(500).json({ error: 'Failed to create group' });
    }
});

// Search
app.get('/api/users/search', async (req, res) => {
    try {
        const { query, currentUserId } = req.query;
        if (!query) return res.json([]);

        const regex = new RegExp(query, 'i');

        const users = await User.find({
            id: { $ne: currentUserId },
            $or: [
                { name: regex }, 
                { username: regex },
                { email: regex }
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

        // --- Fetch Groups ---
        // Find all groups where userId is in members
        const groups = await Group.find({ members: userId });
        
        // Convert groups to "Contact" objects
        const groupContacts = await Promise.all(groups.map(async (g) => {
            // Populate member info
            const memberUsers = await User.find({ id: { $in: g.members } }).select('id name avatarUrl');
            const members = memberUsers.map(u => ({
                id: u.id,
                name: u.name,
                avatarUrl: u.avatarUrl,
                role: g.ownerId === u.id ? 'owner' : (g.admins.includes(u.id) ? 'admin' : 'member'),
                lastSeen: 'недавно'
            }));

            // Get last message from group history
            const lastMsg = g.chatHistory.length > 0 ? g.chatHistory[g.chatHistory.length - 1] : null;

            return {
                id: g.id,
                name: g.name,
                avatarUrl: g.avatarUrl,
                lastMessage: lastMsg ? (lastMsg.text || 'Вложение') : '',
                lastMessageTime: lastMsg ? lastMsg.timestamp : g.createdAt,
                unreadCount: 0, // Simplified for now
                isOnline: false,
                type: g.type,
                membersCount: g.members.length,
                members: members,
                settings: g.settings,
                description: g.type === 'channel' ? 'Канал' : 'Группа'
            };
        }));

        // Merge User Contacts + Groups
        // We prioritize Server Groups over Local Contacts for groups
        const userContacts = fullData.contacts || [];
        // Filter out groups from stored contacts (to replace with fresh data)
        const cleanUserContacts = userContacts.filter(c => c.type === 'user' || c.id === 'saved-messages');
        const finalContacts = [...groupContacts, ...cleanUserContacts];

        // Merge Chat History
        // User history contains DMs. Group history is stored in Group docs.
        // We need to merge them for the client.
        const combinedHistory = { ...fullData.chatHistory };
        groups.forEach(g => {
            combinedHistory[g.id] = g.chatHistory;
        });

        res.json({
            profile: {
                id: fullData.id,
                name: fullData.name,
                email: fullData.email,
                avatarUrl: fullData.avatarUrl,
                username: fullData.username
            },
            contacts: finalContacts, 
            chatHistory: combinedHistory,
            settings: fullData.settings || {}, 
            devices: fullData.devices || []
        });
    } catch (e) {
        console.error("Sync Error:", e);
        res.status(500).json({ error: 'Sync failed' });
    }
});

// Handle generic API 404s
app.all('/api/*', (req, res) => {
    res.status(404).json({ error: 'API Endpoint not found' });
});

// --- Socket.io ---

const io = new Server(server, {
    maxHttpBufferSize: 1e8,
    cors: {
        origin: "*", 
        methods: ["GET", "POST"]
    }
});

const saveMessageToDB = async (senderId, receiverId, message) => {
    try {
        if (receiverId === 'saved-messages') {
             const sender = await User.findOne({ id: senderId });
             if (sender) {
                 const history = sender.chatHistory || {};
                 const chat = history['saved-messages'] || [];
                 chat.push({ ...message, status: 'read' });
                 history['saved-messages'] = chat;
                 await User.updateOne({ id: senderId }, { $set: { chatHistory: history } });
             }
             return;
        }

        // Check if receiver is a Group
        const group = await Group.findOne({ id: receiverId });
        if (group) {
            // It's a group message
            await Group.updateOne(
                { id: receiverId }, 
                { $push: { chatHistory: message } }
            );
            return;
        }

        // It's a DM
        // 1. Update Sender
        const sender = await User.findOne({ id: senderId });
        if (sender) {
            const history = sender.chatHistory || {};
            const chat = history[receiverId] || [];
            if (!chat.some(m => m.id === message.id)) {
                chat.push({ ...message, status: 'sent' });
                history[receiverId] = chat;
                await User.updateOne({ id: senderId }, { $set: { chatHistory: history } });
            }
        }

        // 2. Update Receiver
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
    socket.on('join', async (userId) => {
        socket.join(userId);
        
        // Also join all group rooms this user is part of
        try {
            const groups = await Group.find({ members: userId });
            groups.forEach(g => {
                socket.join(g.id);
            });
        } catch (e) {
            console.error("Error joining group rooms", e);
        }
    });

    socket.on('send_message', async (data) => {
        const { receiverId, message } = data;
        const senderId = message.senderId;

        await saveMessageToDB(senderId, receiverId, message);

        if (receiverId === 'saved-messages') {
            socket.emit('message_sent', { tempId: message.id, status: 'read' });
            return;
        }

        // Emit to receiver (works for both User ID room and Group ID room)
        socket.to(receiverId).emit('receive_message', message);
        
        socket.emit('message_sent', { tempId: message.id, status: 'sent' });
    });

    socket.on('typing', ({ to, from, isTyping }) => {
        io.to(to).emit('typing', { from, isTyping });
    });

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

if (process.env.NODE_ENV === 'production' || process.env.RENDER) {
    const distPath = path.join(__dirname, '../dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
        if (req.path.startsWith('/api') || req.path.startsWith('/socket.io')) return;
        res.sendFile(path.join(distPath, 'index.html'));
    });
}

server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
