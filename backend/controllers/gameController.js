import User from '../models/User.js';
import GameRound from '../models/GameRounds.js';
import { getGameInfo, getGameHistory, placeBet } from '../services/gameServices.js';

/**
 * Get current game info
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const getCurrentGameInfo = async (req, res) => {
  try {
    const game = await getGameInfo();
    res.json(game);
  } catch (error) {
    console.error('Error getting current game:', error);
    res.status(500).json({ message: error.message });
  }
};

/**
 * Get game by ID
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const getGameById = async (req, res) => {
  try {
    const { id } = req.params;
    const game = await getGameInfo(parseInt(id));
    res.json(game);
  } catch (error) {
    console.error('Error getting game by ID:', error);
    res.status(500).json({ message: error.message });
  }
};

/**
 * Get game history
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const getGameHistoryController = async (req, res) => {
  try {
    const { limit = 10 } = req.query;
    const games = await getGameHistory(parseInt(limit));
    res.json(games);
  } catch (error) {
    console.error('Error getting game history:', error);
    res.status(500).json({ message: error.message });
  }
};

/**
 * Place a bet
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const placeGameBet = async (req, res) => {
  try {
    const { usdAmount, cryptoCurrency, cryptoAmount, priceAtBet } = req.body;
    const userId = req.user.id;
    const username = req.user.username;

    const bet = await placeBet(
      userId,
      username,
      parseFloat(usdAmount),
      cryptoCurrency,
      parseFloat(cryptoAmount),
      parseFloat(priceAtBet)
    );

    res.json(bet);
  } catch (error) {
    console.error('Error placing bet:', error);
    res.status(400).json({ message: error.message });
  }
};

/**
 * Get user's bet history
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const getUserBetHistory = async (req, res) => {
  try {
    const userId = req.user.id;
    const { limit = 10, skip = 0 } = req.query;

    const bets = await GameRound.find({
      'bets.userId': userId
    })
      .sort({ roundId: -1 })
      .skip(parseInt(skip))
      .limit(parseInt(limit));

    const userBets = bets.map(game => ({
      roundId: game.roundId,
      crashPoint: game.crashPoint,
      status: game.status,
      bet: game.bets.find(bet => bet.userId.toString() === userId)
    }));

    res.json(userBets);
  } catch (error) {
    console.error('Error getting user bet history:', error);
    res.status(500).json({ message: error.message });
  }
};