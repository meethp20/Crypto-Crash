import GameRound from '../models/GameRounds.js';
import Transaction from '../models/Transaction.js';
import User from '../models/User.js';
import { generateGameData } from '../utils/provablyFair.js';
import crypto from 'crypto';

// Global game state
let currentGame = {
  isRunning: false,
  multiplier: 1.00,
  lastCrash: null,
  startTime: null
};
let nextRoundId = 1;
let gameInterval = null;
let gameTimeout = null;
let multiplierInterval = null;
const ROUND_WAIT_TIME = 10000; // 10 seconds between rounds
const MULTIPLIER_UPDATE_INTERVAL = 100; // Update multiplier every 100ms
const TICK_RATE = 100; // Update every 100ms

// Game constants
const GROWTH_FACTOR = 0.00006; // Determines how fast the multiplier grows

/**
 * Gets the current game state
 * @returns {Object} Current game state
 */
const getCurrentGameState = () => {
  if (!currentGame) {
    return {
      isRunning: false,
      multiplier: 1.00,
      lastCrash: null,
      startTime: null,
      status: 'waiting',
      bets: []
    };
  }

  return {
    isRunning: currentGame.status === 'running',
    multiplier: currentGame.multiplier || 1.00,
    lastCrash: currentGame.crashPoint,
    startTime: currentGame.startTime,
    status: currentGame.status,
    bets: currentGame.bets || [],
    roundId: currentGame.roundId
  };
};

/**
 * Initializes the game loop
 * @param {Object} io - Socket.io instance for broadcasting updates
 */
const initializeGameLoop = async (io) => {
  try {
    // Find the highest roundId in the database to continue from there
    const lastGame = await GameRound.findOne().sort({ roundId: -1 });
    if (lastGame) {
      nextRoundId = lastGame.roundId + 1;
    }
    
    // Start the game loop
    await startNextRound(io);
  } catch (error) {
    console.error('Error initializing game loop:', error);
    // Retry after a delay
    setTimeout(() => initializeGameLoop(io), 5000);
  }
};

/**
 * Starts a new game round
 * @param {Object} io - Socket.io instance for broadcasting updates
 */
const startNextRound = async (io) => {
  try {
    // Generate game data (seed, hash, crash point)
    const { seed, hash, crashPoint } = generateGameData(nextRoundId);
    
    // Create new game round in database
    const newGame = new GameRound({
      roundId: nextRoundId,
      seed,
      hash,
      crashPoint,
      status: 'waiting',
      bets: [],
      startTime: null,
      endTime: null
    });
    
    await newGame.save();
    currentGame = newGame;
    
    // Update the global game state
    Object.assign(currentGame, {
      isRunning: false,
      multiplier: 1.00,
      status: 'waiting'
    });
    
    // Notify clients about the new upcoming round
    io.emit('gameUpdate', {
      type: 'new_round',
      roundId: nextRoundId,
      hash, // Send hash for verification
      startingIn: ROUND_WAIT_TIME / 1000
    });
    
    // Schedule the start of the round
    gameTimeout = setTimeout(() => startRound(io), ROUND_WAIT_TIME);
    
    // Increment roundId for next round
    nextRoundId++;
  } catch (error) {
    console.error('Error starting next round:', error);
    // Retry after a delay
    gameTimeout = setTimeout(() => startNextRound(io), 5000);
  }
};

/**
 * Starts the active phase of a round
 * @param {Object} io - Socket.io instance for broadcasting updates
 */
const startRound = async (io) => {
  try {
    if (!currentGame) {
      throw new Error('No current game found');
    }
    
    // Update game status
    currentGame.status = 'running';
    currentGame.startTime = new Date();
    await currentGame.save();
    
    // Initialize game variables
    let startTime = Date.now();
    let currentMultiplier = 1.00;
    
    // Notify clients that the round has started
    io.emit('gameUpdate', {
      type: 'round_started',
      roundId: currentGame.roundId,
      startTime: currentGame.startTime
    });
    
    // Start multiplier updates
    multiplierInterval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      currentMultiplier = calculateMultiplier(elapsed);
      
      // Emit multiplier update
      io.emit('gameUpdate', {
        type: 'multiplier_update',
        multiplier: parseFloat(currentMultiplier.toFixed(2)),
        elapsed
      });
      
      // Check if we've reached the crash point
      if (currentMultiplier >= currentGame.crashPoint) {
        endRound(io, currentMultiplier);
      }
    }, MULTIPLIER_UPDATE_INTERVAL);
  } catch (error) {
    console.error('Error starting round:', error);
    // End the round with a default multiplier
    endRound(io, 1.00);
  }
};

/**
 * Calculates the current multiplier based on elapsed time
 * @param {number} elapsed - Time elapsed in milliseconds
 * @returns {number} Current multiplier value
 */
const calculateMultiplier = (elapsed) => {
  return Math.floor((1 + (elapsed * GROWTH_FACTOR)) * 100) / 100;
};

/**
 * Ends the current round
 * @param {Object} io - Socket.io instance for broadcasting updates
 * @param {number} finalMultiplier - Final multiplier when the game crashed
 */
