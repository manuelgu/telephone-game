import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/patrick-hand/latin.css'
import '@fontsource/patrick-hand/latin-ext.css'
import './styles.css'
import { App } from './App'

// Block iOS pinch-zoom / double-tap zoom gestures outside of inputs.
document.addEventListener('gesturestart', (e) => e.preventDefault())
document.addEventListener(
  'touchmove',
  (e) => {
    if ((e as TouchEvent).touches.length > 1) e.preventDefault()
  },
  { passive: false },
)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
