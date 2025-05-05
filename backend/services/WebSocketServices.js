import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { processCashout, initializeGameLoop, getCurrentGameState, placeBet } from './gameServices.js';
import cryptoService from './cryptoServices.js';
import { Types } from 'mongoose';

class WebSocketService {
  constructor(io) {
    this.io = io;
  }

  initialize() {
    // Initialize game loop with the io instance for broadcasting
    initializeGameLoop(this.io);
    
    // Initialize crypto price updates
    cryptoService.startPriceUpdates(this.io);
    
    this.io.on('connection', (socket) => {
      console.log('New client connected:', socket.id);

      // Generate a temporary user ID
      socket.userId = `temp_${socket.id}`;
      socket.username = 'Player_' + socket.id.substr(0, 4);

      // Send initial game state
      socket.on('getGameState', async () => {
        try {
          const gameState = getCurrentGameState();
          // Add current crypto prices to game state
          gameState.cryptoPrices = cryptoService.getPrices();
          socket.emit('gameState', gameState);
          console.log('Sent initial game state:', gameState);
        } catch (error) {
          console.error('Error sending game state:', error);
          socket.emit('gameUpdate', {
            type: 'error',
            message: 'Failed to get game state'
          });
        }
      });
      
      // Handle authentication
      socket.on('authenticate', async (token) => {
        try {
          // Verify JWT token
          const decoded = jwt.verify(token, process.env.JWT_SECRET);
          const user = await User.findById(decoded.userId);
          
          if (!user) {
            socket.emit('auth_error', { message: 'User not found' });
            return;
          }
          
          // Store user info in socket object
          socket.userId = user._id.toString();
          socket.username = user.username;
          
          // Join a user-specific room for targeted messages
          socket.join(`user:${user._id}`);
          
          socket.emit('auth_success', { 
            userId: user._id,
            username: user.username
          });
          
          console.log('User authenticated:', user.username);
        } catch (error) {
          console.error('Authentication error:', error);
          socket.emit('auth_error', { message: 'Authentication failed' });
        }
      });

      // Handle bet placement
      socket.on('place_bet', async (data) => {
        try {
          console.log('Received bet request:', {
            socketId: socket.id,
            userId: socket.userId,
            username: socket.username,
            ...data
          });

          const { amount, cryptoCurrency } = data;
          
          if (!amount || amount < 1) {
            throw new Error('Minimum bet amount is 1 USD');
          }

          if (!cryptoCurrency || !['btc', 'eth'].includes(cryptoCurrency.toLowerCase())) {
            throw new Error('Invalid cryptocurrency selected');
          }

          // Get current crypto price
          const cryptoPrices = cryptoService.getPrices();
          const priceAtBet = cryptoPrices[cryptoCurrency.toLowerCase()];

          if (!priceAtBet || priceAtBet <= 0) {
            throw new Error('Invalid cryptocurrency price');
          }

          // Convert USD amount to crypto amount
          const cryptoAmount = amount / priceAtBet;
          
          console.log('Processing bet:', {
            userId: socket.userId,
            username: socket.username,
            amount,
            cryptoCurrency,
            cryptoAmount,
            priceAtBet
          });

          // Place bet using game services
          const bet = await placeBet({
            userId: socket.userId, // Now passing string ID directly
            username: socket.username,
            usdAmount: amount,
            cryptoCurrency: cryptoCurrency.toLowerCase(),
            cryptoAmount,
            priceAtBet
          });
          
          console.log('Bet placed successfully:', bet);

          // Emit success event to the player
          socket.emit('gameUpdate', {
            type: 'bet_placed',
            amount: bet.usdAmount,
            cryptoAmount: bet.cryptoAmount,
            cryptoCurrency: bet.cryptoCurrency
          });

          // Broadcast the bet to all clients
          this.io.emit('bet_placed', {
            username: socket.username,
            amount: bet.usdAmount,
            cryptoAmount: bet.cryptoAmount,
            cryptoCurrency: bet.cryptoCurrency
          });
        } catch (error) {
          console.error('Bet error:', error);
          socket.emit('gameUpdate', {
            type: 'error',
            message: error.message || 'Failed to place bet'
          });
        }
      });
      
      // Handle cashout requests
      socket.on('cashout', async () => {
        try {
          console.log('Processing cashout for:', {
            socketId: socket.id,
            userId: socket.userId,
            username: socket.username
          });

          const result = await processCashout(socket.userId, currentMultiplier);
          
          console.log('Cashout successful:', result);

          socket.emit('gameUpdate', {
            type: 'cashout_success',
            ...result
          });

          // Broadcast the cashout to all clients
          this.io.emit('cashout', {
            username: socket.username,
            amount: result.usdPayout,
            cryptoAmount: result.cryptoPayout,
            cryptoCurrency: result.cryptoCurrency,
            multiplier: result.cashoutMultiplier
          });
        } catch (error) {
          console.error('Cashout error:', error);
          socket.emit('gameUpdate', {
            type: 'error',
            message: error.message || 'Failed to process cashout'
          });
        }
      });
      
      // Handle chat messages
      socket.on('chat_message', (message) => {
        // Verify user is authenticated
        if (!socket.userId || !socket.username) {
          return;
        }
        
        // Broadcast message to all clients
        this.io.emit('chat_message', {
          userId: socket.userId,
          username: socket.username,
          message: message.trim(),
          timestamp: Date.now()
        });
      });
      
      // Handle disconnect
      socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
      });
    });
  }
}

export default WebSocketService;