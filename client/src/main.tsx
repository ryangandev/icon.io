import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './ui/zumpo.css';
import './app.css';
import { App } from './app';

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
