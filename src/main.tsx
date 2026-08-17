import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';
import { SplashScreen } from '@capacitor/splash-screen';

// Initialize Capacitor native features when running in Android app
if (typeof window !== 'undefined' && Capacitor.isNativePlatform()) {
  StatusBar.setStyle({ style: Style.Dark }).catch(() => {});
  StatusBar.setBackgroundColor({ color: '#0a0f1d' }).catch(() => {});
  SplashScreen.hide().catch(() => {});
}

// Global safe alert override for iframe compatibility
if (typeof window !== 'undefined') {
  const originalAlert = window.alert;
  window.alert = function (message) {
    console.log('[Safe Alert Interceptor]:', message);
    try {
      // Try calling native alert. If it's blocked by the iframe sandbox, handle it gracefully.
      originalAlert(message);
    } catch (e) {
      console.warn('Native alert() was blocked by iframe sandbox restrictions. Gracefully falling back to toast notification.', e);
      // Dispatch custom notification event for App.tsx toast system
      window.dispatchEvent(new CustomEvent('app-show-notification', {
        detail: { message: String(message), type: 'info' }
      }));
    }
  };
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
