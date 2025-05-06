import { ChakraProvider } from '@chakra-ui/react'
import { GameProvider } from './context/GameContext'
import GameArea from './components/GameArea'
import WalletPanel from './components/WalletPanel'
import theme from './theme'
import './styles.css'

function App() {
  return (
    <ChakraProvider theme={theme}>
      <GameProvider>
        <div className="app">
          <h1 className="title">Crypto Crash</h1>
          <div className="game-wrapper">
            <div className="game-container">
              <GameArea />
            </div>
            <div className="side-panel">
              <WalletPanel />
            </div>
          </div>
        </div>
      </GameProvider>
    </ChakraProvider>
  )
}

export default App
