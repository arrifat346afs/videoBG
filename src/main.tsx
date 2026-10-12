import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';
import { TooltipProvider } from '@/components/ui/tooltip';
import { readShareFromUrl } from './ui/share.ts';
import { useAppStore } from './ui/store.ts';

document.documentElement.classList.add('dark');

// Load shareable URL (#seed+params) before first render.
const shared = readShareFromUrl();
if (shared) {
  useAppStore.getState().loadSnapshot({
    seed: shared.s,
    generatorId: shared.g,
    params: shared.p,
    post: shared.post,
    layers: shared.layers,
    activeLayer: shared.activeLayer,
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <TooltipProvider delayDuration={200}>
      <App />
    </TooltipProvider>
  </StrictMode>,
);
