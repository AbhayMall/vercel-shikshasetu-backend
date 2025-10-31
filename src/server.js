require('dotenv').config();
const http = require('http');
const mongoose = require('mongoose');
const { app } = require('./app');
const { Server } = require('socket.io');
const { ChatMessage } = require('./models/ChatMessage');

const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI;
const CLIENT_URL = process.env.CLIENT_URL;

async function start() {
  try {
    // Connect to MongoDB
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Create HTTP server
    const server = http.createServer(app);

    // Setup Socket.IO with correct CORS
    const io = new Server(server, {
      cors: {
        origin: CLIENT_URL,
        methods: ['GET', 'POST'],
        credentials: true
      }
    });

    io.on('connection', (socket) => {
      console.log('🟢 New client connected');

      socket.on('join-course', (courseId) => {
        socket.join(`course-${courseId}`);
      });

      socket.on('send-message', async (data) => {
        try {
          const { courseId, senderId, message } = data;
          const chatMsg = await ChatMessage.create({ course: courseId, sender: senderId, message });
          const populated = await ChatMessage.findById(chatMsg._id).populate('sender', 'name email');
          io.to(`course-${courseId}`).emit('new-message', populated);
        } catch (err) {
          console.error('❌ Failed to send message', err);
          socket.emit('error', { message: 'Failed to send message' });
        }
      });

      socket.on('disconnect', () => {
        console.log('🔴 Client disconnected');
      });
    });

    // Make io available globally (if needed)
    app.locals.io = io;

    // Start server
    server.listen(PORT, () => {
      console.log('='.repeat(60));
      console.log(`📡 Server running on: https://vercel-shikshasetu-backend-1.onrender.com`);
      console.log(`🗄️  MongoDB connected`);
      console.log(`🌐 Allowed Origin: ${CLIENT_URL}`);
      console.log(`🔐 JWT Auth Enabled`);
      console.log('='.repeat(60) + '\n');
    });

  } catch (err) {
    console.error('❌ Failed to start server:', err);
    process.exit(1);
  }
}

start();
