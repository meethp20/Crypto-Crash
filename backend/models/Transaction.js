import mongoose from 'mongoose';

const TransactionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  roundId: {
    type: Number,
    required: true
  },
  usdAmount: {
    type: Number,
    required: true
  },
  cryptoAmount: {
    type: Number,
    required: true
  },
  cryptoCurrency: {
    type: String,
    enum: ['btc', 'eth'],
    required: true
  },
  priceAtTime: {
    type: Number,
    required: true
  },
  transactionType: {
    type: String,
    enum: ['bet', 'cashout', 'conversion'],
    required: true
  },
  multiplier: {
    type: Number,
    default: null
  },
  transactionHash: {
    type: String,
    required: true
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
});

export default mongoose.model('Transaction', TransactionSchema);