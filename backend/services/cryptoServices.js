import axios from 'axios';
import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

// Constants for API interactions
const CACHE_DURATION = 30000; // 30 seconds cache (increased from 10s)
const MAX_RETRIES = 5; // Increased from 3
const RETRY_DELAY = 1000; // 1 second
const RATE_LIMIT_DELAY = 60000; // 1 minute delay if rate limited

// API URLs
const COINGECKO_API_URL = 'https://api.coingecko.com/api/v3';
const COINMARKETCAP_API_URL = 'https://pro-api.coinmarketcap.com/v1';

/**
 * CryptoService class handles all cryptocurrency-related operations
 * including price fetching, caching, and currency conversions.
 */
class CryptoService {
  constructor() {
    // Price caching mechanism
    this.priceCache = new Map();
    this.lastFetchTime = new Map();
    this.fetchPromises = new Map();
    
    // Current prices
    this.prices = {
      btc: 0,
      eth: 0
    };
    
    // API state tracking
    this.lastUpdate = null;
    this.rateLimitHit = false;
    this.rateLimitResetTime = null;
    this.apiFailures = {
      coingecko: 0,
      coinmarketcap: 0
    };
    
    // Initialize with default values
    this.initializeDefaultPrices();
  }
  
  /**
   * Initialize default prices from a local source or reasonable estimates
   * This ensures the app can function even if APIs are temporarily unavailable
   */
  initializeDefaultPrices() {
    // Default prices based on recent market values (as of May 2023)
    this.prices = {
      btc: 30000, // Default BTC price in USD
      eth: 2000   // Default ETH price in USD
    };
    this.lastUpdate = Date.now();
  }

  async getPrice(cryptoCurrency) {
    const cacheKey = cryptoCurrency.toLowerCase();
    const now = Date.now();

    // Check if we have a valid cached price
    if (this.priceCache.has(cacheKey)) {
      const cachedData = this.priceCache.get(cacheKey);
      if (now - this.lastFetchTime.get(cacheKey) < CACHE_DURATION) {
        return cachedData;
      }
    }

    // Check if there's already a fetch in progress for this currency
    if (this.fetchPromises.has(cacheKey)) {
      return this.fetchPromises.get(cacheKey);
    }

    // Fetch new price with retries
    const fetchPromise = this.fetchPriceWithRetry(cryptoCurrency);
    this.fetchPromises.set(cacheKey, fetchPromise);

    try {
      const price = await fetchPromise;
      this.priceCache.set(cacheKey, price);
      this.lastFetchTime.set(cacheKey, now);
      return price;
    } finally {
      this.fetchPromises.delete(cacheKey);
    }
  }

