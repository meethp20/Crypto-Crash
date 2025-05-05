import mongoose from 'mongoose';
const { Schema } = mongoose;

const BetSchema = new Schema({
  userId: {
    type: Schema.Types.Mixed,
    required: true,
    validate: {
      validator: function(v) {
        return v && (typeof v === 'string' || v instanceof mongoose.Types.ObjectId);
      },
      message: 'Invalid userId format'
    }
  },
  username: {
    type: String,
    required: true
  },
  usdAmount: {
    type: Number,
    required: true,
    min: [1, 'Minimum bet amount is 1 USD']
  },
  cryptoAmount: {
    type: Number,
    required: true,
    min: [0, 'Crypto amount must be positive']
  },
  cryptoCurrency: {
    type: String,
    enum: ['btc', 'eth'],
    required: true,
    lowercase: true
  },
  priceAtBet: {
    type: Number,
    required: true,
    min: [0, 'Price must be positive']
  },
  hashedOut: {
    type: Boolean,
    default: false
  },
  cashoutMultiplier: {
    type: Number,
    default: null
  },
  usdPayout: {
    type: Number,
    default: null
  },
  cryptoPayout: {
    type: Number,
    default: null
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
}, {
  _id: true, // Ensure each bet gets its own _id
  strict: true // Only allow defined fields
});

const GameRoundSchema = new mongoose.Schema({
  roundId: {
    type: Number,
    required: true,
    unique: true
  },
  seed: {
    type: String,
    required: true
  },
  hash: {
    type: String,
    required: true
  },
  crashPoint: {
    type: Number,
    required: true,
    min: [1, 'Crash point must be greater than 1']
  },
  startTime: {
    type: Date,
    default: null
  },
  endTime: {
    type: Date,
    default: null
  },
  status: {
    type: String,
    enum: ['waiting', 'running', 'crashed'],
    default: 'waiting'
  },
  bets: [BetSchema],
  createdAt: {
    type: Date,
    default: Date.now
  }
}, {
  strict: true
});

// Add index for better query performance
GameRoundSchema.index({ roundId: 1 });
GameRoundSchema.index({ status: 1 });
GameRoundSchema.index({ 'bets.userId': 1 });

export default mongoose.model('GameRound', GameRoundSchema);