const endRound = async (io, finalMultiplier) => {
  try {
    // Clear intervals and timeouts
    clearInterval(multiplierInterval);
    
    if (!currentGame) {
      throw new Error('No current game found');
    }
    
    // Update game status
    currentGame.status = 'crashed';
    currentGame.endTime = new Date();
    await currentGame.save();
    
    // Emit crash event
    io.emit('gameUpdate', {
      type: 'round_crashed',
      roundId: currentGame.roundId,
      crashPoint: currentGame.crashPoint,
      finalMultiplier: parseFloat(finalMultiplier.toFixed(2)),
      seed: currentGame.seed // Reveal seed for verification
    });
    
    // Schedule the next round
    gameTimeout = setTimeout(() => startNextRound(io), ROUND_WAIT_TIME);
  } catch (error) {
    console.error('Error ending round:', error);
    gameTimeout = setTimeout(() => startNextRound(io), ROUND_WAIT_TIME);
  }
};

/**
 * Places a bet for a player
 * @param {Object} betData - The bet data object
 * @returns {Promise<Object>} Bet details
 */
const placeBet = async (betData) => {
  try {
    console.log('Placing bet with data:', betData);

    // Validate current game state
    if (!currentGame) {
      throw new Error('No active game found');
    }

    if (currentGame.status !== 'waiting') {
      throw new Error('Game is not accepting bets at this moment');
    }

    // Validate bet amount
    if (betData.usdAmount < 1) {
      throw new Error('Minimum bet amount is 1 USD');
    }

    // Check if user already has a bet in this round
    if (currentGame.bets && currentGame.bets.some(bet => bet.userId === betData.userId)) {
      throw new Error('You already have a bet in this round');
    }

    // Create bet object with validated data
    const bet = {
      userId: betData.userId,
      username: betData.username,
      usdAmount: betData.usdAmount,
      cryptoAmount: betData.cryptoAmount,
      cryptoCurrency: betData.cryptoCurrency.toLowerCase(),
      priceAtBet: betData.priceAtBet,
      hashedOut: false,
      timestamp: new Date()
    };

    // Add bet to current game
    if (!currentGame.bets) {
      currentGame.bets = [];
    }

    try {
      currentGame.bets.push(bet);
      await currentGame.save();
      console.log('Bet saved successfully:', bet);
      return bet;
    } catch (saveError) {
      console.error('Error saving bet:', saveError);
      // If there's a validation error, throw a more user-friendly message
      if (saveError.name === 'ValidationError') {
        throw new Error('Invalid bet data. Please check your inputs.');
      }
      throw saveError;
    }
  } catch (error) {
    console.error('Error placing bet:', error);
    throw error;
  }
};

/**
 * Processes a player cashout
 * @param {string} userId - User ID
 * @param {number} currentMultiplier - Current multiplier at cashout time
 * @returns {Promise<Object>} Cashout details
 */
const processCashout = async (userId, currentMultiplier) => {
  try {
    // Validate current game state
    if (!currentGame || currentGame.status !== 'running') {
      throw new Error('Cashout is only allowed during an active round');
    }
    
    // Find the user's bet in the current game
    const betIndex = currentGame.bets.findIndex(bet => 
      bet.userId.toString() === userId && !bet.hashedOut
    );
    
    if (betIndex === -1) {
      throw new Error('No active bet found for this user');
    }
    
    const bet = currentGame.bets[betIndex];
    
    // Calculate payout
    const usdPayout = bet.usdAmount * currentMultiplier;
    const cryptoPayout = bet.cryptoAmount * currentMultiplier;
    
    // Update bet with cashout info
    bet.hashedOut = true;
    bet.cashoutMultiplier = currentMultiplier;
    bet.usdPayout = usdPayout;
    bet.cryptoPayout = cryptoPayout;
    
    // Save game state
    await currentGame.save();
    
    // Generate mock transaction hash
    const transactionHash = '0x' + crypto.randomBytes(32).toString('hex');
    
    // Log transaction
    await Transaction.create({
      userId,
      roundId: currentGame.roundId,
      usdAmount: usdPayout,
      cryptoAmount: cryptoPayout,
      cryptoCurrency: bet.cryptoCurrency,
      priceAtTime: bet.priceAtBet,
      transactionType: 'cashout',
      transactionHash
    });
    
    // Update user's wallet
    const user = await User.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }
    
    user.wallet[bet.cryptoCurrency] += cryptoPayout;
    await user.save();
    
    return {
      roundId: currentGame.roundId,
      username: bet.username,
      cryptoCurrency: bet.cryptoCurrency,
      cashoutMultiplier: currentMultiplier,
      usdPayout,
      cryptoPayout,
      transactionHash
    };
  } catch (error) {
    console.error('Error processing cashout:', error);
    throw error;
  }
};

/**
 * Gets information about a specific game round
 * @param {number} roundId - Round ID to get info for
 * @returns {Promise<Object>} Game round information
 */
const getGameInfo = async (roundId = null) => {
  try {
    if (roundId) {
      // Get specific round
      const game = await GameRound.findOne({ roundId });
      if (!game) {
        throw new Error('Game round not found');
      }
      return game;
    } else {
      // Get current round
      return currentGame;
    }
  } catch (error) {
    console.error('Error getting game info:', error);
    throw error;
  }
};

/**
 * Gets game history
 * @param {number} limit - Number of rounds to return
 * @returns {Promise<Array>} Array of past game rounds
 */
const getGameHistory = async (limit = 10) => {
  try {
    const games = await GameRound.find({ status: 'crashed' })
      .sort({ roundId: -1 })
      .limit(limit);
    
    return games;
  } catch (error) {
    console.error('Error getting game history:', error);
    throw error;
  }
};

export {
  initializeGameLoop,
  getCurrentGameState,
  processCashout,
  placeBet,
  startNextRound,
  endRound,
  getGameInfo,
  getGameHistory
};