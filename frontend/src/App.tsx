import { GameProvider } from './context/GameContext'
import GameArea from './components/GameArea'
import WalletPanel from './components/WalletPanel'
import './styles.css'

function App() {
  return (
    <GameProvider>
      <div className="app">
        <div className="container">
          <h1 className="title">Crypto Crash</h1>
          <GameArea />
          <WalletPanel />
        </div>
      </div>
    </GameProvider>
  )
}

export default App
