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

const params = new URLSearchParams(window.location.search);
// Planches de debug (développement et captures)
if (params.has('koitex')) void import('./ui/devKoiTextures').then((m) => m.renderKoiSheet(root));
else
  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
