import crypto from 'crypto';

// Constants for crash point calculation
const HOUSE_EDGE = 0.01; // 1%
const MIN_CRASH_POINT = 1.01; // Minimum crash point (1.01x)
const MAX_CRASH_POINT = 1000.0; // Maximum crash point (1000x)

/**
 * Generates a cryptographically secure random seed
 * @returns {string} A random hex string
 */
const generateSeed = () => {
  return crypto.randomBytes(32).toString('hex');
};

/**
 * Creates a hash from the seed and round number
 * @param {string} seed - The random seed
 * @param {number} roundId - The game round ID
 * @returns {string} The resulting hash
 */
const createHash = (seed, roundId) => {
  return crypto
    .createHash('sha256')
    .update(`${seed}-${roundId}`)
    .digest('hex');
};

/**
 * Converts a hex hash to a float between 0 and 1
 * @param {string} hash - The hex hash to convert
 * @returns {number} A float between 0 and 1
 */
const hashToFloat = (hash) => {
  const divisor = Math.pow(2, 52); // Use 52 bits for better distribution
  const decimal = parseInt(hash.slice(0, 13), 16);
  return decimal / divisor;
};

/**
 * Calculates the crash point from a float value
 * @param {number} float - A float between 0 and 1
 * @returns {number} The crash point multiplier
 */
const calculateCrashPoint = (float) => {
  // Formula: 0.99 / (1 - float)
  // This creates a distribution where:
  // - Most crash points are low (1x-2x)
  // - Medium crash points are less common (2x-10x)
  // - High crash points are rare (10x+)
  const point = Math.floor((1 - HOUSE_EDGE) / (1 - float) * 100) / 100;
  return Math.min(Math.max(point, MIN_CRASH_POINT), MAX_CRASH_POINT);
};

/**
 * Generates game data for a round
 * @param {number} roundId - The game round ID
 * @returns {{seed: string, hash: string, crashPoint: number}} Game round data
 */
const generateGameData = (roundId) => {
  const seed = generateSeed();
  const hash = createHash(seed, roundId);
  const float = hashToFloat(hash);
  const crashPoint = calculateCrashPoint(float);

  return { seed, hash, crashPoint };
};

/**
 * Verifies a game round's crash point
 * @param {string} seed - The revealed seed
 * @param {number} roundId - The game round ID
 * @param {number} crashPoint - The claimed crash point
 * @returns {boolean} Whether the crash point is valid
 */
const verifyGameRound = (seed, roundId, crashPoint) => {
  const hash = createHash(seed, roundId);
  const float = hashToFloat(hash);
  const calculatedCrashPoint = calculateCrashPoint(float);
  
  // Allow for small floating-point differences
  return Math.abs(calculatedCrashPoint - crashPoint) < 0.01;
};

/**
 * Generates proof data for client verification
 * @param {string} seed - The random seed
 * @param {number} roundId - The game round ID
 * @returns {{hash: string, float: number, calculation: string}} Proof data
 */
const generateProofData = (seed, roundId) => {
  const hash = createHash(seed, roundId);
  const float = hashToFloat(hash);
  const calculation = `crashPoint = ${1 - HOUSE_EDGE} / (1 - ${float})`;

  return {
    hash,
    float,
    calculation
  };
};

export {
  generateGameData,
  verifyGameRound,
  generateProofData,
  HOUSE_EDGE,
  MIN_CRASH_POINT,
  MAX_CRASH_POINT
};