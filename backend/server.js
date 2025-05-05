import app from './app.js';
import http from 'http';
import { Server } from 'socket.io';
import WebSocketService from './services/WebSocketServices.js';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: ["http://localhost:5173", "http://localhost:3000"],
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true
  },
  transports: ['websocket', 'polling'],
  pingTimeout: 60000,
  pingInterval: 25000
});

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/crypto-crash', {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log('Connected to MongoDB'))
.catch(err => console.error('MongoDB connection error:', err));

// Initialize WebSocket service
const webSocketService = new WebSocketService(io);
webSocketService.initialize();

const startServer = async (port) => {
  try {
    await new Promise((resolve, reject) => {
      server.listen(port)
        .once('listening', () => {
          console.log(`Server running on port ${port}`);
          resolve();
        })
        .once('error', (err) => {
          if (err.code === 'EADDRINUSE') {
            console.log(`Port ${port} is busy, trying port ${port + 1}`);
            server.listen(port + 1)
              .once('listening', () => {
                console.log(`Server running on port ${port + 1}`);
                resolve();
              })
              .once('error', reject);
          } else {
            reject(err);
          }
        });
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Start server on port 5001
startServer(5001);
