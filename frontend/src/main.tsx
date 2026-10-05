import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { TooltipProvider } from './components/ui/tooltip'
import App from './App'
import './index.css'
import { probeApi } from './services/api'
import { getOrderRows } from './data/orders'

/* Probe the analytics API once at boot so the top bar shows the correct
   connection badge immediately. Never blocks rendering. */
void probeApi()
getOrderRows() // build the 50k-row fact table once, off the critical render path

const container = document.getElementById('root')
if (!container) throw new Error('Root container #root is missing from index.html')

createRoot(container).render(
  <StrictMode>
    <TooltipProvider>
      <App />
    </TooltipProvider>
  </StrictMode>,
)