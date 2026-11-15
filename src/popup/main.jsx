import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/inter';
import './styles.css';
import App from './App.jsx';
import { ToastProvider } from './components/Toast.jsx';

if (new URLSearchParams(location.search).has('window')) {
  document.body.classList.add('as-window');
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ToastProvider>
      <App />
    </ToastProvider>
  </StrictMode>,
);
