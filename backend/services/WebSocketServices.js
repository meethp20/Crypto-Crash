import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { processCashout, initializeGameLoop, getCurrentGameState, placeBet } from './gameServices.js';
import cryptoService from './cryptoServices.js';
import { Types } from 'mongoose';
import { generateTransactionHash } from './cryptoServices.js';

// Constants for WebSocket operations
const PING_INTERVAL = 25000; // 25 seconds
const CONNECTION_TIMEOUT = 60000; // 60 seconds
const MAX_CLIENTS_PER_IP = 10; // Maximum connections per IP address

class WebSocketService {
  constructor(io) {
    this.io = io;
  }

  /**
   * Initialize the WebSocket service
   * Sets up event listeners, connection handling, and game loop
   */
  initialize() {
    // Connection tracking
    const clientsByIp = new Map();
    const connectedClients = new Map();
    
    // Initialize game loop with the io instance for broadcasting
    initializeGameLoop(this.io);
    
    // Initialize crypto price updates
    cryptoService.startPriceUpdates(this.io);
    
    // Middleware for connection management and rate limiting
    this.io.use((socket, next) => {
      const clientIp = socket.handshake.headers['x-forwarded-for'] || socket.handshake.address;
      
      // Rate limiting by IP address
      if (!clientsByIp.has(clientIp)) {
        clientsByIp.set(clientIp, new Set());
      }
      
      const ipClients = clientsByIp.get(clientIp);
      
      // Check if this IP has too many connections
      if (ipClients.size >= MAX_CLIENTS_PER_IP) {
        console.warn(`Too many connections from IP: ${clientIp}`);
        return next(new Error('Too many connections from your IP address'));
      }
      
      // Add this socket to the IP's client set
      ipClients.add(socket.id);
      
      // Continue with connection
      next();
    });
    
    // Handle new connections
    this.io.on('connection', (socket) => {
      console.log('New client connected:', socket.id);
      
      // Track connection time
      connectedClients.set(socket.id, {
        connectedAt: Date.now(),
        lastActivity: Date.now(),
        authenticated: false,
        userId: null,
        username: null
      });
      
      // Set up ping/pong for connection monitoring
      const pingInterval = setInterval(() => {
        if (Date.now() - connectedClients.get(socket.id)?.lastActivity > CONNECTION_TIMEOUT) {
          console.log(`Client ${socket.id} timed out, disconnecting`);
          socket.disconnect(true);
          return;
        }
        
        socket.emit('ping', { timestamp: Date.now() });
      }, PING_INTERVAL);
      
      // Handle pong response
      socket.on('pong', () => {
        if (connectedClients.has(socket.id)) {
          const client = connectedClients.get(socket.id);
          client.lastActivity = Date.now();
          connectedClients.set(socket.id, client);
        }
      });
      
      // Handle disconnection
      socket.on('disconnect', () => {
        console.log(`Client disconnected: ${socket.id}`);
        
        // Clean up interval
        clearInterval(pingInterval);
        
        // Remove from connection tracking
        if (connectedClients.has(socket.id)) {
          connectedClients.delete(socket.id);
        }
        
        // Remove from IP tracking
        const clientIp = socket.handshake.headers['x-forwarded-for'] || socket.handshake.address;
        if (clientsByIp.has(clientIp)) {
          const ipClients = clientsByIp.get(clientIp);
          ipClients.delete(socket.id);
          
          // If no more clients from this IP, remove the entry
          if (ipClients.size === 0) {
            clientsByIp.delete(clientIp);
          }
        }
        
        // Log connection statistics
        console.log(`Active connections: ${connectedClients.size}, Unique IPs: ${clientsByIp.size}`);
      });

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

          // Check if user is authenticated
          if (!socket.userId || !socket.username) {
            throw new Error('You must be logged in to place a bet');
          }

          // Get current game state to verify we can accept bets
          const gameState = getCurrentGameState();
          console.log('Current game state:', gameState);
          
          if (gameState.status !== 'waiting') {
            throw new Error(`Game is not accepting bets at this moment. Current status: ${gameState.status}`);
          }

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

          // Get the current game state to obtain the current multiplier
          const gameState = getCurrentGameState();
          const currentMultiplier = gameState.multiplier;
          
          console.log('Current multiplier at cashout:', currentMultiplier);

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
      socket.on('disconnect', async () => {
        console.log('Client disconnected:', socket.id, socket.userId, socket.username);
        
        // Check if user had an active bet in the current game
        if (socket.userId) {
          try {
            // Store the user ID in a variable that can be tracked even after disconnect
            const disconnectedUserId = socket.userId;
            const gameState = getCurrentGameState();
            
            // Only log disconnection during active game for users with active bets
            if (gameState.isRunning) {
              console.log(`User ${socket.username} (${disconnectedUserId}) disconnected during active game`);
              
              // We could implement auto-cashout for disconnected users here if desired
              // For now, just log the event for tracking purposes
              this.io.emit('player_disconnected', {
                username: socket.username,
                userId: disconnectedUserId,
                timestamp: new Date()
              });
            }
          } catch (error) {
            console.error('Error handling disconnect:', error);
          }
        }
      });
    });
  }
}

export default WebSocketService;