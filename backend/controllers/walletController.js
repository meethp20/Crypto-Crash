import User from '../models/User.js';
import Transaction from '../models/Transaction.js';
import { usdToCrypto, cryptoToUsd } from '../services/cryptoServices.js';

/**
 * Get user wallet balance
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getWalletBalance = async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Get user with wallet info
    const user = await User.findById(userId).select('wallet -_id');
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Get current prices for USD equivalent
    const [btcPrice, ethPrice] = await Promise.all([
      (user.wallet.btc > 0) ? (await cryptoToUsd(user.wallet.btc, 'btc')).price : 0,
      (user.wallet.eth > 0) ? (await cryptoToUsd(user.wallet.eth, 'eth')).price : 0
    ]);
    
    // Calculate USD equivalents
    const btcUsdValue = user.wallet.btc * btcPrice;
    const ethUsdValue = user.wallet.eth * ethPrice;
    
    res.json({
      wallet: {
        usd: user.wallet.usd,
        btc: {
          amount: user.wallet.btc,
          usdEquivalent: btcUsdValue,
          price: btcPrice
        },
        eth: {
          amount: user.wallet.eth,
          usdEquivalent: ethUsdValue,
          price: ethPrice
        },
        totalUsdEquivalent: user.wallet.usd + btcUsdValue + ethUsdValue
      }
    });
  } catch (error) {
    console.error('Error getting wallet balance:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

/**
 * Convert USD to crypto in wallet
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const convertUsdToCrypto = async (req, res) => {
  try {
    const { amount, cryptoCurrency } = req.body;
    const userId = req.user.id;
    
    // Validate amount
    const usdAmount = parseFloat(amount);
    if (isNaN(usdAmount) || usdAmount <= 0) {
      return res.status(400).json({ message: 'Invalid amount' });
    }
    
    // Validate cryptocurrency
    if (!['btc', 'eth'].includes(cryptoCurrency.toLowerCase())) {
      return res.status(400).json({ message: 'Invalid cryptocurrency' });
    }
    
    // Get user
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Check if user has enough USD
    if (user.wallet.usd < usdAmount) {
      return res.status(400).json({ message: 'Insufficient USD balance' });
    }
    
    // Convert USD to crypto
    const { cryptoAmount, price } = await usdToCrypto(usdAmount, cryptoCurrency);
    
    // Update user wallet
    user.wallet.usd -= usdAmount;
    user.wallet[cryptoCurrency] += cryptoAmount;
    await user.save();
    
    // Generate mock transaction hash
    const crypto = require('crypto');
    const transactionHash = '0x' + crypto.randomBytes(32).toString('hex');
    
    // Log transaction
    await Transaction.create({
      userId,
      roundId: 0, // Not associated with a game round
      usdAmount,
      cryptoAmount,
      cryptoCurrency,
      priceAtTime: price,
      transactionType: 'conversion',
      transactionHash
    });
    
    res.json({
      success: true,
      wallet: user.wallet,
      transaction: {
        usdAmount,
        cryptoAmount,
        cryptoCurrency,
        price,
        transactionHash
      }
    });
  } catch (error) {
    console.error('Error converting USD to crypto:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

/**
 * Convert crypto to USD in wallet
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const convertCryptoToUsd = async (req, res) => {
  try {
    const { amount, cryptoCurrency } = req.body;
    const userId = req.user.id;
    
    // Validate amount
    const cryptoAmount = parseFloat(amount);
    if (isNaN(cryptoAmount) || cryptoAmount <= 0) {
      return res.status(400).json({ message: 'Invalid amount' });
    }
    
    // Validate cryptocurrency
    if (!['btc', 'eth'].includes(cryptoCurrency.toLowerCase())) {
      return res.status(400).json({ message: 'Invalid cryptocurrency' });
    }
    
    // Get user
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Check if user has enough crypto
    if (user.wallet[cryptoCurrency] < cryptoAmount) {
      return res.status(400).json({ message: 'Insufficient crypto balance' });
    }
    
    // Convert crypto to USD
    const { usdAmount, price } = await cryptoToUsd(cryptoAmount, cryptoCurrency);
    
    // Update user wallet
    user.wallet[cryptoCurrency] -= cryptoAmount;
    user.wallet.usd += usdAmount;
    await user.save();
    
    // Generate mock transaction hash
    const crypto = require('crypto');
    const transactionHash = '0x' + crypto.randomBytes(32).toString('hex');
    
    // Log transaction
    await Transaction.create({
      userId,
      roundId: 0, // Not associated with a game round
      usdAmount,
      cryptoAmount,
      cryptoCurrency,
      priceAtTime: price,
      transactionType: 'conversion',
      transactionHash
    });
    
    res.json({
      success: true,
      wallet: user.wallet,
      transaction: {
        usdAmount,
        cryptoAmount,
        cryptoCurrency,
        price,
        transactionHash
      }
    });
  } catch (error) {
    console.error('Error converting crypto to USD:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

/**
 * Get transaction history
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getTransactionHistory = async (req, res) => {
  try {
    const userId = req.user.id;
    const { limit = 10, skip = 0, type } = req.query;
    
    // Build query
    const query = { userId };
    if (type && ['bet', 'cashout', 'conversion'].includes(type)) {
      query.transactionType = type;
    }
    
    // Get transactions
    const transactions = await Transaction.find(query)
      .sort({ timestamp: -1 })
      .skip(parseInt(skip))
      .limit(parseInt(limit));
    
    // Get total count
    const total = await Transaction.countDocuments(query);
    
    res.json({
      transactions,
      total,
      page: Math.floor(skip / limit) + 1,
      totalPages: Math.ceil(total / limit)
    });
  } catch (error) {
    console.error('Error getting transaction history:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export {
  getWalletBalance,
  convertUsdToCrypto,
  convertCryptoToUsd,
  getTransactionHistory
};  