// Shared styles load first so each mode's own stylesheet can refine them.
import './ui/tokens.css';
import './ui/base.css';
import './ui/ui.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import { registerServiceWorker } from './app/update';

const root = document.getElementById('root');
if (!root) throw new Error('Missing #root element.');

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

if (import.meta.env.PROD) registerServiceWorker();
