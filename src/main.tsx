import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { I18nProvider } from './i18n/I18nProvider'
import { AntdProvider } from './providers/AntdProvider'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <I18nProvider>
      <AntdProvider>
        <App />
      </AntdProvider>
    </I18nProvider>
  </StrictMode>,
)
