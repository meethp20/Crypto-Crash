import express from 'express';
import { getWalletBalance, convertUsdToCrypto, convertCryptoToUsd, getTransactionHistory } from '../controllers/walletController.js';
import auth from '../middleware/auth.js';

const router = express.Router();

// Apply auth middleware to all wallet routes
router.use(auth);

// @route   GET /api/wallet
// @desc    Get wallet balance
// @access  Private
router.get('/', getWalletBalance);

// @route   POST /api/wallet/usd-to-crypto
// @desc    Convert USD to crypto
// @access  Private
router.post('/usd-to-crypto', convertUsdToCrypto);

// @route   POST /api/wallet/crypto-to-usd
// @desc    Convert crypto to USD
// @access  Private
router.post('/crypto-to-usd', convertCryptoToUsd);

// @route   GET /api/wallet/transactions
// @desc    Get transaction history
// @access  Private
router.get('/transactions', getTransactionHistory);

export default router;