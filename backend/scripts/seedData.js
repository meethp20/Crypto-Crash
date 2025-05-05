import mongoose from 'mongoose';
import User from '../models/User.js';
import GameRound from '../models/GameRounds.js';
import Transaction from '../models/Transaction.js';
import bcrypt from 'bcryptjs';
import { generateGameData } from '../utils/provablyFair.js';
import dotenv from 'dotenv';

dotenv.config();

const sampleUsers = [
  {
    username: 'player1',
    email: 'player1@example.com',
    password: 'password123',
    wallet: {
      usd: 1000,
      btc: 0.01,
      eth: 0.5
    }
  },
  {
    username: 'player2',
    email: 'player2@example.com',
    password: 'password123',
    wallet: {
      usd: 2000,
      btc: 0.02,
      eth: 1.0
    }
  },
  {
    username: 'player3',
    email: 'player3@example.com',
    password: 'password123',
    wallet: {
      usd: 3000,
      btc: 0.03,
      eth: 1.5
    }
  }
];

const createSampleGameRounds = async (userIds) => {
  const rounds = [];
  const btcPrice = 60000;
  const ethPrice = 3000;

  for (let i = 1; i <= 5; i++) {
    const { seed, hash, crashPoint } = generateGameData(i);
    
    const bets = userIds.map(userId => ({
      userId,
      username: `player${userId}`,
      usdAmount: 100 * i,
      cryptoAmount: (100 * i) / (Math.random() < 0.5 ? btcPrice : ethPrice),
      cryptoCurrency: Math.random() < 0.5 ? 'btc' : 'eth',
      priceAtBet: Math.random() < 0.5 ? btcPrice : ethPrice,
      hashedOut: Math.random() < 0.7,
      cashoutMultiplier: Math.random() * (crashPoint - 1) + 1
    }));

    rounds.push({
      roundId: i,
      seed,
      hash,
      crashPoint,
      status: 'completed',
      startTime: new Date(Date.now() - (6 - i) * 60000),
      endTime: new Date(Date.now() - (6 - i) * 60000 + 30000),
      bets
    });
  }

  return rounds;
};

const createSampleTransactions = async (userIds, gameRounds) => {
  const transactions = [];
  
  for (const round of gameRounds) {
    for (const bet of round.bets) {
      // Bet transaction
      transactions.push({
        userId: bet.userId,
        roundId: round.roundId,
        usdAmount: bet.usdAmount,
        cryptoAmount: bet.cryptoAmount,
        cryptoCurrency: bet.cryptoCurrency,
        priceAtTime: bet.priceAtBet,
        transactionType: 'bet',
        transactionHash: '0x' + Math.random().toString(16).substr(2, 40),
        timestamp: round.startTime
      });

      // Cashout transaction if player cashed out
      if (bet.hashedOut) {
        transactions.push({
          userId: bet.userId,
          roundId: round.roundId,
          usdAmount: bet.usdAmount * bet.cashoutMultiplier,
          cryptoAmount: bet.cryptoAmount * bet.cashoutMultiplier,
          cryptoCurrency: bet.cryptoCurrency,
          priceAtTime: bet.priceAtBet,
          transactionType: 'cashout',
          transactionHash: '0x' + Math.random().toString(16).substr(2, 40),
          timestamp: new Date(round.startTime.getTime() + Math.random() * 25000)
        });
      }
    }
  }

  return transactions;
};

const seedDatabase = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Clear existing data
    await Promise.all([
      User.deleteMany({}),
      GameRound.deleteMany({}),
      Transaction.deleteMany({})
    ]);
    console.log('Cleared existing data');

    // Create users
    const createdUsers = await Promise.all(
      sampleUsers.map(async user => {
        const hashedPassword = await bcrypt.hash(user.password, 10);
        return User.create({
          ...user,
          password: hashedPassword
        });
      })
    );
    console.log('Created sample users');

    // Create game rounds
    const userIds = createdUsers.map(user => user._id);
    const gameRounds = await createSampleGameRounds(userIds);
    await GameRound.insertMany(gameRounds);
    console.log('Created sample game rounds');

    // Create transactions
    const transactions = await createSampleTransactions(userIds, gameRounds);
    await Transaction.insertMany(transactions);
    console.log('Created sample transactions');

    console.log('Database seeding completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('Error seeding database:', error);
    process.exit(1);
  }
};

seedDatabase(); 