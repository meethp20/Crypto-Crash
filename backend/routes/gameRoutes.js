import express from 'express';
import { getCurrentGameInfo, getGameById, getGameHistoryController, placeGameBet, getUserBetHistory } from '../controllers/gameController.js';
import auth from '../middleware/auth.js';

const router = express.Router();

// @route   GET /api/game/current
// @desc    Get current game info
// @access  Public
router.get('/current', getCurrentGameInfo);

// @route   GET /api/game/:id
// @desc    Get game by ID
// @access  Public
router.get('/:id', getGameById);

// @route   GET /api/game/history
// @desc    Get game history
// @access  Public
router.get('/history/all', getGameHistoryController);

// Protected routes (require authentication)
// @route   POST /api/game/bet
// @desc    Place a bet
// @access  Private
router.post('/bet', auth, placeGameBet);

// @route   GET /api/game/history/user
// @desc    Get user's bet history
// @access  Private
router.get('/history/user', auth, getUserBetHistory);

export default router;