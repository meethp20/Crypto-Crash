# Crypto Crash Game Backend

This is the backend server for the Crypto Crash game, built with Node.js, Express, MongoDB, and WebSocket.

## Features

- Real-time game updates using WebSocket
- User authentication and authorization
- Crypto price tracking and integration
- Wallet management
- Game history tracking

## Prerequisites

- Node.js (v14 or higher)
- MongoDB (v4.4 or higher)
- npm or yarn

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Create a .env file in the root directory with the following variables:
   ```
   PORT=5000
   MONGODB_URI=mongodb://localhost:27017/crypto-crash
   JWT_SECRET=your_jwt_secret_key_here
   FRONTEND_URL=http://localhost:3000
   NODE_ENV=development
   COINMARKETCAP_API_KEY=your_coinmarketcap_api_key
   BINANCE_API_KEY=your_binance_api_key
   BINANCE_API_SECRET=your_binance_api_secret
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

4. For production:
   ```bash
   npm start
   ```

## API Endpoints

### Authentication
- POST /api/auth/register - Register new user
- POST /api/auth/login - User login
- GET /api/auth/profile - Get user profile

### Game
- GET /api/game/history - Get game history
- GET /api/game/current - Get current game round
- POST /api/game/bet - Place a bet

### Wallet
- GET /api/wallet/balance - Get wallet balance
- POST /api/wallet/deposit - Deposit funds
- POST /api/wallet/withdraw - Withdraw funds

## WebSocket Events

- `gameStart` - New game round starts
- `gameCrash` - Game round ends
- `playerBet` - Player places a bet
- `playerCashout` - Player cashes out

## Directory Structure

```
backend/
├── controllers/     # Route controllers
├── models/         # Database models
├── routes/         # API routes
├── services/       # Business logic
├── utils/          # Utility functions
├── websockets/     # WebSocket handlers
├── app.js         # Express app setup
└── server.js      # Server entry point
```

## Error Handling

The application uses a centralized error handling middleware. All errors are logged and appropriate error responses are sent to the client.

## Security

- JWT for authentication
- Input validation
- CORS protection
- Rate limiting
- Environment variables for sensitive data

## Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a new Pull Request 