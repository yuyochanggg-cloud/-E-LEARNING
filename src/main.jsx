import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// 測試環境（npm run deploy:staging 建置時帶 VITE_APP_ENV=staging）：頂端掛醒目標示，避免跟正式站搞混
const isStaging = import.meta.env.VITE_APP_ENV === 'staging'
if (isStaging) document.title = '【測試環境】' + document.title

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {isStaging && (
      <div className="fixed top-0 inset-x-0 z-[10000] h-1.5 bg-orange-500 pointer-events-none">
        <span className="absolute left-1/2 -translate-x-1/2 top-0 px-3 py-0.5 rounded-b-lg bg-orange-500 text-white text-xs font-bold shadow">
          測試環境｜資料與正式站分開
        </span>
      </div>
    )}
    <App />
  </StrictMode>,
)
