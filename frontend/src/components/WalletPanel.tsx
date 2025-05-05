import { useGame } from '../context/GameContext';

const WalletPanel = () => {
  const { walletBalance } = useGame();

  return (
    <div className="wallet-panel">
      <div className="balance-label">
        Balance
      </div>
      <div className="balance-amount">
        ${walletBalance.toFixed(2)}
      </div>
    </div>
  );
};

export default WalletPanel; 