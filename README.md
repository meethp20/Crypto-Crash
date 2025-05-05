# Crypto Crash Game

A real-time multiplayer crypto crash game with WebSocket integration and cryptocurrency conversions.

## Features

- Real-time multiplayer game with WebSocket updates
- Cryptocurrency integration with CoinMarketCap API
- Provably fair crash algorithm
- Wallet system with USD and crypto (BTC/ETH) balances
- Transaction logging and mock blockchain transactions
- Live chat functionality

## Prerequisites

- Node.js v16 or higher
- MongoDB
- CoinMarketCap API key

## Setup

1. Clone the repository:
```bash
git clone <repository-url>
cd crypto-crash
```

2. Install dependencies:
```bash
cd backend
npm install
```

3. Create a .env file in the backend directory:
```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/crypto-crash
JWT_SECRET=your_jwt_secret_here
COINMARKETCAP_API_KEY=your_coinmarketcap_api_key_here
```

4. Start the server:
```bash
# Development mode
npm run dev

# Production mode
npm start
```

## API Endpoints

### Authentication
- POST `/api/auth/register` - Register a new user
- POST `/api/auth/login` - Login and get JWT token

### Wallet
- GET `/api/wallet/balance` - Get user's wallet balance
- POST `/api/wallet/convert/usd-to-crypto` - Convert USD to cryptocurrency
- POST `/api/wallet/convert/crypto-to-usd` - Convert cryptocurrency to USD
- GET `/api/wallet/transactions` - Get transaction history

### Game
- GET `/api/game/current` - Get current game info
- GET `/api/game/:id` - Get specific game by ID
- GET `/api/game/history` - Get game history
- POST `/api/game/bet` - Place a bet
- GET `/api/game/bets` - Get user's bet history

## WebSocket Events

### Client -> Server
- `authenticate` - Send JWT token for authentication
- `cashout` - Request to cash out during a game
- `chat_message` - Send a chat message

### Server -> Client
- `auth_success` - Authentication successful
- `auth_error` - Authentication failed
- `gameUpdate` - Game state updates (new round, multiplier updates, crashes)
- `player_cashout` - Player cashout notifications
- `chat_message` - Broadcast chat messages

## Provably Fair Algorithm

The game uses a provably fair algorithm to ensure transparency:

1. For each round, the server generates:
   - A random seed
   - A hash of the seed + round number
   - A crash point derived from the hash

2. Before the round:
   - Players can see the hash
   - The crash point is determined but unknown

3. After the round:
   - The seed is revealed
   - Players can verify the crash point using the seed and round number

Formula: `crash_point = 0.99 / (1 - hash_to_float(hash(seed + round_number)))`

## Development

### Running Tests
```bash
npm test
```

### Populating Sample Data
```bash
npm run seed
```

## License

MIT 