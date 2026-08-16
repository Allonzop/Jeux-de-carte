import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Route, Routes, Navigate } from 'react-router-dom';
import './index.css';
import Home from './pages/Home';
import Play from './pages/Play';
import IntroSplash from './components/IntroSplash';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      {/* Écran de chargement d'ouverture, au-dessus de toutes les routes. */}
      <IntroSplash />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/play/:roomId" element={<Play />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>,
);
