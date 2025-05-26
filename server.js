// server.js
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');
const Message = require('./models/Message');
require('dotenv').config();
const path = require('path');

// CORS configuration for production
const corsOptions = {
  origin: [
    'http://localhost:3000',
    'https://your-frontend-app.netlify.app' // Add your frontend URL
  ],
  credentials: true
};

app.use(cors(corsOptions));

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, 'build')));
  
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'build', 'index.html'));
  });
}
const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/chatapp', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const db = mongoose.connection;
db.on('error', console.error.bind(console, 'connection error:'));
db.once('open', () => {
  console.log('Connected to MongoDB');
});

// Routes
app.get('/api/messages', async (req, res) => {
  try {
    const messages = await Message.find().sort({ createdAt: 1 });
    res.json(messages);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/messages', async (req, res) => {
  try {
    const message = new Message(req.body);
    await message.save();
    res.status(201).json(message);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.put('/api/messages/:id', async (req, res) => {
  try {
    const message = await Message.findByIdAndUpdate(
      req.params.id,
      { ...req.body, edited: true },
      { new: true }
    );
    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }
    res.json(message);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.delete('/api/messages/:id', async (req, res) => {
  try {
    const message = await Message.findByIdAndDelete(req.params.id);
    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }
    res.json({ message: 'Message deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Socket.IO connection handling
const connectedUsers = new Map();

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('join', (userData) => {
    connectedUsers.set(socket.id, userData);
    socket.broadcast.emit('userJoined', userData);
    
    // Send current online users to the new user
    const onlineUsers = Array.from(connectedUsers.values());
    socket.emit('onlineUsers', onlineUsers);
    
    // Broadcast updated user count
    io.emit('userCount', connectedUsers.size);
  });

  socket.on('sendMessage', async (messageData) => {
    try {
      const message = new Message(messageData);
      await message.save();
      
      // Broadcast the message to all connected clients
      io.emit('newMessage', message);
    } catch (error) {
      socket.emit('error', { message: 'Failed to save message' });
    }
  });

  socket.on('updateMessage', async (data) => {
    try {
      const message = await Message.findByIdAndUpdate(
        data.messageId,
        { text: data.text, edited: true },
        { new: true }
      );
      
      if (message) {
        io.emit('messageUpdated', message);
      }
    } catch (error) {
      socket.emit('error', { message: 'Failed to update message' });
    }
  });

  socket.on('deleteMessage', async (messageId) => {
    try {
      await Message.findByIdAndDelete(messageId);
      io.emit('messageDeleted', messageId);
    } catch (error) {
      socket.emit('error', { message: 'Failed to delete message' });
    }
  });

  socket.on('typing', (data) => {
    socket.broadcast.emit('userTyping', data);
  });

  socket.on('stopTyping', (data) => {
    socket.broadcast.emit('userStoppedTyping', data);
  });

  socket.on('disconnect', () => {
    const userData = connectedUsers.get(socket.id);
    connectedUsers.delete(socket.id);
    
    if (userData) {
      socket.broadcast.emit('userLeft', userData);
    }
    
    io.emit('userCount', connectedUsers.size);
    console.log('User disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});