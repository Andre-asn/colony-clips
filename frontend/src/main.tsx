import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import App from './App'
import { PublicVideoViewer } from './components/PublicVideoViewer'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/watch/:token" element={<PublicVideoViewer />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>,
)