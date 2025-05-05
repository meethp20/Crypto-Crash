import axios from 'axios';
import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

const CACHE_DURATION = 10000; // 10 seconds cache
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 second

const COINGECKO_API_URL = 'https://api.coingecko.com/api/v3';

class CryptoService {
  constructor() {
    this.priceCache = new Map();
    this.lastFetchTime = new Map();
    this.fetchPromises = new Map();
    this.prices = {
      btc: 0,
      eth: 0
    };
    this.lastUpdate = null;
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

  async fetchPriceWithRetry(cryptoCurrency, retryCount = 0) {
    try {
      const response = await axios.get('https://pro-api.coinmarketcap.com/v1/cryptocurrency/quotes/latest', {
        headers: {
          'X-CMC_PRO_API_KEY': process.env.COINMARKETCAP_API_KEY
        },
        params: {
          symbol: cryptoCurrency.toUpperCase(),
          convert: 'USD'
        }
      });

      const price = response.data.data[cryptoCurrency.toUpperCase()].quote.USD.price;
      return price;
    } catch (error) {
      if (retryCount < MAX_RETRIES) {
        console.warn(`Retry ${retryCount + 1}/${MAX_RETRIES} for ${cryptoCurrency}`);
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * (retryCount + 1)));
        return this.fetchPriceWithRetry(cryptoCurrency, retryCount + 1);
      }

      // If we still have a cached price, use it as fallback
      if (this.priceCache.has(cryptoCurrency.toLowerCase())) {
        console.warn(`Using cached price for ${cryptoCurrency} due to API error`);
        return this.priceCache.get(cryptoCurrency.toLowerCase());
      }

      throw new Error(`Failed to fetch price for ${cryptoCurrency} after ${MAX_RETRIES} retries`);
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