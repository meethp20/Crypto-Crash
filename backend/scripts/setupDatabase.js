import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/User.js';
import GameRound from '../models/GameRounds.js';
import Transaction from '../models/Transaction.js';
import bcrypt from 'bcryptjs';

// Load environment variables
dotenv.config();

// Connection options
const options = {
  serverSelectionTimeoutMS: 30000,
  heartbeatFrequencyMS: 2000,
  socketTimeoutMS: 45000,
  family: 4
};

/**
 * Initialize the database with sample data
 */
const initializeDatabase = async () => {
  try {
    // Connect to MongoDB
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/crypto-crash', options);
    console.log('Connected to MongoDB successfully');

    // Check if we need to initialize with sample data
    const userCount = await User.countDocuments();
    
    if (userCount === 0) {
      console.log('No users found. Creating sample data...');
      
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
      const sampleRound = new GameRound({
        roundId: 1,
        seed: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
        hash: 'abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789',
        crashPoint: 2.5,
        status: 'crashed',
        startTime: new Date(Date.now() - 60000),
        endTime: new Date(Date.now() - 30000),
        bets: []
      });
      
      await sampleRound.save();
      console.log('Created sample game round');
    } else {
      console.log(`Database already contains ${userCount} users. Skipping sample data creation.`);
    }
    
    // Verify collections exist
    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log('Available collections:');
    collections.forEach(collection => {
      console.log(`- ${collection.name}`);
    });
    
    console.log('Database setup complete!');
    process.exit(0);
  } catch (error) {
    console.error('Database initialization error:', error);
    process.exit(1);
  }
};

// Run the initialization
initializeDatabase();