  /**
   * Fetch cryptocurrency price with retry logic and fallback mechanisms
   * @param {string} cryptoCurrency - The cryptocurrency symbol (e.g., 'btc', 'eth')
   * @param {number} retryCount - Current retry attempt count
   * @param {boolean} useBackupApi - Whether to use the backup API
   * @returns {Promise<number>} The price in USD
   */
  async fetchPriceWithRetry(cryptoCurrency, retryCount = 0, useBackupApi = false) {
    // If we're rate limited, wait until reset time
    if (this.rateLimitHit && Date.now() < this.rateLimitResetTime) {
      console.log(`Rate limit in effect, using cached data for ${cryptoCurrency}`);
      
      // Use cached price if available
      if (this.priceCache.has(cryptoCurrency.toLowerCase())) {
        return this.priceCache.get(cryptoCurrency.toLowerCase());
      }
      
      // Otherwise use default price estimates
      return cryptoCurrency.toLowerCase() === 'btc' ? this.prices.btc : this.prices.eth;
    }
    
    try {
      let price;
      
      // Try CoinGecko first if not using backup API and if we haven't had too many failures
      if (!useBackupApi && this.apiFailures.coingecko < 3) {
        try {
          const response = await axios.get(`${COINGECKO_API_URL}/simple/price`, {
            params: {
              ids: cryptoCurrency.toLowerCase() === 'btc' ? 'bitcoin' : 'ethereum',
              vs_currencies: 'usd'
            },
            timeout: 5000 // 5 second timeout
          });
          
          // Extract price based on cryptocurrency
          if (cryptoCurrency.toLowerCase() === 'btc') {
            price = response.data.bitcoin.usd;
          } else {
            price = response.data.ethereum.usd;
          }
          
          // Reset failure counter for CoinGecko
          this.apiFailures.coingecko = 0;
          return price;
        } catch (coingeckoError) {
          // Increment failure counter for CoinGecko
          this.apiFailures.coingecko++;
          console.warn(`CoinGecko API error (failure #${this.apiFailures.coingecko}):`, coingeckoError.message);
          
          // Check for rate limiting
          if (coingeckoError.response && coingeckoError.response.status === 429) {
            this.rateLimitHit = true;
            this.rateLimitResetTime = Date.now() + RATE_LIMIT_DELAY;
            console.warn(`CoinGecko rate limit hit, will reset at ${new Date(this.rateLimitResetTime).toISOString()}`);
          }
          
          // Fall through to CoinMarketCap
        }
      }
      
      // Try CoinMarketCap as primary or fallback
      const response = await axios.get(`${COINMARKETCAP_API_URL}/cryptocurrency/quotes/latest`, {
        headers: {
          'X-CMC_PRO_API_KEY': process.env.COINMARKETCAP_API_KEY
        },
        params: {
          symbol: cryptoCurrency.toUpperCase(),
          convert: 'USD'
        },
        timeout: 5000 // 5 second timeout
      });

      price = response.data.data[cryptoCurrency.toUpperCase()].quote.USD.price;
      
      // Reset failure counter for CoinMarketCap
      this.apiFailures.coinmarketcap = 0;
      return price;
    } catch (error) {
      // Check for rate limiting
      if (error.response && error.response.status === 429) {
        this.rateLimitHit = true;
        this.rateLimitResetTime = Date.now() + RATE_LIMIT_DELAY;
        console.warn(`API rate limit hit, will reset at ${new Date(this.rateLimitResetTime).toISOString()}`);
      }
      
      // Increment failure counter for CoinMarketCap
      this.apiFailures.coinmarketcap++;
      
      // Retry logic
      if (retryCount < MAX_RETRIES) {
        const delay = RETRY_DELAY * Math.pow(2, retryCount); // Exponential backoff
        console.warn(`Retry ${retryCount + 1}/${MAX_RETRIES} for ${cryptoCurrency} in ${delay}ms`);
        await new Promise(resolve => setTimeout(resolve, delay));
        
        // If we've tried the primary API and failed, try the backup
        return this.fetchPriceWithRetry(cryptoCurrency, retryCount + 1, !useBackupApi);
      }

      // If we still have a cached price, use it as fallback
      if (this.priceCache.has(cryptoCurrency.toLowerCase())) {
        console.warn(`Using cached price for ${cryptoCurrency} due to API error`);
        return this.priceCache.get(cryptoCurrency.toLowerCase());
      }
      
      // Last resort: use default estimates
      console.warn(`Using default price estimate for ${cryptoCurrency} after all retries failed`);
      return cryptoCurrency.toLowerCase() === 'btc' ? this.prices.btc : this.prices.eth;
    }
  }

  async usdToCrypto(usdAmount, cryptoCurrency) {
    const price = await this.getPrice(cryptoCurrency);
    return {
      cryptoAmount: usdAmount / price,
      price
    };
  }

  async cryptoToUsd(cryptoAmount, cryptoCurrency) {
    const price = await this.getPrice(cryptoCurrency);
    return {
      usdAmount: cryptoAmount * price,
      price
    };
  }

  async updatePrices() {
    try {
      const response = await axios.get(`${COINGECKO_API_URL}/simple/price`, {
        params: {
          ids: 'bitcoin,ethereum',
          vs_currencies: 'usd'
        }
      });

      this.prices = {
        btc: response.data.bitcoin.usd,
        eth: response.data.ethereum.usd
      };
      this.lastUpdate = Date.now();
      return this.prices;
    } catch (error) {
      console.error('Error fetching crypto prices:', error);
      throw error;
    }
  }

  getPrices() {
    return this.prices;
  }

  getLastUpdate() {
    return this.lastUpdate;
  }

  startPriceUpdates(io) {
    // Update prices every 30 seconds
    setInterval(async () => {
      try {
        const prices = await this.updatePrices();
        io.emit('cryptoPrices', {
          prices,
          timestamp: this.lastUpdate
        });
      } catch (error) {
        console.error('Error in price update interval:', error);
      }
    }, 30000);
  }
}

// Create singleton instance
const cryptoService = new CryptoService();

// Export the conversion methods directly
export const usdToCrypto = (usdAmount, cryptoCurrency) => cryptoService.usdToCrypto(usdAmount, cryptoCurrency);
export const cryptoToUsd = (cryptoAmount, cryptoCurrency) => cryptoService.cryptoToUsd(cryptoAmount, cryptoCurrency);

export const generateTransactionHash = () => {
  return '0x' + crypto.randomBytes(32).toString('hex');
};

export default cryptoService;