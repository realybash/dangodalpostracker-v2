import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, ShieldAlert, MessageCircle } from 'lucide-react';
import { WhatsAppSupportButton } from './WhatsAppSupportButton';

interface Props {
  children: ReactNode;
  sectionTitle?: string;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
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

  private handleRetry = () => {
    (this as any).setState({ hasError: false, error: null, errorInfo: null });
  };

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
    const props = (this as any).props;
    const state = (this as any).state;

    if (state.hasError) {
      if (props.fallback) {
        return props.fallback;
      }

      let errorMessage = state.error?.message || "The application encountered an unexpected view error. Please try again.";
      let isQuotaError = false;

      // Try to parse the error if it looks like our JSON firestore error
      try {
        const error = state.error;
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
        <div className="flex flex-col items-center justify-center p-6 bg-neutral-50 dark:bg-neutral-900/90 rounded-2xl border border-neutral-200 dark:border-neutral-800 text-center my-4 shadow-xs min-h-[220px]">
          <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-4 shadow-xs ${isQuotaError ? 'bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400' : 'bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-400'}`}>
            {isQuotaError ? <AlertTriangle className="w-7 h-7" /> : <ShieldAlert className="w-7 h-7" />}
          </div>
          <h3 className="text-xl font-black text-neutral-800 dark:text-white mb-2">
            {props.sectionTitle ? `${props.sectionTitle} Section Error` : (isQuotaError ? "Database Limit Reached" : "Something went wrong")}
          </h3>
          <p className="text-xs text-neutral-600 dark:text-neutral-400 mb-6 max-w-md mx-auto leading-relaxed font-medium">
            {errorMessage}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2.5">
            <button 
              type="button"
              onClick={this.handleRetry}
              className="px-5 py-2.5 bg-emerald-600 text-white font-bold text-xs rounded-xl hover:bg-emerald-500 transition-colors shadow-xs flex items-center gap-1.5 cursor-pointer active:scale-95"
            >
              <span>Try Again</span>
            </button>
            <button 
              type="button"
              onClick={() => window.location.reload()}
              className="px-5 py-2.5 bg-neutral-900 dark:bg-neutral-800 text-white font-bold text-xs rounded-xl hover:bg-neutral-800 transition-colors shadow-xs cursor-pointer active:scale-95"
            >
              Refresh Application
            </button>
            <button 
              type="button"
              onClick={this.handleHardReset}
              className="px-5 py-2.5 bg-amber-600 text-white font-bold text-xs rounded-xl hover:bg-amber-700 transition-colors shadow-xs cursor-pointer active:scale-95"
              title="Clears local cache and reloads application"
            >
              Hard Reset (Clear Cache)
            </button>
            <WhatsAppSupportButton 
              context="Application Error"
              issue={state.error?.message || 'Unexpected application error'}
              buttonText="Contact Support"
              variant="primary"
            />
          </div>
          <p className="text-[11px] text-neutral-400 dark:text-neutral-500 mt-4 font-mono">
            If the problem continues, contact POSTRACK Support (+2348141106560)
          </p>
        </div>
      );
    }

    return props.children;
  }
}
