import app from './app.js';
import http from 'http';
import { Server } from 'socket.io';
import WebSocketService from './services/WebSocketServices.js';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { MongoMemoryServer } from 'mongodb-memory-server';
import User from './models/User.js';
import GameRound from './models/GameRounds.js';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

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

// Connect to MongoDB with in-memory server for development
const connectToMongoDB = async () => {
  try {
    let uri = process.env.MONGODB_URI;
    
    // If we're in development mode and no MongoDB URI is provided, use in-memory MongoDB
    if (!uri && process.env.NODE_ENV !== 'production') {
      console.log('Starting in-memory MongoDB server for development...');
      const mongod = await MongoMemoryServer.create();
      uri = mongod.getUri();
      console.log(`In-memory MongoDB server started at: ${uri}`);
      
      // Add shutdown handler to close MongoDB server
      process.on('SIGINT', async () => {
        await mongod.stop();
        console.log('In-memory MongoDB server stopped');
        process.exit(0);
      });
    } else if (!uri) {
      // Default connection string if none provided
      uri = 'mongodb://127.0.0.1:27017/crypto-crash';
    }
    
    // Connect to MongoDB with improved settings
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 30000, // Increase timeout to 30 seconds
      heartbeatFrequencyMS: 2000,     // Check connection every 2 seconds
      socketTimeoutMS: 45000,         // Socket timeout
    });
    
    console.log('Connected to MongoDB successfully');
    
    // Create initial data if needed
    await createInitialData();
    
    // Initialize WebSocket service only after successful DB connection
    const webSocketService = new WebSocketService(io);
    webSocketService.initialize();
    
    return true;
  } catch (err) {
    console.error('MongoDB connection error:', err);
    console.log('Will retry connection in 5 seconds...');
    
    // Retry connection after delay
    setTimeout(connectToMongoDB, 5000);
    return false;
  }
};

/**
 * Creates initial sample data for the database if it doesn't exist
 */
const createInitialData = async () => {
  try {
    // Check if we need to create sample data
    const userCount = await User.countDocuments();
    
    if (userCount === 0) {
      console.log('Creating sample data for the database...');
      
      // Create a test user
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash('password123', salt);
      
      const testUser = new User({
        username: 'testuser',
        password: hashedPassword,
        wallet: {
          usd: 10000,
          btc: 0.1,
          eth: 1.5
        }
      });
      
      await testUser.save();
      console.log('Created test user: testuser (password: password123)');
      
      // Create a sample game round
      const seed = crypto.randomBytes(32).toString('hex');
      const hash = crypto
        .createHash('sha256')
        .update(`${seed}-1`)
        .digest('hex');
      
      const sampleRound = new GameRound({
        roundId: 1,
        seed: seed,
        hash: hash,
        crashPoint: 2.5,
        status: 'crashed',
        startTime: new Date(Date.now() - 60000),
        endTime: new Date(Date.now() - 30000),
        bets: []
      });
      
      await sampleRound.save();
      console.log('Created sample game round');
      
      console.log('Sample data creation complete!');
    } else {
      console.log(`Database already contains ${userCount} users. Skipping sample data creation.`);
    }
  } catch (error) {
    console.error('Error creating initial data:', error);
  }
};

// Attempt to connect to MongoDB
connectToMongoDB();

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
