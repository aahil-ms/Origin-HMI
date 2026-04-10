import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import Simulation from './pages/Simulation.jsx'
import './index.css'

// Simple pathname router — no React Router needed
const path = window.location.pathname

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {path === '/simulation' ? <Simulation /> : <App />}
  </React.StrictMode>,
)
