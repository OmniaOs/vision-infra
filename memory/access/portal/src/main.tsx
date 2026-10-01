import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { AppProviders } from '@/app/app-providers'
import { AppRouter } from '@/app/app-router'
import { installCspNonce } from '@/shared/lib/install-csp-nonce'
import './index.css'

installCspNonce()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppProviders>
      <AppRouter />
    </AppProviders>
  </StrictMode>,
)
