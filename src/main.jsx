import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import { IosInstallHint } from './components/IosInstallHint.jsx'
import { PwaUpdateToast } from './components/PwaUpdateToast.jsx'
import { syncIosStatusBar } from './iosSupport.js'

const darkScheme = window.matchMedia('(prefers-color-scheme: dark)')
const applyStatusBar = () => syncIosStatusBar(document, darkScheme.matches)
applyStatusBar()
darkScheme.addEventListener('change', applyStatusBar)

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
    <PwaUpdateToast />
    <IosInstallHint />
  </StrictMode>,
)
