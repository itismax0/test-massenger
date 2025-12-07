import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import fs from 'fs';
import path from 'path';
import cors from 'cors';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const PORT = 3001;
const DB_FILE = path.join(__dirname, 'data.json');

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// --- Database Helper ---
function getDb() {
  if (!fs.existsSync(DB_FILE)) {
    const initialData = { users: [], messages: [] };
    fs.writeFileSync(DB_FILE, JSON.stringify(initialData, null, 2));
    return initialData;
  }
  try {
    return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  } catch (e) {
    return { users: [], messages: [] };
  }
}

function saveDb(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

// --- REST API ---

// Register
app.post('/api/register', (req, res) => {
  try {
    const { name, email, password } = req.body;
    const db = getDb();
    
    // Check if email exists
    if (db.users.find(u => u.email.toLowerCase() === email.toLowerCase().trim())) {
      return res.status(400).json({ error: 'Пользователь уже существует' });
    }

    const newUser = {
      id: (db.users.length + 1).toString(),
      name: name.trim(),
      email: email.trim(),
      password: password, // In prod, hash this!
      username: '',
      avatarUrl: '',
      contacts: [], // List of contact IDs
      settings: {},
      createdAt: Date.now()
    };

    db.users.push(newUser);
    saveDb(db);
    
    // Return profile without password
    const { password: _, ...profile } = newUser;
    res.json(profile);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Login
app.post('/api/login', (req, res) => {
  try {
    const { email, password } = req.body;
    const db = getDb();
    
    const user = db.users.find(u => u.email.toLowerCase() === email.toLowerCase().trim());
    
    if (!user) return res.status(400).json({ error: 'Пользователь не найден' });
    if (user.password !== password) return res.status(400).json({ error: 'Неверный пароль' });

    const { password: _, ...profile } = user;
    res.json(profile);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Update Profile
app.post('/api/user/:id', (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    const db = getDb();
    
    const index = db.users.findIndex(u => u.id === id);
    if (index === -1) return res.status(404).json({ error: 'User not found' });

    // Username uniqueness check
    if (updates.username && updates.username !== db.users[index].username) {
      if (db.users.find(u => u.username === updates.username && u.id !== id)) {
         return res.status(400).json({ error: 'Имя пользователя занято' });
      }
    }

    db.users[index] = { ...db.users[index], ...updates };
    saveDb(db);
    
    const { password: _, ...profile } = db.users[index];
    res.json(profile);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Search Users
app.get('/api/users/search', (req, res) => {
  try {
    const { query, currentUserId } = req.query;
    if (!query) return res.json([]);
    
    const db = getDb();
    const q = query.toLowerCase().replace('@', '');
    
    const results = db.users
      .filter(u => u.id !== currentUserId)
      .filter(u => u.name.toLowerCase().includes(q) || (u.username && u.username.toLowerCase().includes(q)))
      .map(u => ({
        id: u.id,
        name: u.name,
        email: u.email,
        username: u.username,
        avatarUrl: u.avatarUrl
      }));
      
    res.json(results);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Get User Data (Sync)
app.get('/api/sync/:id', (req, res) => {
  try {
    const { id } = req.params;
    const db = getDb();
    const user = db.users.find(u => u.id === id);
    
    if (!user) return res.status(404).json({ error: 'User not found' });

    // Get Chat History
    // Filter messages where user is sender OR receiver
    const userMessages = db.messages.filter(m => m.senderId === id || m.recipientId === id);
    
    // Group by contact
    const chatHistory = {};
    const contacts = [];
    const processedContactIds = new Set();

    // 1. Add Gemimi defaults
    // In a real app, Gemini history would also be saved in DB messages with recipientId='gemini-ai'
    // For now we assume Gemini is local-only or stored similarly.
    
    // 2. Process real messages
    userMessages.forEach(msg => {
       const otherId = msg.senderId === id ? msg.recipientId : msg.senderId;
       
       if (!chatHistory[otherId]) chatHistory[otherId] = [];
       chatHistory[otherId].push(msg);
       
       if (!processedContactIds.has(otherId) && otherId !== 'gemini-ai') {
         processedContactIds.add(otherId);
         const otherUser = db.users.find(u => u.id === otherId);
         if (otherUser) {
           contacts.push({
             id: otherUser.id,
             name: otherUser.name,
             avatarUrl: otherUser.avatarUrl,
             username: otherUser.username,
             type: 'user',
             isOnline: false // Socket will update this
           });
         }
       }
    });

    // Populate lastMessage for contacts
    const enrichedContacts = contacts.map(c => {
       const msgs = chatHistory[c.id];
       const lastMsg = msgs[msgs.length - 1];
       return {
         ...c,
         lastMessage: lastMsg?.text || (lastMsg?.type === 'image' ? 'Фото' : 'Сообщение'),
         lastMessageTime: lastMsg?.timestamp || Date.now(),
         unreadCount: 0
       };
    });

    res.json({
      profile: {
        id: user.id,
        name: user.name,
        email: user.email,
        avatarUrl: user.avatarUrl,
        username: user.username
      },
      contacts: enrichedContacts,
      chatHistory: chatHistory,
      settings: user.settings || {}
    });

  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});


// --- Socket.IO ---

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('join', (userId) => {
    socket.join(userId);
    console.log(`User ${userId} joined room`);
    // Broadcast online status? (Optional for now)
  });

  socket.on('send_message', (message) => {
    // message: { id, text, senderId, recipientId, timestamp, type, ... }
    const db = getDb();
    
    // Save to DB
    // Ensure recipientId exists for persistence
    if (!message.recipientId) return; 

    db.messages.push(message);
    saveDb(db);
    
    // Relay to recipient
    io.to(message.recipientId).emit('receive_message', message);
    
    // Confirm to sender (optional, usually sender updates optimistic UI)
    io.to(message.senderId).emit('message_sent', { tempId: message.id, status: 'sent' });
    
    console.log(`Message from ${message.senderId} to ${message.recipientId}`);
  });

  socket.on('disconnect', () => {
    console.log('User disconnected');
  });
});

httpServer.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
