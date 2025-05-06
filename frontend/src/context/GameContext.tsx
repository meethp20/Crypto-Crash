import React, { createContext, useContext, useEffect, useState } from 'react';
import io, { Socket } from 'socket.io-client';

interface GameContextType {
  currentMultiplier: number;
  isGameRunning: boolean;
  walletBalance: number;
  placeBet: (amount: number, cryptoCurrency: string) => void;
  cashOut: () => void;
  error: string | null;
  lastCrash: number | null;
  cryptoPrices: {
    btc: number;
    eth: number;
  };
}

// Backend connection configuration
const BACKEND_URL = 'http://localhost:5001';
const SOCKET_OPTIONS = {
  transports: ['websocket', 'polling'],  // Try websocket first, fall back to polling
  reconnection: true,
  reconnectionAttempts: 10,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  timeout: 20000,
  autoConnect: true,
  forceNew: true
};

const GameContext = createContext<GameContextType | undefined>(undefined);

export const GameProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [currentMultiplier, setCurrentMultiplier] = useState(1.00);
  const [isGameRunning, setIsGameRunning] = useState(false);
  const [walletBalance, setWalletBalance] = useState(1000);
  const [error, setError] = useState<string | null>(null);
  const [lastCrash, setLastCrash] = useState<number | null>(null);
  const [currentBet, setCurrentBet] = useState<number | null>(null);
  const [cryptoPrices, setCryptoPrices] = useState<{ btc: number; eth: number }>({
    btc: 0,
    eth: 0
  });

  useEffect(() => {
    const connectToServer = () => {
      console.log(`Attempting to connect to ${BACKEND_URL}`);
      
      const newSocket = io(BACKEND_URL, SOCKET_OPTIONS);

      newSocket.on('connect_error', (error) => {
        console.error('Connection error:', error);
        setError('Failed to connect to game server. Please try again later.');
      });

      newSocket.on('connect', () => {
        console.log('Connected to game server');
        setError(null);
        newSocket.emit('getGameState');
      });

      newSocket.on('disconnect', () => {
        console.log('Disconnected from game server');
        setError('Connection lost. Reconnecting...');
      });

      newSocket.on('gameState', (data) => {
        console.log('Received game state:', data);
        setCurrentMultiplier(data.multiplier);
        setIsGameRunning(data.isRunning);
        setWalletBalance(data.balance || 1000);
        setLastCrash(data.lastCrash);
        if (data.cryptoPrices) {
          setCryptoPrices(data.cryptoPrices);
        }
      });

      newSocket.on('cryptoPrices', (data) => {
        console.log('Received crypto prices:', data);
        setCryptoPrices(data.prices);
      });

      newSocket.on('gameUpdate', (data) => {
        console.log('Received game update:', data);
        switch (data.type) {
          case 'new_round':
            setIsGameRunning(false);
            setCurrentMultiplier(1.00);
            setCurrentBet(null);
            setError(null);
            break;
          case 'round_started':
            setIsGameRunning(true);
            setError(null);
            break;
          case 'multiplier_update':
            setCurrentMultiplier(data.multiplier);
            break;
          case 'round_crashed':
            setIsGameRunning(false);
            setLastCrash(data.crashPoint);
            if (currentBet) {
              setError('Game crashed! Better luck next time!');
            }
            break;
          case 'bet_placed':
            setWalletBalance(prev => prev - data.amount);
            setCurrentBet(data.amount);
            setError(null);
            break;
          case 'cashout_success':
            setWalletBalance(prev => prev + (data.amount * currentMultiplier));
            setCurrentBet(null);
            setError(null);
            break;
          case 'error':
            setError(data.message);
            break;
        }
      });

      setSocket(newSocket);
      return newSocket;
    };

    const socket = connectToServer();
    return () => {
      socket.close();
    };
  }, []);

  const placeBet = (amount: number, cryptoCurrency: string) => {
    if (!socket?.connected) {
      setError('Not connected to server');
      return;
    }
    if (amount <= 0) {
      setError('Invalid bet amount');
      return;
    }
    if (amount > walletBalance) {
      setError('Insufficient balance');
      return;
    }
    if (isGameRunning) {
      setError('Cannot bet while game is running');
      return;
    }
    if (!cryptoPrices[cryptoCurrency.toLowerCase() as 'btc' | 'eth']) {
      setError('Invalid cryptocurrency selected');
      return;
    }

    try {
      console.log('Placing bet:', {
        amount,
        cryptoCurrency,
        priceAtBet: cryptoPrices[cryptoCurrency.toLowerCase() as 'btc' | 'eth']
      });

      setError(null); // Clear any previous errors
      socket.emit('place_bet', { 
        amount,
        cryptoCurrency,
        priceAtBet: cryptoPrices[cryptoCurrency.toLowerCase() as 'btc' | 'eth']
      });
    } catch (err) {
      console.error('Error emitting bet:', err);
      setError('Failed to place bet. Please try again.');
    }
  };

  const cashOut = () => {
    if (!socket?.connected) {
      setError('Not connected to server');
      return;
    }
    if (!isGameRunning) {
      setError('Game is not running');
      return;
    }
    if (!currentBet) {
      setError('No active bet to cash out');
      return;
    }

    try {
      setError(null); // Clear any previous errors
      socket.emit('cashout');
    } catch (err) {
      console.error('Error emitting cashout:', err);
      setError('Failed to cash out. Please try again.');
    }
  };

  return (
    <GameContext.Provider value={{
      currentMultiplier,
      isGameRunning,
      walletBalance,
      placeBet,
      cashOut,
      error,
      lastCrash,
      cryptoPrices
    }}>
      {children}
    </GameContext.Provider>
  );
};

export const useGame = () => {
  const context = useContext(GameContext);
  if (context === undefined) {
    throw new Error('useGame must be used within a GameProvider');
  }
  return context;
}; 