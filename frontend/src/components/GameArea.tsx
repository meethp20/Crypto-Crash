import { useState, useEffect } from 'react';
import { useGame } from '../context/GameContext';

const GameArea = () => {
  const { currentMultiplier, isGameRunning, placeBet, cashOut, error, lastCrash, cryptoPrices } = useGame();
  const [betAmount, setBetAmount] = useState('');
  const [selectedCrypto, setSelectedCrypto] = useState('btc');
  const [cryptoAmount, setCryptoAmount] = useState('0');
  const [hasBet, setHasBet] = useState(false);

  // Update crypto amount whenever bet amount or selected crypto changes
  useEffect(() => {
    if (betAmount && !isNaN(Number(betAmount)) && cryptoPrices[selectedCrypto]) {
      const usdAmount = Number(betAmount);
      const cryptoValue = usdAmount / cryptoPrices[selectedCrypto];
      setCryptoAmount(cryptoValue.toFixed(8));
    } else {
      setCryptoAmount('0');
    }
  }, [betAmount, selectedCrypto, cryptoPrices]);

  // Reset bet state when game starts
  useEffect(() => {
    if (!isGameRunning) {
      setHasBet(false);
    }
  }, [isGameRunning]);

  const handlePlaceBet = () => {
    if (!betAmount || isNaN(Number(betAmount))) {
      console.error('Invalid bet amount:', betAmount);
      return;
    }
    
    const amount = Number(betAmount);
    if (amount <= 0) {
      console.error('Bet amount must be greater than 0');
      return;
    }

    try {
      console.log('Attempting to place bet:', {
        amount,
        selectedCrypto,
        cryptoAmount,
        cryptoPrice: cryptoPrices[selectedCrypto]
      });

      placeBet(amount, selectedCrypto);
      setHasBet(true);
    } catch (err) {
      console.error('Error placing bet:', err);
    }
  };

  const handleCryptoChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newCrypto = e.target.value;
    console.log('Changing crypto to:', newCrypto);
    setSelectedCrypto(newCrypto);
    // Recalculate crypto amount with new price
    if (betAmount && !isNaN(Number(betAmount)) && cryptoPrices[newCrypto]) {
      const usdAmount = Number(betAmount);
      const cryptoValue = usdAmount / cryptoPrices[newCrypto];
      setCryptoAmount(cryptoValue.toFixed(8));
    }
  };

  const handleBetAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value === '' || (!isNaN(Number(value)) && Number(value) >= 0)) {
      setBetAmount(value);
    }
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(price);
  };

  return (
    <div className="game-area">
      <div className="crypto-prices">
        <div className="price-item">
          <span>BTC:</span>
          <span>{formatPrice(cryptoPrices.btc)}</span>
        </div>
        <div className="price-item">
          <span>ETH:</span>
          <span>{formatPrice(cryptoPrices.eth)}</span>
        </div>
      </div>

      {lastCrash && !isGameRunning && (
        <div className="last-crash">
          Last Crash: {lastCrash.toFixed(2)}x
        </div>
      )}
      
      <div className={`multiplier ${isGameRunning ? 'running' : 'stopped'}`}>
        {currentMultiplier.toFixed(2)}x
      </div>

      {error && (
        <div className="error-message">
          {error}
        </div>
      )}

      <div className="controls">
        <div className="bet-controls">
          <select
            value={selectedCrypto}
            onChange={handleCryptoChange}
            disabled={isGameRunning || hasBet}
            className="crypto-select"
          >
            <option value="btc">Bitcoin (BTC)</option>
            <option value="eth">Ethereum (ETH)</option>
          </select>
          
          <div className="bet-input-group">
            <input
              placeholder="Bet amount in USD"
              value={betAmount}
              onChange={handleBetAmountChange}
              type="number"
              min="1"
              step="0.01"
              disabled={isGameRunning || hasBet}
              className="bet-input"
            />
            <div className="usd-label">USD</div>
          </div>

          <div className="crypto-conversion">
            <div className="crypto-amount">
              ≈ {cryptoAmount} {selectedCrypto.toUpperCase()}
            </div>
            <div className="crypto-value">
              {cryptoPrices[selectedCrypto] ? 
                `(1 ${selectedCrypto.toUpperCase()} = ${formatPrice(cryptoPrices[selectedCrypto])})` : 
                'Loading price...'
              }
            </div>
          </div>

          <button
            className="bet-button"
            onClick={handlePlaceBet}
            disabled={isGameRunning || hasBet || !betAmount || Number(betAmount) <= 0 || !cryptoPrices[selectedCrypto]}
          >
            {!cryptoPrices[selectedCrypto] ? 'Loading...' : hasBet ? 'Bet Placed' : 'Place Bet'}
          </button>
        </div>
        
        <button
          className="cashout-button"
          onClick={cashOut}
          disabled={!isGameRunning || !hasBet}
        >
          Cash Out @ {currentMultiplier.toFixed(2)}x
        </button>
      </div>
    </div>
  );
};

export default GameArea; 