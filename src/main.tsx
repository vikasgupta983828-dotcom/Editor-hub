import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App.tsx';
import './index.css';

if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  registerSW({
    immediate: true,
    onRegisteredSW() {
      // Service worker active for standalone App Mode & offline shell caching
    },
  });
}

createRoot(document.getElementById('root')!).render(<App />);
