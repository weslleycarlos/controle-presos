import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import { ProvedorTema } from './TemaContext.jsx';
import { ProvedorAuth } from './AuthContext.jsx';
import './index.css' // <-- MUITO IMPORTANTE!

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ProvedorTema> 
      <ProvedorAuth> 
        <App />
      </ProvedorAuth>
    </ProvedorTema>
  </React.StrictMode>,
)