import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import { installHapticClicks } from './lib/haptics'
import { installScrollTapGuard } from './lib/scrollTapGuard'

installHapticClicks()
installScrollTapGuard()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
