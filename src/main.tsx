import '@fontsource/zen-maru-gothic/latin-400.css';
import '@fontsource/zen-maru-gothic/latin-500.css';
import '@fontsource/zen-maru-gothic/latin-700.css';
import './ui/styles.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { applyUrlDebug } from './engine/debug';
import { App } from './ui/App';

applyUrlDebug(window.location.search);

const root = document.getElementById('root');
if (!root) throw new Error('#root introuvable');

if (import.meta.env.DEV || new URLSearchParams(window.location.search).has('koitex')) {
  if (new URLSearchParams(window.location.search).has('koitex')) {
    void import('./ui/devKoiTextures').then((m) => m.renderKoiSheet(root));
  }
}

if (!new URLSearchParams(window.location.search).has('koitex'))
  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
