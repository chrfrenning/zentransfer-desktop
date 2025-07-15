import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';

// Import CSS (Tailwind will be processed by Vite)
import '../input.css';

// Ensure the Electron API is available before rendering
if (!window.electronAPI) {
  console.error('Electron API not available. Make sure preload script is loaded.');
}

// Create React root and render the app
const root = ReactDOM.createRoot(document.getElementById('root'));

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Log that React app has been initialized
console.log('ZenTransfer React App initialized');

// For development: expose React DevTools
if (typeof window !== 'undefined' && window.__REACT_DEVTOOLS_GLOBAL_HOOK__) {
  window.__REACT_DEVTOOLS_GLOBAL_HOOK__.checkDCE = () => {};
} 