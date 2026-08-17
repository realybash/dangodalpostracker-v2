import React, { useState, useEffect, useRef } from 'react';
import { Transaction, AppSettings, User, LowProfitAlert, ProviderType, TransactionType } from '../types';
import { formatNaira } from '../utils';
import { playStatusSound } from './TransactionForm';
import { 
  AlertTriangle, 
  TrendingDown, 
  Bell, 
  X, 
  Check, 
  CheckCheck, 
  Settings, 
  Sliders, 
  ArrowRight, 
  ShieldAlert, 
  DollarSign, 
  Trash2, 
  Zap,
  ChevronRight,
  UserCheck
} from 'lucide-react';

interface LowProfitAlertSystemProps {
  transactions: Transaction[];
  settings: AppSettings;
  currentUser: User;
  onOpenPricingRules: (initialProvider?: ProviderType, initialType?: TransactionType) => void;
  onOpenSettings: () => void;
  // Allows rendering the Bell button directly or standalone
  renderBellOnly?: boolean;
}

const STORAGE_KEY = 'OPay_LowProfit_Alerts_v1';

export function LowProfitAlertSystem({
  transactions,
  settings,
  currentUser,
  onOpenPricingRules,
  onOpenSettings,
  renderBellOnly = false
}: LowProfitAlertSystemProps) {
  const isManager = currentUser.role === 'Manager';
  const minThreshold = settings.minProfitThreshold ?? 50; // Default threshold ₦50
  const isAlertsEnabled = settings.lowProfitAlertsEnabled ?? true;

  const [alerts, setAlerts] = useState<LowProfitAlert[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  const [activeRealtimeAlert, setActiveRealtimeAlert] = useState<LowProfitAlert | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [filterProvider, setFilterProvider] = useState<string>('ALL');

  const knownTxIdsRef = useRef<Set<string>>(new Set());
  const initialLoadRef = useRef(true);

  // Save alerts to local storage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(alerts.slice(0, 100)));
    } catch (e) {
      console.error('[LowProfitAlerts] LocalStorage save failed:', e);
    }
  }, [alerts]);

  // Monitor incoming transactions for low profit violations
  useEffect(() => {
    if (!isAlertsEnabled) return;

    // Filter valid finished transactions
    const successfulTxs = transactions.filter(
      (tx) => (tx.status === 'Success' || !tx.status) && typeof tx.profit === 'number'
    );

    if (initialLoadRef.current) {
      // Seed existing known IDs and generate initial alerts for recent transactions below threshold
      const existingAlertsMap = new Map(alerts.map((a) => [a.transactionId, a]));
      const newAlertsList: LowProfitAlert[] = [...alerts];

      successfulTxs.forEach((tx) => {
        knownTxIdsRef.current.add(tx.id);
        if (tx.profit < minThreshold && !existingAlertsMap.has(tx.id)) {
          const alertObj: LowProfitAlert = {
            id: `alert-${tx.id}`,
            transactionId: tx.id,
            timestamp: tx.timestamp || new Date().toISOString(),
            amount: tx.amount,
            profit: tx.profit,
            threshold: minThreshold,
            provider: tx.provider,
            type: tx.type,
            customerFee: tx.customerFee,
            terminalFee: tx.terminalFee,
            cbnCharge: tx.cbnCharge,
            cashierName: tx.employeeName || tx.cashierId || 'Cashier',
            cashierId: tx.employeeId || tx.cashierId,
            isRead: false
          };
          newAlertsList.unshift(alertObj);
        }
      });

      setAlerts(newAlertsList);
      initialLoadRef.current = false;
      return;
    }

    // Process newly arrived transactions
    successfulTxs.forEach((tx) => {
      if (!knownTxIdsRef.current.has(tx.id)) {
        knownTxIdsRef.current.add(tx.id);

        if (tx.profit < minThreshold) {
          const alertObj: LowProfitAlert = {
            id: `alert-${tx.id}-${Date.now()}`,
            transactionId: tx.id,
            timestamp: tx.timestamp || new Date().toISOString(),
            amount: tx.amount,
            profit: tx.profit,
            threshold: minThreshold,
            provider: tx.provider,
            type: tx.type,
            customerFee: tx.customerFee,
            terminalFee: tx.terminalFee,
            cbnCharge: tx.cbnCharge,
            cashierName: tx.employeeName || tx.cashierId || 'Cashier',
            cashierId: tx.employeeId || tx.cashierId,
            isRead: false
          };

          setAlerts((prev) => [alertObj, ...prev.filter((a) => a.transactionId !== tx.id)]);

          if (isManager) {
            setActiveRealtimeAlert(alertObj);

            // Play warning acoustic chime
            if (settings.soundEnabled) {
              playStatusSound('Failed');
            }

            // Speech synthesis broadcast
            if (settings.voiceEnabled && 'speechSynthesis' in window) {
              try {
                window.speechSynthesis.cancel();
                const text = `Attention Manager: Low profit alert on ${tx.provider} transaction. Net profit is ${formatNaira(tx.profit)}, below ${formatNaira(minThreshold)} threshold.`;
                const utterance = new SpeechSynthesisUtterance(text);
                utterance.rate = 1.0;
                window.speechSynthesis.speak(utterance);
              } catch (err) {
                console.error(err);
              }
            }
          }
        }
      }
    });
  }, [transactions, minThreshold, isAlertsEnabled, isManager, settings.soundEnabled, settings.voiceEnabled]);

  const unreadAlertsCount = alerts.filter((a) => !a.isRead && !a.dismissed).length;

  const markAllRead = () => {
    setAlerts((prev) => prev.map((a) => ({ ...a, isRead: true })));
  };

  const clearAlerts = () => {
    setAlerts([]);
  };

  const handleAlertClickPricing = (alert: LowProfitAlert) => {
    setActiveRealtimeAlert(null);
    setIsDrawerOpen(false);
    onOpenPricingRules(alert.provider, alert.type);
  };

  const filteredAlerts = alerts.filter((a) => {
    if (filterProvider === 'ALL') return true;
    return a.provider === filterProvider;
  });

  // Render trigger button for managers
  const renderBellButton = () => {
    if (!isManager) return null;
    return (
      <button
        type="button"
        onClick={() => setIsDrawerOpen(true)}
        className={`relative p-2 rounded-2xl border transition-all cursor-pointer flex items-center gap-1.5 active:scale-95 ${
          unreadAlertsCount > 0
            ? 'bg-amber-500/10 border-amber-500/40 text-amber-700 hover:bg-amber-500/20 shadow-xs'
            : 'bg-white border-neutral-200 text-neutral-600 hover:bg-neutral-100'
        }`}
        title={`Low Profit Alerts (${unreadAlertsCount} unread)`}
      >
        <div className="relative">
          <Bell className={`w-4 h-4 ${unreadAlertsCount > 0 ? 'text-amber-600 animate-bounce' : ''}`} />
          {unreadAlertsCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 bg-rose-600 text-white text-[9px] font-black px-1 py-0.2 rounded-full min-w-[16px] text-center shadow-xs">
              {unreadAlertsCount}
            </span>
          )}
        </div>
        <span className="text-[11px] font-bold hidden md:inline">
          {unreadAlertsCount > 0 ? `${unreadAlertsCount} Alert${unreadAlertsCount > 1 ? 's' : ''}` : 'Low Profit Monitor'}
        </span>
      </button>
    );
  };

  if (renderBellOnly) {
    return renderBellButton();
  }

  return (
    <>
      {/* 1. REAL-TIME TOAST ALERT BANNER FOR MANAGERS */}
      {isManager && activeRealtimeAlert && (
        <div className="fixed top-3 left-1/2 -translate-x-1/2 z-50 w-full max-w-xl px-4 animate-slide-down">
          <div className="bg-gradient-to-r from-amber-900 via-stone-900 to-amber-950 text-white rounded-3xl p-4 shadow-2xl border border-amber-500/40 backdrop-blur-md relative overflow-hidden">
            {/* Ambient indicator accent */}
            <div className="absolute top-0 left-0 bottom-0 w-2 bg-gradient-to-b from-amber-400 to-rose-500" />

            <div className="flex items-start justify-between gap-3 pl-2">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl bg-amber-500/20 border border-amber-400/30 flex items-center justify-center shrink-0 text-amber-400 animate-pulse">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black uppercase tracking-wider bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-full border border-amber-400/30 font-mono">
                      Real-time Profit Alert
                    </span>
                    <span className="text-[10px] text-neutral-400 font-mono">
                      {new Date(activeRealtimeAlert.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <h4 className="text-sm font-extrabold text-white mt-0.5">
                    Low Profit: <span className="text-amber-400">{formatNaira(activeRealtimeAlert.profit)}</span>
                    <span className="text-xs text-neutral-300 font-normal ml-1">
                      (Threshold: {formatNaira(activeRealtimeAlert.threshold)})
                    </span>
                  </h4>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setActiveRealtimeAlert(null)}
                className="text-neutral-400 hover:text-white p-1 rounded-xl hover:bg-white/10 transition cursor-pointer"
                title="Dismiss Alert"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Alert Details Card */}
            <div className="mt-3 bg-black/40 rounded-2xl p-3 border border-white/10 grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] font-mono">
              <div>
                <span className="text-neutral-400 block text-[9px]">Provider / Type</span>
                <span className="font-bold text-amber-200">{activeRealtimeAlert.provider} ({activeRealtimeAlert.type})</span>
              </div>
              <div>
                <span className="text-neutral-400 block text-[9px]">Tx Amount</span>
                <span className="font-bold text-white">{formatNaira(activeRealtimeAlert.amount)}</span>
              </div>
              <div>
                <span className="text-neutral-400 block text-[9px]">Customer Fee</span>
                <span className="font-bold text-emerald-400">{formatNaira(activeRealtimeAlert.customerFee)}</span>
              </div>
              <div>
                <span className="text-neutral-400 block text-[9px]">Terminal Fee</span>
                <span className="font-bold text-rose-400">-{formatNaira(activeRealtimeAlert.terminalFee)}</span>
              </div>
            </div>

            {/* Actions Bar */}
            <div className="mt-3 flex items-center justify-between gap-2 flex-wrap pt-1">
              <span className="text-[10px] text-neutral-300 font-sans flex items-center gap-1">
                <UserCheck className="w-3 h-3 text-amber-400" /> Cashier: <strong className="text-white">{activeRealtimeAlert.cashierName}</strong>
              </span>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onOpenSettings}
                  className="px-2.5 py-1.5 bg-white/10 hover:bg-white/20 text-neutral-200 hover:text-white rounded-xl text-[11px] font-bold border border-white/15 transition cursor-pointer flex items-center gap-1"
                >
                  <Sliders className="w-3.5 h-3.5" />
                  <span>Adjust Threshold</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleAlertClickPricing(activeRealtimeAlert)}
                  className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-stone-950 rounded-xl text-[11px] font-black transition cursor-pointer flex items-center gap-1.5 shadow-md active:scale-95"
                >
                  <Zap className="w-3.5 h-3.5" />
                  <span>Quick Adjust Pricing Rules</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2. MANAGER LOW PROFIT ALERT CENTER DRAWER */}
      {isDrawerOpen && isManager && (
        <div className="fixed inset-0 z-50 bg-neutral-900/60 backdrop-blur-xs flex justify-end animate-fade-in font-sans">
          <div className="bg-white w-full max-w-lg h-full shadow-2xl flex flex-col border-l border-neutral-200 animate-slide-left">
            {/* Header */}
            <div className="p-5 border-b border-neutral-200 bg-neutral-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-white tracking-tight flex items-center gap-2">
                    Low Profit Alert Center
                    <span className="bg-amber-500 text-stone-950 text-[10px] font-black px-2 py-0.5 rounded-full font-mono">
                      Threshold: {formatNaira(minThreshold)}
                    </span>
                  </h3>
                  <p className="text-[11px] text-neutral-400 mt-0.5">
                    Monitors transactions where net agent profit fell below predefined minimum threshold.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsDrawerOpen(false)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-neutral-300 flex items-center justify-center cursor-pointer transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Controls Bar */}
            <div className="p-3.5 bg-neutral-50 border-b border-neutral-200 flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono font-bold text-neutral-500 uppercase">Provider Filter:</span>
                <select
                  value={filterProvider}
                  onChange={(e) => setFilterProvider(e.target.value)}
                  className="bg-white border border-neutral-200 text-neutral-800 text-xs font-bold rounded-xl px-2.5 py-1 focus:outline-none focus:border-amber-500"
                >
                  <option value="ALL">All Providers</option>
                  <option value="OPay">OPay</option>
                  <option value="Moniepoint">Moniepoint</option>
                  <option value="PalmPay">PalmPay</option>
                  <option value="Kuda">Kuda</option>
                  <option value="Nomba">Nomba</option>
                  <option value="Baxi">Baxi</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                {unreadAlertsCount > 0 && (
                  <button
                    type="button"
                    onClick={markAllRead}
                    className="text-[11px] font-bold text-neutral-600 hover:text-neutral-900 flex items-center gap-1 cursor-pointer bg-white px-2.5 py-1 rounded-xl border border-neutral-200 hover:bg-neutral-100"
                  >
                    <CheckCheck className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Mark all read</span>
                  </button>
                )}
                {alerts.length > 0 && (
                  <button
                    type="button"
                    onClick={clearAlerts}
                    className="text-[11px] font-bold text-rose-600 hover:text-rose-800 flex items-center gap-1 cursor-pointer bg-white px-2.5 py-1 rounded-xl border border-neutral-200 hover:bg-rose-50"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Clear</span>
                  </button>
                )}
              </div>
            </div>

            {/* Alert List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-neutral-100/50">
              {filteredAlerts.length === 0 ? (
                <div className="text-center py-16 px-4 space-y-3">
                  <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
                    <Check className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-neutral-800">No Low Profit Alerts</h4>
                    <p className="text-xs text-neutral-500 mt-1 max-w-xs mx-auto">
                      All transaction profits are currently at or above your minimum threshold of {formatNaira(minThreshold)}.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={onOpenSettings}
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-xl hover:bg-amber-100 transition cursor-pointer"
                  >
                    <Sliders className="w-3.5 h-3.5" />
                    <span>Adjust Minimum Threshold</span>
                  </button>
                </div>
              ) : (
                filteredAlerts.map((alert) => (
                  <div
                    key={alert.id}
                    className={`p-4 rounded-2xl border transition-all ${
                      !alert.isRead
                        ? 'bg-amber-50/80 border-amber-300/80 shadow-xs ring-1 ring-amber-400/30'
                        : 'bg-white border-neutral-200'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${!alert.isRead ? 'bg-amber-500 animate-ping' : 'bg-neutral-300'}`} />
                        <span className="text-[11px] font-extrabold text-neutral-800 uppercase font-mono">
                          {alert.provider} &bull; {alert.type}
                        </span>
                      </div>
                      <span className="text-[10px] text-neutral-400 font-mono">
                        {new Date(alert.timestamp).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                      </span>
                    </div>

                    <div className="mt-2 flex items-baseline justify-between">
                      <div>
                        <span className="text-[10px] text-neutral-500 font-mono uppercase block">Tx Amount</span>
                        <span className="text-sm font-extrabold text-neutral-900 font-mono">{formatNaira(alert.amount)}</span>
                      </div>

                      <div className="text-right">
                        <span className="text-[10px] text-amber-700 font-mono font-bold uppercase block">Recorded Profit</span>
                        <span className="text-base font-black text-rose-600 font-mono">{formatNaira(alert.profit)}</span>
                      </div>
                    </div>

                    {/* Breakdown */}
                    <div className="mt-2 pt-2 border-t border-neutral-200/60 grid grid-cols-3 gap-1 text-[10px] font-mono text-neutral-600">
                      <div>
                        <span className="text-neutral-400 block text-[9px]">Cust. Fee</span>
                        <span className="font-bold text-emerald-700">+{formatNaira(alert.customerFee)}</span>
                      </div>
                      <div>
                        <span className="text-neutral-400 block text-[9px]">Terminal Fee</span>
                        <span className="font-bold text-rose-600">-{formatNaira(alert.terminalFee)}</span>
                      </div>
                      <div>
                        <span className="text-neutral-400 block text-[9px]">Cashier</span>
                        <span className="font-bold text-neutral-800 truncate block">{alert.cashierName}</span>
                      </div>
                    </div>

                    {/* Action button */}
                    <div className="mt-3 pt-2 border-t border-neutral-200/60 flex items-center justify-between gap-2">
                      <span className="text-[10px] text-neutral-400 font-sans italic">
                        Shortfall: {formatNaira(alert.threshold - alert.profit)} below {formatNaira(alert.threshold)} limit
                      </span>

                      <button
                        type="button"
                        onClick={() => handleAlertClickPricing(alert)}
                        className="px-3 py-1.5 bg-[#00B87A] hover:bg-[#00a36c] text-white rounded-xl text-[11px] font-extrabold transition cursor-pointer flex items-center gap-1 shadow-xs active:scale-95"
                      >
                        <Zap className="w-3.5 h-3.5" />
                        <span>Adjust Pricing Rules</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-neutral-200 bg-neutral-50 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={onOpenSettings}
                className="text-xs font-bold text-neutral-700 hover:text-neutral-900 flex items-center gap-1.5 cursor-pointer"
              >
                <Sliders className="w-4 h-4 text-amber-600" />
                <span>Configure Profit Threshold ({formatNaira(minThreshold)})</span>
              </button>

              <button
                type="button"
                onClick={() => setIsDrawerOpen(false)}
                className="px-4 py-2 bg-neutral-900 hover:bg-black text-white text-xs font-bold rounded-xl cursor-pointer"
              >
                Close Panel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
