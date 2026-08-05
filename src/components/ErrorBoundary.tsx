import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, ShieldAlert, MessageCircle } from 'lucide-react';
import { WhatsAppSupportButton } from './WhatsAppSupportButton';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error caught by ErrorBoundary:", error);
    console.error("Component stack trace:", errorInfo.componentStack);
    (this as any).setState({ errorInfo });
  }

  private handleHardReset = () => {
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch (e) {
      console.error("Failed to clear local storage during reset:", e);
    }
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      let errorMessage = "The application encountered a critical error. Please refresh the page.";
      let isQuotaError = false;

      // Try to parse the error if it looks like our JSON firestore error
      try {
        const error = (this.state as any).error;
        if (error && error.message) {
          const parsed = JSON.parse(error.message);
          if (parsed.error && parsed.error.includes("Quota limit exceeded")) {
            isQuotaError = true;
            errorMessage = "Daily database limit reached (Firestore Quota). The application cannot load data right now. Please try again tomorrow or contact support.";
          }
        }
      } catch (e) {
        // Fallback to default
      }

      return (
        <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-neutral-50 dark:bg-neutral-900 text-center">
          <div className={`w-16 h-16 rounded-3xl flex items-center justify-center mb-6 shadow-sm ${isQuotaError ? 'bg-amber-50 text-amber-600' : 'bg-red-50 text-red-600'}`}>
            {isQuotaError ? <AlertTriangle className="w-8 h-8" /> : <ShieldAlert className="w-8 h-8" />}
          </div>
          <h2 className="text-2xl font-black text-neutral-800 dark:text-white mb-2">
            {isQuotaError ? "Database Limit Reached" : "Something went wrong."}
          </h2>
          <p className="text-neutral-600 dark:text-neutral-400 mb-8 max-w-md mx-auto leading-relaxed">
            {errorMessage}
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <button 
              onClick={() => window.location.reload()}
              className="w-full sm:w-auto px-6 py-3 bg-neutral-900 text-white font-bold text-xs rounded-xl hover:bg-neutral-800 transition-colors shadow-sm"
            >
              Refresh Application
            </button>
            <button 
              onClick={this.handleHardReset}
              className="w-full sm:w-auto px-6 py-3 bg-amber-600 text-white font-bold text-xs rounded-xl hover:bg-amber-700 transition-colors shadow-sm"
              title="Clears local cache and reloads application"
            >
              Hard Reset (Clear Cache)
            </button>
            <WhatsAppSupportButton 
              context="Application Error"
              issue={(this.state as any).error?.message || 'Unexpected application error'}
              buttonText="Contact Support on WhatsApp"
              variant="primary"
            />
          </div>
          <p className="text-[11px] text-neutral-400 dark:text-neutral-500 mt-4 font-mono">
            If the problem continues, contact POSTRACK Support (+2348141106560)
          </p>
        </div>
      );
    }

    return (this as any).props.children;
  }
}
