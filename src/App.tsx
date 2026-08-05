/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useReducer, useEffect, useState, useMemo, useRef } from 'react';
import { AppState, AppAction, User, Transaction, UserRole, TransactionType, AppSettings, Expense, PosTerminal, ProviderType, HistoryFilter } from './types';
import { onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile, sendPasswordResetEmail, signOut, updatePassword } from 'firebase/auth';
import { collection, doc, query, where, onSnapshot, setDoc, getDoc, deleteDoc, writeBatch, getDocs, orderBy, limit, or, Timestamp, runTransaction, serverTimestamp } from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from './lib/firebase';
import { syncOfflineTransactions } from './lib/sync';
import { 
  getSeedTransactions, 
  computeTxMetrics, 
  formatNaira, 
  isSameDay, 
  isSameWeek, 
  isSameMonth, 
  isSameYear, 
  calculateTerminalFee,
  calculateCBNCharge,
  getRecommendedAgentFee,
  getProviderTransactionNumber,
  mapFirestoreUser,
  cleanPhoneForCompare,
  getAuthPassword,
  prepareFirestoreData,
  filterTransactionsByHistoryFilter,
  applyAdvancedFilter,
  getDefaultPricingProfiles,
  getCalculatedFinancials,
  REALISTIC_PROVIDER_CONFIGS,
  REALISTIC_REGULATORY_CONFIG,
  REALISTIC_PRICING_PROFILE,
  generateId,
  safeLocalStorageSet
} from './utils';
import {
  getCachedTransactions,
  saveCachedTransactions,
  getCachedExpenses,
  saveCachedExpenses,
  getCachedPosTerminals,
  saveCachedPosTerminals,
  getCachedUser,
  saveCachedUser,
  deleteCachedUser,
  getPendingTransactions,
  getPendingExpenses,
  getPendingPosTerminals,
  getPendingDeletions,
  savePendingTransaction,
  savePendingExpense,
  savePendingPosTerminal,
  savePendingDeletion
} from './lib/offlineDb';
import { logApprovalLifecycle } from './utils/approvalTracer';
import { MetricCards } from './components/MetricCards';
import { ManagerAggregatedStats } from './components/ManagerAggregatedStats';
import { ChargeMatrixSettings } from './components/ChargeMatrixSettings';
import { RealizedGainHistory } from './components/RealizedGainHistory';
import { TransactionForm } from './components/TransactionForm';
import { AudioRecorder } from './components/AudioRecorder';
import { CalendarFilter } from './components/CalendarFilter';
import { TransactionList } from './components/TransactionList';
import { BreakdownTable } from './components/BreakdownTable';
import { ProviderBreakdown } from './components/ProviderBreakdown';
import { TrendChart } from './components/TrendChart';
import { ProfileModal, renderUserAvatar } from './components/ProfileModal';
import { AnimatedNumber } from './components/AnimatedNumber';
import { SettingsModal } from './components/SettingsModal';
import { ShiftControlModal } from './components/ShiftControlModal';
import { BorrowKeepSection } from './components/BorrowKeepSection';
import { UnpaidChargesLedger } from './components/UnpaidChargesLedger';
import { EmployeeOversightBoard } from './components/EmployeeOversightBoard';
import { EditEmployeeModal } from './components/EditEmployeeModal';
import { CashierReconciliationCalculator } from './components/CashierReconciliationCalculator';
import { LoginScreen } from './components/LoginScreen';
import ReferralsTab from './components/ReferralsTab';
import { useFirebasePersistence } from './hooks/useFirebasePersistence';
import { resetAllData } from './lib/resetDatabase';
import { AdminPricingAudit } from './components/AdminPricingAudit';
import { PricingRuleManager } from './components/PricingRuleManager';
import { LowProfitAlertSystem } from './components/LowProfitAlertSystem';
import { WhatsAppSupportButton } from './components/WhatsAppSupportButton';
import { AuditPaymentHistory } from './components/AuditPaymentHistory';
import { BillingModal } from './components/BillingModal';
import { QRCodeSVG } from 'qrcode.react';
import { UploadReceiptModal } from './components/UploadReceiptModal';
import { SubscriptionDetailsModal } from './components/SubscriptionDetailsModal';
import { SubscriptionStatusWidget } from './components/SubscriptionStatusWidget';
import { NetworkAdvisorModal, NetworkAdvisorWidget } from './components/NetworkAdvisor';
import { 
  User as UserIcon,
  UserCheck, 
  Users, 
  ChevronDown,
  ChevronUp,
  ShieldCheck, 
  TrendingUp, 
  Settings, 
  Percent,
  Plus,
  HelpCircle,
  FileSpreadsheet,
  Menu,
  X,
  Smartphone,
  Eye,
  EyeOff,
  Bell,
  Headphones,
  ArrowRight,
  ArrowDownToLine,
  ArrowUpFromLine,
  ArrowRightLeft,
  CheckCircle2,
  Trash2,
  RotateCcw,
  Sparkles,
  Search,
  Target,
  Calculator,
  History,
  Lock,
  Unlock,
  Key,
  ShieldAlert, AlertTriangle,
  
  Calendar,
  FileText,
  Copy,
  Check,
  Pencil,
  Edit3,
  Receipt,
  TrendingDown,
  Tag,
  CreditCard,
  Upload,
  Wifi,
  Globe,
  RefreshCw,
  CheckCircle,
  XCircle,
  MapPin,
  Building,
  Cloud,
  CloudOff,
  WifiOff
} from 'lucide-react';

import { motion, AnimatePresence } from 'motion/react';

const LOCAL_STORAGE_KEY = 'POSTrack_State_Store_v5';

// Initial Users Seeding
const EMPLOYEES: User[] = [];

export const DEFAULT_SETTINGS: AppSettings = {
  soundEnabled: true,
  voiceEnabled: false,
  businessName: 'My Agency',
  receiptAddress: 'Your Address Here',
  receiptPhone: 'Your Phone Number',
  receiptFooter: 'Thank you for your business!',
  listDensity: 'comfortable',
  pageSize: 10,
  defaultProvider: 'OPay',
  defaultType: 'Withdrawal',
  chartStyle: 'line',
  darkMode: false,
  language: 'en',
  pricingProfiles: [REALISTIC_PRICING_PROFILE],
  selectedProfileId: REALISTIC_PRICING_PROFILE.id,
  profitWalletBalance: 0,
  providerConfigs: REALISTIC_PROVIDER_CONFIGS,
  regulatoryConfig: REALISTIC_REGULATORY_CONFIG
};

const DEFAULT_STATE: AppState = {
  currentUser: {
    id: '',
    name: 'Please Login',
    role: 'Employee',
    pin: '',
    phone: '',
    ownerId: ''
  },
  availableEmployees: EMPLOYEES,
  transactions: [],
  historyTransactions: [],
  selectedEmployeeFilter: 'ALL',
  activeTimeframe: 'Daily',
  terminalFeeRate: 0.5,
  dailyTarget: 3000,
  expenses: [],
  posTerminals: [],
  settings: DEFAULT_SETTINGS,
  historyFilter: { type: 'DAY_1' }
};

// Reducer implementation guaranteeing reactive immediate computation
function appReducer(state: AppState, action: AppAction): AppState {
  let nextState: AppState;

  switch (action.type) {
    case 'SWITCH_USER': {
      const nextUser = action.payload;
      // Safety rule constraints: Employees must strictly only filter to themselves!
      const nextFilter = nextUser.role === 'Manager' ? 'ALL' : nextUser.id;
      nextState = {
        ...state,
        currentUser: nextUser,
        selectedEmployeeFilter: nextFilter
      };
      break;
    }
    case 'SET_EMPLOYEE_FILTER': {
      // Employees are blocked from switching filters
      if (state.currentUser.role === 'Employee') {
        nextState = state;
      } else {
        nextState = {
          ...state,
          selectedEmployeeFilter: action.payload
        };
      }
      break;
    }
    case 'SET_TIMEFRAME': {
      let hFilterType: any = 'LIFETIME';
      if (action.payload === 'Daily') hFilterType = 'DAY_1';
      else if (action.payload === 'Weekly') hFilterType = 'THIS_WEEK';
      else if (action.payload === 'Monthly') hFilterType = 'THIS_MONTH';
      else if (action.payload === 'Yearly') hFilterType = 'THIS_YEAR';

      nextState = {
        ...state,
        activeTimeframe: action.payload,
        historyFilter: { ...state.historyFilter, type: hFilterType }
      };
      break;
    }
    case 'SET_HISTORY_FILTER': {
      let aTimeframe = state.activeTimeframe;
      if (action.payload.type === 'DAY_1') aTimeframe = 'Daily';
      else if (action.payload.type === 'THIS_WEEK') aTimeframe = 'Weekly';
      else if (action.payload.type === 'THIS_MONTH') aTimeframe = 'Monthly';
      else if (action.payload.type === 'THIS_YEAR') aTimeframe = 'Yearly';

      nextState = {
        ...state,
        historyFilter: action.payload,
        activeTimeframe: aTimeframe
      };
      break;
    }
    case 'SET_HISTORY_TRANSACTIONS': {
      nextState = {
        ...state,
        historyTransactions: action.payload
      };
      break;
    }
    case 'SET_TERMINAL_RATE': {
      nextState = {
        ...state,
        terminalFeeRate: action.payload
      };
      break;
    }
    case 'SET_DAILY_TARGET': {
      nextState = {
        ...state,
        dailyTarget: action.payload
      };
      break;
    }
    case 'ADD_TRANSACTION': {
      // Prepend so operations show right at the top
      nextState = {
        ...state,
        transactions: [action.payload, ...state.transactions],
        historyTransactions: [action.payload, ...state.historyTransactions]
      };
      break;
    }
    case 'UPDATE_TRANSACTION': {
      nextState = {
        ...state,
        transactions: state.transactions.map(t => t.id === action.payload.id ? action.payload : t),
        historyTransactions: state.historyTransactions.map(t => t.id === action.payload.id ? action.payload : t)
      };
      break;
    }
    case 'DELETE_TRANSACTION': {
      nextState = {
        ...state,
        transactions: state.transactions.filter(t => t.id !== action.payload),
        historyTransactions: state.historyTransactions.filter(t => t.id !== action.payload)
      };
      break;
    }
    case 'BULK_DELETE_TRANSACTIONS': {
      nextState = {
        ...state,
        transactions: state.transactions.filter(t => !action.payload.includes(t.id)),
        historyTransactions: state.historyTransactions.filter(t => !action.payload.includes(t.id))
      };
      break;
    }
    case 'BULK_UPDATE_TRANSACTIONS': {
      const payload = Array.isArray(action.payload) ? action.payload : [];
      nextState = {
        ...state,
        transactions: state.transactions.map((t) => {
          const match = payload.find((u) => u.id === t.id);
          return match ? match : t;
        }),
        historyTransactions: state.historyTransactions.map((t) => {
          const match = payload.find((u) => u.id === t.id);
          return match ? match : t;
        })
      };
      break;
    }
    case 'ADD_EXPENSE': {
      nextState = {
        ...state,
        expenses: [action.payload, ...state.expenses]
      };
      break;
    }
    case 'DELETE_EXPENSE': {
      nextState = {
        ...state,
        expenses: state.expenses.filter(e => e.id !== action.payload)
      };
      break;
    }
    case 'RESET_DATA': {
      nextState = {
        ...state,
        transactions: getSeedTransactions(state.terminalFeeRate),
        expenses: []
      };
      break;
    }
    case 'SET_TRANSACTIONS': {
      nextState = {
        ...state,
        transactions: action.payload
      };
      break;
    }
    case 'SET_EXPENSES': {
      nextState = {
        ...state,
        expenses: action.payload
      };
      break;
    }
    case 'SET_REGISTERED_USERS': {
      const ownerId = state.currentUser.role === 'Manager' ? state.currentUser.id : state.currentUser.ownerId;
      nextState = {
        ...state,
        availableEmployees: action.payload.filter(u => u.role === 'Employee' && u.ownerId === ownerId)
      };
      break;
    }
    case 'SET_POS_TERMINALS': {
      nextState = {
        ...state,
        posTerminals: action.payload
      };
      break;
    }
    case 'ADD_POS_TERMINAL': {
      nextState = {
        ...state,
        posTerminals: [action.payload, ...state.posTerminals]
      };
      break;
    }
    case 'UPDATE_POS_TERMINAL': {
      nextState = {
        ...state,
        posTerminals: state.posTerminals.map(p => p.id === action.payload.id ? action.payload : p)
      };
      break;
    }
    case 'DELETE_POS_TERMINAL': {
      nextState = {
        ...state,
        posTerminals: state.posTerminals.filter(p => p.id !== action.payload)
      };
      break;
    }
    case 'UPDATE_SETTINGS': {
      const payload = action.payload || {};
      nextState = {
        ...state,
        settings: {
          ...state.settings!,
          ...payload,
          providerConfigs: Array.isArray(payload.providerConfigs) 
            ? payload.providerConfigs 
            : (state.settings?.providerConfigs || DEFAULT_SETTINGS.providerConfigs),
          pricingProfiles: Array.isArray(payload.pricingProfiles)
            ? payload.pricingProfiles
            : (state.settings?.pricingProfiles || DEFAULT_SETTINGS.pricingProfiles)
        }
      };
      break;
    }
    case 'SET_IMPERSONATED_USER': {
      nextState = {
        ...state,
        impersonatedUserId: action.payload
      };
      break;
    }
    default:
      return state;
  }

  return nextState;
}

// Helper to initialize state from local storage securely
function initAppState(): AppState {
  try {
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      
      return {
        ...DEFAULT_STATE,
        ...parsed,
        availableEmployees: Array.isArray(parsed.availableEmployees) ? parsed.availableEmployees : [],
        currentUser: parsed.currentUser || DEFAULT_STATE.currentUser,
        // Make sure date values parsed as string can be computed elegantly
        transactions: (Array.isArray(parsed.transactions) ? parsed.transactions : []).map((t: any) => ({
          ...t,
          amount: parseFloat(t?.amount || 0),
          customerFee: parseFloat(t?.customerFee || 0),
          terminalFee: parseFloat(t?.terminalFee || 0),
          profit: parseFloat(t?.profit || 0)
        })),
        expenses: Array.isArray(parsed.expenses) ? parsed.expenses : [],
        posTerminals: Array.isArray(parsed.posTerminals) ? parsed.posTerminals : [],
        settings: {
          ...DEFAULT_SETTINGS,
          ...(parsed.settings || {}),
          providerConfigs: Array.isArray(parsed.settings?.providerConfigs) 
            ? parsed.settings.providerConfigs 
            : DEFAULT_SETTINGS.providerConfigs,
          pricingProfiles: Array.isArray(parsed.settings?.pricingProfiles)
            ? parsed.settings.pricingProfiles
            : DEFAULT_SETTINGS.pricingProfiles
        }
      };
    }
  } catch (err) {
    console.warn('LocalStorage state recovery skipped', err);
  }
  return DEFAULT_STATE;
}

export default function App() {
  const [state, dispatch] = useReducer(appReducer, undefined, initAppState);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // Manager Auth states
  const [cloudUser, setCloudUser] = useState<any>(null);
  
  const [appMode, setAppMode] = useState<'online' | 'offline'>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('POSTrack_Mode') as 'online' | 'offline') || 'online';
    }
    return 'online';
  });
  const [browserOnline, setBrowserOnline] = useState(typeof window !== 'undefined' ? window.navigator.onLine : true);
  const [isOnline, setIsOnline] = useState(() => {
    const initialMode = typeof window !== 'undefined' ? (localStorage.getItem('POSTrack_Mode') || 'online') : 'online';
    const initialNet = typeof window !== 'undefined' ? window.navigator.onLine : true;
    return initialNet && initialMode === 'online';
  });
  // Handle Referral Links & Session Guard
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const refCode = params.get('ref');
    
    if (refCode) {
      console.log('[Referral] Detected referral code in URL:', refCode);
      localStorage.setItem('pending_referral_code', refCode);
      localStorage.setItem('OPay_Saved_Referral_Code', refCode);
      
      const isSuperAdminUser = state.currentUser?.phone === '08141106560' || (state.currentUser as any)?.phoneNumber === '08141106560' || state.currentUser?.id === '08141106560';
      if (isSuperAdminUser) {
        console.log('[Referral] Super Admin session active. Skipping referral registration prompt to protect active session.');
        return;
      }

      if (!state.currentUser.id || state.currentUser.id === '') {
        setForceRegister(true);
      }
    }
  }, [state.currentUser]);

  const [isSyncing, setIsSyncing] = useState(false);
  const [indexedDbPendingCount, setIndexedDbPendingCount] = useState(0);

  const updateIndexedDbPendingCount = async () => {
    try {
      const [txs, expenses, terminals, deletions] = await Promise.all([
        getPendingTransactions(),
        getPendingExpenses(),
        getPendingPosTerminals(),
        getPendingDeletions()
      ]);
      const totalPending = txs.length + expenses.length + terminals.length + deletions.length;
      setIndexedDbPendingCount(totalPending);
      console.log(`[TRANSACTION SYNC TRACE] [IndexedDB State check] Updated pending count from IndexedDB. Total: ${totalPending} (Txs: ${txs.length}, Expenses: ${expenses.length}, Terminals: ${terminals.length}, Deletes: ${deletions.length})`);
    } catch (err) {
      console.error('[Sync] Failed to query IndexedDB pending queues:', err);
    }
  };

  const syncOwnerId = useMemo(() => {
    // If we have a profile loaded in state, that's the most reliable source for ownerId
    if (state.currentUser && state.currentUser.id && state.currentUser.id !== '' && state.currentUser.id !== 'mgr_1') {
      return state.currentUser.role === 'Manager' ? state.currentUser.id : state.currentUser.ownerId;
    }
    // Fallback to Auth UID if no profile yet (initial load)
    if (cloudUser) {
      return cloudUser.uid;
    }
    // Default fallback in AI Studio preview / sandbox
    return null;
  }, [cloudUser, state.currentUser]);

  // Unified registered users pool
  const [registeredUsers, setRegisteredUsers] = useState<User[]>(() => {
    try {
      const saved = localStorage.getItem('OPay_Registered_Users_v4');
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (err) {}
    return [];
  });
  const [isUsersLoaded, setIsUsersLoaded] = useState(false);

  useFirebasePersistence(setRegisteredUsers, setIsUsersLoaded, dispatch, syncOwnerId);

  // Super Admin check
  const isSuperAdmin = useMemo(() => {
    if (!state.currentUser) return false;
    if (state.currentUser.phone === '08141106560' || (state.currentUser as any).phoneNumber === '08141106560' || state.currentUser.id === '08141106560') {
      return true;
    }
    if (state.currentUser.role !== 'Manager') return false;
    const managers = registeredUsers.filter(u => u.role === 'Manager');
    if (managers.length === 0) return false;
    
    managers.sort((a, b) => {
      const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return aTime - bTime;
    });
    
    return managers[0].id === state.currentUser.id;
  }, [state.currentUser, registeredUsers]);

  // Team Users check
  const teamUsers = useMemo(() => {
    if (!state.currentUser || !state.currentUser.id) return [];
    
    const ownerId = state.currentUser.role === 'Manager' ? state.currentUser.id : state.currentUser.ownerId;
    return registeredUsers.filter(u => 
      u.id === ownerId || (u.role === 'Employee' && u.ownerId === ownerId) || u.id === state.currentUser.id
    );
  }, [state.currentUser, registeredUsers]);

  // STRICT SaaS Admin check for Payment Audit & Subscription Approvals
  const isSaaSAdmin = useMemo(() => {
    if (!state.currentUser) return false;
    return (
      state.currentUser.phone === '08141106560' || 
      (state.currentUser as any).phoneNumber === '08141106560' || 
      state.currentUser.id === '08141106560'
    );
  }, [state.currentUser]);

const getStoredApprovedTxIds = (): Set<string> => {
  try {
    const stored = JSON.parse(localStorage.getItem('POSTrack_Approved_Txs') || '[]');
    return new Set(Array.isArray(stored) ? stored : []);
  } catch (e) {
    return new Set();
  }
};

  // Compute number of items currently pending cloud sync
  const pendingSyncCount = useMemo(() => {
    return indexedDbPendingCount;
  }, [indexedDbPendingCount]);

  const optimisticApprovedTxsRef = useRef<Set<string>>(getStoredApprovedTxIds());

  // Sync state to local storage when database records mutate
  useEffect(() => {
    updateIndexedDbPendingCount();
  }, [state.transactions, state.expenses, state.posTerminals]);

  const [cloudLoading, setCloudLoading] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [isSessionLoaded, setIsSessionLoaded] = useState(false);

  // Temporary Toast state & ref for 5-second Settlement UNDO approval workflow
  const [approvalToast, setApprovalToast] = useState<{
    id: string;
    tx: Transaction;
    message: string;
    secondsRemaining: number;
  } | null>(null);
  const toastTimerRef = useRef<any>(null);

  const triggerApprovalToast = (tx: Transaction, approvedTx: Transaction) => {
    if (toastTimerRef.current) {
      clearInterval(toastTimerRef.current);
    }

    const p = tx.pendingSettlement;
    const amountStr = p ? `₦${p.paidAmount.toLocaleString()}` : '';
    const clientName = tx.customerName || 'Walk-in Client';

    setApprovalToast({
      id: tx.id,
      tx: approvedTx,
      message: `Approved settlement for ${clientName}${amountStr ? ` (${amountStr})` : ''}`,
      secondsRemaining: 5
    });

    toastTimerRef.current = setInterval(() => {
      setApprovalToast(prev => {
        if (!prev || prev.secondsRemaining <= 1) {
          clearInterval(toastTimerRef.current);
          return null;
        }
        return { ...prev, secondsRemaining: prev.secondsRemaining - 1 };
      });
    }, 1000);
  };

  // Sync state to local storage
  useEffect(() => {
    try {
      safeLocalStorageSet(LOCAL_STORAGE_KEY, JSON.stringify({
        transactions: state.transactions,
        expenses: state.expenses,
        availableEmployees: state.availableEmployees,
        terminalFeeRate: state.terminalFeeRate,
        dailyTarget: state.dailyTarget,
        selectedEmployeeFilter: state.selectedEmployeeFilter,
        activeTimeframe: state.activeTimeframe,
        historyFilter: state.historyFilter,
        currentUser: state.currentUser,
        settings: state.settings,
        impersonatedUserId: state.impersonatedUserId,
        posTerminals: state.posTerminals
      }));
      
      // Cloud backup for settings if ownerId is present
      if (syncOwnerId && state.settings && state.currentUser.role === 'Manager') {
        const settingsRef = doc(db, 'settings', syncOwnerId);
        setDoc(settingsRef, state.settings, { merge: true }).catch(err => {
          console.warn('Firestore settings sync failed:', err);
        });
      }
    } catch (err) {
      console.warn('LocalStorage save failed', err);
    }
  }, [state, syncOwnerId]);

  // Synchronize dark theme state with the DOM
  useEffect(() => {
    const isDark = state.settings?.darkMode ?? false;
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [state.settings?.darkMode]);

  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [preselectedFormType, setPreselectedFormType] = useState<TransactionType>('Withdrawal');
  const [preselectedMode, setPreselectedMode] = useState<'Standard' | 'SplitWithdrawal'>('Standard');
  const [helpBannerOpen, setHelpBannerOpen] = useState(true);
  const [hideBalances, setHideBalances] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [providerFilter, setProviderFilter] = useState<string>('ALL');
  const [filterDate, setFilterDate] = useState(new Date());
  const [selectedReceiptTx, setSelectedReceiptTx] = useState<Transaction | null>(null);
  const [copiedTxId, setCopiedTxId] = useState<string | null>(null);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isReconCalcOpen, setIsReconCalcOpen] = useState(false);
  const [isNetworkAdvisorOpen, setIsNetworkAdvisorOpen] = useState(false);
  const [isBillingModalOpen, setIsBillingModalOpen] = useState(false);
  const [isUploadReceiptModalOpen, setIsUploadReceiptModalOpen] = useState(false);
  const [isSubscriptionDetailsOpen, setIsSubscriptionDetailsOpen] = useState(false);
  const [forceRegister, setForceRegister] = useState(false);
  const [isSubscriptionExpiredDialogOpen, setIsSubscriptionExpiredDialogOpen] = useState(false);
  const [isRefreshingSubscription, setIsRefreshingSubscription] = useState(false);
  const [billingInitialPlan, setBillingInitialPlan] = useState<'Starter' | 'Professional' | 'Business' | 'Enterprise' | null>(null);
  const [editingEmployeeFromDashboard, setEditingEmployeeFromDashboard] = useState<User | null>(null);
  const [pricingInitialFilter, setPricingInitialFilter] = useState<{ provider?: ProviderType; type?: TransactionType } | null>(null);
  const [appNotification, setAppNotification] = useState<{message: string, type: 'success' | 'info' | 'error'} | null>(null);

  const handleOpenPricingRules = (initialProvider?: ProviderType, initialType?: TransactionType) => {
    if (initialProvider || initialType) {
      setPricingInitialFilter({ provider: initialProvider, type: initialType });
    } else {
      setPricingInitialFilter(null);
    }
    setDashboardTab('pricing');
  };

  const showAppNotification = (message: string, type: 'success' | 'info' | 'error' = 'success') => {
    setAppNotification({ message, type });
    setTimeout(() => setAppNotification(null), 5000);
  };

  // Compute metrics dynamically from visible transactions based on active permissions
  // Security Layer rule: Employees see ONLY their own txns. Managers see filtered employee or ALL.
  const authorizedTransactions = useMemo(() => {
    let txs = state.transactions;
    if (state.currentUser.role === 'Employee') {
      const cashierId = state.currentUser.id;
      // STRICT FILTERING: Employees MUST ONLY see their own transactions by unique ID.
      // We exclude name-based matching to prevent accidental data leaks.
      txs = txs.filter(t => t.employeeId === cashierId || t.cashierId === cashierId || t.createdBy === cashierId);
    } else {
      const teamUserIds = new Set(teamUsers.map(u => u.id));
      teamUserIds.add(state.currentUser.id);
      
      txs = txs.filter(t => 
        t.ownerId === state.currentUser.id ||
        (t as any).managerId === state.currentUser.id ||
        teamUserIds.has(t.employeeId) ||
        teamUserIds.has(t.cashierId) ||
        t.createdBy === state.currentUser.id ||
        (t.addedBy && teamUsers.some(u => u.name.toLowerCase().trim() === t.addedBy?.toLowerCase().trim()))
      );

      const targetUserId = state.impersonatedUserId || (state.selectedEmployeeFilter === 'ALL' ? undefined : state.selectedEmployeeFilter);
      if (targetUserId) {
        txs = txs.filter(t => t.employeeId === targetUserId || t.cashierId === targetUserId || t.ownerId === targetUserId || (t as any).managerId === targetUserId || t.createdBy === targetUserId);
      }
    }
    return txs;
  }, [state.transactions, state.currentUser, state.selectedEmployeeFilter, state.impersonatedUserId, teamUsers]);

  const unpaidTransactions = useMemo(() => {
    return authorizedTransactions.filter((tx) => {
      // Check if transaction has unpaid charges or debt fee
      const isUnpaidDebt = (tx.chargesStatus === 'Unpaid' || tx.chargesStatus === 'PartiallyPaid' || ((tx.unpaidFeeAmount || 0) > 0));
      // Check if cashier has submitted a settlement pending manager approval
      const isPendingSettlement = !!tx.pendingSettlement;

      // Filter out transactions that are already fully paid & approved without pending settlement
      const isFullyPaidAndApproved = (
        (tx.chargesStatus === 'Paid' || tx.chargesStatus === 'Waived' || tx.chargesStatus === 'Waive') && 
        !isPendingSettlement && 
        (tx.approvalStatus === 'approved' || tx.approved === true || tx.status === 'Paid' || tx.status === 'Settled')
      );

      const isNotFailed = (tx.status || 'Success') !== 'Failed';

      return (isUnpaidDebt || isPendingSettlement) && !isFullyPaidAndApproved && isNotFailed;
    });
  }, [authorizedTransactions]);

  const unpaidCount = unpaidTransactions.length;

  const [activeUnpaidIndex, setActiveUnpaidIndex] = useState(0);

  useEffect(() => {
    if (unpaidTransactions.length <= 1) return;
    const interval = setInterval(() => {
      setActiveUnpaidIndex((prev) => (prev + 1) % unpaidTransactions.length);
    }, 4500); // rotate every 4.5 seconds for readability
    return () => clearInterval(interval);
  }, [unpaidTransactions.length]);

  useEffect(() => {
    if (activeUnpaidIndex >= unpaidTransactions.length) {
      setActiveUnpaidIndex(0);
    }
  }, [unpaidTransactions.length, activeUnpaidIndex]);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isShiftModalOpen, setIsShiftModalOpen] = useState(false);

   // Manager Auth states
  
  // Consolidated browser network connectivity status listener
  useEffect(() => {
    const handleOnline = () => {
      console.log('[Sync] Browser online event fired.');
      setBrowserOnline(true);
    };
    const handleOffline = () => {
      console.log('[Sync] Browser offline event fired.');
      setBrowserOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Reactive synchronizer of the isOnline state and sync engine
  useEffect(() => {
    const resolvedOnline = browserOnline && appMode === 'online';
    setIsOnline(resolvedOnline);
    console.log(`[Sync] Network status evaluated: browserOnline=${browserOnline}, appMode=${appMode} -> isOnline=${resolvedOnline}`);
    
    if (resolvedOnline) {
      console.log('[Sync] Device is online and Online Mode is active. Attempting to synchronize pending local mutations...');
      syncOfflineTransactions((syncing) => setIsSyncing(syncing)).then(() => {
        updateIndexedDbPendingCount();
      });
    }
  }, [browserOnline, appMode, state.currentUser.id]);

  // Authentication form modal states
  const [isCloudSyncFormOpen, setIsCloudSyncFormOpen] = useState(false);
  const [cloudFormTab, setCloudFormTab] = useState<'signin' | 'signup' | 'forgot' | 'employee_signin'>('signin');
  const [cloudEmail, setCloudEmail] = useState('');
  const [cloudPassword, setCloudPassword] = useState('');
  const [cloudBusinessName, setCloudBusinessName] = useState('');
  const [referralCode, setReferralCode] = useState('');
  const [cloudFormError, setCloudFormError] = useState('');
  const [cloudFormSuccessMessage, setCloudFormSuccessMessage] = useState('');
  const [cloudFormLoading, setCloudFormLoading] = useState(false);
  const [isAddingExpense, setIsAddingExpense] = useState(false);
  const [newExpenseDesc, setNewExpenseDesc] = useState('');
  const [newExpenseAmt, setNewExpenseAmt] = useState('');
  const [newExpenseNotes, setNewExpenseNotes] = useState('');
  const [newExpenseAudio, setNewExpenseAudio] = useState('');
  const [isAddingTerminal, setIsAddingTerminal] = useState(false);
  const [newTerminalName, setNewTerminalName] = useState('');
  const [newTerminalProvider, setNewTerminalProvider] = useState<ProviderType>('OPay');
  const [newTerminalAccountNo, setNewTerminalAccountNo] = useState('');
  const [newTerminalCashierName, setNewTerminalCashierName] = useState('');
  const [newTerminalArea, setNewTerminalArea] = useState('');
  const [newTerminalSN, setNewTerminalSN] = useState('');
  const [newTerminalSim, setNewTerminalSim] = useState('');
  const [newTerminalNetwork, setNewTerminalNetwork] = useState<string>('MTN');
  const [newTerminalBattery, setNewTerminalBattery] = useState<number>(100);
  const [newTerminalSignal, setNewTerminalSignal] = useState<number>(5);
  const [newTerminalRate, setNewTerminalRate] = useState<number>(0.5);
  const [dashboardTab, setDashboardTab] = useState<'pos' | 'expenses' | 'unpaid' | 'terminals' | 'reports' | 'settings' | 'audit' | 'pricing' | 'airtime' | 'referrals' | 'payment-audit'>('pos');

  // Subscription & Referral Real-time states
  const [activeSubscription, setActiveSubscription] = useState<any>(null);

  useEffect(() => {
    const ownerId = state.currentUser?.role === 'Manager' ? state.currentUser.id : state.currentUser?.ownerId;
    if (!ownerId || ownerId === 'mgr_1') {
      setActiveSubscription(null);
      return;
    }

    const subRef = doc(db, 'subscriptions', ownerId);
    const unsubscribe = onSnapshot(subRef, (snapshot) => {
      if (snapshot.exists()) {
        setActiveSubscription(snapshot.data());
      } else {
        const trialStart = state.currentUser?.createdAt || new Date().toISOString();
        const trialEnd = new Date(new Date(trialStart).getTime() + 14 * 24 * 60 * 60 * 1000).toISOString();
        const initialSub = {
          id: ownerId,
          ownerId: ownerId,
          plan: 'Free Trial',
          status: 'Trial',
          trialStartDate: trialStart,
          trialEndDate: trialEnd,
          subscriptionStartDate: null,
          subscriptionEndDate: null,
          referredBy: state.currentUser?.referredBy || null,
          payoutBalance: 0,
          payoutLifetime: 0
        };
        setActiveSubscription(initialSub);
        setDoc(subRef, initialSub).catch((err) => {
          console.warn('[Firestore] Failed to initialize subscription doc:', err);
        });
      }
    }, (err) => {
      console.warn('Subscription snap failed:', err);
    });

    return () => unsubscribe();
  }, [state.currentUser?.id, state.currentUser?.ownerId, state.currentUser?.role]);

  const isPremiumLocked = useMemo(() => {
    if (!activeSubscription) return false;
    if (!state.currentUser?.id) return false;

    // The super manager account (including 08141106560 or primary manager) is free & never locked
    if (state.currentUser?.phone === '08141106560' || (state.currentUser as any)?.phoneNumber === '08141106560' || state.currentUser?.id === '08141106560') {
      return false;
    }
    const managers = state.availableEmployees.filter(u => u.role === 'Manager');
    managers.sort((a, b) => new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime());
    const superAdmin = managers.length > 0 ? managers[0] : null;
    
    if (superAdmin && superAdmin.id === state.currentUser.id) {
      return false;
    }

    if (activeSubscription.status === 'Active') {
      return false;
    }
    if (activeSubscription.status === 'Trial') {
      const trialEnd = new Date(activeSubscription.trialEndDate).getTime();
      const isExpired = trialEnd < Date.now();
      return isExpired;
    }
    return true;
  }, [activeSubscription, state.currentUser?.id, state.availableEmployees]);

  const handleUpgradeFromOverlay = (plan: 'Starter' | 'Professional' | 'Business' | 'Enterprise') => {
    setBillingInitialPlan(plan);
    setIsBillingModalOpen(true);
  };

  const handleRefreshSubscription = async () => {
    const ownerId = state.currentUser?.role === 'Manager' ? state.currentUser.id : state.currentUser?.ownerId;
    if (!ownerId || ownerId === 'mgr_1') return;
    setIsRefreshingSubscription(true);
    try {
      // Check for approved payments first
      const paymentsRef = collection(db, 'subscription_payments');
      const qPay = query(paymentsRef, where('ownerId', '==', ownerId), where('status', '==', 'Approved'));
      const paySnap = await getDocs(qPay);
      if (!paySnap.empty) {
        const latestApproved = paySnap.docs[0].data();
        const nowStr = new Date().toISOString();
        const expiryDateStr = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
        const activeSubData = {
          plan: latestApproved.plan || 'Starter',
          status: 'Active',
          subscriptionStartDate: latestApproved.updatedAt || nowStr,
          subscriptionEndDate: expiryDateStr,
          lastPaymentDate: latestApproved.paymentDate || nowStr,
          nextPaymentDate: expiryDateStr,
          lastPaymentReference: latestApproved.reference || '',
          lastReceiptUrl: latestApproved.receiptUrl || '',
          updatedAt: nowStr
        };
        await setDoc(doc(db, 'subscriptions', ownerId), activeSubData, { merge: true });
        setActiveSubscription(activeSubData);
        showAppNotification('Subscription status verified and activated!', 'success');
        setIsSubscriptionExpiredDialogOpen(false);
        return;
      }

      const subRef = doc(db, 'subscriptions', ownerId);
      const snapshot = await getDoc(subRef);
      if (snapshot.exists()) {
        const subData = snapshot.data();
        setActiveSubscription(subData);
        if (subData.status === 'Active') {
          showAppNotification('Subscription status updated. Your access is now restored!', 'success');
          setIsSubscriptionExpiredDialogOpen(false);
        } else if (subData.status === 'Trial') {
          const trialEnd = new Date(subData.trialEndDate).getTime();
          if (trialEnd > Date.now()) {
            showAppNotification('Trial is active.', 'success');
            setIsSubscriptionExpiredDialogOpen(false);
          } else {
            showAppNotification('Your trial remains expired.', 'info');
          }
        } else {
          showAppNotification('No active subscription found. Please complete payment.', 'info');
        }
      } else {
        showAppNotification('No subscription record exists yet.', 'info');
      }
    } catch (err) {
      console.error('Manual subscription refresh failed:', err);
      showAppNotification('Failed to check subscription status. Please try again.', 'error');
    } finally {
      setIsRefreshingSubscription(false);
    }
  };
  
  // Filter terminals based on user context
  const filteredPosTerminals = useMemo(() => {
    if (!state.currentUser) return [];

    const currentOwnerId = state.currentUser.role === 'Manager'
      ? state.currentUser.id
      : state.currentUser.ownerId;

    const currentUserName = (state.currentUser.name || '').trim().toLowerCase();
    const currentUserId = state.currentUser.id;

    const myEmployeeIds = new Set<string>();
    const myEmployeeNames = new Set<string>();
    if (state.currentUser.role === 'Manager') {
      registeredUsers.forEach(u => {
        if (u.ownerId === currentUserId || u.parentManagerId === currentUserId || u.addedBy === state.currentUser.name) {
          if (u.id) myEmployeeIds.add(u.id);
          if (u.name) myEmployeeNames.add(u.name.trim().toLowerCase());
        }
      });
    }

    // Find cashier's manager for store terminal matching
    const cashierManager = state.currentUser.role !== 'Manager' ? registeredUsers.find(u => 
      u.id === state.currentUser.ownerId || 
      u.id === (state.currentUser as any).parentManagerId ||
      (u.name && state.currentUser.addedBy && u.name.trim().toLowerCase() === state.currentUser.addedBy.trim().toLowerCase())
    ) : null;
    const managerNameLower = cashierManager ? cashierManager.name.trim().toLowerCase() : (state.currentUser.addedBy || '').trim().toLowerCase();

    return (state.posTerminals || []).filter(t => {
      const termOwnerId = t.ownerId || '';
      const termAddedBy = (t.addedBy || '').trim().toLowerCase();
      const termCashierName = (t.cashierName || '').trim().toLowerCase();
      const termEmployeeId = t.employeeId || '';

      const isOwnerMatch = Boolean(termOwnerId && currentOwnerId && termOwnerId === currentOwnerId);
      const isAddedByMe = Boolean(
        termAddedBy && (termAddedBy === currentUserName || termAddedBy === currentUserId.toLowerCase())
      );
      const isAssignedToMe = Boolean(
        (termEmployeeId && termEmployeeId === currentUserId) ||
        (termCashierName && (
          termCashierName === currentUserName ||
          termCashierName.includes(currentUserName) ||
          currentUserName.includes(termCashierName)
        ))
      );
      const isAssignedToMyEmployee = Boolean(
        state.currentUser.role === 'Manager' && (
          (termEmployeeId && myEmployeeIds.has(termEmployeeId)) ||
          (termCashierName && myEmployeeNames.has(termCashierName))
        )
      );

      if (state.currentUser.role === 'Manager') {
        // Manager / Super Admin Manager only views terminals created by or belonging to their store/account
        if (isOwnerMatch || isAddedByMe || isAssignedToMyEmployee) {
          return true;
        }
        if (termOwnerId && termOwnerId !== currentOwnerId && termOwnerId !== 'mgr_1' && termOwnerId !== 'local_owner') {
          return false;
        }
        if (!termOwnerId || termOwnerId === 'mgr_1' || termOwnerId === 'local_owner') {
          if (isAddedByMe || isAssignedToMe || isAssignedToMyEmployee) {
            return true;
          }
          return false;
        }
        return false;
      } else {
        // Cashier / Employee can ONLY see their own physical POS terminal assigned or added to them
        return isAssignedToMe || isAddedByMe;
      }
    });
  }, [state.posTerminals, state.currentUser, registeredUsers]);

  // List of cashiers belonging to current manager
  const managerCashiers = useMemo(() => {
    if (!state.currentUser) return [];
    const mgrId = state.currentUser.role === 'Manager' ? state.currentUser.id : state.currentUser.ownerId;
    const mgrName = (state.currentUser.name || '').trim().toLowerCase();
    return registeredUsers.filter(u => {
      const uRole = (u.role || '').toLowerCase();
      if (uRole !== 'employee' && uRole !== 'cashier') return false;
      return u.ownerId === mgrId || u.parentManagerId === mgrId || (u.addedBy || '').trim().toLowerCase() === mgrName;
    });
  }, [registeredUsers, state.currentUser]);

  // Dashboard-level partial payment modal states
  const [carouselSettlingTx, setCarouselSettlingTx] = useState<Transaction | null>(null);
  const [carouselSettleAmount, setCarouselSettleAmount] = useState<string>('');
  const [carouselSettleMethod, setCarouselSettleMethod] = useState<'Cash' | 'CardDebit'>('Cash');
  const [carouselSettleNote, setCarouselSettleNote] = useState<string>('Partial payment');

  useEffect(() => {
    if (carouselSettlingTx) {
      const remaining = (carouselSettlingTx.unpaidFeeAmount !== undefined && carouselSettlingTx.unpaidFeeAmount > 0)
        ? carouselSettlingTx.unpaidFeeAmount 
        : (carouselSettlingTx.customerFee || 200);
      setCarouselSettleAmount(remaining.toString());
      setCarouselSettleMethod(carouselSettlingTx.feeMethod || 'Cash');
      setCarouselSettleNote('Partial payment from Dashboard');
    }
  }, [carouselSettlingTx]);

  const ownerTxsRef = useRef<Transaction[]>([]);
  const cashierTxsRef = useRef<Transaction[]>([]);
  const isRegisteringUser = useRef(false);

  // Compute individual stats for each linked terminal
  const terminalStats = useMemo(() => {
    const list = filteredPosTerminals || [];
    const txs = state.transactions || [];
    
    return list.map(terminal => {
      // Find all successful transactions matching this terminal's ID
      const matchingTxs = txs.filter(t => t.terminalId === terminal.id && t.status === 'Success');
      
      const volume = matchingTxs.reduce((sum, t) => sum + t.amount, 0);
      const profit = matchingTxs.reduce((sum, t) => sum + t.profit, 0);
      const count = matchingTxs.length;
      
      return {
        ...terminal,
        volume,
        profit,
        count
      };
    });
  }, [filteredPosTerminals, state.transactions]);

  // Find the most active registered terminal based on transaction volume
  const mostActiveTerminal = useMemo(() => {
    if (!terminalStats || terminalStats.length === 0) return null;
    const activeOnly = terminalStats.filter(t => t.volume > 0);
    if (activeOnly.length === 0) return null;
    return activeOnly.reduce((max, curr) => curr.volume > max.volume ? curr : max, activeOnly[0]);
  }, [terminalStats]);

  // Find terminal for current user
  const myTerminal = useMemo(() => {
    const targetUserId = state.impersonatedUserId || state.currentUser.id;
    return filteredPosTerminals?.find(t => t.employeeId === targetUserId);
  }, [filteredPosTerminals, state.currentUser.id, state.impersonatedUserId]);

  // Compute stats for "Default/No Specific Terminal" transactions
  const defaultTerminalStats = useMemo(() => {
    const txs = state.transactions || [];
    // Successful transactions that do not have a terminalId
    const matchingTxs = txs.filter(t => !t.terminalId && t.status === 'Success');
    
    const volume = matchingTxs.reduce((sum, t) => sum + t.amount, 0);
    const profit = matchingTxs.reduce((sum, t) => sum + t.profit, 0);
    const count = matchingTxs.length;
    
    return {
      volume,
      profit,
      count
    };
  }, [state.transactions]);

  // Initialize Auth state listener
  useEffect(() => {
    console.log('[Auth] Initializing onAuthStateChanged listener');
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCloudUser(user);
      
      if (user) {
        console.log('[Auth] User detected:', user.uid, user.email);
        
        // If registration is in progress, bypass the auto-restoration flow
        if (isRegisteringUser.current) {
          console.log('[Auth] Registration in progress, bypassing auto-restoration in auth listener');
          setIsSessionLoaded(true);
          setCloudLoading(false);
          // setIsLoading(false); // Gate with isUsersLoaded
          return;
        }

        const userDocRef = doc(db, 'users', user.uid);
        
        const updatePoolAndDispatch = (mUser: User) => {
          setRegisteredUsers((prev) => {
            if (!prev.some(u => u.id === mUser.id)) {
              const next = [...prev, mUser];
              safeLocalStorageSet('OPay_Registered_Users_v4', JSON.stringify(next));
              return next;
            }
            return prev;
          });
          dispatch({ type: 'SWITCH_USER', payload: mUser });
        };

        try {
          let snap;
          try {
            snap = await getDoc(userDocRef);
          } catch (err) {
            handleFirestoreError(err, OperationType.GET, `users/${user.uid}`);
          }

          if (snap && snap.exists()) {
            const mUser = mapFirestoreUser(snap.data(), user.uid);
            console.log('[Auth] Profile restored from Firestore:', mUser.name, 'Role:', mUser.role);
            updatePoolAndDispatch(mUser);

            // Load settings if manager or linked to one
            const ownerId = mUser.role === 'Manager' ? mUser.id : mUser.ownerId;
            if (ownerId && ownerId !== 'mgr_1') {
              try {
                const settingsSnap = await getDoc(doc(db, 'settings', ownerId));
                if (settingsSnap.exists()) {
                  dispatch({ type: 'UPDATE_SETTINGS', payload: settingsSnap.data() });
                }
              } catch (settingsErr) {
                console.warn('[Auth] Settings retrieval failed:', settingsErr);
              }
            }
          } else {
            console.warn('[Auth] Auth account exists but Firestore document is missing for UID:', user.uid);
            
            // Self-healing: Trigger recovery to restore the operator's record
            const recoverFirestoreProfile = async () => {
              console.log('[Auth Recovery] Attempting to recover and restore missing Firestore profile for UID:', user.uid);
              try {
                let recoveredUser: User | null = null;
                
                // 1. Check local registeredUsers or OPay_Registered_Users_v4 cache
                const cachedUsersStr = localStorage.getItem('OPay_Registered_Users_v4');
                if (cachedUsersStr) {
                  try {
                    const parsed = JSON.parse(cachedUsersStr) as User[];
                    const found = parsed.find(u => u.id === user.uid);
                    if (found) {
                      recoveredUser = found;
                      console.log('[Auth Recovery] Found user in localStorage cache:', recoveredUser.name);
                    }
                  } catch (e) {
                    console.error('[Auth Recovery] Failed to parse localStorage cached users:', e);
                  }
                }

                // 2. Query offline IndexedDB cache as secondary fallback
                if (!recoveredUser) {
                  try {
                    const cached = await getCachedUser(user.uid);
                    if (cached) {
                      recoveredUser = mapFirestoreUser(cached, user.uid);
                      console.log('[Auth Recovery] Found user in IndexedDB offline cache:', recoveredUser.name);
                    }
                  } catch (e) {
                    console.error('[Auth Recovery] Failed to query IndexedDB cache:', e);
                  }
                }

                // 3. Reconstruct a safe default user profile if not cached anywhere
                if (!recoveredUser) {
                  const fallbackName = user.displayName || user.email?.split('@')[0] || 'Operator';
                  const emailClean = user.email || '';
                  const fallbackRole: UserRole = emailClean.toLowerCase().includes('manager') ? 'Manager' : 'Employee';
                  
                  recoveredUser = {
                    id: user.uid,
                    name: fallbackName,
                    role: fallbackRole,
                    phone: user.email?.split('@')[0] || '',
                    ownerId: fallbackRole === 'Manager' ? user.uid : 'mgr_1',
                    activated: true,
                    email: emailClean
                  };
                  console.log('[Auth Recovery] Reconstructed default profile:', recoveredUser.name, 'Role:', recoveredUser.role);
                }

                // 4. Save self-healed profile to Firestore
                const firestoreDocRaw = {
                  uid: user.uid,
                  id: user.uid,
                  fullName: recoveredUser.name,
                  phoneNumber: recoveredUser.phone,
                  phone: recoveredUser.phone,
                  role: recoveredUser.role,
                  ownerId: recoveredUser.ownerId || (recoveredUser.role === 'Manager' ? user.uid : 'mgr_1'),
                  email: recoveredUser.email || user.email || '',
                  activated: true,
                  createdAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString(),
                  status: 'active',
                  permissions: recoveredUser.role === 'Manager' ? ['admin', 'manager'] : ['cashier']
                };

                const cleanData = prepareFirestoreData(firestoreDocRaw, 'users');
                await setDoc(doc(db, 'users', user.uid), cleanData, { merge: true });
                console.log('[Auth Recovery] Successfully self-healed and restored user document in Firestore for:', recoveredUser.name);
                showAppNotification('Operator profile recovered and synchronized successfully.', 'success');

                // 5. Cache locally to ensure offline availability
                try {
                  await saveCachedUser(cleanData);
                } catch (dbErr) {
                  console.error('[Auth Recovery] Local cache update failed:', dbErr);
                }

                // 6. Complete flow and dispatch to app state
                updatePoolAndDispatch(recoveredUser);
              } catch (recoveryErr) {
                console.error('[Auth Recovery] Profile recovery completely failed:', recoveryErr);
                console.log('[Auth Recovery] Forced fallback: signing out to prevent stale state.');
                try {
                  await signOut(auth);
                  localStorage.removeItem('OPay_Registered_Users_v4');
                  localStorage.removeItem('OPay_Terminal_Locked');
                  localStorage.removeItem('OPay_Last_Login_Tab');
                  localStorage.removeItem('OPay_Last_Staff_Phone');
                  localStorage.removeItem('OPay_Last_Staff_Pin');
                  localStorage.removeItem('OPay_Last_Manager_Phone');
                  localStorage.removeItem('OPay_Last_Manager_Pin');
                  setRegisteredUsers([]);
                  window.location.reload();
                } catch (signOutErr) {
                  console.error('[Auth Recovery Fallback] Sign out failed:', signOutErr);
                }
              }
            };

            await recoverFirestoreProfile();
          }
        } catch (err) {
          console.error('[Auth] Failed to retrieve user profile:', err);
        } finally {
          setIsSessionLoaded(true);
          setCloudLoading(false);
          // setIsLoading(false); // Gate with isUsersLoaded
        }
      } else {
        console.log('[Auth] No active session. Reverting to login state.');
        // Reset to default empty user to trigger LoginScreen
        const emptyUser: User = {
          id: '',
          name: 'Please Login',
          role: 'Employee',
          pin: '',
          phone: '',
          ownerId: ''
        };
        dispatch({ type: 'SWITCH_USER', payload: emptyUser });
        setIsLocked(true);
        setIsSessionLoaded(true);
        setCloudLoading(false);
        // setIsLoading(false); // Gate with isUsersLoaded
      }
    });
    return () => unsubscribe();
  }, []);



  useEffect(() => {
    // Always trigger an initial pending IndexedDB count check
    updateIndexedDbPendingCount();

    if (isSessionLoaded && isUsersLoaded) {
      console.log('[App] Auth session and Users loaded, finalizing app initialization.');
      setIsLoading(false);
    }
    
    // Always hydrate local IndexedDB cache immediately on startup for zero-delay UI
    (async () => {
      try {
        const [txs, expenses, terminals] = await Promise.all([
          getCachedTransactions(),
          getCachedExpenses(),
          getCachedPosTerminals()
        ]);
        
        if (txs?.length) {
          dispatch({ type: 'SET_TRANSACTIONS', payload: txs });
          dispatch({ type: 'SET_HISTORY_TRANSACTIONS', payload: txs });
        }
        if (expenses?.length) dispatch({ type: 'SET_EXPENSES', payload: expenses });
        if (terminals?.length) dispatch({ type: 'SET_POS_TERMINALS', payload: terminals });
        
        console.log('[Initial Cache Load] Hydrated state from IndexedDB:', { 
          txs: txs?.length, 
          expenses: expenses?.length, 
          terminals: terminals?.length 
        });
      } catch (err) {
        console.error('[Initial Cache Load] Failed to load cached data:', err);
      }
    })();

    const mode = localStorage.getItem('POSTrack_Mode') || 'online';
    const actuallyOffline = !navigator.onLine || mode === 'offline';

    if (!actuallyOffline) {
      syncOfflineTransactions((syncing) => setIsSyncing(syncing)).then(() => {
        updateIndexedDbPendingCount();
      });
    }
  }, [isSessionLoaded, isUsersLoaded]);

  // Real-time Firestore sync subscriptions when session is fully loaded and validated
  useEffect(() => {
    if (isLoading || !isSessionLoaded || appMode === 'offline' || !syncOwnerId || !state.currentUser?.id || state.currentUser.id === '' || state.currentUser.name === 'Please Login') return;

    // Instant local cache hydration upon user session change to eliminate loading delays
    (async () => {
      try {
        const [txs, expenses, terminals] = await Promise.all([
          getCachedTransactions(),
          getCachedExpenses(),
          getCachedPosTerminals()
        ]);
        
        if (txs?.length) {
          dispatch({ type: 'SET_TRANSACTIONS', payload: txs });
          dispatch({ type: 'SET_HISTORY_TRANSACTIONS', payload: txs });
        }
        if (expenses?.length) dispatch({ type: 'SET_EXPENSES', payload: expenses });
        if (terminals?.length) dispatch({ type: 'SET_POS_TERMINALS', payload: terminals });
      } catch (err) {
        console.warn('[User Hydration] Failed to load IndexedDB user cache:', err);
      }
    })();

    const currentUserId = state.currentUser.id;
    const isManager = state.currentUser.role === 'Manager';

    const buildTxQuery = (field: 'ownerId' | 'cashierId', value: string) => {
      const targetValue = value || syncOwnerId;
      if (!targetValue) return null;
      return query(
        collection(db, 'transactions'),
        where(field, '==', targetValue),
        orderBy('timestamp', 'desc')
      );
    };

    const mapSnapToTxs = (snap: any) => {
      const storedApproved = getStoredApprovedTxIds();
      return snap.docs.map((d: any) => {
        const data = d.data();
        if (data.timestamp && typeof data.timestamp === 'object' && (data.timestamp as any).toDate) {
          data.timestamp = (data.timestamp as any).toDate().toISOString();
        }
        const tx = data as Transaction;
        
        // Anti-Reversion Guard: If this transaction was optimistically approved locally,
        // do not let a stale cached snapshot revert it to pending approval!
        if (optimisticApprovedTxsRef.current.has(tx.id) || storedApproved.has(tx.id)) {
          if (tx.pendingSettlement || tx.approvalStatus !== 'approved' || !tx.approved) {
            tx.pendingSettlement = null;
            tx.approvalStatus = 'approved';
            tx.approved = true;
            tx.status = tx.status || 'Success';
            tx.pending = false;
          }
        }
        return tx;
      });
    };

    const updateStateTxs = () => {
      const combined = [...ownerTxsRef.current, ...cashierTxsRef.current];
      const unique = Array.from(new Map(combined.map(tx => [tx.id, tx])).values());
      unique.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      
      // Update both slices with the same full dataset; filtering happens in useMemo
      dispatch({ type: 'SET_TRANSACTIONS', payload: unique });
      dispatch({ type: 'SET_HISTORY_TRANSACTIONS', payload: unique });
    };

    let unsubOwner = () => {};
    let unsubCashier = () => {};

    if (isManager) {
      unsubOwner = onSnapshot(buildTxQuery('ownerId', currentUserId), (snap) => {
        const txs = mapSnapToTxs(snap);
        ownerTxsRef.current = txs;
        updateStateTxs();
        saveCachedTransactions(txs);
      }, (err) => {
        if (err.message && err.message.includes("Quota limit exceeded")) {
          console.warn('[Firestore] Owner transactions sync halted: Quota exceeded.');
          return;
        }
        console.warn('[Firestore] Owner transactions sync error:', err);
      });
    } else {
      unsubCashier = onSnapshot(buildTxQuery('cashierId', currentUserId), (snap) => {
        const txs = mapSnapToTxs(snap);
        cashierTxsRef.current = txs;
        updateStateTxs();
        saveCachedTransactions(txs);
      }, (err) => {
        if (err.message && err.message.includes("Quota limit exceeded")) {
          console.warn('[Firestore] Cashier transactions sync halted: Quota exceeded.');
          return;
        }
        console.warn('[Firestore] Cashier transactions sync error:', err);
      });
    }

    // Subscribe to Expenses
    const expensesQuery = isManager 
      ? query(collection(db, 'expenses'), where('ownerId', '==', currentUserId))
      : query(collection(db, 'expenses'), where('employeeId', '==', currentUserId));

    const unsubscribeExpenses = onSnapshot(expensesQuery, (snapshot) => {
      const expList: Expense[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data() as any;
        if (data.timestamp && typeof data.timestamp === 'object' && data.timestamp.toDate) {
          data.timestamp = data.timestamp.toDate().toISOString();
        }
        expList.push(data as Expense);
      });
      expList.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      
      dispatch({ type: 'SET_EXPENSES', payload: expList });
      saveCachedExpenses(expList);
    }, (err) => {
      // If it's a quota error, don't throw to ErrorBoundary, just log it.
      // The app can continue with cached data.
      if (err.message && err.message.includes("Quota limit exceeded")) {
        console.warn('[Firestore] Expenses sync halted: Quota exceeded.');
        return;
      }
      console.warn('[Firestore] Expenses sync error:', err);
    });

    // Subscribe to POS Terminals
    const terminalsQuery = isManager
      ? query(collection(db, 'pos_terminals'), where('ownerId', '==', currentUserId))
      : query(collection(db, 'pos_terminals'), where('employeeId', '==', currentUserId), where('ownerId', '==', syncOwnerId));

    const unsubscribeTerminals = onSnapshot(terminalsQuery, (snapshot) => {
      const termList: PosTerminal[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data() as any;
        if (data.timestamp && typeof data.timestamp === 'object' && data.timestamp.toDate) {
          data.timestamp = data.timestamp.toDate().toISOString();
        }
        termList.push(data as PosTerminal);
      });
      termList.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      
      dispatch({ type: 'SET_POS_TERMINALS', payload: termList });
      saveCachedPosTerminals(termList);
    }, (err) => {
      // If it's a quota error, don't throw to ErrorBoundary, just log it.
      // The app can continue with cached data.
      if (err.message && err.message.includes("Quota limit exceeded")) {
        console.warn('[Firestore] Terminals sync halted: Quota exceeded.');
        return;
      }
      console.warn('[Firestore] Terminals sync error:', err);
    });

    return () => {
      unsubOwner();
      unsubCashier();
      unsubscribeExpenses();
      unsubscribeTerminals();
    };
  }, [isLoading, isSessionLoaded, syncOwnerId, state.currentUser?.id, state.currentUser?.role, appMode]);

  // Firestore mutation wrappers
  const handleAddPosTerminal = async (term: PosTerminal) => {
    if (state.currentUser.role !== 'Manager') {
      alert('Permission denied: Only Store Managers have permission to register physical POS terminals.');
      return;
    }
    dispatch({ type: 'ADD_POS_TERMINAL', payload: term });

    const termWithOwner = { ...term, ownerId: syncOwnerId || 'mgr_1' };
    const cleanData = prepareFirestoreData(termWithOwner, 'pos_terminals');

    // 1. Save directly to local IndexedDB main store first
    try {
      const current = await getCachedPosTerminals();
      const updated = [...current.filter((t: any) => t.id !== term.id), cleanData];
      await saveCachedPosTerminals(updated);
    } catch (dbErr) {
      console.error('[DB] Failed to save POS terminal to main cache:', dbErr);
    }

    const mode = localStorage.getItem('POSTrack_Mode') || 'online';
    const offline = mode === 'offline' || !isOnline;

    if (offline) {
      try {
        await savePendingPosTerminal(cleanData);
      } catch (err) {
        console.error('[DB] Failed to save POS terminal to pending queue:', err);
      }
      return;
    }

    if (syncOwnerId) {
      try {
        await setDoc(doc(db, 'pos_terminals', term.id), cleanData);
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `pos_terminals/${term.id}`);
        // Fallback to offline pending queue if firestore write fails
        try {
          await savePendingPosTerminal(cleanData);
        } catch (queueErr) {
          console.error('[DB] Fallback save to pending POS terminal failed:', queueErr);
        }
      }
    }
  };

  const handleUpdatePosTerminal = async (term: PosTerminal) => {
    dispatch({ type: 'UPDATE_POS_TERMINAL', payload: term });

    const termWithOwner = { ...term, ownerId: syncOwnerId || 'mgr_1' };
    const cleanData = prepareFirestoreData(termWithOwner, 'pos_terminals');

    // 1. Save directly to local IndexedDB main store first
    try {
      const current = await getCachedPosTerminals();
      const updated = [...current.filter((t: any) => t.id !== term.id), cleanData];
      await saveCachedPosTerminals(updated);
    } catch (dbErr) {
      console.error('[DB] Failed to update POS terminal in main cache:', dbErr);
    }

    const mode = localStorage.getItem('POSTrack_Mode') || 'online';
    const offline = mode === 'offline' || !isOnline;

    if (offline) {
      try {
        await savePendingPosTerminal(cleanData);
      } catch (err) {
        console.error('[DB] Failed to save pending POS terminal update:', err);
      }
      return;
    }

    if (syncOwnerId) {
      try {
        await setDoc(doc(db, 'pos_terminals', term.id), cleanData);
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `pos_terminals/${term.id}`);
        // Fallback
        try {
          await savePendingPosTerminal(cleanData);
        } catch (queueErr) {
          console.error('[DB] Fallback save pending terminal update failed:', queueErr);
        }
      }
    }
  };

  const handleCheckTerminalNetwork = async (term: PosTerminal) => {
    const statuses: ('Active' | 'Inactive')[] = ['Active', 'Inactive'];
    const browsings: ('Enabled' | 'Disabled')[] = ['Enabled', 'Disabled'];
    const internet: ('Granted' | 'Denied')[] = ['Granted', 'Denied'];

    const updatedTerm = {
      ...term,
      networkStatus: statuses[Math.floor(Math.random() * statuses.length)],
      browsingStatus: browsings[Math.floor(Math.random() * browsings.length)],
      internetAccess: internet[Math.floor(Math.random() * internet.length)],
      signalStrength: Math.floor(Math.random() * 5) + 1,
      batteryLevel: Math.floor(Math.random() * 100),
    };
    await handleUpdatePosTerminal(updatedTerm);
  };

  const handleDeletePosTerminal = async (id: string) => {
    dispatch({ type: 'DELETE_POS_TERMINAL', payload: id });

    // 1. Delete from local IndexedDB main cache first
    try {
      const current = await getCachedPosTerminals();
      const updated = current.filter((t: any) => t.id !== id);
      await saveCachedPosTerminals(updated);
    } catch (dbErr) {
      console.error('[DB] Failed to delete POS terminal from main cache:', dbErr);
    }

    const mode = localStorage.getItem('POSTrack_Mode') || 'online';
    const offline = mode === 'offline' || !isOnline;

    if (offline) {
      try {
        await savePendingDeletion({
          id: `pos_terminals_${id}`,
          collection: 'pos_terminals',
          docId: id
        });
      } catch (err) {
        console.error('[DB] Failed to save pending POS terminal deletion:', err);
      }
      return;
    }

    if (syncOwnerId) {
      try {
        await deleteDoc(doc(db, 'pos_terminals', id));
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `pos_terminals/${id}`);
        // Fallback
        try {
          await savePendingDeletion({
            id: `pos_terminals_${id}`,
            collection: 'pos_terminals',
            docId: id
          });
        } catch (queueErr) {
          console.error('[DB] Fallback save pending terminal deletion failed:', queueErr);
        }
      }
    }
  };

  const handleAddTransaction = async (tx: Transaction) => {
    if (isPremiumLocked) {
      setIsSubscriptionExpiredDialogOpen(true);
      return;
    }
    console.log(`[TRANSACTION SYNC TRACE] [Save Flow] handleAddTransaction initiated. ID: "${tx.id}", Amount: $${tx.amount}`);
    dispatch({ type: 'ADD_TRANSACTION', payload: tx });
    
    const cashierId = tx.employeeId || tx.cashierId || (tx.terminalId ? state.posTerminals.find(t => t.id === tx.terminalId)?.employeeId : undefined) || state.currentUser.id || 'cashier';
    const txWithIds = { 
        ...tx, 
        ownerId: syncOwnerId || state.currentUser.ownerId || state.currentUser.id, 
        cashierId 
    };
    const cleanData = prepareFirestoreData(txWithIds, 'transactions');

    // 1. Save directly to local IndexedDB main cache first to avoid losing data across offline restarts
    try {
      console.log(`[TRANSACTION SYNC TRACE] [Save Flow] Saving transaction ID: "${tx.id}" to IndexedDB main cache...`);
      const current = await getCachedTransactions();
      const updated = [...current.filter((t: any) => t.id !== tx.id), cleanData];
      await saveCachedTransactions(updated);
      console.log(`[TRANSACTION SYNC TRACE] [Save Flow] [SUCCESS] Transaction ID: "${tx.id}" saved to IndexedDB main cache.`);
    } catch (dbErr) {
      console.error('[TRANSACTION SYNC TRACE] [Save Flow] [ERROR] Failed to save transaction to main cache:', dbErr);
    }

    const mode = localStorage.getItem('POSTrack_Mode') || 'online';
    const offline = mode === 'offline' || !isOnline;

    if (offline) {
        console.log(`[TRANSACTION SYNC TRACE] [Save Flow] Device/Terminal mode resolved as OFFLINE (POSTrack_Mode: "${mode}", isOnline: ${isOnline}). Enqueuing to IndexedDB pending list.`);
        await savePendingTransaction(cleanData);
        return;
    }

    if (syncOwnerId) {
      try {
        console.log(`[TRANSACTION SYNC TRACE] [Save Flow] Device is online. Attempting immediate Firestore write for transaction ID: "${tx.id}"...`);
        await setDoc(doc(db, 'transactions', tx.id), cleanData);
        console.log(`[TRANSACTION SYNC TRACE] [Save Flow] [SUCCESS] Transaction ID: "${tx.id}" written to Firestore successfully.`);
      } catch (err: any) {
        console.warn(`[TRANSACTION SYNC TRACE] [Save Flow] [FALLBACK] Firestore write failed for transaction ID: "${tx.id}". Error:`, err);
        
        if (err.message?.includes('Missing or insufficient permissions') || err.code === 'permission-denied') {
            console.warn('[TRANSACTION SYNC TRACE] Permission Denied. Reverting from local cache and showing subscription dialog.');
            const current = await getCachedTransactions();
            await saveCachedTransactions(current.filter((t: any) => t.id !== tx.id));
            setIsSubscriptionExpiredDialogOpen(true);
            return;
        }

        try {
          handleFirestoreError(err, OperationType.WRITE, `transactions/${tx.id}`);
        } catch (e) {
          // Just swallow it here so we can save to pending
        }
        
        // Fallback to offline storage if write fails
        await savePendingTransaction(cleanData);
      }
    } else {
      console.log(`[TRANSACTION SYNC TRACE] [Save Flow] No syncOwnerId set. Skipping immediate Firestore write for ID: "${tx.id}".`);
    }
  };

  const handleApproveTransaction = async (tx: Transaction) => {
    console.log(`[TRANSACTION SYNC TRACE] [Approval Flow] handleApproveTransaction initiated. ID: "${tx.id}"`);
    
    const cashierId = tx.employeeId || tx.cashierId || (tx.terminalId ? state.posTerminals.find(t => t.id === tx.terminalId)?.employeeId : undefined) || state.currentUser?.id || 'cashier';
    const backupSettlement = tx.pendingSettlement || tx.lastSettlementBackup || null;
    const p = tx.pendingSettlement;

    const originalFee = (tx.originalFeeAmount !== undefined && tx.originalFeeAmount > 0) ? tx.originalFeeAmount : (tx.unpaidFeeAmount !== undefined && tx.unpaidFeeAmount > 0 ? tx.unpaidFeeAmount : tx.customerFee || 200);
    const finalCustomerFee = p ? p.proposedTotalPaidSoFar : (tx.chargesPaidAmount || tx.customerFee || 0);
    const updatedProfit = finalCustomerFee - tx.terminalFee - (tx.cbnCharge || 0);
    const updatedTotalCustomerCharged = (p?.feeMethod || tx.feeMethod) === 'CardDebit' ? (tx.amount + finalCustomerFee) : tx.amount;
    const updatedPayments = p && p.proposedPaymentRecord ? [...(tx.chargePayments || []), p.proposedPaymentRecord] : (tx.chargePayments || []);

    const approvedTx: Transaction = {
      ...tx,
      ownerId: syncOwnerId || state.currentUser?.ownerId || state.currentUser?.id,
      cashierId,
      customerFee: finalCustomerFee,
      profit: updatedProfit,
      agentProfit: updatedProfit,
      netProfit: updatedProfit,
      totalCustomerCharged: updatedTotalCustomerCharged,
      feeMethod: p?.feeMethod || tx.feeMethod,
      chargesStatus: p ? (p.proposedChargesStatus || 'Paid') : 'Paid',
      unpaidFeeAmount: p ? p.proposedUnpaidAmount : undefined,
      originalFeeAmount: originalFee,
      chargesPaidAmount: finalCustomerFee,
      chargePayments: updatedPayments,
      pendingSettlement: null, // Clear pending state
      lastSettlementBackup: backupSettlement || p || null,
      approvalStatus: 'approved',
      status: 'Success',
      approved: true,
      approvedBy: state.currentUser?.id || 'manager',
      approvedAt: new Date().toISOString(),
      pending: false,
      waitingApproval: null,
      needsApproval: false,
      approvalQueue: null,
      approvalRequest: null,
      managerPending: false,
    };

    // Trigger 5-second UNDO toast notification for Manager
    triggerApprovalToast(tx, approvedTx);

    // 1. Immediately store ID in local optimistic approved tracking (Ref & LocalStorage)
    optimisticApprovedTxsRef.current.add(tx.id);
    try {
      const list = Array.from(optimisticApprovedTxsRef.current);
      localStorage.setItem('POSTrack_Approved_Txs', JSON.stringify(list));
    } catch (e) {
      console.error('[Approval Flow] LocalStorage save error:', e);
    }

    // 2. Immediately update React State (Optimistic UI update)
    dispatch({ type: 'UPDATE_TRANSACTION', payload: approvedTx });
    
    // Ensure the refs used by listeners are also updated immediately to prevent snapshot reversion before firestore catches up
    ownerTxsRef.current = ownerTxsRef.current.map(t => t.id === tx.id ? approvedTx : t);
    cashierTxsRef.current = cashierTxsRef.current.map(t => t.id === tx.id ? approvedTx : t);

    // 3. Immediately update local IndexedDB main cache
    const cleanData = prepareFirestoreData(approvedTx, 'transactions');
    try {
      console.log(`[TRANSACTION SYNC TRACE] [Approval Flow] Updating transaction ID: "${tx.id}" in IndexedDB main cache...`);
      const current = await getCachedTransactions();
      const updated = [...current.filter((t: any) => t.id !== tx.id), cleanData];
      await saveCachedTransactions(updated);
      console.log(`[TRANSACTION SYNC TRACE] [Approval Flow] [SUCCESS] Transaction ID: "${tx.id}" updated in IndexedDB main cache.`);
    } catch (dbErr) {
      console.error('[TRANSACTION SYNC TRACE] [Approval Flow] [ERROR] Failed to update transaction in main cache:', dbErr);
    }

    const mode = localStorage.getItem('POSTrack_Mode') || 'online';
    const offline = mode === 'offline' || !isOnline;

    if (offline) {
      console.log(`[TRANSACTION SYNC TRACE] [Approval Flow] Offline mode detected. Enqueuing approved transaction to IndexedDB pending list.`);
      await savePendingTransaction(cleanData);
      return;
    }

    // 4. Update Firestore with non-blocking offline-resilient setDoc
    if (syncOwnerId) {
      try {
        console.log(`[TRANSACTION SYNC TRACE] [Approval Flow] Attempting setDoc approval update for ID: "${tx.id}"...`);
        const txRef = doc(db, 'transactions', tx.id);
        const approvalData = prepareFirestoreData({
          ...cleanData,
          pendingSettlement: null,
          lastSettlementBackup: backupSettlement,
          approvalStatus: 'approved',
          status: 'approved',
          approved: true,
          approvedBy: state.currentUser?.id || 'manager',
          approvedAt: serverTimestamp(),
          pending: false,
          waitingApproval: null,
          needsApproval: false,
          approvalQueue: null,
          approvalRequest: null,
          managerPending: false,
        }, 'transactions');
        await setDoc(txRef, approvalData, { merge: true });
        console.log(`[TRANSACTION SYNC TRACE] [Approval Flow] [SUCCESS] Transaction ID: "${tx.id}" approved in Firestore.`);
      } catch (err: any) {
        console.warn(`[TRANSACTION SYNC TRACE] [Approval Flow] [FALLBACK] Firestore approval write failed for transaction ID: "${tx.id}". Error:`, err);
        if (err.message?.includes('Missing or insufficient permissions') || err.code === 'permission-denied') {
          console.warn('[TRANSACTION SYNC TRACE] Permission Denied during approval.');
          setIsSubscriptionExpiredDialogOpen(true);
          return;
        }
        try {
          handleFirestoreError(err, OperationType.WRITE, `transactions/${tx.id}`);
        } catch (e) {
          // Swallow error to preserve UI state
        }
        // Fallback to offline pending store
        await savePendingTransaction(cleanData);
      }
    }
  };

  // Manager Settlement Reversal & Rollback handler
  const handleReverseTransaction = async (tx: Transaction) => {
    console.log(`[TRANSACTION SYNC TRACE] [Reversal Flow] handleReverseTransaction initiated. ID: "${tx.id}"`);
    
    // Clear approval toast if active
    if (toastTimerRef.current) {
      clearInterval(toastTimerRef.current);
    }
    setApprovalToast(null);

    const originalFee = (tx.originalFeeAmount !== undefined && tx.originalFeeAmount > 0) ? tx.originalFeeAmount : (tx.unpaidFeeAmount !== undefined && tx.unpaidFeeAmount > 0 ? tx.unpaidFeeAmount : tx.customerFee || 200);

    // Restore pending settlement object so charge is re-opened for cashier
    const restoredSettlement = tx.lastSettlementBackup || (tx.pendingSettlement ? tx.pendingSettlement : null);

    // Calculate reverted payments and fees
    const payments = tx.chargePayments || [];
    const revertedPayments = payments.length > 0 ? payments.slice(0, -1) : [];
    const revertedPaidAmount = revertedPayments.reduce((acc, curr) => acc + (curr.amount || 0), 0);
    const revertedUnpaidAmount = Math.max(0, originalFee - revertedPaidAmount);
    const revertedProfit = revertedPaidAmount - tx.terminalFee - (tx.cbnCharge || 0);

    const reversedTx: Transaction = {
      ...tx,
      customerFee: originalFee,
      profit: revertedProfit,
      chargesStatus: revertedPaidAmount > 0 ? 'PartiallyPaid' : 'Unpaid',
      unpaidFeeAmount: revertedUnpaidAmount,
      chargesPaidAmount: revertedPaidAmount,
      chargePayments: revertedPayments,
      // Re-open debt & pending settlement for cashier
      pendingSettlement: restoredSettlement ? {
        ...restoredSettlement,
        requestedAt: new Date().toISOString()
      } : {
        requestedBy: tx.cashierName || tx.employeeName || 'Cashier',
        requestedById: tx.cashierId || tx.employeeId || 'cashier',
        requestedAt: new Date().toISOString(),
        feeMethod: tx.feeMethod || 'Cash',
        paidAmount: originalFee,
        note: 'Re-opened after manager settlement reversal',
        proposedChargesStatus: 'Paid',
        proposedUnpaidAmount: 0,
        proposedTotalPaidSoFar: originalFee,
        proposedPaymentRecord: {
          id: `pay-${Date.now()}`,
          date: new Date().toISOString(),
          amount: originalFee,
          collectorName: tx.cashierName || tx.employeeName || 'Cashier',
          note: 'Re-opened settlement request'
        }
      },
      approvalStatus: 'reversed',
      approved: false,
      approvedBy: undefined,
      approvedAt: undefined,
      pending: true,
      needsApproval: true,
      status: 'Pending',
      notes: (tx.notes || '') + ` [Settlement Reversed by Manager at ${new Date().toLocaleTimeString()}]`
    };

    // 1. Remove from optimistic approved tracking ref
    optimisticApprovedTxsRef.current.delete(tx.id);
    try {
      const list = Array.from(optimisticApprovedTxsRef.current);
      localStorage.setItem('POSTrack_Approved_Txs', JSON.stringify(list));
    } catch (e) {
      console.error('[Reversal Flow] LocalStorage save error:', e);
    }

    // 2. Immediately update React State for zero-latency UI / count sync
    dispatch({ type: 'UPDATE_TRANSACTION', payload: reversedTx });

    // Update refs to prevent snapshot re-fetch overwrites
    ownerTxsRef.current = ownerTxsRef.current.map(t => t.id === tx.id ? reversedTx : t);
    cashierTxsRef.current = cashierTxsRef.current.map(t => t.id === tx.id ? reversedTx : t);

    // 3. Update IndexedDB cache
    const cleanData = prepareFirestoreData(reversedTx, 'transactions');
    try {
      const current = await getCachedTransactions();
      const updated = [...current.filter((t: any) => t.id !== tx.id), cleanData];
      await saveCachedTransactions(updated);
    } catch (dbErr) {
      console.error('[Reversal Flow] IndexedDB update error:', dbErr);
    }

    // 4. Update Firestore if online
    if (syncOwnerId) {
      try {
        const txRef = doc(db, 'transactions', tx.id);
        const reversalData = prepareFirestoreData({
          ...cleanData,
          pendingSettlement: reversedTx.pendingSettlement || null,
          lastSettlementBackup: restoredSettlement || null,
          approvalStatus: 'reversed',
          status: 'Pending',
          approved: false,
          approvedBy: null,
          approvedAt: null,
          pending: true,
          needsApproval: true
        }, 'transactions');
        await setDoc(txRef, reversalData, { merge: true });
        console.log(`[Reversal Flow] [SUCCESS] Transaction ID: "${tx.id}" reversed in Firestore.`);
      } catch (err: any) {
        console.warn('[Reversal Flow] Firestore reversal update failed:', err);
      }
    }
  };

  const handleUpdateTransaction = async (tx: Transaction) => {
    console.log(`[TRANSACTION SYNC TRACE] [Save Flow] handleUpdateTransaction initiated. ID: "${tx.id}", Amount: $${tx.amount}`);
    dispatch({ type: 'UPDATE_TRANSACTION', payload: tx });

    const cashierId = tx.employeeId || tx.cashierId || (tx.terminalId ? state.posTerminals.find(t => t.id === tx.terminalId)?.employeeId : undefined) || state.currentUser.id || 'cashier';
    const txWithIds = { 
        ...tx, 
        ownerId: syncOwnerId || state.currentUser.ownerId || state.currentUser.id, 
        cashierId 
    };
    const cleanData = prepareFirestoreData(txWithIds, 'transactions');

    // 1. Save directly to local IndexedDB main cache first
    try {
      console.log(`[TRANSACTION SYNC TRACE] [Save Flow] Updating transaction ID: "${tx.id}" in IndexedDB main cache...`);
      const current = await getCachedTransactions();
      const updated = [...current.filter((t: any) => t.id !== tx.id), cleanData];
      await saveCachedTransactions(updated);
      console.log(`[TRANSACTION SYNC TRACE] [Save Flow] [SUCCESS] Transaction ID: "${tx.id}" updated in IndexedDB main cache.`);
    } catch (dbErr) {
      console.error('[TRANSACTION SYNC TRACE] [Save Flow] [ERROR] Failed to update transaction in main cache:', dbErr);
    }

    const mode = localStorage.getItem('POSTrack_Mode') || 'online';
    const offline = mode === 'offline' || !isOnline;

    if (offline) {
        console.log(`[TRANSACTION SYNC TRACE] [Save Flow] Device/Terminal mode resolved as OFFLINE (POSTrack_Mode: "${mode}", isOnline: ${isOnline}). Enqueuing update to IndexedDB pending list.`);
        await savePendingTransaction(cleanData);
        return;
    }

    if (syncOwnerId) {
      try {
        console.log(`[TRANSACTION SYNC TRACE] [Save Flow] Device is online. Attempting immediate Firestore update for transaction ID: "${tx.id}"...`);
        await setDoc(doc(db, 'transactions', tx.id), cleanData);
        console.log(`[TRANSACTION SYNC TRACE] [Save Flow] [SUCCESS] Transaction ID: "${tx.id}" updated in Firestore successfully.`);
      } catch (err: any) {
        console.warn(`[TRANSACTION SYNC TRACE] [Save Flow] [FALLBACK] Firestore update failed for transaction ID: "${tx.id}". Error:`, err);
        
        if (err.message?.includes('Missing or insufficient permissions') || err.code === 'permission-denied') {
            console.warn('[TRANSACTION SYNC TRACE] Permission Denied. Showing subscription dialog.');
            setIsSubscriptionExpiredDialogOpen(true);
            return;
        }

        try {
           handleFirestoreError(err, OperationType.WRITE, `transactions/${tx.id}`);
        } catch (e) {
           // Swallow
        }

        // Fallback to offline storage
        await savePendingTransaction(cleanData);
      }
    } else {
      console.log(`[TRANSACTION SYNC TRACE] [Save Flow] No syncOwnerId set. Skipping immediate Firestore update for ID: "${tx.id}".`);
    }
  };

  const handleQuickMarkAsPaid = async (tx: Transaction) => {
    const remainingAmount = (tx.unpaidFeeAmount !== undefined && tx.unpaidFeeAmount > 0) ? tx.unpaidFeeAmount : (tx.customerFee || 200);
    if (confirm(`Are you sure you want to mark this debt of ₦${remainingAmount.toLocaleString()} for ${tx.customerName || 'Walk-in Customer'} as FULLY PAID?`)) {
      const originalFee = (tx.originalFeeAmount !== undefined && tx.originalFeeAmount > 0) ? tx.originalFeeAmount : (tx.unpaidFeeAmount !== undefined && tx.unpaidFeeAmount > 0 ? tx.unpaidFeeAmount : tx.customerFee || 200);
      const prevPaid = tx.chargesPaidAmount || 0;
      const totalPaidSoFar = prevPaid + remainingAmount;
      
      const newPaymentRecord = {
        id: generateId(),
        date: new Date().toISOString(),
        amount: remainingAmount,
        collectorName: state.currentUser?.name || 'Cashier',
        note: 'Quick Settle (Mark as Paid Shortcut)'
      };

      const updatedPayments = [...(tx.chargePayments || []), newPaymentRecord];

      const finalCustomerFee = totalPaidSoFar;
      const updatedProfit = finalCustomerFee - tx.terminalFee - (tx.cbnCharge || 0);
      const updatedTotalCustomerCharged = tx.feeMethod === 'CardDebit' ? (tx.amount + finalCustomerFee) : tx.amount;

      if (state.currentUser?.role === 'Employee') {
        const updatedTx: Transaction = {
          ...tx,
          originalFeeAmount: originalFee,
          pendingSettlement: {
            requestedBy: state.currentUser.name,
            requestedById: state.currentUser.id,
            requestedAt: new Date().toISOString(),
            feeMethod: tx.feeMethod || 'Cash',
            paidAmount: remainingAmount,
            note: 'Quick Settle by Cashier',
            proposedChargesStatus: 'Paid',
            proposedTotalPaidSoFar: totalPaidSoFar,
            proposedPaymentRecord: newPaymentRecord
          }
        };
        await handleUpdateTransaction(updatedTx);
        alert(`📢 Settlement request of ₦${remainingAmount.toLocaleString()} for ${tx.customerName || 'Customer'} submitted! Pending Manager approval.`);
        return;
      }

      const updatedTx: Transaction = {
        ...tx,
        customerFee: finalCustomerFee,
        profit: updatedProfit,
        totalCustomerCharged: updatedTotalCustomerCharged,
        chargesStatus: 'Paid',
        unpaidFeeAmount: undefined,
        originalFeeAmount: originalFee,
        chargesPaidAmount: totalPaidSoFar,
        chargePayments: updatedPayments
      };

      await handleUpdateTransaction(updatedTx);

      // Play elegant success sound
      try {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioContextClass) {
          const ctx = new AudioContextClass();
          const now = ctx.currentTime;
          const osc1 = ctx.createOscillator();
          const gain1 = ctx.createGain();
          osc1.type = 'sine';
          osc1.frequency.setValueAtTime(523.25, now); // C5
          gain1.gain.setValueAtTime(0.12, now);
          gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
          osc1.connect(gain1);
          gain1.connect(ctx.destination);
          osc1.start(now);
          osc1.stop(now + 0.2);
        }
      } catch (e) {
        console.error(e);
      }

      alert(`Successfully marked the debt as FULLY PAID for ${tx.customerName || 'Walk-in Customer'}!`);
    }
  };

  const handleDeleteTransaction = async (id: string) => {
    console.log(`[TRANSACTION SYNC TRACE] [Save Flow] handleDeleteTransaction initiated. ID: "${id}"`);
    dispatch({ type: 'DELETE_TRANSACTION', payload: id });

    // 1. Save directly to local IndexedDB main cache first
    try {
      console.log(`[TRANSACTION SYNC TRACE] [Save Flow] Removing transaction ID: "${id}" from IndexedDB main cache...`);
      const current = await getCachedTransactions();
      const updated = current.filter((t: any) => t.id !== id);
      await saveCachedTransactions(updated);
      console.log(`[TRANSACTION SYNC TRACE] [Save Flow] [SUCCESS] Transaction ID: "${id}" removed from IndexedDB main cache.`);
    } catch (dbErr) {
      console.error('[TRANSACTION SYNC TRACE] [Save Flow] [ERROR] Failed to delete transaction from main cache:', dbErr);
    }

    const mode = localStorage.getItem('POSTrack_Mode') || 'online';
    const offline = mode === 'offline' || !isOnline;

    if (offline) {
      try {
        console.log(`[TRANSACTION SYNC TRACE] [Save Flow] Device/Terminal mode resolved as OFFLINE (POSTrack_Mode: "${mode}", isOnline: ${isOnline}). Saving deletion request to IndexedDB pending list.`);
        await savePendingDeletion({
          id: `transactions_${id}`,
          collection: 'transactions',
          docId: id
        });
      } catch (err) {
        console.error('[TRANSACTION SYNC TRACE] [Save Flow] [ERROR] Failed to save pending transaction deletion:', err);
      }
      return;
    }

    if (syncOwnerId) {
      try {
        console.log(`[TRANSACTION SYNC TRACE] [Save Flow] Device is online. Attempting immediate Firestore deletion for transaction ID: "${id}"...`);
        await deleteDoc(doc(db, 'transactions', id));
        console.log(`[TRANSACTION SYNC TRACE] [Save Flow] [SUCCESS] Transaction ID: "${id}" deleted from Firestore successfully.`);
      } catch (err) {
        console.warn(`[TRANSACTION SYNC TRACE] [Save Flow] [FALLBACK] Firestore deletion failed for transaction ID: "${id}". Saving deletion request to IndexedDB pending list. Error:`, err);
        handleFirestoreError(err, OperationType.DELETE, `transactions/${id}`);
        // Fallback
        try {
          await savePendingDeletion({
            id: `transactions_${id}`,
            collection: 'transactions',
            docId: id
          });
        } catch (queueErr) {
          console.error('[TRANSACTION SYNC TRACE] [Save Flow] [ERROR] Fallback save pending transaction deletion failed:', queueErr);
        }
      }
    } else {
      console.log(`[TRANSACTION SYNC TRACE] [Save Flow] No syncOwnerId set. Skipping immediate Firestore deletion for ID: "${id}".`);
    }
  };

  const handleBulkDeleteTransactions = async (ids: string[]) => {
    console.log(`[TRANSACTION SYNC TRACE] [Save Flow] handleBulkDeleteTransactions initiated. Total count: ${ids.length}`);
    dispatch({ type: 'BULK_DELETE_TRANSACTIONS', payload: ids });

    // 1. Update IndexedDB main cache first
    try {
      console.log(`[TRANSACTION SYNC TRACE] [Save Flow] Removing ${ids.length} transactions from IndexedDB main cache...`);
      const current = await getCachedTransactions();
      const updated = current.filter((t: any) => !ids.includes(t.id));
      await saveCachedTransactions(updated);
      console.log(`[TRANSACTION SYNC TRACE] [Save Flow] [SUCCESS] Bulk transactions removed from IndexedDB main cache.`);
    } catch (dbErr) {
      console.error('[TRANSACTION SYNC TRACE] [Save Flow] [ERROR] Failed bulk deletion from main cache:', dbErr);
    }

    const mode = localStorage.getItem('POSTrack_Mode') || 'online';
    const offline = mode === 'offline' || !isOnline;

    if (offline) {
      try {
        console.log(`[TRANSACTION SYNC TRACE] [Save Flow] Device/Terminal mode resolved as OFFLINE (POSTrack_Mode: "${mode}", isOnline: ${isOnline}). Enqueuing bulk deletions to IndexedDB pending list.`);
        for (const id of ids) {
          await savePendingDeletion({
            id: `transactions_${id}`,
            collection: 'transactions',
            docId: id
          });
        }
      } catch (err) {
        console.error('[TRANSACTION SYNC TRACE] [Save Flow] [ERROR] Failed saving bulk pending deletions:', err);
      }
      return;
    }

    if (syncOwnerId) {
      try {
        console.log(`[TRANSACTION SYNC TRACE] [Save Flow] Device is online. Attempting immediate bulk deletion on Firestore...`);
        const batch = writeBatch(db);
        ids.forEach((id) => {
          batch.delete(doc(db, 'transactions', id));
        });
        await batch.commit();
        console.log(`[TRANSACTION SYNC TRACE] [Save Flow] [SUCCESS] Bulk Firestore deletions committed successfully.`);
      } catch (err) {
        console.warn(`[TRANSACTION SYNC TRACE] [Save Flow] [FALLBACK] Bulk Firestore deletion failed. Saving bulk deletion requests to IndexedDB pending list. Error:`, err);
        handleFirestoreError(err, OperationType.WRITE, 'transactions_bulk_delete');
        // Fallback
        try {
          for (const id of ids) {
            await savePendingDeletion({
              id: `transactions_${id}`,
              collection: 'transactions',
              docId: id
            });
          }
        } catch (queueErr) {
          console.error('[TRANSACTION SYNC TRACE] [Save Flow] [ERROR] Fallback saving bulk pending deletions failed:', queueErr);
        }
      }
    } else {
      console.log(`[TRANSACTION SYNC TRACE] [Save Flow] No syncOwnerId set. Skipping immediate bulk Firestore deletion.`);
    }
  };

  const handleBulkUpdateTransactions = async (updatedTxs: Transaction[]) => {
    console.log(`[TRANSACTION SYNC TRACE] [Save Flow] handleBulkUpdateTransactions initiated. Total count: ${updatedTxs.length}`);
    dispatch({ type: 'BULK_UPDATE_TRANSACTIONS', payload: updatedTxs });

    // 1. Update IndexedDB main cache
    try {
      console.log(`[TRANSACTION SYNC TRACE] [Save Flow] Updating ${updatedTxs.length} transactions in IndexedDB main cache...`);
      const current = await getCachedTransactions();
      const idMap = new Map(updatedTxs.map(tx => [tx.id, tx]));
      const updated = current.map((tx: any) => idMap.has(tx.id) ? { ...tx, ...idMap.get(tx.id) } : tx);
      await saveCachedTransactions(updated);
      console.log(`[TRANSACTION SYNC TRACE] [Save Flow] [SUCCESS] Bulk transactions updated in IndexedDB main cache.`);
    } catch (dbErr) {
      console.error('[TRANSACTION SYNC TRACE] [Save Flow] [ERROR] Failed bulk update in main cache:', dbErr);
    }

    const mode = localStorage.getItem('POSTrack_Mode') || 'online';
    const offline = mode === 'offline' || !isOnline;

    if (offline) {
      try {
        console.log(`[TRANSACTION SYNC TRACE] [Save Flow] Device/Terminal mode resolved as OFFLINE (POSTrack_Mode: "${mode}", isOnline: ${isOnline}). Saving bulk updates to IndexedDB pending list.`);
        for (const tx of updatedTxs) {
          const cashierId = tx.employeeId || tx.cashierId || (tx.terminalId ? state.posTerminals.find(t => t.id === tx.terminalId)?.employeeId : undefined) || state.currentUser.id || 'cashier';
          const txWithOwner = { ...tx, ownerId: syncOwnerId || 'mgr_1', cashierId };
          const cleanData = prepareFirestoreData(txWithOwner, 'transactions');
          await savePendingTransaction(cleanData);
        }
      } catch (err) {
        console.error('[TRANSACTION SYNC TRACE] [Save Flow] [ERROR] Failed saving pending bulk transaction updates:', err);
      }
      return;
    }

    if (syncOwnerId) {
      try {
        console.log(`[TRANSACTION SYNC TRACE] [Save Flow] Device is online. Attempting immediate bulk update on Firestore...`);
        const batch = writeBatch(db);
        updatedTxs.forEach((tx) => {
          const cashierId = tx.employeeId || tx.cashierId || (tx.terminalId ? state.posTerminals.find(t => t.id === tx.terminalId)?.employeeId : undefined) || state.currentUser.id || 'cashier';
          const txWithOwner = { ...tx, ownerId: syncOwnerId, cashierId };
          const cleanData = prepareFirestoreData(txWithOwner, 'transactions');
          batch.set(doc(db, 'transactions', tx.id), cleanData, { merge: true });
        });
        await batch.commit();
        console.log(`[TRANSACTION SYNC TRACE] [Save Flow] [SUCCESS] Bulk Firestore updates committed successfully.`);
      } catch (err) {
        console.warn(`[TRANSACTION SYNC TRACE] [Save Flow] [FALLBACK] Bulk Firestore update failed. Saving bulk updates to IndexedDB pending list. Error:`, err);
        handleFirestoreError(err, OperationType.WRITE, 'transactions_bulk_update');
        // Fallback
        try {
          for (const tx of updatedTxs) {
            const cashierId = tx.employeeId || tx.cashierId || (tx.terminalId ? state.posTerminals.find(t => t.id === tx.terminalId)?.employeeId : undefined) || state.currentUser.id || 'cashier';
            const txWithOwner = { ...tx, ownerId: syncOwnerId, cashierId };
            const cleanData = prepareFirestoreData(txWithOwner, 'transactions');
            await savePendingTransaction(cleanData);
          }
        } catch (queueErr) {
          console.error('[TRANSACTION SYNC TRACE] [Save Flow] [ERROR] Fallback saving pending bulk transaction updates failed:', queueErr);
        }
      }
    }
  };

  const handleCustomResetData = async () => {
    dispatch({ type: 'RESET_DATA' });

    // Seed/Reset IndexedDB main cache
    const seedTxs = getSeedTransactions(state.terminalFeeRate);
    try {
      await saveCachedTransactions(seedTxs);
    } catch (dbErr) {
      console.error('[DB] Failed resetting transaction main cache:', dbErr);
    }

    if (syncOwnerId) {
      try {
        const batch = writeBatch(db);
        const currentTxs = state.transactions;
        currentTxs.forEach((tx) => {
          batch.delete(doc(db, 'transactions', tx.id));
        });

        seedTxs.forEach((tx) => {
          const cashierId = tx.employeeId || tx.cashierId || state.currentUser.id || 'cashier';
          const txWithOwner = { ...tx, ownerId: syncOwnerId, cashierId };
          const cleanData = prepareFirestoreData(txWithOwner, 'transactions');
          batch.set(doc(db, 'transactions', tx.id), cleanData);
        });

        await batch.commit();
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, 'transactions_batch_reset');
      }
    }
  };

  const handleAddExpense = async (expense: Expense) => {
    dispatch({ type: 'ADD_EXPENSE', payload: expense });

    const expenseWithOwner = { ...expense, ownerId: syncOwnerId || 'mgr_1' };
    const cleanData = prepareFirestoreData(expenseWithOwner, 'expenses');

    // 1. Save directly to local IndexedDB main cache first
    try {
      const current = await getCachedExpenses();
      const updated = [...current.filter((e: any) => e.id !== expense.id), cleanData];
      await saveCachedExpenses(updated);
    } catch (dbErr) {
      console.error('[DB] Failed to save expense to main cache:', dbErr);
    }

    const mode = localStorage.getItem('POSTrack_Mode') || 'online';
    const offline = mode === 'offline' || !isOnline;

    if (offline) {
      try {
        await savePendingExpense(cleanData);
      } catch (err) {
        console.error('[DB] Failed to save pending expense:', err);
      }
      return;
    }

    if (syncOwnerId) {
      try {
        await setDoc(doc(db, 'expenses', expense.id), cleanData);
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `expenses/${expense.id}`);
        // Fallback
        try {
          await savePendingExpense(cleanData);
        } catch (queueErr) {
          console.error('[DB] Fallback save pending expense failed:', queueErr);
        }
      }
    }
  };

  const handleDeleteExpense = async (id: string) => {
    dispatch({ type: 'DELETE_EXPENSE', payload: id });

    // 1. Delete from local IndexedDB main cache first
    try {
      const current = await getCachedExpenses();
      const updated = current.filter((e: any) => e.id !== id);
      await saveCachedExpenses(updated);
    } catch (dbErr) {
      console.error('[DB] Failed to delete expense from main cache:', dbErr);
    }

    const mode = localStorage.getItem('POSTrack_Mode') || 'online';
    const offline = mode === 'offline' || !isOnline;

    if (offline) {
      try {
        await savePendingDeletion({
          id: `expenses_${id}`,
          collection: 'expenses',
          docId: id
        });
      } catch (err) {
        console.error('[DB] Failed to save pending expense deletion:', err);
      }
      return;
    }

    if (syncOwnerId) {
      try {
        await deleteDoc(doc(db, 'expenses', id));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `expenses/${id}`);
        // Fallback
        try {
          await savePendingDeletion({
            id: `expenses_${id}`,
            collection: 'expenses',
            docId: id
          });
        } catch (queueErr) {
          console.error('[DB] Fallback save pending expense deletion failed:', queueErr);
        }
      }
    }
  };

  const [isLocked, setIsLocked] = useState(() => {
    try {
      const locked = localStorage.getItem('OPay_Terminal_Locked');
      const isLockedVal = locked !== 'false';
      console.log(`[OFFLINE AUTH TRACE] Initializing terminal lock status. LocalStorage OPay_Terminal_Locked: "${locked}" -> Resolved isLocked: ${isLockedVal}`);
      return isLockedVal;
    } catch (e) {
      console.error('[OFFLINE AUTH TRACE] Error reading OPay_Terminal_Locked from localStorage:', e);
      return true;
    }
  });

  const handleLoginSuccess = (user: User) => {
    const terminalMode = (localStorage.getItem('POSTrack_Mode') as 'online' | 'offline') || 'online';
    setAppMode(terminalMode);
    console.log('[OFFLINE AUTH TRACE] handleLoginSuccess successfully invoked:', {
      userId: user.id,
      userName: user.name,
      userRole: user.role,
      userPhone: user.phone,
      terminalMode: terminalMode
    });

    setRegisteredUsers((prev) => {
      if (!prev.some(u => u.id === user.id)) {
        console.log('[OFFLINE AUTH TRACE] Adding logged-in user to active registeredUsers pool and localStorage:', user.id);
        const next = [...prev, user];
        safeLocalStorageSet('OPay_Registered_Users_v4', JSON.stringify(next));
        return next;
      }
      return prev;
    });

    dispatch({ type: 'SWITCH_USER', payload: user });
    setIsLocked(false);
    localStorage.setItem('OPay_Terminal_Locked', 'false');
    console.log('[OFFLINE AUTH TRACE] Terminal unlocked. Current active shift operator is:', user.name);
  };

  const handleLockTerminal = () => {
    console.log('[OFFLINE AUTH TRACE] Terminal lock triggered manually. Setting OPay_Terminal_Locked = true.');
    setIsLocked(true);
    localStorage.setItem('OPay_Terminal_Locked', 'true');
  };

  const personaSectionRef = useRef<HTMLDivElement>(null);
  const targetSectionRef = useRef<HTMLDivElement>(null);
  const historySectionRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // CMD/CTRL + K or / key to focus search (if not in an input/textarea)
      if (
        (e.key === 'k' && (e.metaKey || e.ctrlKey)) ||
        (e.key === '/' && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA' && document.activeElement?.tagName !== 'SELECT')
      ) {
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Compute today's statistics for active shift operator
  const currentShiftStats = useMemo(() => {
    const todayStr = new Date().toDateString();
    const targetUserId = state.impersonatedUserId || state.currentUser.id;
    const myTxs = (state.transactions || []).filter(t => t.employeeId === targetUserId && t.status === 'Success');
    const todayTxs = myTxs.filter(t => new Date(t.timestamp).toDateString() === todayStr);
    
    const targetUser = state.currentUser.role === 'Manager' && state.impersonatedUserId
      ? (registeredUsers || []).find(u => u.id === state.impersonatedUserId)
      : state.currentUser;
    const isEmployee = targetUser?.role === 'Employee';

    return {
      count: todayTxs.length,
      volume: todayTxs.reduce((sum, t) => sum + t.amount, 0),
      profit: todayTxs.reduce((sum, t) => sum + (t.profit || 0), 0)
    };
  }, [state.transactions, state.currentUser, state.impersonatedUserId, registeredUsers]);

  const handleRegisterUser = async (newUser: User) => {
    console.log('[Registration] Starting registration for:', newUser.name, 'Role:', newUser.role);
    isRegisteringUser.current = true;
    try {
      let finalUid = newUser.id;
      
      // 1. Thorough Pre-Registration Checks
      const phoneKey = cleanPhoneForCompare(newUser.phone || '');
      const emailLower = newUser.email?.trim().toLowerCase();

      // Check against local state
      let phoneExists = phoneKey && registeredUsers.some(u => cleanPhoneForCompare(u.phone || '') === phoneKey);
      let emailExists = emailLower && registeredUsers.some(u => u.email && u.email.trim().toLowerCase() === emailLower);

      // Robust check: Query Firestore directly if not found locally
      if (!phoneExists || !emailExists) {
        try {
          const usersRef = collection(db, 'users');
          if (!phoneExists && phoneKey) {
            const q = query(usersRef, where('phone', '==', newUser.phone));
            const snap = await getDocs(q);
            phoneExists = !snap.empty;
          }
          if (!emailExists && emailLower) {
            const q = query(usersRef, where('email', '==', emailLower));
            const snap = await getDocs(q);
            emailExists = !snap.empty;
          }
        } catch (err) {
          console.error('[Registration] Firestore pre-check failed:', err);
        }
      }

      if (phoneExists || emailExists) {
        const dupError = new Error(`An account already exists with this ${phoneExists ? 'phone number' : 'email address'}. Please sign in instead.`);
        (dupError as any).code = 'auth/email-already-in-use';
        console.error('[Registration] Pre-check failed: User already exists');
        throw dupError;
      }

      // Firebase Auth User Creation
      const loginIdentifier = phoneKey || Math.random().toString(36).substring(7);
      const authEmail = `${loginIdentifier}@opay-pos.com`;
      const authPass = getAuthPassword(newUser.pin || '1111'); 
      
      console.log(`[Registration] Creating Auth account for ${newUser.role}:`, authEmail);
      
      let userCred;
      try {
        userCred = await createUserWithEmailAndPassword(auth, authEmail, authPass);
        finalUid = userCred.user.uid;
        await updateProfile(userCred.user, { displayName: newUser.name });
      } catch (authErr: any) {
        if (authErr?.code === 'auth/email-already-in-use') {
          console.log('[Registration] Email/account already exists in Auth. Attempting sign-in fallback...');
          try {
            userCred = await signInWithEmailAndPassword(auth, authEmail, authPass);
            finalUid = userCred.user.uid;
            console.log('[Registration] Sign-in fallback succeeded. UID:', finalUid);
          } catch (signInErr: any) {
            console.error('[Registration] Sign-in fallback failed:', signInErr.code, signInErr.message);
            const dupError = new Error(`An account with this phone number already exists. Please sign in instead.`);
            (dupError as any).code = 'auth/email-already-in-use';
            throw dupError;
          }
        } else {
          console.error('[Registration] Firebase Authentication failed:', authErr?.code, authErr?.message);
          throw authErr;
        }
      }

      // Prepare Firestore document
      const firestoreDocRaw = {
        uid: finalUid,
        id: finalUid,
        fullName: newUser.name,
        phoneNumber: newUser.phone,
        phone: newUser.phone,
        role: newUser.role,
        ownerId: newUser.role === 'Manager' ? finalUid : (newUser.ownerId || syncOwnerId || 'mgr_1'),
        email: newUser.email || authEmail,
        activated: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        status: 'active',
        permissions: newUser.role === 'Manager' ? ['admin', 'manager'] : ['cashier'],
        referralCode: newUser.referralCode,
        referredBy: newUser.referredBy,
        areaOfWorking: newUser.areaOfWorking,
        avatar: newUser.avatar
      };

      const cleanData = prepareFirestoreData(firestoreDocRaw, 'users');
      await setDoc(doc(db, 'users', finalUid), cleanData, { merge: true });
      
      // Clear referral codes after successful registration
      localStorage.removeItem('pending_referral_code');
      localStorage.removeItem('OPay_Saved_Referral_Code');
      
      // If new user is a Manager with a referredBy code, initialize subscription & referral document
      if (newUser.role === 'Manager') {
        const subRef = doc(db, 'subscriptions', finalUid);
        await setDoc(subRef, {
          id: finalUid,
          ownerId: finalUid,
          plan: 'Free Trial',
          status: 'Trial',
          trialStartDate: new Date().toISOString(),
          trialEndDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
          subscriptionStartDate: null,
          subscriptionEndDate: null,
          referredBy: newUser.referredBy ? newUser.referredBy.toUpperCase() : null,
          payoutBalance: 0,
          payoutLifetime: 0
        }, { merge: true });

        if (newUser.referredBy) {
          try {
            const usersRef = collection(db, 'users');
            const qRef = query(usersRef, where('referralCode', '==', newUser.referredBy.toUpperCase()));
            const snapRef = await getDocs(qRef);
            if (!snapRef.empty) {
              const referrerUser = snapRef.docs[0].data();
              const referrerUid = referrerUser.uid || referrerUser.id;
              const referralId = `${referrerUid}_${finalUid}`;
              
              await setDoc(doc(db, 'referrals', referralId), {
                id: referralId,
                referrerId: referrerUid,
                referrerCode: referrerUser.referralCode,
                referredId: finalUid,
                referredName: newUser.name,
                referredEmail: newUser.email || `${newUser.phone}@opay-pos.com`,
                referredPhone: newUser.phone,
                status: 'Trial',
                plan: 'Free Trial',
                commissionAmount: 0,
                createdAt: new Date().toISOString()
              }, { merge: true });
            }
          } catch (refErr) {
            console.error('Error recording manager referral:', refErr);
          }
        }
      }

      showAppNotification(`Account for ${newUser.name} created successfully.`, 'success');
      
      // Update local state and cache
      await saveCachedUser({ ...cleanData, pin: newUser.pin });
      
      setRegisteredUsers(prev => [...prev.filter(u => u.id !== finalUid), mapFirestoreUser(cleanData, finalUid)]);

    } catch (err: any) {
      if (['auth/email-already-in-use', 'auth/weak-password', 'auth/network-request-failed'].includes(err.code)) {
        console.warn(`[Registration Flow] Handled auth error: ${err.code}`);
      } else {
        console.error('[Registration Flow] Error captured:', err.code, err.message);
      }
      
      let friendlyMsg = 'Registration failed. Please try again later.';
      switch (err.code) {
        case 'auth/email-already-in-use':
          friendlyMsg = 'This account already exists. Please login using your existing account.';
          break;
        case 'auth/weak-password':
          friendlyMsg = 'The passcode/PIN is too weak.';
          break;
        case 'auth/network-request-failed':
          friendlyMsg = 'No internet connection. Please reconnect and try again.';
          break;
        case 'permission-denied':
          friendlyMsg = 'Database permission error. Please contact support.';
          break;
        default:
          friendlyMsg = err.message || friendlyMsg;
      }
      
      // We throw to allow LoginScreen to handle the UI update
      (err as any).userFriendlyMessage = friendlyMsg;
      throw err;
    } finally {
      isRegisteringUser.current = false;
    }
  };


  const handleUpdateUserPin = async (userId: string, newPin: string) => {
    console.log('[OFFLINE AUTH TRACE] App.tsx: updating user PIN inside IndexedDB "users" store for user ID:', userId, 'with new PIN length:', newPin.length);
    // 1. Sync directly to local IndexedDB cache
    try {
      const cached = await getCachedUser(userId);
      if (cached) {
        console.log('[OFFLINE AUTH TRACE] User found in cache. Proceeding to update PIN in "users" store.');
        await saveCachedUser({ ...cached, pin: newPin });
        console.log('[OFFLINE AUTH TRACE] Successfully updated user PIN in offline IndexedDB cache for userId:', userId);
      } else {
        console.warn('[OFFLINE AUTH TRACE] Failed to find user in offline cache to update PIN:', userId);
      }
    } catch (dbErr) {
      console.error('[OFFLINE AUTH TRACE] Failed to update PIN in offline cache:', dbErr);
    }

    if (syncOwnerId) {
      try {
        // Since we are instructed to NEVER store user's password or PIN inside Firestore,
        // we'll update the password in Firebase Auth if it is the currently authenticated user.
        if (auth.currentUser && auth.currentUser.uid === userId) {
          await updatePassword(auth.currentUser, getAuthPassword(newPin));
          console.log('[PIN Update] Successfully updated Firebase Auth password for current user.');
        } else {
          console.warn('[PIN Update] Skipping Firestore PIN storage for other user per security rules. Raw PINs must never be stored in the database.');
        }
      } catch (err) {
        console.error('[PIN Update] Error updating PIN:', err);
        showAppNotification(`Failed to update PIN: ${err instanceof Error ? err.message : String(err)}`, 'error');
        return;
      }
    } else {
      setRegisteredUsers((prev) => {
        const next = prev.map((u) => u.id === userId ? { ...u, pin: newPin } : u);
        safeLocalStorageSet('OPay_Registered_Users_v4', JSON.stringify(next));
        return next;
      });
    }
    showAppNotification(`Operator PIN successfully reset.`, 'success');
  };

  const handleUpdateUser = async (updatedUser: User) => {
    // 1. Sync directly to local IndexedDB cache
    try {
      const cleanData = prepareFirestoreData({ ...updatedUser, ownerId: syncOwnerId || 'mgr_1' }, 'users');
      await saveCachedUser(cleanData);
      console.log('[User Update] Successfully updated user in offline IndexedDB cache:', updatedUser.id);
    } catch (dbErr) {
      console.error('[User Update] Failed to update user in offline cache:', dbErr);
    }

    if (syncOwnerId) {
      try {
        const userWithOwner = { ...updatedUser, ownerId: syncOwnerId };
        const cleanData = prepareFirestoreData(userWithOwner, 'users');
        await setDoc(doc(db, 'users', updatedUser.id), cleanData, { merge: true });
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `users/${updatedUser.id}`);
      }
    } else {
      setRegisteredUsers((prev) => {
        const next = prev.map((u) => u.id === updatedUser.id ? updatedUser : u);
        safeLocalStorageSet('OPay_Registered_Users_v4', JSON.stringify(next));
        return next;
      });
    }
    // Update active currentUser if modifying themselves
    if (updatedUser.id === state.currentUser.id) {
      dispatch({ type: 'SWITCH_USER', payload: updatedUser });
    }
    showAppNotification(`Information for ${updatedUser.name} has been updated.`, 'success');
  };

  const handleDeleteUser = async (userId: string) => {
    // 1. Sync directly to local IndexedDB cache
    try {
      await deleteCachedUser(userId);
      console.log('[User Delete] Successfully deleted user from offline IndexedDB cache:', userId);
    } catch (dbErr) {
      console.error('[User Delete] Failed to delete user from offline cache:', dbErr);
    }

    if (syncOwnerId) {
      try {
        await deleteDoc(doc(db, 'users', userId));
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `users/${userId}`);
      }
    } else {
      setRegisteredUsers((prev) => {
        const next = prev.filter((u) => u.id !== userId);
        safeLocalStorageSet('OPay_Registered_Users_v4', JSON.stringify(next));
        return next;
      });
    }
  };

  const handleDeleteAllUsers = async () => {
    if (syncOwnerId) {
      try {
        const batch = writeBatch(db);
        registeredUsers.forEach((u) => {
          batch.delete(doc(db, 'users', u.id));
        });
        await batch.commit();
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `users_deleteAll`);
      }
    } else {
      setRegisteredUsers([]);
      safeLocalStorageSet('OPay_Registered_Users_v4', JSON.stringify([]));
    }
  };

  // Synchronize state.currentUser dynamically if detailed properties are modified on Firestore/local sessions
  useEffect(() => {
    const matched = registeredUsers.find(u => u.id === state.currentUser.id);
    if (matched) {
      if (
        matched.name !== state.currentUser.name ||
        matched.phone !== state.currentUser.phone ||
        matched.role !== state.currentUser.role ||
        matched.ownerId !== state.currentUser.ownerId
      ) {
        dispatch({ type: 'SWITCH_USER', payload: matched });
      }
    }
  }, [registeredUsers, state.currentUser.id]);

  // Keep local storage in sync with registeredUsers for offline startup access
  useEffect(() => {
    safeLocalStorageSet('OPay_Registered_Users_v4', JSON.stringify(registeredUsers));
  }, [registeredUsers]);

  const allUsersPool = useMemo(() => {
    return registeredUsers;
  }, [registeredUsers]);

  const availableEmployees = useMemo(() => {
    return registeredUsers.filter(u => 
      u.role === 'Employee' && 
      (u.ownerId === state.currentUser.id || u.ownerId === 'mgr_1' || u.ownerId === 'local_owner' || !u.ownerId)
    );
  }, [registeredUsers, state.currentUser.id]);

  const authorizedHistoryTransactions = useMemo(() => {
    let txs = state.historyTransactions;
    if (state.currentUser.role === 'Employee') {
      const cashierId = state.currentUser.id;
      // STRICT FILTERING: Employees MUST ONLY see their own history transactions by unique ID.
      txs = txs.filter(t => t.employeeId === cashierId || t.cashierId === cashierId || t.createdBy === cashierId);
    } else {
      const teamUserIds = new Set(teamUsers.map(u => u.id));
      teamUserIds.add(state.currentUser.id);

      txs = txs.filter(t => 
        t.ownerId === state.currentUser.id ||
        (t as any).managerId === state.currentUser.id ||
        teamUserIds.has(t.employeeId) ||
        teamUserIds.has(t.cashierId) ||
        t.createdBy === state.currentUser.id ||
        (t.addedBy && teamUsers.some(u => u.name.toLowerCase().trim() === t.addedBy?.toLowerCase().trim()))
      );

      const targetUserId = state.impersonatedUserId || (state.selectedEmployeeFilter === 'ALL' ? undefined : state.selectedEmployeeFilter);
      if (targetUserId) {
        txs = txs.filter(t => t.employeeId === targetUserId || t.cashierId === targetUserId || t.ownerId === targetUserId || (t as any).managerId === targetUserId || t.createdBy === targetUserId);
      }
    }
    
    // Apply Memory-based Date Filtering
    const dateFiltered = filterTransactionsByHistoryFilter(txs, state.historyFilter);

    // Apply Advanced Search and Category Filtering (Synced across app)
    return applyAdvancedFilter(dateFiltered, searchQuery, typeFilter, providerFilter);
  }, [state.historyTransactions, state.currentUser, state.selectedEmployeeFilter, state.impersonatedUserId, state.historyFilter, searchQuery, typeFilter, providerFilter, teamUsers]);

  // Determine active user (impersonated or real)
  const activeUser = useMemo(() => {
    if (state.impersonatedUserId) {
        return registeredUsers.find(u => u.id === state.impersonatedUserId) || state.currentUser;
    }
    return state.currentUser;
  }, [state.impersonatedUserId, state.currentUser, registeredUsers]);

  // Safely auto-fallback non-super-admin accounts back to POS tab if accessing restricted tabs
  useEffect(() => {
    if (!isSuperAdmin && (dashboardTab === 'settings' || dashboardTab === 'audit' || dashboardTab === 'pricing')) {
      setDashboardTab('pos');
    } else if (activeUser.role !== 'Manager' && (dashboardTab === 'reports' || dashboardTab === 'settings' || dashboardTab === 'referrals')) {
      setDashboardTab('pos');
    }
  }, [isSuperAdmin, activeUser.role, dashboardTab]);

  // Manager: Compute aggregate metrics for ALL transactions
  const managerDailyStats = useMemo(() => {
    if (state.currentUser.role !== 'Manager') return null;
    return computeTxMetrics(authorizedTransactions, 'Daily', state.terminalFeeRate);
  }, [authorizedTransactions, state.terminalFeeRate, state.currentUser.role]);

  // Compute matched transactions based on global search query
  const matchedTransactions = useMemo(() => {
    if (!searchQuery.trim()) {
      return [];
    }
    const q = searchQuery.toLowerCase().trim();
    return authorizedTransactions.filter((tx) => {
      const idMatch = tx.id.toLowerCase().includes(q);
      const nameMatch = tx.employeeName.toLowerCase().includes(q);
      const amountMatch = tx.amount.toString().includes(q) || formatNaira(tx.amount).toLowerCase().includes(q);
      const notesMatch = tx.notes ? tx.notes.toLowerCase().includes(q) : false;
      const typeMatch = tx.type.toLowerCase().includes(q);
      const providerMatch = tx.provider.toLowerCase().includes(q);
      return idMatch || nameMatch || amountMatch || notesMatch || typeMatch || providerMatch;
    });
  }, [authorizedTransactions, searchQuery]);

  // Pending approval transactions for manager dashboard (unaffected by employee filter)
  const pendingApprovalTxs = useMemo(() => {
    if (activeUser.role !== 'Manager') return [];
    return authorizedTransactions.filter(t => 
      !!t.pendingSettlement && 
      t.approvalStatus !== 'approved' && 
      t.approved !== true && 
      t.status !== 'Paid' && 
      t.status !== 'Settled'
    );
  }, [authorizedTransactions, activeUser.role]);

  // Compute Active Selection Metrics (Synchronized with History Filter)
  const activeMetrics = useMemo(() => {
    // Use the already filtered authorizedHistoryTransactions to ensure synchronization
    // Pass 'Lifetime' to computeTxMetrics as date filtering was already applied in memory
    return computeTxMetrics(authorizedHistoryTransactions, 'Lifetime', state.terminalFeeRate);
  }, [authorizedHistoryTransactions, state.terminalFeeRate]);

  // Compute Timeframe Blocks metrics for Overview Matrix items
  const summaryOverviews = useMemo(() => {
    const targetTxs = authorizedTransactions;

    const dailyVec = computeTxMetrics(targetTxs, 'Daily', state.terminalFeeRate);
    const weeklyVec = computeTxMetrics(targetTxs, 'Weekly', state.terminalFeeRate);
    const monthlyVec = computeTxMetrics(targetTxs, 'Monthly', state.terminalFeeRate);
    const yearlyVec = computeTxMetrics(targetTxs, 'Yearly', state.terminalFeeRate);
    const allTimeVec = computeTxMetrics(targetTxs, 'All-Time', state.terminalFeeRate);

    return {
      daily: dailyVec,
      weekly: weeklyVec,
      monthly: monthlyVec,
      yearly: yearlyVec,
      allTime: allTimeVec
    };
  }, [authorizedTransactions, state.transactions, state.terminalFeeRate, state.currentUser.role, state.impersonatedUserId]);

  // Handle immediate test simulation injections
  const triggerSimulation = () => {
    if (isPremiumLocked) {
      setIsSubscriptionExpiredDialogOpen(true);
      return;
    }
    const isWithdrawal = Math.random() > 0.4;
    const type = isWithdrawal ? 'Withdrawal' : 'Deposit';
    const provider = Math.random() > 0.6 ? 'OPay' : Math.random() > 0.3 ? 'Moniepoint' : 'PalmPay';
    const amount = [5000, 10000, 15000, 20000, 30000, 50000, 80000][Math.floor(Math.random() * 7)];
    const subType = Math.random() > 0.4 ? 'OtherBank' : 'SameBank';
    
    // Choose worker operator
    const employeeId = state.currentUser.id;
    const employeeName = state.currentUser.name;

    // Nigeria Agent fee practices standard calculation
    const financials = getCalculatedFinancials(amount, type, provider, state.settings);
    const customerFee = financials.customerCharge; 
    const terminalFee = financials.providerCharge;
    const cbnCharge = financials.cbnCharge;
    const profit = financials.agentProfit;

    const newSimTx: Transaction = {
      id: 'tx_sim_' + Math.floor(1000 + Math.random() * 9000),
      employeeId,
      employeeName,
      type,
      provider,
      subType,
      amount,
      customerFee,
      terminalFee,
      cbnCharge,
      profit,
      timestamp: new Date().toISOString(),
      notes: 'Automated live micro-simulation entry'
    };

    handleAddTransaction(newSimTx);
  };

  // Helper function to render currency or support privacy mode
  const displayNaira = (val: number) => {
    if (hideBalances) {
      return '₦ •••••••';
    }
    return formatNaira(val);
  };

  // Actions for circular menu
  const openWithPreset = (type: TransactionType, mode: 'Standard' | 'SplitWithdrawal' = 'Standard') => {
    if (isPremiumLocked) {
      setIsSubscriptionExpiredDialogOpen(true);
      return;
    }
    setIsAddModalOpen(true);
    setPreselectedFormType(type);
    setPreselectedMode(mode);
  };

  const handleExportCSV = () => {
    if (authorizedTransactions.length === 0) {
      alert('No record transactions found to export.');
      return;
    }

    const headers = ['TXID', 'Timestamp', 'Staff Operator', 'Type', 'POS Provider', 'Amount(NGN)', 'Customer FeeCharged', 'Terminal Cost', 'Profit(NGN)', 'Notes'];
    
    const rows = authorizedTransactions.map(tx => [
      tx.id,
      new Date(tx.timestamp).toLocaleString(),
      tx.employeeName,
      tx.type,
      tx.provider,
      tx.amount.toString(),
      tx.customerFee.toString(),
      tx.terminalFee.toString(),
      tx.profit.toString(),
      tx.notes || ''
    ]);

    const csvContent = 
      'data:text/csv;charset=utf-8,' + 
      [headers.join(','), ...rows.map(e => e.map(val => `"${val.replace(/"/g, '""')}"`).join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `OPayStyle_AuditExport_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const scrollToRef = (ref: React.RefObject<HTMLDivElement | null>) => {
    if (ref === historySectionRef) {
      setDashboardTab('pos');
    }
    setTimeout(() => {
      if (ref && ref.current) {
        ref.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }, 150);
  };

  const renderSyncStatusBadge = () => {
    let status: 'offline' | 'synced' | 'syncing' | 'pending-offline' = 'offline';
    
    const isOnlineCapable = syncOwnerId && syncOwnerId !== 'mgr_1';
    
    if (isOnlineCapable) {
      if (isSyncing) {
        status = 'syncing';
      } else if (pendingSyncCount > 0) {
        if (isOnline) {
          status = 'syncing';
        } else {
          status = 'pending-offline';
        }
      } else {
        status = 'synced';
      }
    } else {
      status = 'offline';
    }

    const badgeConfig = {
      'offline': {
        bg: 'bg-neutral-100 border-neutral-200 text-neutral-600',
        dotColor: 'bg-neutral-400',
        label: 'Offline Mode (Local Only)',
        icon: <CloudOff className="w-3.5 h-3.5 text-neutral-500" />,
        tooltip: 'Running in offline mode. Your data is saved locally on this device. Setup Cloud Sync in the Settings/Cloud menu to back up and sync across devices.'
      },
      'synced': {
        bg: 'bg-emerald-50 border-emerald-100 text-emerald-700',
        dotColor: 'bg-[#00B87A]',
        label: 'Cloud Synced',
        icon: <Cloud className="w-3.5 h-3.5 text-[#00B87A]" />,
        tooltip: 'All local modifications are successfully saved in the cloud. Your recent data is highly secure.'
      },
      'syncing': {
        bg: 'bg-indigo-50 border-indigo-150 text-indigo-700',
        dotColor: 'bg-indigo-500',
        label: `Syncing (${pendingSyncCount} left)...`,
        icon: <RefreshCw className="w-3.5 h-3.5 text-indigo-500 animate-spin" />,
        tooltip: 'Currently uploading new records to the cloud database. Please keep the app open to complete synchronization.'
      },
      'pending-offline': {
        bg: 'bg-amber-50 border-amber-150 text-amber-700',
        dotColor: 'bg-amber-500',
        label: 'Offline (Sync Pending)',
        icon: <WifiOff className="w-3.5 h-3.5 text-amber-500" />,
        tooltip: 'You are registered for Cloud Sync, but this device is currently offline. New changes are stored locally and will sync automatically when you reconnect.'
      }
    };

    const current = badgeConfig[status];

    return (
      <div 
        className={`inline-flex items-center gap-1.5 px-2 py-0.5 mt-1 text-[10px] font-semibold rounded-md border ${current.bg} w-fit transition duration-150 select-none cursor-help shadow-2xs`}
        title={current.tooltip}
      >
        <span className="flex items-center gap-1">
          {current.icon}
          <span>{current.label}</span>
        </span>
        <span className="relative flex h-1.5 w-1.5">
          {status === 'syncing' && (
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
          )}
          {status === 'synced' && (
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#00B87A]/50 opacity-75"></span>
          )}
          <span className={`relative inline-flex rounded-full h-1.5 w-1.5 ${current.dotColor}`}></span>
        </span>
      </div>
    );
  };

  if (isLoading || cloudLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-50 flex-col gap-4">
        <div className="w-12 h-12 border-4 border-[#00B87A] border-t-transparent rounded-full animate-spin" />
        <p className="text-neutral-500 font-bold animate-pulse text-sm">Synchronizing your session...</p>
      </div>
    );
  }

  if (isLocked || !activeUser || !activeUser.id || forceRegister) {
    return (
      <LoginScreen
        registeredUsers={registeredUsers}
        onLogin={(user) => {
          setForceRegister(false);
          handleLoginSuccess(user);
        }}
        onRegister={handleRegisterUser}
        onDeleteAllAccounts={handleDeleteAllUsers}
        isUsersLoaded={isUsersLoaded}
        initialAuthMode={forceRegister ? 'register' : 'login'}
      />
    );
  }

  const renderPremiumLockedOverlay = () => {
    return (
      <div className="bg-white border border-neutral-200 p-8 rounded-3xl shadow-sm text-center max-w-lg mx-auto my-12 space-y-6">
        <div className="w-16 h-16 bg-amber-50 rounded-full flex items-center justify-center mx-auto text-amber-500 border border-amber-100 shadow-sm animate-bounce">
          <Sparkles className="w-8 h-8" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-extrabold text-neutral-800 tracking-tight">POSTrack Premium Required</h2>
          <p className="text-sm text-neutral-500 max-w-md mx-auto leading-relaxed">
            Your 14-day free trial has expired or your subscription is currently inactive. Upgrade now to unlock full access to Main POS, Expenses, Debts, and POS Terminal management.
          </p>
        </div>

        {/* Plan Selectors */}
        <div className="grid grid-cols-1 gap-3 text-left">
          {[
            { id: 'Starter' as const, name: 'Starter Plan', price: '₦2,000', desc: 'Up to 3 Operators, basic transaction logging' },
            { id: 'Professional' as const, name: 'Professional Plan', price: '₦5,000', desc: 'Up to 10 Operators, automated audit logging & daily reports' },
            { id: 'Business' as const, name: 'Business Plan', price: '₦10,000', desc: 'Unlimited Operators, priority network monitoring, maximum commissions' }
          ].map((p) => (
            <button
              key={p.id}
              onClick={() => handleUpgradeFromOverlay(p.id)}
              className="group border border-neutral-200 hover:border-[#00B87A] p-4 rounded-2xl flex justify-between items-center transition bg-neutral-50 hover:bg-emerald-50/20 text-left w-full cursor-pointer"
            >
              <div className="space-y-1">
                <span className="font-bold text-neutral-800 group-hover:text-[#00B87A] transition block text-sm">{p.name}</span>
                <span className="text-xs text-neutral-500 block">{p.desc}</span>
              </div>
              <div className="text-right shrink-0 pl-4">
                <span className="font-mono font-extrabold text-[#00B87A] block text-base">{p.price}</span>
                <span className="text-[10px] text-emerald-600 font-bold block uppercase tracking-wider">Upgrade →</span>
              </div>
            </button>
          ))}
        </div>

        <div className="pt-4 border-t border-neutral-100 flex flex-col gap-3 items-center w-full">
          <WhatsAppSupportButton
            context="Trial Expired / Subscription Locked"
            userName={activeUser?.name}
            businessName={state.settings?.businessName}
            phone={activeUser?.phone}
            role={activeUser?.role}
            buttonText="Contact Support on WhatsApp"
            variant="card"
            className="w-full"
          />
          <p className="text-xs text-neutral-400">
            Have a referral code? Go to the{' '}
            <button
              onClick={() => setDashboardTab('referrals')}
              className="text-[#00B87A] font-bold hover:underline"
            >
              Partnerships Tab
            </button>{' '}
            to apply it or try sandbox simulations!
          </p>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-neutral-100 text-neutral-850 flex flex-col font-sans relative pb-20 antialiased selection:bg-emerald-200">
      {state.impersonatedUserId && (
        <div className="bg-gradient-to-r from-amber-600 via-orange-500 to-amber-500 text-white px-4 py-3 shadow-md z-50 sticky top-0 backdrop-blur-md border-b border-amber-400/20 select-none">
          <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/10 rounded-xl shrink-0 animate-pulse">
                <Eye className="w-5 h-5 text-white stroke-[2.5]" />
              </div>
              <div className="text-center sm:text-left">
                <div className="text-xs font-black uppercase tracking-widest flex items-center justify-center sm:justify-start gap-1.5 opacity-90">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-white animate-ping" />
                  Superuser Oversight Mode Active
                </div>
                <p className="text-[11px] font-medium text-amber-50 mt-0.5">
                  Currently viewing <strong className="font-extrabold text-white underline decoration-wavy decoration-white/40">{activeUser.name}</strong>'s cashier session. No password or PIN required.
                </p>
              </div>
            </div>
            
            <button 
              onClick={() => dispatch({ type: 'SET_IMPERSONATED_USER', payload: undefined })}
              className="bg-white text-orange-600 px-4 py-1.5 rounded-xl text-xs font-black hover:bg-neutral-50 active:scale-95 transition cursor-pointer flex items-center gap-1.5 shadow-sm font-mono tracking-tight shrink-0 uppercase border border-white/50"
            >
              <span>← Exit View</span>
            </button>
          </div>
        </div>
      )}

      {unpaidCount > 0 && (
        <div 
          onClick={() => setDashboardTab('unpaid')}
          className="bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 text-white py-2 px-3 sm:py-2.5 sm:px-4 shadow-md z-40 sticky top-0 border-b border-amber-600/30 select-none cursor-pointer hover:brightness-[1.02] transition-all duration-150 group"
        >
          <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2.5 min-w-0">
            <div className="flex items-center gap-2.5 min-w-0 flex-1 w-full">
              {/* Alert Icon Badge */}
              <div className="bg-white/20 p-1.5 rounded-lg shrink-0 flex items-center justify-center animate-pulse shadow-sm border border-white/10">
                <AlertTriangle className="w-4 h-4 text-white" />
              </div>
              
              {/* Carousel Container */}
              <div className="flex-1 min-w-0 relative py-1.5 flex items-center">
                <AnimatePresence mode="wait">
                  {(() => {
                    const currentTx = unpaidTransactions[activeUnpaidIndex];
                    if (!currentTx || currentTx.approvalStatus === 'approved' || currentTx.approved === true || currentTx.status === 'Paid' || currentTx.status === 'Settled' || currentTx.chargesStatus === 'Paid' || currentTx.chargesStatus === 'Settled') return null;
                    const remainingAmount = currentTx.unpaidFeeAmount !== undefined ? currentTx.unpaidFeeAmount : (currentTx.customerFee || 0);
                    const debtorName = currentTx.customerName || 'Walk-in Customer';
                    const debtorPhone = currentTx.customerPhone || 'N/A';
                    const debtorAddress = currentTx.customerAddress || currentTx.address || 'N/A';
                    
                    // Simple wording for non-well-educated / general users
                    const friendlyType = currentTx.type === 'Withdrawal' ? 'Withdrawal' :
                                         currentTx.type === 'Deposit' ? 'Receive Money' :
                                         currentTx.type === 'Transfer' ? 'Bank Transfer' :
                                         currentTx.type === 'Airtime' ? 'Airtime' :
                                         currentTx.type === 'Data' ? 'Data' : currentTx.type;

                    const getFriendlyTransactionDate = (timestampStr: string) => {
                      try {
                        const d = new Date(timestampStr);
                        const now = new Date();
                        
                        // Check if same day
                        const isToday = d.toDateString() === now.toDateString();
                        
                        // Check if yesterday
                        const yesterday = new Date();
                        yesterday.setDate(now.getDate() - 1);
                        const isYesterday = d.toDateString() === yesterday.toDateString();
                        
                        const timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                        
                        if (isToday) {
                          return `Today at ${timeStr}`;
                        } else if (isYesterday) {
                          return `Yesterday at ${timeStr}`;
                        } else {
                          const dateStr = d.toLocaleDateString([], { month: 'short', day: 'numeric', weekday: 'short' });
                          return `${dateStr} at ${timeStr}`;
                        }
                      } catch (e) {
                        return 'Recently';
                      }
                    };

                    return (
                      <motion.div
                        key={currentTx.id}
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -5 }}
                        transition={{ duration: 0.2, ease: 'easeOut' }}
                        className="w-full flex items-center justify-between gap-3 min-w-0"
                      >
                        <div className="flex-1 min-w-0 flex items-center flex-wrap gap-x-1.5 gap-y-1 text-xs sm:text-sm leading-tight text-white/95">
                          {/* Alert Label */}
                          <span className="bg-amber-950/40 text-amber-300 font-extrabold px-1.5 py-0.5 rounded text-[9px] sm:text-[10px] tracking-wide uppercase flex items-center gap-1 shrink-0 shadow-inner">
                            <span>Pending Charge</span>
                            {unpaidCount > 1 && <span className="font-mono text-white/80">({activeUnpaidIndex + 1}/{unpaidCount})</span>}
                          </span>

                          {/* Friendly readable sentence */}
                          <div className="text-[11px] sm:text-xs text-amber-50 leading-relaxed sm:leading-normal">
                            <strong className="text-white font-black underline decoration-white/20">{debtorName}</strong> is owing you <strong className="text-red-100 bg-red-950/40 px-1.5 py-0.5 rounded font-black font-mono shadow-inner text-[10px] sm:text-xs">₦{remainingAmount.toLocaleString()}</strong> from a <strong className="text-white font-bold">₦{currentTx.amount.toLocaleString()} {friendlyType}</strong> on <span className="text-amber-100 font-semibold">{getFriendlyTransactionDate(currentTx.timestamp)}</span>
                            <span className="inline-flex items-center gap-0.5 ml-1.5 bg-emerald-600/90 text-white font-bold px-1.5 py-0.5 rounded text-[9px] sm:text-[10px] animate-pulse">
                              📢 Please Collect Money!
                            </span>
                          </div>
                        </div>

                        {/* Quick Settle Button inside Carousel */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation(); // Avoid triggering parent click which navigates to ledger
                            setCarouselSettlingTx(currentTx);
                          }}
                          className="shrink-0 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white px-2.5 py-1 rounded-md text-[10px] font-black tracking-tight flex items-center gap-1 shadow-sm border border-emerald-400/20 transition-all duration-150 cursor-pointer"
                          title="Settle this pending charge with a full or partial payment"
                        >
                          <Check className="w-3 h-3 stroke-[3]" />
                          <span>Settle Debt</span>
                        </button>
                      </motion.div>
                    );
                  })()}
                </AnimatePresence>
              </div>
            </div>

            {/* View Debts Action Button */}
            {unpaidCount > 1 && (
              <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto justify-end">
                <button 
                  onClick={(e) => {
                    e.stopPropagation(); // Prevent duplicate calls since container also clicks
                    setDashboardTab('unpaid');
                  }}
                  className="w-full sm:w-auto bg-white/10 hover:bg-white text-white hover:text-amber-900 border border-white/20 hover:border-white px-3 py-1 sm:py-1.5 rounded-lg text-[10px] sm:text-xs font-black shadow-inner active:scale-95 transition-all duration-150 cursor-pointer flex items-center justify-center gap-1 uppercase tracking-tight"
                >
                  <span>View All Debts</span>
                  <span className="text-xs sm:text-sm group-hover:translate-x-0.5 transition-transform">&rarr;</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}
      
      {/* PERSISTENT SUBSCRIPTION EXPIRED WARNING BANNER */}
      {isPremiumLocked && (
        <div className="bg-gradient-to-r from-red-700 via-red-600 to-amber-700 text-white py-2.5 px-4 shadow-md relative z-40 border-b border-red-800">
          <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2.5 text-xs">
            <div className="flex items-center gap-2.5 font-sans">
              <div className="bg-white/20 p-1.5 rounded-full shrink-0">
                <ShieldAlert className="w-4 h-4 text-white animate-pulse" />
              </div>
              <div>
                <span className="font-extrabold tracking-wide uppercase text-[10px] bg-red-900/60 px-2 py-0.5 rounded-full border border-red-400/30 mr-1.5 inline-block">
                  Subscription Expired
                </span>
                <span className="font-medium text-red-50 text-[11px] sm:text-xs">
                  Your 14-day trial or paid subscription has expired. Operating in <strong className="font-bold underline decoration-red-200">Read-Only Mode</strong> (All data is safe & preserved).
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto justify-end flex-wrap">
              <button
                type="button"
                onClick={() => setIsSubscriptionDetailsOpen(true)}
                className="bg-red-900/60 hover:bg-red-900/90 text-white border border-red-400/30 px-2.5 py-1.5 rounded-xl font-bold text-[11px] transition-all cursor-pointer flex items-center gap-1"
                title="View Subscription Details"
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Details</span>
              </button>
              <button
                type="button"
                onClick={() => setIsUploadReceiptModalOpen(true)}
                className="bg-white/15 hover:bg-white/25 text-white border border-white/30 px-2.5 py-1.5 rounded-xl font-bold text-[11px] transition-all cursor-pointer flex items-center gap-1"
                title="Upload Payment Proof"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Upload Receipt</span>
              </button>
              <button
                type="button"
                onClick={() => setIsSubscriptionExpiredDialogOpen(true)}
                className="bg-white hover:bg-red-50 text-red-700 px-3 py-1.5 rounded-xl font-extrabold text-[11px] transition-all shadow-sm active:scale-95 cursor-pointer flex items-center gap-1.5"
              >
                <span>Renew Subscription</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={handleRefreshSubscription}
                disabled={isRefreshingSubscription}
                className="bg-red-900/50 hover:bg-red-900/80 text-white border border-red-400/30 px-2.5 py-1.5 rounded-xl font-bold text-[11px] transition-all cursor-pointer flex items-center gap-1"
                title="Check for approved payment"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isRefreshingSubscription ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">Refresh</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Primary OPay Brand Header Bar */}
      <header className="border-b border-neutral-200 bg-white sticky top-0 z-30 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-3 flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-4">
          
          {/* Logo brand & Name */}
          <div className="flex items-center gap-3 justify-between sm:justify-start w-full sm:w-auto">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#00B87A] flex items-center justify-center text-white font-black text-xl tracking-wider shadow-md shadow-emerald-500/20">
                O
              </div>
              <div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-base font-extrabold text-[#00B87A] tracking-tight">Dan Godal Postracker</span>
                  <span className="bg-[#00B87A]/10 text-[#00B87A] text-[9px] font-bold px-1.5 py-0.5 rounded-full">
                    {activeUser.role === 'Manager' ? 'Manager App' : 'Cashier App'}
                  </span>
                </div>
                {renderSyncStatusBadge()}
              </div>
            </div>
          </div>

          {/* Centered Active Operator Session Badge */}
          <div className="flex items-center justify-center py-0.5 sm:py-0">
            {activeUser.role === 'Manager' ? (
              <button
                type="button"
                onClick={() => setIsShiftModalOpen(true)}
                className="flex items-center gap-2 text-xs pl-2 pr-3 py-1.5 rounded-full border border-emerald-200 bg-emerald-50/70 hover:bg-[#00B87A]/10 text-[#00B87A] cursor-pointer transition duration-150 active:scale-95 font-extrabold shadow-sm select-none"
                title="Active Operator Shift & Control Center"
              >
                {renderUserAvatar(activeUser.avatar, activeUser.name, "w-5 h-5 shrink-0", "rounded-full", "text-[8px] font-black")}
                <span className="truncate font-sans tracking-tight flex items-center gap-1">
                  <span className="text-neutral-500 font-normal">Manager:</span>
                  <span className="font-black text-neutral-800">{activeUser.name}</span>
                </span>
                <ChevronDown className="w-3.5 h-3.5 opacity-70" />
              </button>
            ) : (
              <div
                onClick={() => setIsProfileModalOpen(true)}
                className="flex items-center gap-2 text-xs pl-2 pr-4 py-1.5 rounded-full border border-emerald-150 bg-emerald-50/40 text-neutral-600 hover:bg-neutral-100 cursor-pointer font-extrabold shadow-sm select-none transition duration-150 active:scale-95"
                title="Active Cashier Session - View Profile"
              >
                {renderUserAvatar(activeUser.avatar, activeUser.name, "w-5 h-5 shrink-0", "rounded-full", "text-[8px] font-black")}
                <span className="truncate font-sans tracking-tight text-neutral-500 flex items-center gap-1">
                  <span className="font-normal">Cashier:</span>
                  <span className="font-black text-neutral-800">{activeUser.name}</span>
                  {myTerminal && (
                    <span className="text-[10px] ml-1 px-1.5 py-0.5 rounded-md bg-emerald-100 text-emerald-800 font-bold">
                      {myTerminal.areaOfWorking}
                    </span>
                  )}
                  {!myTerminal && activeUser.areaOfWorking && (
                    <span className="text-[10px] ml-1 px-1.5 py-0.5 rounded-md bg-emerald-100 text-emerald-800 font-bold">
                      {activeUser.areaOfWorking}
                    </span>
                  )}
                </span>
              </div>
            )}
          </div>

          {/* Quick Mock Operations on Header */}
          <div className="flex flex-wrap items-center justify-center sm:justify-end gap-3 w-full sm:w-auto mt-1 sm:mt-0">
            {/* Manager Account Session Status Button / Cashier Profile Button */}
            {state.currentUser.role === 'Manager' && (
                <div className="flex items-center gap-2">
                  {!state.impersonatedUserId && (
                      <select
                          value={state.impersonatedUserId || 'ALL'}
                          onChange={(e) => dispatch({ type: 'SET_IMPERSONATED_USER', payload: e.target.value === 'ALL' ? undefined : e.target.value } as any)}
                          className="text-[10px] border border-emerald-200 bg-emerald-50 text-emerald-800 rounded-lg p-1.5 font-bold cursor-pointer focus:outline-none"
                      >
                          <option value="ALL">Manager Dashboard</option>
                          {state.availableEmployees.map(emp => (
                              <option key={emp.id} value={emp.id}>View: {emp.name}</option>
                          ))}
                      </select>
                  )}
                  <div className="flex flex-col items-end gap-0.5 text-xs text-[#00B87A] bg-[#00B87A]/10 px-2.5 py-1.5 rounded-2xl border border-[#00B87A]/20">
                     <div className="flex items-center gap-1.5">
                       <span className="w-2 h-2 rounded-full bg-[#00B87A] animate-pulse" />
                       <span className="font-bold text-[11px] hidden sm:inline">Active: {cloudUser?.displayName || cloudUser?.email || 'Local Manager'}</span>
                     </div>
                     {mostActiveTerminal && (
                       <span className="text-[9px] font-mono font-bold text-neutral-600">
                         {mostActiveTerminal.cashierName} • {mostActiveTerminal.areaOfWorking}
                       </span>
                     )}
                  </div>
                </div>
            )}
            


            {activeUser.role === 'Manager' && (
              <LowProfitAlertSystem
                renderBellOnly
                transactions={state.transactions}
                settings={state.settings || { soundEnabled: true, voiceEnabled: true, businessName: 'OPay', receiptAddress: '', receiptPhone: '', receiptFooter: '', listDensity: 'comfortable', pageSize: 10, defaultProvider: 'OPay', defaultType: 'Withdrawal', chartStyle: 'line', darkMode: false, language: 'en' }}
                currentUser={activeUser}
                onOpenPricingRules={handleOpenPricingRules}
                onOpenSettings={() => {
                  if (isSuperAdmin) {
                    setDashboardTab('settings');
                  } else {
                    setIsSettingsModalOpen(true);
                  }
                }}
              />
            )}

            {isSuperAdmin && (
              <div 
                className="flex items-center gap-1.5 px-2 py-1.5 rounded-full bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-sm border border-indigo-400/30 shrink-0"
                title="Super Admin Eyes Only - Global System Users"
              >
                <Users className="w-3.5 h-3.5 shrink-0 opacity-80" />
                <span className="text-[9px] font-black uppercase tracking-wider pr-1 border-r border-indigo-400/30">
                  <span className="hidden sm:inline">Managers:</span>
                  <span className="inline sm:hidden">M:</span>
                  <span className="text-white text-[10px] font-mono ml-0.5">{registeredUsers.filter(u => u.role === 'Manager').length}</span>
                </span>
                <span className="text-[9px] font-black uppercase tracking-wider pl-1">
                  <span className="hidden sm:inline">Cashiers:</span>
                  <span className="inline sm:hidden">C:</span>
                  <span className="text-white text-[10px] font-mono ml-0.5">{registeredUsers.filter(u => u.role === 'Employee').length}</span>
                </span>
              </div>
            )}

            {activeUser.role === 'Manager' && pendingApprovalTxs.length > 0 && (
              <button
                type="button"
                onClick={() => setDashboardTab('unpaid')}
                className="bg-amber-500 hover:bg-amber-600 text-white text-xs font-black px-3 py-1.5 rounded-xl font-mono uppercase shadow-sm transition flex items-center gap-1.5 animate-pulse cursor-pointer"
                title="Cashier settlements awaiting approval"
              >
                <span>⚡ Approvals ({pendingApprovalTxs.length})</span>
              </button>
            )}

            <WhatsAppSupportButton
              userName={activeUser?.name}
              businessName={state.settings?.businessName}
              phone={activeUser?.phone}
              role={activeUser?.role}
              buttonText="Support"
              variant="compact"
            />

            <button 
              onClick={() => alert("Alert Notification: Gateway connection is extremely stable. High velocity is active.")}
              className="p-2 transition rounded-full hover:bg-neutral-100 text-neutral-600 relative"
              title="Notifications"
            >
              <Bell className="w-5 h-5" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-red-500" />
            </button>
          </div>

        </div>
      </header>

      {/* Main Content Layout Container */}
      <main className="max-w-4xl mx-auto px-4 py-5 flex-grow space-y-6 w-full">
        
        {/* Personalized Greeting */}
        <div className="flex flex-col">
          <div className="text-lg font-extrabold text-neutral-800 tracking-tight">
            Hello, {activeUser.name}!
          </div>
          {activeUser.email === 'realybash@gmail.com' && (
            <span className="text-[10px] text-emerald-600 font-black uppercase tracking-widest font-mono">
              Super Manager Account
            </span>
          )}
        </div>

        {/* MANAGER DASHBOARD PENDING CASHIER SETTLEMENTS BANNER */}
        {activeUser.role === 'Manager' && pendingApprovalTxs.length > 0 && (
          <div className="border-2 border-amber-500/50 bg-amber-500/15 rounded-3xl p-5 shadow-sm space-y-3 transition-all">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 pb-2 border-b border-amber-200/60">
              <div className="flex items-center gap-2.5">
                <span className="flex h-3.5 w-3.5 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-amber-500"></span>
                </span>
                <h3 className="text-sm font-black uppercase tracking-tight flex items-center gap-2 text-amber-900">
                  <span>⚡ Cashier Settlements Awaiting Manager Approval</span>
                  <span className="px-2 py-0.5 rounded-full text-xs font-mono font-bold bg-amber-200 text-amber-900">
                    {pendingApprovalTxs.length}
                  </span>
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setDashboardTab('unpaid')}
                className="text-xs font-black px-3 py-1.5 rounded-xl transition cursor-pointer font-mono uppercase text-amber-900 bg-amber-200 hover:bg-amber-300"
              >
                Review in Debts Ledger →
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {pendingApprovalTxs.map((tx) => {
                const p = tx.pendingSettlement!;
                return (
                  <div key={tx.id} className="bg-white border border-amber-200 rounded-2xl p-3.5 shadow-xs space-y-2">
                    <div className="flex justify-between items-start gap-2">
                      <div>
                        <span className="text-xs font-black text-neutral-850 block">
                          {tx.customerName || 'Walk-in Client'}
                        </span>
                        <span className="text-[10px] text-neutral-500 block">
                          Original Tx: {formatNaira(tx.amount)} ({tx.type})
                        </span>
                      </div>
                      <span className="bg-amber-100 text-amber-900 text-[10px] font-mono font-bold px-2 py-0.5 rounded-md border border-amber-200">
                        Paid: {formatNaira(p.paidAmount)} ({p.feeMethod || 'Cash'})
                      </span>
                    </div>

                    <div className="text-[11px] text-neutral-600 space-y-0.5 bg-neutral-50 p-2 rounded-xl border border-neutral-100 font-mono">
                      <div><strong className="text-neutral-800">Cashier (Submitted by):</strong> <span className="text-[#00B87A] font-extrabold">{p.requestedBy}</span></div>
                      <div><strong className="text-neutral-800">Note:</strong> {p.note || 'No note'}</div>
                      <div><strong className="text-neutral-800">Target Status:</strong> <span className="text-emerald-700 font-bold">{p.proposedChargesStatus}</span></div>
                    </div>

                    <div className="flex items-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            const originalFee = (tx.originalFeeAmount !== undefined && tx.originalFeeAmount > 0) ? tx.originalFeeAmount : (tx.unpaidFeeAmount !== undefined && tx.unpaidFeeAmount > 0 ? tx.unpaidFeeAmount : tx.customerFee || 200);
                            const updatedPayments = [...(tx.chargePayments || []), p.proposedPaymentRecord];
                            const finalCustomerFee = p.proposedTotalPaidSoFar;
                            const updatedProfit = finalCustomerFee - tx.terminalFee - (tx.cbnCharge || 0);
                            const updatedTotalCustomerCharged = p.feeMethod === 'CardDebit' ? (tx.amount + finalCustomerFee) : tx.amount;

                            await handleApproveTransaction({
                              ...tx,
                              customerFee: finalCustomerFee,
                              profit: updatedProfit,
                              totalCustomerCharged: updatedTotalCustomerCharged,
                              feeMethod: p.feeMethod || tx.feeMethod,
                              chargesStatus: p.proposedChargesStatus as any,
                              unpaidFeeAmount: p.proposedUnpaidAmount,
                              originalFeeAmount: originalFee,
                              chargesPaidAmount: p.proposedTotalPaidSoFar,
                              chargePayments: updatedPayments,
                              pendingSettlement: null,
                              approvalStatus: 'approved',
                              status: tx.status || 'Success',
                              approved: true,
                              approvedBy: state.currentUser?.id,
                              approvedAt: new Date().toISOString()
                            });
                          } catch (err) {
                            console.error("Error approving settlement:", err);
                          }
                        }}
                        className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black py-1.5 rounded-xl font-mono uppercase shadow-sm transition active:scale-95 cursor-pointer flex items-center justify-center gap-1"
                      >
                        ✓ Approve
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            await handleUpdateTransaction({
                              ...tx,
                              pendingSettlement: null
                            });
                          } catch (err) {
                            console.error("Error rejecting settlement:", err);
                          }
                        }}
                        className="bg-red-100 hover:bg-red-200 text-red-700 text-xs font-black px-3 py-1.5 rounded-xl font-mono uppercase transition active:scale-95 cursor-pointer"
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ACTIVE OPERATOR SESSION & SECURITY CONTROL HUB */}
        {activeUser.role === 'Manager' && (
          <div className="bg-white border border-neutral-200 rounded-[32px] p-6 shadow-xs relative overflow-hidden transition-all duration-150">
            {/* Accent colored top strip */}
            <div className="absolute top-0 left-0 right-0 h-[4px] bg-gradient-to-r from-emerald-500 via-[#00B87A] to-indigo-600" />
            
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">
              {/* Operator info section */}
              <div className="flex items-center gap-4">
                <div className="relative shrink-0">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#00B87A] to-emerald-600 text-white flex items-center justify-center font-black text-lg shadow-md shadow-emerald-500/15">
                    {(activeUser?.name || 'US').slice(0, 2).toUpperCase()}
                  </div>
                  <span className="absolute -bottom-1 -right-1 flex h-4.5 w-4.5 items-center justify-center rounded-full bg-white shadow-xs">
                    <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                  </span>
                </div>
                
                <div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className={`inline-flex items-center gap-1 text-[9px] font-mono font-black uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                      isSaaSAdmin
                        ? 'bg-indigo-50 border-indigo-200 text-indigo-700'
                        : 'bg-emerald-50 border-emerald-100 text-emerald-700'
                    }`}>
                      {isSaaSAdmin ? '👑 Superuser' : 'Manager Account'}
                    </span>
                    <span className={`inline-flex items-center gap-1 text-[9px] font-mono font-black uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                      activeSubscription?.status === 'Active'
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                        : activeSubscription?.status === 'Pending Review'
                        ? 'bg-amber-50 border-amber-200 text-amber-700'
                        : 'bg-neutral-100 border-neutral-200 text-neutral-600'
                    }`}>
                      <ShieldCheck className="w-3 h-3" />
                      {activeSubscription?.status === 'Active' 
                        ? `${activeSubscription.plan} (Subscribed)` 
                        : activeSubscription?.status === 'Pending Review'
                        ? 'Payment Pending Review'
                        : activeSubscription?.status === 'Trial'
                        ? 'Free Trial (Unsubscribed)'
                        : 'No Subscription'}
                    </span>
                    <span className="text-[10px] text-neutral-400 font-bold font-mono uppercase tracking-widest">Active Session</span>
                  </div>
                  <h2 className="text-lg font-black text-neutral-850 tracking-tight mt-0.5">
                    {activeUser.name}
                  </h2>
                  <p className="text-[11px] text-neutral-400 font-semibold mt-0.5">
                    Secure Access ID: <span className="font-mono font-bold text-neutral-700">{activeUser.phone || 'No Phone Number'}</span>
                  </p>
                </div>
              </div>

              {/* Live Metrics for the operator's active session */}
              <div className="grid grid-cols-3 gap-2.5 flex-1 max-w-lg">
                <div className="bg-neutral-50/80 border border-neutral-150 p-2.5 rounded-2xl">
                  <span className="text-[9px] text-neutral-400 block font-bold uppercase tracking-wider leading-none">
                    Shift Slips
                  </span>
                  <span className="text-xs font-black font-mono text-neutral-800 block mt-1">
                    {currentShiftStats.count} receipts
                  </span>
                </div>
                <div className="bg-neutral-50/80 border border-neutral-150 p-2.5 rounded-2xl">
                  <span className="text-[9px] text-neutral-400 block font-bold uppercase tracking-wider leading-none">Handled Vol</span>
                  <span className="text-xs font-black font-mono text-[#00B87A] block mt-1 truncate" title={formatNaira(currentShiftStats.volume)}>
                    {formatNaira(currentShiftStats.volume)}
                  </span>
                </div>
                <div className="bg-neutral-50/80 border border-neutral-150 p-2.5 rounded-2xl relative flex flex-col justify-between">
                  <div>
                    <span className="text-[9px] text-neutral-400 block font-bold uppercase tracking-wider leading-none">Net Profit</span>
                    <span className="text-xs font-black font-mono text-indigo-650 block mt-1 truncate" title={formatNaira(currentShiftStats.profit)}>
                      {formatNaira(currentShiftStats.profit)}
                    </span>
                    {unpaidCount > 0 && (
                      <div className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[8px] text-white font-black animate-pulse">
                        {unpaidCount}
                      </div>
                    )}
                    <div className="mt-1 text-[9px] text-neutral-400 font-mono">
                      Projected: {formatNaira(currentShiftStats.profit * (8 / Math.max(1, new Date().getHours() - 8)))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Elegant Security Session Control buttons (Exclusive options based on Role) */}
              <div className="grid grid-cols-2 md:flex md:flex-col gap-2 shrink-0 w-full md:w-auto border-t md:border-t-0 md:border-l border-neutral-150 pt-4 md:pt-0 md:pl-5">
                <button
                  type="button"
                  onClick={() => setIsShiftModalOpen(true)}
                  className="flex-1 md:flex-none flex items-center justify-center gap-2 px-3.5 py-2.5 bg-neutral-100 hover:bg-neutral-150 text-neutral-700 hover:text-neutral-800 rounded-xl text-[11px] font-black transition cursor-pointer select-none active:scale-[0.98] border border-neutral-200/40 uppercase tracking-wider"
                  title="Handover shift or switch to another registered employee"
                >
                  <ArrowRightLeft className="w-3.5 h-3.5 text-neutral-500" />
                  <span>Switch Shift</span>
                </button>

                {isSaaSAdmin && (
                  <>
                    <button
                      type="button"
                      onClick={() => setDashboardTab('audit')}
                      className="flex-1 md:flex-none flex items-center justify-center gap-2 px-3.5 py-2.5 bg-amber-50 hover:bg-amber-100 text-amber-600 hover:text-amber-700 rounded-xl text-[11px] font-black transition cursor-pointer select-none active:scale-[0.98] border border-amber-200/40 uppercase tracking-wider"
                      title="Audit pricing rules and verify Firestore configuration"
                    >
                      <ShieldAlert className="w-3.5 h-3.5 text-amber-500" />
                      <span>Pricing Audit</span>
                    </button>
                    
                    <button
                      type="button"
                      onClick={() => setDashboardTab('pricing')}
                      className="flex-1 md:flex-none flex items-center justify-center gap-2 px-3.5 py-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 hover:text-indigo-700 rounded-xl text-[11px] font-black transition cursor-pointer select-none active:scale-[0.98] border border-indigo-200/40 uppercase tracking-wider"
                      title="Manage advanced pricing rules and versioned matrices"
                    >
                      <ShieldAlert className="w-3.5 h-3.5 text-indigo-500" />
                      <span>Pricing Rules</span>
                    </button>
                  </>
                )}

                {isSaaSAdmin && (
                  <button
                    type="button"
                    onClick={() => setDashboardTab('payment-audit')}
                    className="flex-1 md:flex-none flex items-center justify-center gap-2 px-3.5 py-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-600 hover:text-emerald-700 rounded-xl text-[11px] font-black transition cursor-pointer select-none active:scale-[0.98] border border-emerald-200/40 uppercase tracking-wider"
                    title="Audit and review historical subscription payments"
                  >
                    <CreditCard className="w-3.5 h-3.5 text-emerald-500" />
                    <span>Payment Audit</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {activeUser.role === 'Employee' && (
          <div className="bg-gradient-to-br from-emerald-950 via-neutral-900 to-neutral-950 text-white border border-neutral-800 rounded-[32px] p-6 shadow-xl relative overflow-hidden transition-all duration-150">
            {/* Ambient background glow */}
            <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />
            {/* Top decorative strip */}
            <div className="absolute top-0 left-0 right-0 h-[4px] bg-gradient-to-r from-[#00B87A] via-emerald-400 to-[#00B87A]" />
            
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
              {/* Operator info and prominently displayed Operating Area */}
              <div className="flex-1 space-y-4">
                <div className="flex items-center gap-3.5">
                  <div className="relative shrink-0">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-emerald-400 to-[#00B87A] text-white flex items-center justify-center font-black text-lg shadow-md shadow-emerald-500/20">
                      {(activeUser?.name || 'US').slice(0, 2).toUpperCase()}
                    </div>
                    <span className="absolute -bottom-1 -right-1 flex h-4.5 w-4.5 items-center justify-center rounded-full bg-neutral-900 shadow-xs border border-neutral-800">
                      <span className="h-2 w-2 rounded-full bg-[#00B87A] animate-pulse" />
                    </span>
                  </div>
                  
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="inline-flex items-center gap-1 text-[9px] font-mono font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-400">
                        ⚡ Cashier Station
                      </span>
                      <span className="text-[10px] text-neutral-400 font-bold font-mono uppercase tracking-widest flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#00B87A] animate-ping" /> SECURE SESSION
                      </span>
                    </div>
                    <h2 className="text-xl font-black text-white tracking-tight mt-1">
                      {activeUser.name}
                    </h2>
                    <p className="text-xs text-neutral-400 mt-0.5 font-medium">
                      Operator ID: <span className="font-mono font-bold text-emerald-400">{activeUser.phone || 'N/A'}</span>
                    </p>
                  </div>
                </div>

                {/* AREA OF OPERATION DISPLAY CARD - EXTREMELY PROMINENT */}
                <div className="bg-neutral-900/90 border border-neutral-800/80 p-4.5 rounded-2xl flex items-center gap-4.5 shadow-inner">
                  <div className="p-3.5 bg-gradient-to-br from-emerald-500 to-[#00B87A] text-white rounded-2xl shrink-0 shadow-lg shadow-emerald-500/10">
                    <MapPin className="w-6 h-6 stroke-[2.5]" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="text-[9px] font-mono font-black tracking-widest text-emerald-400 uppercase block">
                      REGISTERED BUSINESS STATION & OUTLET
                    </span>
                    <h3 className="text-lg font-black text-white tracking-tight mt-0.5 truncate uppercase">
                      {myTerminal?.areaOfWorking || activeUser.areaOfWorking || 'MAIN OFFICE HEADQUARTERS'}
                    </h3>
                    <p className="text-[10.5px] text-neutral-400 font-medium leading-normal mt-0.5 flex items-center gap-1.5 flex-wrap">
                      <Building className="w-3.5 h-3.5 text-neutral-500 shrink-0" />
                      <span>Operating Branch for <strong>{state.settings?.businessName || 'the registered enterprise'}</strong></span>
                    </p>
                  </div>
                </div>
              </div>

              {/* Live shift performance metrics */}
              <div className="flex flex-col gap-3.5 w-full md:w-80 shrink-0">
                <span className="text-[10px] font-mono font-black tracking-widest text-neutral-400 uppercase block">
                  TODAY'S WORKSTATION STATS
                </span>
                
                <div className="grid grid-cols-3 gap-2.5">
                  <div className="bg-neutral-900/60 border border-neutral-800 p-3 rounded-2xl text-center">
                    <span className="text-[8.5px] text-neutral-400 block font-bold uppercase tracking-wider">
                      Shift slips
                    </span>
                    <span className="text-sm font-black font-mono text-white block mt-1.5">
                      {currentShiftStats.count}
                    </span>
                  </div>
                  <div className="bg-neutral-900/60 border border-neutral-800 p-3 rounded-2xl text-center">
                    <span className="text-[8.5px] text-neutral-400 block font-bold uppercase tracking-wider">
                      Vol. handled
                    </span>
                    <span className="text-sm font-black font-mono text-emerald-400 block mt-1.5 truncate" title={formatNaira(currentShiftStats.volume)}>
                      {currentShiftStats.volume > 0 ? formatNaira(currentShiftStats.volume).replace('₦', '') : '0'}
                    </span>
                  </div>
                  <div className="bg-neutral-900/60 border border-neutral-800 p-3 rounded-2xl text-center relative flex flex-col justify-between min-h-[84px]">
                    <div>
                      <span className="text-[8.5px] text-neutral-400 block font-bold uppercase tracking-wider">
                        Agent profit
                      </span>
                      <span className="text-sm font-black font-mono text-indigo-400 block mt-1.5 truncate" title={formatNaira(currentShiftStats.profit)}>
                        {currentShiftStats.profit > 0 ? formatNaira(currentShiftStats.profit).replace('₦', '') : '0'}
                      </span>
                      {unpaidCount > 0 && (
                        <div className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[8px] text-white font-black animate-pulse">
                          {unpaidCount}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Actions & Terminal details details block */}
                <div className="flex items-center justify-between text-[10.5px] text-neutral-400 bg-neutral-900/40 border border-neutral-800/50 px-3 py-2 rounded-xl">
                  {myTerminal ? (
                    <div className="flex items-center gap-1.5 font-mono">
                      <Smartphone className="w-3.5 h-3.5 text-[#00B87A]" />
                      <span className="truncate max-w-[130px]" title={myTerminal.name}>
                        {myTerminal.provider} ({myTerminal.serialNumber?.slice(-6) || 'Active'})
                      </span>
                    </div>
                  ) : (
                    <span className="text-neutral-500 font-mono">No Terminal Linked</span>
                  )}
                  
                  <div className="flex items-center gap-2.5">
                    <button
                      type="button"
                      onClick={() => setIsProfileModalOpen(true)}
                      className="text-[9.5px] font-black uppercase text-[#00B87A] hover:text-emerald-400 hover:underline transition cursor-pointer"
                    >
                      {activeUser?.role === 'Manager' ? 'Manage \u2192' : 'Metrics \u2192'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* GLOBAL INSTANT SEARCH HUB */}
        <div className="bg-white border border-neutral-200 p-5 rounded-3xl shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="p-2.5 bg-emerald-50 text-[#00B87A] rounded-2xl shrink-0">
                <Search className="w-5 h-5 animate-pulse" />
              </span>
              <div>
                <h3 className="text-sm font-black text-neutral-800 flex items-center gap-2">
                  Global Instant Search Hub
                  <span className="bg-[#00B87A]/10 text-[#00B87A] text-[9px] font-mono font-black uppercase tracking-widest px-2 py-0.5 rounded-full select-none">
                    ShortCut: press / key
                  </span>
                </h3>
                <p className="text-[11px] text-neutral-500 font-semibold leading-none mt-0.5">
                  Bypass standard ledger scrolling to quickly search, audit, or verify transactions.
                </p>
              </div>
            </div>
          </div>

          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400 w-4.5 h-4.5" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter by ID (e.g. tx_sim...), Amount (e.g. 5000), or Operator / Employee Name..."
              className="w-full bg-neutral-50 border border-neutral-200 focus:border-[#00B87A] focus:outline-none focus:ring-1 focus:ring-[#00B87A] rounded-2xl pl-12 pr-10 py-3 text-xs text-neutral-800 font-extrabold placeholder:text-neutral-450 placeholder:font-medium transition shadow-sm"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-neutral-450 hover:text-neutral-700 bg-neutral-200/50 hover:bg-neutral-200 rounded-full p-1.5 cursor-pointer transition flex items-center justify-center"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Quick results drawer if searching */}
          {searchQuery && (
            <div className="bg-neutral-50 border border-neutral-200/80 rounded-2xl p-4 mt-2 max-h-96 overflow-y-auto space-y-3 shadow-inner">
              <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 text-[11px] pb-2 border-b border-neutral-250 text-neutral-500 font-bold font-mono">
                <span className="flex items-center gap-1.5 select-none text-neutral-600">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#00B87A]" /> 
                  Matched <strong className="text-neutral-850 font-black">{matchedTransactions.length}</strong> of {authorizedTransactions.length} total active journals
                </span>
                {matchedTransactions.length > 0 && (
                  <div className="flex gap-3 text-[10px]">
                    <span>
                      Sum: <strong className="text-neutral-850 font-extrabold">{displayNaira(matchedTransactions.reduce((acc, t) => acc + t.amount, 0))}</strong>
                    </span>
                    <span className="text-emerald-650">
                      Profit: <strong className="font-extrabold">{displayNaira(matchedTransactions.reduce((acc, t) => acc + t.profit, 0))}</strong>
                    </span>
                  </div>
                )}
              </div>

              {matchedTransactions.length === 0 ? (
                <div className="text-center py-8 text-xs text-neutral-400 font-bold">
                  No matching transaction record found.
                </div>
              ) : (
                <div className="space-y-2">
                  {matchedTransactions.map((tx) => {
                    const isDebit = tx.type === 'Withdrawal';
                    const providerColor = 
                      tx.provider === 'Moniepoint' 
                        ? 'text-blue-600 bg-blue-50 border-blue-100' 
                        : tx.provider === 'OPay' 
                        ? 'text-[#00B87A] bg-emerald-50 border-emerald-100' 
                        : tx.provider === 'PalmPay'
                        ? 'text-orange-600 bg-orange-50 border-orange-100'
                        : 'text-neutral-600 bg-neutral-50 border-neutral-200';

                    return (
                      <div
                        key={tx.id}
                        className="bg-white border border-neutral-150 rounded-2xl p-3 sm:p-3.5 flex items-center justify-between gap-3 hover:border-[#00B87A] hover:shadow-sm hover:scale-[1.002] transition duration-150 group"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          {/* Transaction Type Badge */}
                          <div className={`p-2.5 rounded-xl shrink-0 ${
                            tx.type === 'Withdrawal' 
                              ? 'bg-orange-50 text-orange-650' 
                              : tx.type === 'Deposit' 
                                ? 'bg-blue-50 text-blue-600' 
                                : 'bg-emerald-50 text-[#00B87A]'
                          }`}>
                            {tx.type === 'Withdrawal' ? (
                              <ArrowDownToLine className="w-4 h-4" />
                            ) : tx.type === 'Deposit' ? (
                              <ArrowUpFromLine className="w-4 h-4" />
                            ) : (
                              <ArrowRightLeft className="w-4 h-4" />
                            )}
                          </div>

                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-xs font-black text-neutral-850 font-mono">
                                {displayNaira(tx.amount)}
                              </span>
                              <span className={`px-2 py-0.5 rounded-full text-[8px] uppercase font-black border ${providerColor}`}>
                                {tx.provider}
                              </span>
                              <span className={`px-2 py-0.5 rounded-full text-[8px] uppercase font-black border flex items-center gap-1 ${
                                (tx.status || 'Success') === 'Success'
                                  ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
                                  : (tx.status || 'Success') === 'Pending'
                                  ? 'text-amber-700 bg-amber-50 border-amber-200'
                                  : 'text-red-700 bg-red-50 border-red-200'
                              }`}>
                                <span className={`w-1 h-1 rounded-full ${
                                  (tx.status || 'Success') === 'Success' ? 'bg-emerald-500' : (tx.status || 'Success') === 'Pending' ? 'bg-amber-500' : 'bg-red-500'
                                }`} />
                                {(tx.status || 'Success') === 'Success' ? 'APPROVED' : (tx.status || 'Success')}
                              </span>

                              {(tx.chargesStatus === 'Unpaid' || tx.chargesStatus === 'PartiallyPaid' || ((tx.unpaidFeeAmount || 0) > 0)) && (
                                <span className="px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wider bg-rose-600 text-white border border-rose-700 flex items-center gap-1 shadow-xs animate-pulse">
                                  ⚠️ DEBT (UNPAID)
                                </span>
                              )}

                              {(tx.chargesStatus === 'Waived' || tx.chargesStatus === 'Waive' || tx.isFeeWaived || (tx.customerFee === 0 && ((tx.originalFeeAmount || 0) > 0 || (tx.notes && tx.notes.toLowerCase().includes('waiv'))))) && !(tx.chargesStatus === 'Unpaid' || tx.chargesStatus === 'PartiallyPaid' || ((tx.unpaidFeeAmount || 0) > 0)) && (
                                <span className="px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wider bg-purple-600 text-white border border-purple-700 flex items-center gap-1 shadow-xs">
                                  🎉 WAIVED CHARGE
                                </span>
                              )}
                              <span className="text-[10px] text-neutral-500 font-bold">
                                by <span className="text-[#00B87A] font-extrabold">{tx.employeeName}</span>
                              </span>
                            </div>
                            <div className="flex items-center gap-2 text-[9px] font-mono text-neutral-400 mt-1 flex-wrap">
                              <span className="font-extrabold text-neutral-600">{tx.id}</span>
                              <span>•</span>
                              <span>{new Date(tx.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}{' '}{new Date(tx.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric' })}</span>
                              {tx.notes && (
                                <>
                                  <span>•</span>
                                  <span className="italic truncate max-w-[120px] text-neutral-500" title={tx.notes}>{tx.notes}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Action controls */}
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => setEditingTransaction(tx)}
                            className="px-3 py-2 bg-neutral-100 hover:bg-[#00B87A]/10 text-neutral-600 hover:text-[#00B87A] text-[10px] font-black rounded-xl cursor-pointer transition active:scale-95 flex items-center gap-1 border border-neutral-200/60 hover:border-[#00B87A]/30 shadow-xs"
                            title="Edit transaction parameters (amount or charges)"
                          >
                            <Pencil className="w-3 h-3 text-[#00B87A]" />
                            <span>Edit</span>
                          </button>
                          
                          {/* Interactive E-Receipt Slip trigger */}
                          <button
                            type="button"
                            onClick={() => setSelectedReceiptTx(tx)}
                            className="px-3.5 py-2 hover:bg-[#00B87A] bg-[#00B87A]/10 hover:text-white text-[#00B87A] text-[10px] font-black rounded-xl cursor-pointer transition active:scale-95 uppercase tracking-wider font-mono flex items-center gap-1 shadow-sm hover:shadow-md border border-[#00B87A]/10"
                            title="View digital invoice receipt"
                          >
                            <FileText className="w-3.5 h-3.5" />
                            <span>Receipt</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* 1. SIGNATURE OPAY DEEP GREEN WALLET BALANCE CARD */}
        <div className="bg-gradient-to-br from-[#00b87a] via-[#10b981] to-[#047857] text-white p-6 rounded-3xl shadow-xl space-y-6 relative overflow-hidden">
          {/* Ambient background decoration circle standard in stylish fintech apps */}
          <div className="absolute -bottom-8 -right-8 w-44 h-44 bg-white/10 rounded-full blur-xl pointer-events-none" />
          <div className="absolute -top-12 -left-12 w-32 h-32 bg-emerald-400/20 rounded-full blur-xl pointer-events-none" />

          <div className="flex items-center justify-between">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-xs text-emerald-100 font-mono tracking-wider font-semibold uppercase">
                  Realized Agent Profit ({state.activeTimeframe})
                </span>
                <button
                  type="button"
                  onClick={() => setHideBalances(!hideBalances)}
                  className="p-1 hover:bg-white/10 rounded transition text-emerald-100 hover:text-white cursor-pointer"
                  title={hideBalances ? "Show Account Balances" : "Privacy Lock Balances"}
                >
                  {hideBalances ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <div className="flex items-baseline gap-4">
                <h1 className="text-3xl sm:text-4xl font-extrabold font-mono tracking-tight select-none">
                  {activeMetrics && <AnimatedNumber value={activeMetrics.profit} format={displayNaira} />}
                </h1>
              </div>
            </div>
            
            {/* OPay premium crown badge */}
            <div className="bg-white/15 px-3 py-1.5 rounded-2xl border border-white/10 text-right">
              <span className="text-[10px] block uppercase font-mono tracking-wider text-emerald-200">Baseline POS</span>
              <span className="text-xs font-bold text-white block font-mono">{state.terminalFeeRate}% Rate</span>
            </div>
          </div>

          {/* Quick Metrics Sub-ledger */}
          <div className="grid grid-cols-3 gap-2 border-t border-white/10 pt-4 text-xs">
            <div>
              <span className="text-[#a7f3d0] text-[10px] block font-mono">Processed Flow</span>
              <span className="font-bold text-sm block font-mono mt-0.5">{displayNaira(activeMetrics.volume)}</span>
            </div>
            <div>
              <span className="text-[#a7f3d0] text-[10px] block font-mono">Total POS Cost</span>
              <span className="font-bold text-sm block font-mono mt-0.5 text-orange-200">-{displayNaira(activeMetrics.terminalFees)}</span>
            </div>
            <div>
              <span className="text-[#a7f3d0] text-[10px] block font-mono">Txns Rate</span>
              <span className="font-bold text-sm block font-mono mt-0.5">{activeMetrics.count} Receipts</span>
            </div>
          </div>

          {/* Core Green Card Quick Cash Actions (Triggers Forms immediately) */}
          <div className="grid grid-cols-3 gap-3 bg-white/10 p-2.5 rounded-2xl backdrop-blur-md">
            <button
              onClick={() => openWithPreset('Deposit')}
              className="bg-white hover:bg-neutral-50 text-[#00b87a] font-bold py-2.5 px-1 rounded-xl text-[12px] flex flex-col sm:flex-row items-center justify-center gap-1.5 transition active:scale-95 shadow-sm cursor-pointer"
            >
              <ArrowUpFromLine className="w-4 h-4 text-[#00b87a]" />
              <span>Money Receive</span>
            </button>
            <button
              onClick={() => openWithPreset('Transfer')}
              className="bg-white hover:bg-neutral-50 text-[#00b87a] font-bold py-2.5 px-1 rounded-xl text-[12px] flex flex-col sm:flex-row items-center justify-center gap-1.5 transition active:scale-95 shadow-sm cursor-pointer"
            >
              <ArrowRightLeft className="w-4 h-4 text-[#00b87a]" />
              <span>Bank Transfer</span>
            </button>
            <button
              onClick={() => openWithPreset('Withdrawal')}
              className="bg-white hover:bg-neutral-50 text-[#00b87a] font-bold py-2.5 px-1 rounded-xl text-[12px] flex flex-col sm:flex-row items-center justify-center gap-1.5 transition active:scale-95 shadow-sm cursor-pointer"
            >
              <ArrowDownToLine className="w-4 h-4 text-[#00b87a]" />
              <span>Withdraw</span>
            </button>
          </div>

        </div>

        {/* 2. OPAY DYNAMIC SCROLLING OR WARNING BANNER STRIP */}
        <div className="bg-neutral-200/50 border border-neutral-300/40 p-3 rounded-2xl flex items-center justify-between text-neutral-700 text-xs gap-3">
          <div className="flex items-center gap-2 truncate">
            <span className="bg-amber-500 text-neutral-950 font-bold px-1.5 py-0.5 rounded text-[9px] uppercase tracking-wider block shrink-0">
              Security Notice
            </span>
            <span className="truncate font-medium text-[11px] text-neutral-600">
              Only release banknotes to withdrawal customers AFTER a "SUCCESSFUL" message. Beware of fake digital alerts!
            </span>
          </div>
          <button 
            type="button"
            onClick={() => alert("Security verification guide: 1. Confirm transaction slips. 2. Verify alert directly inside this app. 3. Ensure baseline rates align.")}
            className="text-xs text-[#00B87A] font-bold hover:underline shrink-0 pl-1"
          >
            Guide
          </button>
        </div>

        {/* SUB-DASHBOARD NAVIGATION TABS */}
        <div className={`bg-white border border-neutral-200 p-1.5 rounded-3xl shadow-sm grid gap-1 select-none ${
          activeUser.role === 'Manager'
            ? 'grid-cols-4 sm:grid-cols-7'
            : (filteredPosTerminals && filteredPosTerminals.length > 0)
              ? 'grid-cols-2 sm:grid-cols-4'
              : 'grid-cols-3 sm:grid-cols-3'
        }`}>
          <button
            type="button"
            onClick={() => setDashboardTab('pos')}
            className={`py-2.5 px-1 rounded-2xl flex flex-col items-center justify-center gap-1 transition-all cursor-pointer border text-center active:scale-95 duration-100 ${
              dashboardTab === 'pos'
                ? 'bg-emerald-500 text-white border-emerald-500 shadow-md font-black'
                : 'bg-transparent border-transparent text-neutral-500 hover:bg-neutral-50 hover:text-neutral-800'
            }`}
          >
            <Smartphone className="w-5 h-5 shrink-0" />
            <span className="text-[10px] font-black tracking-tight leading-none">Main POS</span>
          </button>

          <button
            type="button"
            onClick={() => setDashboardTab('expenses')}
            className={`py-2.5 px-1 rounded-2xl flex flex-col items-center justify-center gap-1 transition-all cursor-pointer border text-center active:scale-95 duration-100 ${
              dashboardTab === 'expenses'
                ? 'bg-rose-500 text-white border-rose-500 shadow-md font-black'
                : 'bg-transparent border-transparent text-neutral-500 hover:bg-neutral-50 hover:text-neutral-800'
            }`}
          >
            <TrendingDown className="w-5 h-5 shrink-0" />
            <span className="text-[10px] font-black tracking-tight leading-none">Expenses</span>
          </button>

          <button
            type="button"
            onClick={() => setDashboardTab('unpaid')}
            className={`py-2.5 px-1 rounded-2xl flex flex-col items-center justify-center gap-1 transition-all cursor-pointer border text-center active:scale-95 duration-100 ${
              dashboardTab === 'unpaid'
                ? 'bg-amber-500 text-white border-amber-500 shadow-md font-black'
                : 'bg-transparent border-transparent text-neutral-500 hover:bg-neutral-50 hover:text-neutral-800'
            }`}
          >
            <History className="w-5 h-5 shrink-0" />
            <span className="text-[10px] font-black tracking-tight leading-none">Debts</span>
          </button>

          {(activeUser.role === 'Manager' || (filteredPosTerminals && filteredPosTerminals.length > 0)) && (
            <button
              type="button"
              onClick={() => setDashboardTab('terminals')}
              className={`py-2.5 px-1 rounded-2xl flex flex-col items-center justify-center gap-1 transition-all cursor-pointer border text-center active:scale-95 duration-100 ${
                dashboardTab === 'terminals'
                  ? 'bg-[#00B87A] text-white border-[#00B87A] shadow-md font-black'
                  : 'bg-transparent border-transparent text-neutral-500 hover:bg-neutral-50 hover:text-neutral-800'
              }`}
            >
              <CreditCard className="w-5 h-5 shrink-0" />
              <span className="text-[10px] font-black tracking-tight leading-none">POS Terminals</span>
            </button>
          )}

          {activeUser.role === 'Manager' && (
            <button
              type="button"
              onClick={() => setDashboardTab('reports')}
              className={`py-2.5 px-1 rounded-2xl flex flex-col items-center justify-center gap-1 transition-all cursor-pointer border text-center active:scale-95 duration-100 ${
                dashboardTab === 'reports'
                  ? 'bg-indigo-500 text-white border-indigo-500 shadow-md font-black'
                  : 'bg-transparent border-transparent text-neutral-500 hover:bg-neutral-50 hover:text-neutral-800'
              }`}
            >
              <TrendingUp className="w-5 h-5 shrink-0" />
              <span className="text-[10px] font-black tracking-tight leading-none">Reports</span>
            </button>
          )}

          {isSuperAdmin && (
            <button
              type="button"
              onClick={() => setDashboardTab('settings')}
              className={`py-2.5 px-1 rounded-2xl flex flex-col items-center justify-center gap-1 transition-all cursor-pointer border text-center active:scale-95 duration-100 ${
                dashboardTab === 'settings'
                  ? 'bg-neutral-700 text-white border-neutral-700 shadow-md font-black'
                  : 'bg-transparent border-transparent text-neutral-500 hover:bg-neutral-50 hover:text-neutral-800'
              }`}
            >
              <Settings className="w-5 h-5 shrink-0" />
              <span className="text-[10px] font-black tracking-tight leading-none">Configure</span>
            </button>
          )}

          {activeUser.role === 'Manager' && (
            <button
              type="button"
              onClick={() => setDashboardTab('referrals')}
              className={`py-2.5 px-1 rounded-2xl flex flex-col items-center justify-center gap-1 transition-all cursor-pointer border text-center active:scale-95 duration-100 ${
                dashboardTab === 'referrals'
                  ? 'bg-amber-600 text-white border-amber-600 shadow-md font-black'
                  : 'bg-transparent border-transparent text-neutral-500 hover:bg-neutral-50 hover:text-neutral-800'
              }`}
            >
              <Sparkles className="w-5 h-5 shrink-0" />
              <span className="text-[10px] font-black tracking-tight leading-none">Partnership</span>
            </button>
          )}
        </div>

        {/* 3. OPAY TRADITIONAL CIRCULAR SHORTCUTS MENU GRID */}
        {dashboardTab === 'pos' && (
          <>
            <div className="mb-4">
              <SubscriptionStatusWidget
                activeSubscription={activeSubscription}
                onUpgradeClick={() => {
                  setBillingInitialPlan(null);
                  setIsBillingModalOpen(true);
                }}
                onRefreshClick={handleRefreshSubscription}
                onViewDetailsClick={() => setIsSubscriptionDetailsOpen(true)}
                isRefreshing={isRefreshingSubscription}
                isPremiumLocked={isPremiumLocked}
              />
            </div>

            <div className="mb-4">
              <NetworkAdvisorWidget onOpen={() => setIsNetworkAdvisorOpen(true)} />
            </div>

            <div className="bg-white border border-neutral-200 p-5 rounded-3xl shadow-sm space-y-4">
              <span className="text-[10px] uppercase font-mono font-bold tracking-widest text-neutral-400 block pb-1 border-b border-neutral-100">
                Core Services Grid
              </span>
              <div className="grid grid-cols-4 gap-y-5 gap-x-2 text-center">
            
            {/* POS Cashout */}
            <button 
              onClick={() => openWithPreset('Withdrawal')}
              className="group flex flex-col items-center gap-1.5 cursor-pointer focus:outline-none"
            >
              <div className="w-12 h-12 rounded-full bg-orange-100 group-hover:bg-orange-200 transition-colors flex items-center justify-center text-orange-600 shadow-sm active:scale-90 duration-100">
                <ArrowDownToLine className="w-5 h-5 stroke-[2.2]" />
              </div>
              <span className="text-[11px] font-bold text-neutral-700 leading-tight">Withdraw</span>
            </button>

            {/* Withdraw & Send */}
            <button 
              onClick={() => openWithPreset('Withdrawal', 'SplitWithdrawal')}
              className="group flex flex-col items-center gap-1.5 cursor-pointer focus:outline-none"
            >
              <div className="w-12 h-12 rounded-full bg-pink-100 group-hover:bg-pink-200 transition-colors flex items-center justify-center text-pink-600 shadow-sm active:scale-90 duration-100 relative">
                <ArrowDownToLine className="w-4 h-4 stroke-[2.5]" />
                <ArrowRightLeft className="w-3 h-3 absolute -bottom-0.5 -right-0.5 bg-white rounded-full p-0.5 shadow-xs text-pink-600" />
              </div>
              <span className="text-[11px] font-bold text-neutral-700 leading-tight">Withdraw & Send</span>
            </button>

            {/* Wallet Deposit */}
            <button 
              onClick={() => openWithPreset('Deposit')}
              className="group flex flex-col items-center gap-1.5 cursor-pointer focus:outline-none"
            >
              <div className="w-12 h-12 rounded-full bg-blue-100 group-hover:bg-blue-200 transition-colors flex items-center justify-center text-blue-600 shadow-sm active:scale-90 duration-100">
                <ArrowUpFromLine className="w-5 h-5 stroke-[2.2]" />
              </div>
              <span className="text-[11px] font-bold text-neutral-700 leading-tight">Money Receive</span>
            </button>

            {/* Bank Transfer */}
            <button 
              onClick={() => openWithPreset('Transfer')}
              className="group flex flex-col items-center gap-1.5 cursor-pointer focus:outline-none"
            >
              <div className="w-12 h-12 rounded-full bg-emerald-100 group-hover:bg-emerald-200 transition-colors flex items-center justify-center text-emerald-600 shadow-sm active:scale-90 duration-100">
                <ArrowRightLeft className="w-5 h-5 stroke-[2.2]" />
              </div>
              <span className="text-[11px] font-bold text-neutral-700 leading-tight">Bank Transfer</span>
            </button>

            {/* Airtime Sale */}
            <button 
              onClick={() => openWithPreset('Airtime')}
              className="group flex flex-col items-center gap-1.5 cursor-pointer focus:outline-none"
            >
              <div className="w-12 h-12 rounded-full bg-sky-100 group-hover:bg-sky-200 transition-colors flex items-center justify-center text-sky-600 shadow-sm active:scale-90 duration-100">
                <Smartphone className="w-5 h-5 stroke-[2.2]" />
              </div>
              <span className="text-[11px] font-bold text-neutral-700 leading-tight">Airtime</span>
            </button>

            {/* Data Sale */}
            <button 
              onClick={() => openWithPreset('Data')}
              className="group flex flex-col items-center gap-1.5 cursor-pointer focus:outline-none"
            >
              <div className="w-12 h-12 rounded-full bg-violet-100 group-hover:bg-violet-200 transition-colors flex items-center justify-center text-violet-600 shadow-sm active:scale-90 duration-100">
                <Globe className="w-5 h-5 stroke-[2.2]" />
              </div>
              <span className="text-[11px] font-bold text-neutral-700 leading-tight">Data Sale</span>
            </button>

            {/* Simulate Random TX */}
            <button 
              onClick={triggerSimulation}
              className="group flex flex-col items-center gap-1.5 cursor-pointer focus:outline-none animate-bounce-slow"
              title="Inject random ledger sample"
            >
              <div className="w-12 h-12 rounded-full bg-purple-100 group-hover:bg-purple-200 transition-colors flex items-center justify-center text-purple-600 shadow-sm active:scale-90 duration-100">
                <RefreshCw className="w-5 h-5 stroke-[2.2] text-purple-600 animate-spin-slow" />
              </div>
              <span className="text-[11px] font-bold text-neutral-700 leading-tight">Simulate TX</span>
            </button>

            {/* Configure Target Goal */}
            <button 
              onClick={() => scrollToRef(targetSectionRef)}
              className="group flex flex-col items-center gap-1.5 cursor-pointer focus:outline-none"
            >
              <div className="w-12 h-12 rounded-full bg-rose-100 group-hover:bg-rose-200 transition-colors flex items-center justify-center text-rose-600 shadow-sm active:scale-90 duration-100">
                <Target className="w-5 h-5 stroke-[2.2]" />
              </div>
              <span className="text-[11px] font-bold text-neutral-700 leading-tight">Edit Goal</span>
            </button>

            {/* Cashier Reconciliation */}
            <button 
              onClick={() => setIsReconCalcOpen(true)}
              className="group flex flex-col items-center gap-1.5 cursor-pointer focus:outline-none"
            >
              <div className="w-12 h-12 rounded-full bg-indigo-100 group-hover:bg-indigo-200 transition-colors flex items-center justify-center text-indigo-600 shadow-sm active:scale-90 duration-100">
                <Calculator className="w-5 h-5 stroke-[2.2]" />
              </div>
              <span className="text-[11px] font-bold text-neutral-700 leading-tight">Calc Profit</span>
            </button>

            {/* Download CSV Logs */}
            <button 
              onClick={handleExportCSV}
              className="group flex flex-col items-center gap-1.5 cursor-pointer focus:outline-none"
            >
              <div className="w-12 h-12 rounded-full bg-amber-100 group-hover:bg-amber-200 transition-colors flex items-center justify-center text-amber-600 shadow-sm active:scale-90 duration-100">
                <FileSpreadsheet className="w-5 h-5 stroke-[2.2]" />
              </div>
              <span className="text-[11px] font-bold text-neutral-700 leading-tight font-sans">Export CSV</span>
            </button>



            {/* Reset Sandbox */}
            <button 
              onClick={() => {
                if (confirm('Clear custom employee logs and restore baseline diagnostic records?')) {
                  dispatch({ type: 'RESET_DATA' });
                }
              }}
              className="group flex flex-col items-center gap-1.5 cursor-pointer focus:outline-none"
            >
              <div className="w-12 h-12 rounded-full bg-red-100 group-hover:bg-red-200 transition-colors flex items-center justify-center text-red-600 shadow-sm active:scale-90 duration-100">
                <RotateCcw className="w-5 h-5 stroke-[2.2]" />
              </div>
              <span className="text-[11px] font-bold text-neutral-700 leading-tight">Reset Data</span>
            </button>

            {/* View Ledger (Split History trigger Button) */}
            <button 
              type="button"
              onClick={() => scrollToRef(historySectionRef)}
              className="group flex flex-col items-center gap-1.5 cursor-pointer focus:outline-none"
              title="View separated Moniepoint, OPay, PalmPay, and other receipts"
            >
              <div className="w-12 h-12 rounded-full bg-teal-100 group-hover:bg-teal-200 transition-all flex items-center justify-center text-teal-600 shadow-sm active:scale-90 duration-100">
                <History className="w-5 h-5 stroke-[2.2]" />
              </div>
              <span className="text-[11px] font-bold text-neutral-700 leading-tight">Ledger Split</span>
            </button>

            {/* Shift Profile Section */}
            <button 
              type="button"
              onClick={() => setIsProfileModalOpen(true)}
              className="group flex flex-col items-center gap-1.5 cursor-pointer focus:outline-none"
              title="Manage Employees registry, passcode PINs and switch active shift"
            >
              <div className="w-12 h-12 rounded-full bg-emerald-100 group-hover:bg-emerald-200 text-[#00B87A] transition-all flex items-center justify-center shadow-sm active:scale-90 duration-100">
                <UserCheck className="w-5 h-5 stroke-[2.2]" />
              </div>
              <span className="text-[11px] font-bold text-neutral-700 leading-tight">Shift Profile</span>
            </button>

            {/* Network Advisor Button */}
            <button 
              type="button"
              onClick={() => setIsNetworkAdvisorOpen(true)}
              className="group flex flex-col items-center gap-1.5 cursor-pointer focus:outline-none"
              title="Compare mobile signals & AI prediction today"
            >
              <div className="w-12 h-12 rounded-full bg-amber-50 group-hover:bg-amber-100 text-amber-600 border border-amber-200 transition-all flex items-center justify-center shadow-sm active:scale-90 duration-100">
                <span className="text-lg">📶</span>
              </div>
              <span className="text-[11px] font-bold text-neutral-700 leading-tight">Best Network</span>
            </button>
          </div>
        </div>
          </>
        )}

        {/* Active Transaction Counters & Performance */}
        <div className="bg-white border border-neutral-200 p-5 rounded-3xl shadow-xs space-y-4 mt-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-neutral-100 pb-2.5">
            <div>
              <h4 className="text-sm font-extrabold text-neutral-800 tracking-tight flex items-center gap-2">
                <span className="inline-flex items-center justify-center w-5 h-5 rounded-md bg-[#00B87A]/10 text-[#00B87A] text-xs">📈</span>
                <span>Active Transaction Counters & Performance</span>
              </h4>
              <p className="text-[11px] text-neutral-500 font-medium">
                Live performance metrics for operators showing transaction counts and volumes across time ranges.
              </p>
            </div>
            <div className="inline-flex items-center gap-1.5 self-start sm:self-center px-2.5 py-1 rounded-full bg-emerald-50 text-[10px] font-mono font-black uppercase tracking-wider text-[#00B87A] border border-emerald-100">
              <span className="w-1.5 h-1.5 rounded-full bg-[#00B87A] animate-ping" />
              Live Ledger Synced
            </div>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              {
                label: "Today's Activity",
                badge: 'Daily',
                count: summaryOverviews.daily.count,
                volume: summaryOverviews.daily.volume,
                bgColor: 'bg-emerald-50/40 border-emerald-100/80',
                textColor: 'text-emerald-700',
                countColor: 'bg-emerald-105 text-emerald-800',
                icon: '⚡'
              },
              {
                label: 'Weekly Summary',
                badge: 'Weekly',
                count: summaryOverviews.weekly.count,
                volume: summaryOverviews.weekly.volume,
                bgColor: 'bg-blue-50/40 border-blue-100/80',
                textColor: 'text-blue-700',
                countColor: 'bg-blue-100 text-blue-800',
                icon: '📅'
              },
              {
                label: 'Monthly Statement',
                badge: 'Monthly',
                count: summaryOverviews.monthly.count,
                volume: summaryOverviews.monthly.volume,
                bgColor: 'bg-indigo-50/40 border-indigo-100/80',
                textColor: 'text-indigo-700',
                countColor: 'bg-indigo-100 text-indigo-800',
                icon: '📊'
              },
              {
                label: 'Annual Statement',
                badge: 'Yearly',
                count: summaryOverviews.yearly.count,
                volume: summaryOverviews.yearly.volume,
                bgColor: 'bg-purple-50/40 border-purple-100/80',
                textColor: 'text-purple-700',
                countColor: 'bg-purple-100 text-purple-800',
                icon: '🌟'
              }
            ].map((period, i) => (
              <div 
                key={i} 
                className={`p-3.5 rounded-2xl border ${period.bgColor} transition-all hover:shadow-xs hover:scale-[1.01] duration-150 flex flex-col justify-between space-y-2`}
              >
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-extrabold text-neutral-400 uppercase tracking-wider font-mono">
                    {period.label}
                  </span>
                  <span className={`text-[10px] font-mono font-black px-2 py-0.5 rounded-full ${period.countColor} flex items-center gap-1`}>
                    <span>{period.icon}</span>
                    <span>{period.count} tx{period.count === 1 ? '' : 's'}</span>
                  </span>
                </div>
                <div className="space-y-0.5">
                  <span className="text-[10px] text-neutral-500 block font-medium">Accumulated Volume</span>
                  <span className={`text-base font-black font-mono block tracking-tight ${period.textColor}`}>
                    {displayNaira(period.volume)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 7. SECURED BASELINE TERMINAL OPERATOR COMMISSIONS */}
        {dashboardTab === 'settings' && (
        <div className="bg-white border border-neutral-200 p-4 rounded-3xl shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-0.5">
            <span className="text-xs font-mono font-bold text-neutral-400 uppercase tracking-widest flex items-center gap-1.5">
              <Percent className="w-3.5 h-3.5 text-[#00B87A]" /> Withdrawal Base Operating Cost Rate
            </span>
            <p className="text-[11px] text-neutral-500 font-medium">Configure terminal operator charge settings (0.25% Saver vs 0.50% Master rate).</p>
          </div>
 
          <div className="flex bg-neutral-100 p-1 rounded-xl border border-neutral-200">
            <button
              type="button"
              onClick={() => dispatch({ type: 'SET_TERMINAL_RATE', payload: 0.25 })}
              className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition cursor-pointer ${
                state.terminalFeeRate === 0.25 
                  ? 'bg-[#00B87A] text-white shadow-sm' 
                  : 'text-neutral-500 hover:text-neutral-800'
              }`}
            >
              0.25% Saver
            </button>
            <button
              type="button"
              onClick={() => dispatch({ type: 'SET_TERMINAL_RATE', payload: 0.35 })}
              className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition cursor-pointer ${
                state.terminalFeeRate === 0.35 
                  ? 'bg-[#00B87A] text-white shadow-sm' 
                  : 'text-neutral-500 hover:text-neutral-800'
              }`}
            >
              0.35% Special
            </button>
            <button
              type="button"
              onClick={() => dispatch({ type: 'SET_TERMINAL_RATE', payload: 0.5 })}
              className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition cursor-pointer ${
                state.terminalFeeRate === 0.5 
                  ? 'bg-[#00B87A] text-white shadow-sm' 
                  : 'text-neutral-500 hover:text-neutral-800'
              }`}
            >
              0.50% Standard
            </button>
          </div>
        </div>
        )}

        {/* 7.6. EXPENSE TRACKING */}
        {dashboardTab === 'expenses' && (
        <div className="bg-white border border-neutral-200 p-4 rounded-3xl shadow-sm space-y-4">
          <div className="flex justify-between items-center">
            <span className="text-xs font-mono font-bold text-neutral-400 uppercase tracking-widest flex items-center gap-1.5">
              <RefreshCw className="w-3.5 h-3.5 text-[#00B87A]" /> {state.activeTimeframe} Expenses
            </span>
            <button
              onClick={() => setIsAddingExpense(!isAddingExpense)}
              className="text-xs text-[#00B87A] font-bold"
            >
              {isAddingExpense ? 'Cancel' : '+ Add Expense'}
            </button>
          </div>
          <CalendarFilter 
            activeTimeframe={state.activeTimeframe} 
            selectedDate={filterDate}
            onTimeframeChange={(tf) => dispatch({ type: 'SET_TIMEFRAME', payload: tf })}
            onDateChange={setFilterDate}
          />
          {(() => {
            const now = filterDate;
            
            // Calculate totals across all 4 timeframes
            const dailyExpenses = state.expenses.filter(e => isSameDay(new Date(e.timestamp), filterDate)).reduce((sum, e) => sum + e.amount, 0);
            const weeklyExpenses = state.expenses.filter(e => isSameWeek(new Date(e.timestamp), filterDate)).reduce((sum, e) => sum + e.amount, 0);
            const monthlyExpenses = state.expenses.filter(e => isSameMonth(new Date(e.timestamp), filterDate)).reduce((sum, e) => sum + e.amount, 0);
            const yearlyExpenses = state.expenses.filter(e => isSameYear(new Date(e.timestamp), filterDate)).reduce((sum, e) => sum + e.amount, 0);

            // Filter the active list based on selected timeframe
            const filteredExpenses = state.expenses.filter(e => {
              const d = new Date(e.timestamp);
              if (state.activeTimeframe === 'Daily') return isSameDay(d, now);
              if (state.activeTimeframe === 'Weekly') return isSameWeek(d, now);
              if (state.activeTimeframe === 'Monthly') return isSameMonth(d, now);
              return isSameYear(d, now);
            });

            const timeframes = [
              { name: 'Daily' as const, amount: dailyExpenses },
              { name: 'Weekly' as const, amount: weeklyExpenses },
              { name: 'Monthly' as const, amount: monthlyExpenses },
              { name: 'Yearly' as const, amount: yearlyExpenses }
            ];

            return (
              <div className="space-y-4">
                {/* 4-Column Timeframe KPIs Grid */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  {timeframes.map(tf => {
                    const isActive = state.activeTimeframe === tf.name;
                    return (
                      <button
                        key={tf.name}
                        type="button"
                        onClick={() => dispatch({ type: 'SET_TIMEFRAME', payload: tf.name })}
                        className={`text-left p-3.5 rounded-2xl border transition-all relative cursor-pointer focus:outline-none ${
                          isActive
                            ? 'bg-gradient-to-br from-rose-50 to-white border-rose-200 shadow-sm ring-1 ring-rose-200/50'
                            : 'bg-neutral-50/50 border-neutral-200/60 hover:bg-neutral-50 hover:border-neutral-300'
                        }`}
                      >
                        <div className="flex justify-between items-center mb-1.5">
                          <span className={`text-[9px] font-extrabold tracking-wider uppercase ${isActive ? 'text-rose-700' : 'text-neutral-400'}`}>
                            {tf.name}
                          </span>
                          {isActive && (
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                          )}
                        </div>
                        <div className="space-y-0.5">
                          <span className={`text-base font-mono font-black block tracking-tight ${isActive ? 'text-rose-900' : 'text-neutral-800'}`}>
                            {formatNaira(tf.amount)}
                          </span>
                          <span className="text-[9px] text-neutral-400 block font-medium">Expenses Outflow</span>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Info Bar showing which view is active */}
                <div className="flex items-center justify-between bg-neutral-50/80 border border-neutral-200/60 px-3.5 py-2.5 rounded-xl text-[11px] text-neutral-500">
                  <span className="flex items-center gap-1.5 font-medium">
                    <Receipt className="w-3.5 h-3.5 text-neutral-400" />
                    Currently active: <strong className="text-neutral-700">{state.activeTimeframe} Expenses Log</strong>
                  </span>
                  <span className="text-[10px] text-neutral-400 bg-neutral-200/60 px-2 py-0.5 rounded-full font-bold">
                    {filteredExpenses.length} Records
                  </span>
                </div>

                {/* Add Expense Form Box */}
                {isAddingExpense && (
                  <div className="space-y-3 p-4 bg-gradient-to-b from-neutral-50 to-neutral-100/50 rounded-2xl border border-neutral-200 shadow-inner animate-fade-in">
                    <div className="flex items-center gap-1.5 border-b border-neutral-200/60 pb-2 mb-2">
                      <div className="p-1 rounded-md bg-emerald-50 text-[#00B87A]">
                        <Tag className="w-3.5 h-3.5" />
                      </div>
                      <span className="text-xs font-extrabold text-neutral-800 tracking-tight uppercase">Record New Expense Outlet</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[10px] font-extrabold text-neutral-400 uppercase tracking-wider block">Description / Purpose</label>
                        <input
                          type="text"
                          placeholder="e.g. Petrol for Generator, POS rolls..."
                          value={newExpenseDesc}
                          onChange={(e) => setNewExpenseDesc(e.target.value)}
                          className="w-full text-xs p-2.5 rounded-xl border border-neutral-200 bg-white focus:outline-none focus:ring-1 focus:ring-[#00B87A] focus:border-[#00B87A] placeholder-neutral-300 font-medium"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-extrabold text-neutral-400 uppercase tracking-wider block">Amount (₦)</label>
                        <div className="relative">
                          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-neutral-400 font-mono">₦</span>
                          <input
                            type="number"
                            placeholder="0.00"
                            value={newExpenseAmt}
                            onChange={(e) => setNewExpenseAmt(e.target.value)}
                            className="w-full text-xs pl-6 pr-2.5 py-2.5 rounded-xl border border-neutral-200 bg-white focus:outline-none focus:ring-1 focus:ring-[#00B87A] focus:border-[#00B87A] placeholder-neutral-300 font-bold font-mono"
                          />
                        </div>
                      </div>
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] font-extrabold text-neutral-400 uppercase tracking-wider block">Memo / Notes</label>
                        <input
                          type="text"
                          placeholder="e.g. Extra details..."
                          value={newExpenseNotes}
                          onChange={(e) => setNewExpenseNotes(e.target.value)}
                          className="w-full text-xs p-2.5 rounded-xl border border-neutral-200 bg-white focus:outline-none focus:ring-1 focus:ring-[#00B87A] focus:border-[#00B87A] placeholder-neutral-300 font-medium"
                        />
                    </div>
                    <div className="mt-2">
                        <AudioRecorder onSave={setNewExpenseAudio} initialAudio={newExpenseAudio} />
                    </div>

                    <div className="flex justify-end gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => {
                          setNewExpenseDesc('');
                          setNewExpenseAmt('');
                          setIsAddingExpense(false);
                        }}
                        className="px-3.5 py-2 text-xs text-neutral-500 hover:bg-neutral-200/50 rounded-xl font-bold transition cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (newExpenseDesc && newExpenseAmt) {
                            const expense = {
                              id: Date.now().toString(),
                              amount: parseFloat(newExpenseAmt),
                              description: newExpenseDesc,
                              timestamp: new Date().toISOString(),
                              ownerId: state.currentUser.ownerId,
                              employeeId: state.currentUser.id,
                              employeeName: state.currentUser.name,
                              notes: newExpenseNotes || undefined,
                              audioNote: newExpenseAudio || undefined
                            };
                            handleAddExpense(expense);
                            setNewExpenseDesc('');
                            setNewExpenseAmt('');
                            setNewExpenseNotes('');
                            setNewExpenseAudio('');
                            setIsAddingExpense(false);
                          }
                        }}
                        className="px-5 py-2 bg-[#00B87A] hover:bg-[#00a36c] text-white rounded-xl font-bold text-xs transition shadow-sm active:scale-95 flex items-center gap-1.5 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                        Save Record
                      </button>
                    </div>
                  </div>
                )}

                {/* Expenses Log Entries List */}
                <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
                  {filteredExpenses.map(e => {
                    const formattedDate = new Date(e.timestamp).toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    });

                    return (
                      <div key={e.id} className="group flex justify-between items-center text-xs p-3 bg-neutral-50 hover:bg-neutral-100/60 border border-neutral-150 rounded-xl transition-all">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center font-bold shadow-xs">
                            <TrendingDown className="w-4 h-4" />
                          </div>
                          <div className="space-y-0.5">
                            <span className="font-bold text-neutral-800 block">{e.description}</span>
                            <div className="flex items-center gap-2 text-[10px] text-neutral-400 font-medium">
                              <span className="font-mono">{formattedDate}</span>
                              {e.employeeName && (
                                <>
                                  <span className="w-1 h-1 rounded-full bg-neutral-200" />
                                  <span className="bg-neutral-200/50 text-neutral-500 px-1.5 py-0.5 rounded-md text-[9px] font-bold">
                                    by {e.employeeName}
                                  </span>
                                </>
                              )}
                            </div>
                            {e.notes && <span className="text-[10px] text-neutral-500 font-medium italic block mt-0.5">"{e.notes}"</span>}
                            {e.audioNote && (
                              <button
                                type="button"
                                onClick={() => {
                                  const audio = new Audio(e.audioNote);
                                  audio.play();
                                }}
                                className="flex items-center gap-1 text-[10px] text-emerald-600 hover:text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded-md mt-1 cursor-pointer"
                              >
                                🔊 Play Voice Note
                              </button>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="font-bold font-mono text-rose-600 text-sm">-{formatNaira(e.amount)}</span>
                          <button
                            type="button"
                            onClick={() => handleDeleteExpense(e.id)}
                            className="p-1.5 text-neutral-300 hover:text-red-500 rounded-lg hover:bg-neutral-200/50 transition cursor-pointer opacity-0 group-hover:opacity-100 focus:opacity-100"
                            title="Delete this expense record"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}

                  {filteredExpenses.length === 0 && (
                    <div className="text-center py-8 bg-neutral-50/30 border border-dashed border-neutral-200 rounded-2xl">
                      <Receipt className="w-8 h-8 text-neutral-300 mx-auto mb-2" />
                      <p className="text-xs font-semibold text-neutral-500">No {state.activeTimeframe.toLowerCase()} expenses logged</p>
                      <p className="text-[10px] text-neutral-400 mt-1">Tap "+ Add Expense" at the top right to log operating costs.</p>
                    </div>
                  )}
                </div>
              </div>
            );
          })()}
        </div>
        )}

        {dashboardTab === 'terminals' && (
          <div className="space-y-6">
            
            {/* Header section with register terminal trigger */}
            <div className="bg-white border border-neutral-200 p-6 rounded-3xl shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h2 className="text-xl font-extrabold text-neutral-800 flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-[#00B87A]" /> Registered POS Terminals
                </h2>
                <p className="text-xs text-neutral-550 mt-1 font-medium">Add POS terminals, map cashier operations, trace account numbers, and monitor differentiated cashier profits and volume flow.</p>
              </div>
              {state.currentUser.role === 'Manager' ? (
                <button
                  type="button"
                  onClick={() => setIsAddingTerminal(!isAddingTerminal)}
                  className="bg-[#00B87A] hover:bg-[#00A068] text-white px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm active:scale-95 cursor-pointer select-none shrink-0"
                >
                  <Plus className="w-4 h-4" />
                  <span>Register POS Terminal</span>
                </button>
              ) : (
                <div className="bg-amber-50/90 border border-amber-200 text-amber-900 text-xs font-semibold px-3.5 py-2.5 rounded-2xl flex items-center gap-2 shrink-0">
                  <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>Only Store Managers can register physical POS hardware terminals.</span>
                </div>
              )}
            </div>

            {/* MOST ACTIVE TERMINAL PERFORMANCE SUMMARY BAR */}
            {mostActiveTerminal ? (
              <div className="bg-gradient-to-r from-emerald-50/60 via-teal-50/30 to-white border border-emerald-100 p-5 rounded-3xl shadow-xs flex flex-col md:flex-row justify-between items-start md:items-center gap-4 animate-in fade-in duration-300">
                <div className="flex items-center gap-3.5">
                  <div className="w-11 h-11 rounded-2xl bg-[#00B87A] text-white flex items-center justify-center shadow-md shadow-emerald-500/10 shrink-0">
                    <Sparkles className="w-5 h-5 animate-pulse" />
                  </div>
                  <div>
                    <span className="inline-flex items-center gap-1 text-[9px] bg-emerald-600/10 text-emerald-700 font-mono font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full mb-1">
                      🔥 Most Active Terminal
                    </span>
                    <h3 className="text-base font-extrabold text-neutral-800 tracking-tight flex items-center gap-2">
                      {mostActiveTerminal.name}
                      <span className="text-xs font-bold text-neutral-450">({mostActiveTerminal.provider})</span>
                    </h3>
                    <p className="text-[11px] text-neutral-500 font-medium mt-0.5">
                      Operator: <strong className="text-neutral-700">{mostActiveTerminal.cashierName || 'N/A'}</strong> &bull; Operating Location: <strong className="text-neutral-700">{mostActiveTerminal.areaOfWorking || 'N/A'}</strong>
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-4 md:gap-7 items-center w-full md:w-auto border-t md:border-t-0 border-neutral-100 pt-3 md:pt-0">
                  <div className="space-y-0.5">
                    <span className="block text-[9px] font-bold text-neutral-400 uppercase tracking-wider font-mono">Performance Volume</span>
                    <span className="block text-sm font-black font-mono text-[#00B87A]">{formatNaira(mostActiveTerminal.volume)}</span>
                  </div>
                  <div className="space-y-0.5">
                    <span className="block text-[9px] font-bold text-neutral-400 uppercase tracking-wider font-mono">Operator Profit</span>
                    <span className="block text-sm font-black font-mono text-emerald-700">{formatNaira(mostActiveTerminal.profit)}</span>
                  </div>
                  <div className="space-y-0.5">
                    <span className="block text-[9px] font-bold text-neutral-400 uppercase tracking-wider font-mono">Slips Flow</span>
                    <span className="block text-[11px] font-black font-mono bg-neutral-100/65 border border-neutral-200 text-neutral-700 px-2 py-0.5 rounded-lg shadow-2xs">
                      {mostActiveTerminal.count} Receipts
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-neutral-50/50 border border-neutral-200/50 p-5 rounded-3xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4 text-xs font-medium text-neutral-500 font-sans">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-neutral-100 text-neutral-400 flex items-center justify-center shrink-0 border border-neutral-200">
                    <Sparkles className="w-4 h-4 text-neutral-400" />
                  </div>
                  <div>
                    <h4 className="font-extrabold text-neutral-800 tracking-tight text-sm">POS Performance Telemetry</h4>
                    <p className="text-[11px] text-neutral-450 font-medium mt-0.5">Awaiting active transactions on registered POS devices to select top operator metrics.</p>
                  </div>
                </div>
                <div className="text-[10px] bg-white border border-neutral-200 px-3 py-1 rounded-xl text-neutral-450 font-mono font-bold">
                  🟢 Real-time monitoring active
                </div>
              </div>
            )}

            {/* ADD POS TERMINAL FORM BLOCK */}
            {isAddingTerminal && state.currentUser.role === 'Manager' && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!newTerminalName.trim()) {
                    alert('Name of the POS is required.');
                    return;
                  }
                  if (!newTerminalAccountNo.trim()) {
                    alert('POS Account number is required.');
                    return;
                  }
                  if (!newTerminalCashierName.trim()) {
                    alert('Name of the cashier is required.');
                    return;
                  }
                  if (!newTerminalArea.trim()) {
                    alert('Area of working is required.');
                    return;
                  }
                  // Find matching cashier under manager
                  const typedCashierName = newTerminalCashierName.trim();
                  const matchedCashier = registeredUsers.find(u =>
                    ((u.role || '').toLowerCase() === 'employee' || (u.role || '').toLowerCase() === 'cashier') &&
                    (u.ownerId === state.currentUser.id || u.parentManagerId === state.currentUser.id || u.addedBy === state.currentUser.name) &&
                    u.name.trim().toLowerCase() === typedCashierName.toLowerCase()
                  ) || registeredUsers.find(u =>
                    ((u.role || '').toLowerCase() === 'employee' || (u.role || '').toLowerCase() === 'cashier') &&
                    u.name.trim().toLowerCase() === typedCashierName.toLowerCase()
                  );

                  const assignedEmployeeId = matchedCashier ? matchedCashier.id : (state.currentUser.role === 'Employee' ? state.currentUser.id : undefined);
                  const effectiveOwnerId = state.impersonatedUserId || (state.currentUser.role === 'Manager' ? state.currentUser.id : (syncOwnerId || 'local_owner'));

                  const term: PosTerminal = {
                    id: 'term_' + Math.random().toString(36).substring(2, 9),
                    name: newTerminalName.trim(),
                    provider: newTerminalProvider,
                    posAccountNo: newTerminalAccountNo.trim(),
                    cashierName: newTerminalCashierName.trim(),
                    areaOfWorking: newTerminalArea.trim(),
                    terminalFeeRate: newTerminalRate,
                    serialNumber: newTerminalSN.trim(),
                    ownerId: effectiveOwnerId,
                    employeeId: assignedEmployeeId,
                    addedBy: state.currentUser.name,
                    status: 'Active',
                    timestamp: new Date().toISOString(),
                    simCardNumber: newTerminalSim.trim(),
                    networkProvider: newTerminalNetwork as any,
                    batteryLevel: newTerminalBattery,
                    signalStrength: newTerminalSignal
                  };
                  handleAddPosTerminal(term);
                  setNewTerminalName('');
                  setNewTerminalAccountNo('');
                  setNewTerminalCashierName('');
                  setNewTerminalArea('');
                  setNewTerminalSN('');
                  setNewTerminalSim('');
                  setNewTerminalNetwork('MTN');
                  setNewTerminalBattery(100);
                  setNewTerminalSignal(5);
                  setIsAddingTerminal(false);
                }}
                className="bg-white border border-neutral-200 p-6 rounded-3xl shadow-sm space-y-4 animate-in slide-in-from-top-2 duration-200"
              >
                <h3 className="text-sm font-black text-neutral-800 uppercase tracking-wider font-mono flex items-center gap-1.5">
                  📝 POS Hardware & Operator Register Profile
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-neutral-500 uppercase tracking-wider mb-1.5 font-mono">
                      Name of the POS *
                    </label>
                    <input
                      type="text"
                      value={newTerminalName}
                      onChange={(e) => setNewTerminalName(e.target.value)}
                      placeholder="e.g. OPay Main Counter"
                      className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-3.5 py-2.5 text-xs text-neutral-800 font-bold focus:outline-none focus:border-[#00B87A]"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-neutral-500 uppercase tracking-wider mb-1.5 font-mono">
                      POS Account No *
                    </label>
                    <input
                      type="text"
                      value={newTerminalAccountNo}
                      onChange={(e) => setNewTerminalAccountNo(e.target.value)}
                      placeholder="e.g. 8112345678"
                      className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-3.5 py-2.5 text-xs text-neutral-800 font-bold focus:outline-none focus:border-[#00B87A]"
                      required
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-xs font-bold text-neutral-500 uppercase tracking-wider font-mono">
                        Name of the Cashier *
                      </label>
                      {managerCashiers.length > 0 && (
                        <span className="text-[10px] text-[#00B87A] font-extrabold normal-case bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                          {managerCashiers.length} Linked Cashiers
                        </span>
                      )}
                    </div>

                    {managerCashiers.length > 0 ? (
                      <div className="space-y-1.5">
                        <select
                          value={newTerminalCashierName}
                          onChange={(e) => {
                            const val = e.target.value;
                            setNewTerminalCashierName(val);
                            const matched = managerCashiers.find(c => c.name.toLowerCase() === val.toLowerCase());
                            if (matched && matched.areaOfWorking) {
                              setNewTerminalArea(matched.areaOfWorking);
                            }
                          }}
                          className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-3.5 py-2.5 text-xs text-neutral-800 font-bold focus:outline-none focus:border-[#00B87A] cursor-pointer"
                          required
                        >
                          <option value="">-- Select Cashier Account Under Manager --</option>
                          {managerCashiers.map(c => (
                            <option key={c.id} value={c.name}>
                              {c.name} {c.areaOfWorking ? `• Area: ${c.areaOfWorking}` : ''} {c.phone ? `(${c.phone})` : ''}
                            </option>
                          ))}
                        </select>
                        <p className="text-[10px] text-neutral-500 font-medium">
                          Select a cashier linked under your manager account. This physical POS terminal will automatically reflect on their cashier dashboard.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        <input
                          type="text"
                          value={newTerminalCashierName}
                          onChange={(e) => setNewTerminalCashierName(e.target.value)}
                          placeholder="e.g. Chinedu Okafor"
                          className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-3.5 py-2.5 text-xs text-neutral-800 font-bold focus:outline-none focus:border-[#00B87A]"
                          required
                        />
                        <p className="text-[10px] text-neutral-500 font-medium">
                          Type cashier name or register staff in Staff Profile to select from linked cashiers.
                        </p>
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-neutral-500 uppercase tracking-wider mb-1.5 font-mono">
                      Area of working with POS *
                    </label>
                    <input
                      type="text"
                      value={newTerminalArea}
                      onChange={(e) => setNewTerminalArea(e.target.value)}
                      placeholder="e.g. Main Hall, Gate, Outer Stand"
                      className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-3.5 py-2.5 text-xs text-neutral-800 font-bold focus:outline-none focus:border-[#00B87A]"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-neutral-500 uppercase tracking-wider mb-1.5 font-mono">
                      Serial Number
                    </label>
                    <input
                      type="text"
                      value={newTerminalSN}
                      onChange={(e) => setNewTerminalSN(e.target.value)}
                      placeholder="e.g. SN-123456"
                      className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-3.5 py-2.5 text-xs text-neutral-800 font-bold focus:outline-none focus:border-[#00B87A]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-neutral-500 uppercase tracking-wider mb-1.5 font-mono">
                      POS Hardware Brand *
                    </label>
                    <select
                      value={newTerminalProvider}
                      onChange={(e) => setNewTerminalProvider(e.target.value as any)}
                      className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-3.5 py-2.5 text-xs text-neutral-800 font-bold focus:outline-none focus:border-[#00B87A]"
                    >
                      <option value="OPay">OPay Terminal</option>
                      <option value="Moniepoint">Moniepoint Terminal</option>
                      <option value="PalmPay">PalmPay Terminal</option>
                      <option value="Others">Others / Custom</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-neutral-500 uppercase tracking-wider mb-1.5 font-mono">
                      Baseline Terminal Fee Rate Package *
                    </label>
                    <select
                      value={newTerminalRate}
                      onChange={(e) => setNewTerminalRate(parseFloat(e.target.value))}
                      className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-3.5 py-2.5 text-xs text-neutral-800 font-bold focus:outline-none"
                    >
                      <option value={0.5}>0.50% (Standard Business Rate)</option>
                      <option value={0.4}>0.40% (Standard Partner Rate)</option>
                      <option value={0.35}>0.35% (Special Partner Rate)</option>
                      <option value={0.25}>0.25% (Saver Corporate Rate)</option>
                    </select>
                  </div>
                </div>

                <div className="flex justify-end gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsAddingTerminal(false)}
                    className="px-4 py-2 bg-neutral-100 hover:bg-neutral-200 rounded-xl text-xs font-bold text-neutral-600 transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-[#00B87A] hover:bg-[#00A068] text-white rounded-xl text-xs font-bold transition shadow-sm"
                  >
                    Confirm & Register
                  </button>
                </div>
              </form>
            )}

            {/* Registered POS Terminals Cards List */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              
              {/* Live Terminal Cards Loop */}
              {terminalStats.map((term) => {
                const brandColors = {
                  Moniepoint: 'bg-blue-50/55 border-blue-100 text-blue-700',
                  OPay: 'bg-emerald-50/55 border-emerald-100 text-emerald-700',
                  PalmPay: 'bg-orange-50/55 border-orange-100 text-orange-700',
                  Others: 'bg-neutral-50/55 border-neutral-100 text-neutral-700'
                };
                const tagColors = {
                  Moniepoint: 'bg-blue-600',
                  OPay: 'bg-[#00B87A]',
                  PalmPay: 'bg-orange-500',
                  Others: 'bg-neutral-500'
                };
                
                const currentBrand = (term.provider in brandColors) ? term.provider as keyof typeof brandColors : 'Others';
                
                return (
                  <div
                    key={term.id}
                    className="bg-white border border-neutral-200 rounded-3xl p-5 shadow-xs hover:shadow-md transition-all duration-150 flex flex-col justify-between space-y-4"
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-2">
                        <div className={`w-6 h-6 rounded-full ${tagColors[currentBrand]} flex items-center justify-center text-[10px] text-white font-bold`}>
                          {term.provider[0]}
                        </div>
                        <div>
                          <h4 className="font-extrabold text-sm text-neutral-800 tracking-tight">{term.name}</h4>
                          <span className="text-[10px] text-neutral-400 font-mono">Acct: {term.posAccountNo || 'N/A'}</span>
                        </div>
                      </div>
                      <span className={`text-[9px] px-2 py-0.5 rounded-md font-mono font-bold ${brandColors[currentBrand]}`}>
                        {term.provider} ({term.terminalFeeRate}%)
                      </span>
                    </div>

                    <div className="space-y-1.5 text-xs bg-neutral-50/70 p-3 rounded-2xl border border-neutral-100">
                      <div className="flex justify-between">
                        <span className="text-neutral-400 font-medium">Cashier:</span>
                        <span className="font-bold text-neutral-700">{term.cashierName || 'N/A'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-neutral-400 font-medium">Area of Working:</span>
                        <span className="font-bold text-neutral-700">{term.areaOfWorking || 'N/A'}</span>
                      </div>
                      <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-neutral-100 flex-wrap">
                        <div className={`px-1.5 py-0.5 rounded-full flex items-center gap-1 ${term.networkStatus === 'Active' ? 'bg-emerald-100 text-emerald-800' : term.networkStatus === 'Inactive' ? 'bg-red-100 text-red-800' : 'bg-neutral-100 text-neutral-600'}`}>
                            <Wifi className="w-3 h-3" />
                            <span className="text-[9px] font-bold">{term.networkStatus || 'Unknown'}</span>
                        </div>
                        <div className={`px-1.5 py-0.5 rounded-full flex items-center gap-1 ${term.browsingStatus === 'Enabled' ? 'bg-emerald-100 text-emerald-800' : term.browsingStatus === 'Disabled' ? 'bg-red-100 text-red-800' : 'bg-neutral-100 text-neutral-600'}`}>
                            <Globe className="w-3 h-3" />
                            <span className="text-[9px] font-bold">{term.browsingStatus || 'Unknown'}</span>
                        </div>
                        <div className={`px-1.5 py-0.5 rounded-full flex items-center gap-1 ${term.internetAccess === 'Granted' ? 'bg-emerald-100 text-emerald-800' : term.internetAccess === 'Denied' ? 'bg-red-100 text-red-800' : 'bg-neutral-100 text-neutral-600'}`}>
                            <CheckCircle className="w-3 h-3" />
                            <span className="text-[9px] font-bold">{term.internetAccess || 'Unknown'}</span>
                        </div>
                      </div>
                      <button
                        onClick={() => handleCheckTerminalNetwork(term)}
                        className="mt-2 w-full flex items-center justify-center gap-1.5 text-[10px] font-bold bg-white border border-neutral-200 py-1.5 rounded-xl hover:bg-neutral-100 transition cursor-pointer"
                      >
                        <RefreshCw className="w-3 h-3" /> Check Network
                      </button>
                    </div>

                    <div className="border-t border-neutral-100 pt-3.5 space-y-2.5">
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-neutral-450 font-medium font-sans">Total Volume Flow</span>
                        <span className="font-extrabold font-mono text-neutral-800">{formatNaira(term.volume)}</span>
                      </div>
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-neutral-450 font-medium font-sans">Differentiated Net Profit</span>
                        <span className="font-extrabold font-mono text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-lg">{formatNaira(term.profit)}</span>
                      </div>
                      <div className="flex justify-between items-center text-[11px]">
                        <span className="text-neutral-450 font-mono">Transactions Count</span>
                        <span className="font-bold text-neutral-700 font-mono">{term.count} Receipts</span>
                      </div>
                    </div>

                    <div className="flex justify-between items-center border-t border-neutral-100 pt-3">
                      <span className="text-[9px] text-neutral-400 font-semibold font-sans">Added by: {term.addedBy}</span>
                      <button
                        type="button"
                        onClick={() => {
                          if (confirm(`Are you sure you want to remove ${term.name}?`)) {
                            handleDeletePosTerminal(term.id);
                          }
                        }}
                        className="text-red-500 hover:text-red-700 text-[11px] font-bold transition flex items-center gap-0.5 cursor-pointer select-none"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Remove POS
                      </button>
                    </div>
                  </div>
                );
              })}

              {/* Default unlinked transactions card (for backward compatibility / fallback) */}
              {(defaultTerminalStats.count > 0 || filteredPosTerminals?.length === 0) && (
                <div className="bg-neutral-50/50 border border-neutral-200 rounded-3xl p-5 shadow-xs flex flex-col justify-between space-y-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-extrabold text-sm text-neutral-800 tracking-tight">Direct POS / Legacy Terminal</h4>
                      <span className="text-[10px] text-neutral-400 font-sans">Non-terminal transactions</span>
                    </div>
                    <span className="text-[9px] px-2 py-0.5 rounded-md font-mono font-bold bg-neutral-200 text-neutral-700">
                      Standard Rates
                    </span>
                  </div>

                  <div className="border-t border-neutral-100 pt-3.5 space-y-2.5">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-neutral-450 font-medium font-sans">Total Volume Flow</span>
                      <span className="font-extrabold font-mono text-neutral-800">{formatNaira(defaultTerminalStats.volume)}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-neutral-450 font-medium font-sans">Differentiated Net Profit</span>
                      <span className="font-extrabold font-mono text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-lg">{formatNaira(defaultTerminalStats.profit)}</span>
                    </div>
                    <div className="flex justify-between items-center text-[11px]">
                      <span className="text-neutral-450 font-mono">Transactions Count</span>
                      <span className="font-bold text-neutral-700 font-mono">{defaultTerminalStats.count} Receipts</span>
                    </div>
                  </div>

                  <div className="border-t border-neutral-100 pt-3 flex justify-between items-center">
                    <span className="text-[9px] text-neutral-400 font-semibold">Native Default Tracker</span>
                    <span className="text-[10px] text-neutral-400 italic font-medium">Fallback active</span>
                  </div>
                </div>
              )}
            </div>

            {/* Empty state when no custom terminals registered */}
            {(!filteredPosTerminals || filteredPosTerminals.length === 0) && (
              <div className="text-center py-12 bg-white border border-neutral-200 rounded-3xl p-6 shadow-xs max-w-lg mx-auto">
                <CreditCard className="w-12 h-12 text-[#00B87A]/20 mx-auto mb-3" />
                <h4 className="text-base font-extrabold text-neutral-800 tracking-tight">No POS Terminals Registered</h4>
                <p className="text-xs text-neutral-550 mt-1.5 leading-relaxed">
                  Register OPay, Moniepoint, or PalmPay hardware devices with their associated account number, cashier operator, and working area. Differentiated tracking will map profits and statistics separately per registered device.
                </p>
                <button
                  type="button"
                  onClick={() => setIsAddingTerminal(true)}
                  className="mt-4 bg-[#00B87A] hover:bg-[#00A068] text-white px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer active:scale-95 shadow-sm inline-flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4" /> Register Cashier POS Terminal
                </button>
              </div>
            )}

            {/* AGGREGATED PROFIT AND TRANSACTION SUMS BLOCK - "ADD ALL TRANSACTIONS AND ALL PROFITS" */}
            <div className="bg-gradient-to-br from-[#00B87A] to-[#00A068] text-white rounded-3xl p-6 sm:p-8 shadow-xl mt-6">
              <div className="flex justify-between items-center border-b border-white/20 pb-4 mb-4">
                <div>
                  <h3 className="text-base font-extrabold tracking-tight">Combined POS Cash Ledger</h3>
                  <p className="text-[11px] text-emerald-100 font-medium">Aggregating all active terminals + direct channel transactions</p>
                </div>
                <div className="p-2 bg-white/10 rounded-2xl border border-white/5">
                  <CreditCard className="w-5 h-5 text-emerald-100" />
                </div>
              </div>

              {/* Differentiated listing inside combined dashboard */}
              <div className="space-y-3 pt-1">
                {terminalStats.map((term) => (
                  <div key={term.id} className="flex justify-between items-center text-xs border-b border-white/10 pb-2.5">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                      <span className="font-bold">{term.name} ({term.provider})</span>
                    </div>
                    <div className="flex items-center gap-4 font-mono">
                      <span className="text-emerald-100">Flow: {formatNaira(term.volume)}</span>
                      <span className="font-black bg-white/15 px-2 py-0.5 rounded-lg">Profit: +{formatNaira(term.profit)}</span>
                    </div>
                  </div>
                ))}

                {defaultTerminalStats.count > 0 && (
                  <div className="flex justify-between items-center text-xs border-b border-white/10 pb-2.5">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-300" />
                      <span className="font-bold">Direct POS / Legacy Terminal</span>
                    </div>
                    <div className="flex items-center gap-4 font-mono">
                      <span className="text-emerald-100">Flow: {formatNaira(defaultTerminalStats.volume)}</span>
                      <span className="font-black bg-white/15 px-2 py-0.5 rounded-lg">Profit: +{formatNaira(defaultTerminalStats.profit)}</span>
                    </div>
                  </div>
                )}
                
                {/* GRAND TOTALS BLOCK - "ADD ALL TRANSACTIONS AND ALL PROFITS" */}
                {(() => {
                  const successTxs = authorizedTransactions.filter(t => t.status === 'Success');
                  const grandTotalVolume = successTxs.reduce((sum, t) => sum + t.amount, 0);
                  const grandTotalProfit = successTxs.reduce((sum, t) => sum + t.profit, 0);
                  const grandTotalTransactions = successTxs.length;

                  return (
                    <div className="grid grid-cols-1 gap-4 pt-4 mt-2">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div className="bg-white/10 p-3.5 rounded-2xl border border-white/5 space-y-0.5">
                          <span className="text-[10px] block uppercase font-mono tracking-wider text-emerald-100">GRAND TOTAL VOLUME</span>
                          <span className="text-lg font-extrabold font-mono text-white leading-none block">{formatNaira(grandTotalVolume)}</span>
                        </div>
                        <div className="bg-white/10 p-3.5 rounded-2xl border border-white/5 space-y-0.5">
                          <span className="text-[10px] block uppercase font-mono tracking-wider text-emerald-100">GRAND TOTAL PROFITS</span>
                          <span className="text-lg font-extrabold font-mono text-yellow-300 leading-none block">{formatNaira(grandTotalProfit)}</span>
                        </div>
                        <div className="bg-white/10 p-3.5 rounded-2xl border border-white/5 space-y-0.5">
                          <span className="text-[10px] block uppercase font-mono tracking-wider text-emerald-100">GRAND RECEIPT COUNT</span>
                          <span className="text-lg font-extrabold font-mono text-white leading-none block">{grandTotalTransactions} Receipts</span>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        {(['OPay', 'Moniepoint', 'PalmPay'] as const).map(provider => {
                          const providerTxs = authorizedTransactions.filter(t => t.provider === provider && t.status === 'Success');
                          const totalVolume = providerTxs.reduce((sum, t) => sum + t.amount, 0);
                          const totalProfit = providerTxs.reduce((sum, t) => sum + t.profit, 0);
                          return (
                            <div key={provider} className="bg-white/5 p-3.5 rounded-2xl border border-white/5 space-y-0.5">
                              <span className="text-[10px] block uppercase font-mono tracking-wider text-emerald-100">{provider} TOTAL</span>
                              <span className="text-sm font-bold text-white block">Vol: {formatNaira(totalVolume)}</span>
                              <span className="text-xs font-mono text-yellow-300 block">Profit: {formatNaira(totalProfit)}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}

              </div>
            </div>

          </div>
        )}

        {dashboardTab === 'unpaid' && (
        <>
          <UnpaidChargesLedger
            transactions={authorizedTransactions}
            onUpdateTransaction={handleUpdateTransaction}
            onApproveTransaction={handleApproveTransaction}
            onReverseTransaction={handleReverseTransaction}
            onAddTransaction={handleAddTransaction}
            currentUser={state.currentUser}
            settings={state.settings}
          />
          <BorrowKeepSection 
            state={state} 
            syncOwnerId={syncOwnerId} 
            isPremiumLocked={isPremiumLocked} 
            onExpiredSubscription={() => setIsSubscriptionExpiredDialogOpen(true)} 
          />
        </>
        )}

        {dashboardTab === 'reports' && (state.currentUser.role === 'Manager' || state.impersonatedUserId) && (
          <EmployeeOversightBoard
            currentUser={state.currentUser}
            registeredUsers={teamUsers}
            transactions={state.transactions}
            posTerminals={filteredPosTerminals}
            settings={state.settings}
            activeTimeframe={state.activeTimeframe}
            selectedEmployeeFilter={state.selectedEmployeeFilter}
            onSetEmployeeFilter={(id) => dispatch({ type: 'SET_EMPLOYEE_FILTER', payload: id })}
            onEditTransaction={(tx) => setEditingTransaction(tx)}
            onViewReceipt={(tx) => setSelectedReceiptTx(tx)}
            onAddTransaction={handleAddTransaction}
            onSwitchToCashier={(userId) => dispatch({ type: 'SET_IMPERSONATED_USER', payload: userId })}
            onEditEmployee={(user) => setEditingEmployeeFromDashboard(user)}
          />
        )}

        {dashboardTab === 'referrals' && state.currentUser.role === 'Manager' && (
          <ReferralsTab 
            currentUser={state.currentUser}
            showAppNotification={showAppNotification}
            onOpenBillingModal={handleUpgradeFromOverlay}
          />
        )}

        {/* CONFIGURE & SETTINGS CONTROLS */}
        {dashboardTab === 'settings' && isSuperAdmin && (
        <>
          {state.currentUser.role === 'Manager' && (
            <div className="bg-white border border-neutral-200 p-4 rounded-3xl shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="space-y-0.5">
                <span className="text-xs font-mono font-bold text-neutral-400 uppercase tracking-widest flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-[#00B87A]" /> Manager: View Transactions For
                </span>
                <p className="text-[11px] text-neutral-500 font-medium">Filter the dashboard to view transactions from a specific operator or all operators.</p>
              </div>
              
              <select
                value={state.selectedEmployeeFilter}
                onChange={(e) => dispatch({ type: 'SET_EMPLOYEE_FILTER', payload: e.target.value })}
                className="px-3.5 py-2 bg-neutral-50 border border-neutral-200 text-neutral-800 text-xs font-bold rounded-xl focus:outline-none focus:border-[#00B87A] focus:ring-1 focus:ring-[#00B87A]"
              >
                <option value="ALL">{isSuperAdmin ? 'All Operators & Managers' : 'All My Cashiers & Operators'}</option>
                {registeredUsers.map(u => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.role})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Shift Control Card */}
          <div className="bg-white border border-neutral-200 p-4 rounded-3xl shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="space-y-0.5">
              <span className="text-xs font-mono font-bold text-neutral-400 uppercase tracking-widest flex items-center gap-1.5">
                <UserCheck className="w-3.5 h-3.5 text-[#00B87A]" /> Shift & Employee Access
              </span>
              <p className="text-[11px] text-neutral-500 font-medium">Switch the active shift operator, change terminal PIN keys, or register new employees.</p>
            </div>
            <button
              type="button"
              onClick={() => setIsProfileModalOpen(true)}
              className="px-5 py-2 bg-[#00B87A] hover:bg-[#00a36c] text-white text-xs font-bold rounded-xl shadow-sm cursor-pointer transition active:scale-95 flex items-center gap-1.5"
            >
              <UserCheck className="w-3.5 h-3.5 stroke-[2.2]" />
              Manage Shift Profile
            </button>
          </div>

          {/* Billing & Subscription Card */}
          {state.currentUser.role === 'Manager' && (
            <div className="bg-white border border-neutral-200 p-4 rounded-3xl shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="space-y-0.5">
                <span className="text-xs font-mono font-bold text-neutral-400 uppercase tracking-widest flex items-center gap-1.5">
                  <CreditCard className="w-3.5 h-3.5 text-amber-500" /> Billing & Subscriptions
                </span>
                <p className="text-[11px] text-neutral-500 font-medium">Verify payment statuses, upload transfer receipts, print tax-compliant invoices, and view manual subscriptions.</p>
              </div>
              <div className="flex flex-wrap gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsBillingModalOpen(true)}
                  className="px-4 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 text-xs font-bold rounded-xl shadow-sm cursor-pointer transition active:scale-95 flex items-center gap-1.5 border border-[#e5e5e5]"
                >
                  <CreditCard className="w-3.5 h-3.5 stroke-[2.2]" />
                  Billing & Plans
                </button>
                <button
                  type="button"
                  onClick={() => setDashboardTab('payment-audit')}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded-xl shadow-sm cursor-pointer transition active:scale-95 flex items-center gap-1.5"
                >
                  <ShieldAlert className="w-3.5 h-3.5 stroke-[2.2]" />
                  Audit Payment History
                </button>
              </div>
            </div>
          )}

          {/* Charge Rule Matrix Section */}
          <ChargeMatrixSettings 
            providerConfigs={state.settings?.providerConfigs || []}
            regulatoryConfig={state.settings?.regulatoryConfig || { emtlThreshold: 10000, emtlCharge: 50, vatRate: 0 }}
            onSave={(pConfigs, rConfig) => {
              dispatch({ 
                type: 'UPDATE_SETTINGS', 
                payload: { 
                  providerConfigs: pConfigs,
                  regulatoryConfig: rConfig
                } 
              });
            }}
          />

          {/* Revert Sandbox Seed Records */}
          <div className="bg-white border border-neutral-200 p-4 rounded-3xl shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="space-y-0.5">
              <span className="text-xs font-mono font-bold text-neutral-400 uppercase tracking-widest flex items-center gap-1.5">
                <RotateCcw className="w-3.5 h-3.5 text-red-500" /> Revert Sandbox Seed Records
              </span>
              <p className="text-[11px] text-neutral-500 font-medium">Reset custom employee logs and restore baseline diagnostic transaction receipts.</p>
            </div>
            <button
              type="button"
              onClick={() => {
                if (confirm('Clear custom employee logs and restore baseline diagnostic records?')) {
                  dispatch({ type: 'RESET_DATA' });
                }
              }}
              className="px-5 py-2 bg-red-50 hover:bg-red-100 text-red-600 border border-red-250 text-xs font-bold rounded-xl shadow-xs cursor-pointer transition active:scale-95"
            >
              Reset Terminal Data
            </button>
          </div>
        </>
        )}

        {/* 8. TIMEFRAME HIGHLIGHT PILLED TABS */}
        {dashboardTab === 'pos' && (
        <>
          <div className="flex bg-white border border-neutral-200 p-1.5 rounded-2xl shadow-sm">
            {(['Daily', 'Weekly', 'Monthly', 'Yearly'] as const).map((period) => {
              const isActive = state.activeTimeframe === period;
              return (
                <button
                  key={period}
                  type="button"
                  onClick={() => dispatch({ type: 'SET_TIMEFRAME', payload: period })}
                  className={`flex-1 text-center py-2 rounded-xl text-xs font-extrabold font-mono transition duration-155 cursor-pointer ${
                    isActive 
                      ? 'bg-[#00B87A] text-white shadow-md' 
                      : 'text-neutral-500 hover:text-neutral-800 hover:bg-neutral-50'
                  }`}
                >
                  {period === 'Daily' && '☀️ '}
                  {period === 'Weekly' && '📅 '}
                  {period === 'Monthly' && '🗓️ '}
                  {period === 'Yearly' && '📊 '}
                  {period}
                </button>
              );
            })}
          </div>

          {/* 9. OPAY SECTOR MATRIX METRICS */}
          {activeUser.role === 'Manager' && managerDailyStats && (
            <>
              <ManagerAggregatedStats 
                transactions={authorizedTransactions}
                registeredUsers={teamUsers}
              />
              <RealizedGainHistory stats={summaryOverviews} />
            </>
          )}
          <MetricCards
            profit={activeMetrics.profit}
            volume={activeMetrics.volume}
            totalExpenses={state.expenses.filter(e => {
              const d = new Date(e.timestamp);
              const now = new Date();
              if (state.activeTimeframe === 'Daily') return isSameDay(d, now);
              if (state.activeTimeframe === 'Weekly') return isSameWeek(d, now);
              if (state.activeTimeframe === 'Monthly') return isSameMonth(d, now);
              return isSameYear(d, now);
            }).reduce((acc, e) => acc + e.amount, 0)}
            count={activeMetrics.count}
            averageTxSize={activeMetrics.averageTxSize}
            timeframe={state.activeTimeframe}
            dailyTarget={state.dailyTarget}
            onSetDailyTarget={(val) => dispatch({ type: 'SET_DAILY_TARGET', payload: val })}
            onOpenAddModal={() => {
              if (isPremiumLocked) {
                setIsSubscriptionExpiredDialogOpen(true);
              } else {
                setIsAddModalOpen(true);
              }
            }}
            isManager={activeUser.role === 'Manager'}
            language={state.settings?.language || 'en'}
          />
        </>
        )}

        {/* REPORTS & ANALYTICS DATA VISUALIZATIONS */}
        {dashboardTab === 'reports' && (
        <>
          {/* 10. RECALCULATED MATRIX OVERVIEWS - TIGHT 4-GRID COLUMN FOR COMPARISONS */}
          <BreakdownTable 
            daily={summaryOverviews.daily}
            weekly={summaryOverviews.weekly}
            monthly={summaryOverviews.monthly}
            yearly={summaryOverviews.yearly}
            allTime={summaryOverviews.allTime}
            totalAllTimeCount={authorizedTransactions.length}
          />

          {/* 11. OPAY PROVIDER BREAKDOWN CHART */}
          <ProviderBreakdown 
            transactions={authorizedHistoryTransactions} 
            terminalFeeRate={state.terminalFeeRate}
            settings={state.settings}
          />

          {/* 12. DYNAMIC TREND ANALYTICS */}
          <TrendChart 
            transactions={authorizedHistoryTransactions}
            terminalFeeRate={state.terminalFeeRate}
            chartStyle={state.settings?.chartStyle}
          />
        </>
        )}

        {/* 13. CORE REGISTRATIONS TRANSACTION JOURNAL */}
        {dashboardTab === 'pos' && (
        <div ref={historySectionRef}>
          <TransactionList
            currentUser={state.currentUser}
            transactions={authorizedHistoryTransactions}
            historyFilter={state.historyFilter}
            onSetHistoryFilter={(f) => dispatch({ type: 'SET_HISTORY_FILTER', payload: f })}
            onDeleteTransaction={handleDeleteTransaction}
            onEditTransaction={setEditingTransaction}
            onViewReceipt={setSelectedReceiptTx}
            onUpdateTransaction={handleUpdateTransaction}
            onBulkDeleteTransactions={handleBulkDeleteTransactions}
            onBulkUpdateTransactions={handleBulkUpdateTransactions}
            settings={state.settings}
            onOpenSettings={() => setIsSettingsModalOpen(true)}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            typeFilter={typeFilter}
            setTypeFilter={setTypeFilter}
            providerFilter={providerFilter}
            setProviderFilter={setProviderFilter}
          />
        </div>
        )}

        {/* ADMIN PRICING AUDIT VIEW */}
        {dashboardTab === 'audit' && isSuperAdmin && (
          <AdminPricingAudit settings={state.settings} />
        )}

        {/* PRICING RULE MANAGER VIEW */}
        {dashboardTab === 'pricing' && (
          <PricingRuleManager 
            currentUser={activeUser} 
            settings={state.settings} 
            initialProvider={pricingInitialFilter?.provider}
            initialType={pricingInitialFilter?.type}
            isSuperAdmin={isSuperAdmin}
          />
        )}

        {/* AUDIT PAYMENT HISTORY VIEW */}
        {dashboardTab === 'payment-audit' && isSaaSAdmin && (
          <AuditPaymentHistory currentUser={activeUser} onBack={() => setDashboardTab('pos')} />
        )}

      </main>

      {/* 15. PERSISTENT FLOATING BOTTOM NAV BAR - EXTREMELY HIGH FIDELITY TO OPAY FOR MOBILE & DESKTOP DOCK */}
      <footer className="fixed bottom-0 left-0 right-0 z-45 bg-white border-t border-neutral-200 py-2 shadow-lg">
        <div className="max-w-md mx-auto px-4 flex items-center justify-between text-center select-none text-[10px] text-neutral-400 font-bold">
          
          <button 
            type="button"
            onClick={() => alert("Already viewing OPay Manager Home screen")}
            className="flex-1 flex flex-col items-center gap-1 text-[#00B87A] transition-transform duration-75 active:scale-95 cursor-pointer"
          >
            <Smartphone className="w-5 h-5 text-[#00B87A]" />
            <span>Home</span>
          </button>
          
          <button 
            type="button"
            onClick={() => openWithPreset('Withdrawal')}
            className="flex-1 flex flex-col items-center gap-1 hover:text-[#00B87A] transition-transform duration-75 active:scale-95 cursor-pointer"
          >
            <ArrowDownToLine className="w-5 h-5" />
            <span>Withdraw</span>
          </button>

          <button 
            type="button"
            onClick={() => {
              if (isPremiumLocked) {
                setIsSubscriptionExpiredDialogOpen(true);
                return;
              }
              setIsAddModalOpen(true);
              setPreselectedFormType('Withdrawal');
            }}
            className="relative -top-6 bg-gradient-to-tr from-[#00b87a] to-emerald-400 text-white rounded-full p-3.5 shadow-xl transition-transform active:scale-95 cursor-pointer border-4 border-neutral-100 shrink-0"
          >
            <Plus className="w-6 h-6 stroke-[3]" />
          </button>

          <button 
            type="button"
            onClick={() => setIsProfileModalOpen(true)}
            className="flex-1 flex flex-col items-center gap-1 hover:text-[#00B87A] transition-transform duration-75 active:scale-95 cursor-pointer"
            title="View and Edit My Profile"
          >
            <UserIcon className="w-5 h-5" />
            <span>Profile</span>
          </button>
          
          <button 
            type="button"
            onClick={() => scrollToRef(historySectionRef)}
            className="flex-1 flex flex-col items-center gap-1 hover:text-[#00B87A] transition-transform duration-75 active:scale-95 cursor-pointer"
          >
            <FileSpreadsheet className="w-5 h-5" />
            <span>Journals</span>
          </button>

          {activeUser.role === 'Manager' && (
            <button 
              type="button"
              onClick={() => setIsSettingsModalOpen(true)}
              className="flex-1 flex flex-col items-center gap-1 hover:text-[#00B87A] transition-transform duration-75 active:scale-95 cursor-pointer"
              title="Branding, Fee and Terminal Settings"
            >
              <Settings className="w-5 h-5" />
              <span>Settings</span>
            </button>
          )}



        </div>
      </footer>

      {/* 16. DETAILED TRANSACTION DIALOG FORM modal */}
      {isAddModalOpen && (
        <TransactionForm
          currentUser={state.currentUser}
          availableEmployees={availableEmployees}
          terminalFeeRate={state.terminalFeeRate}
          initialType={preselectedFormType}
          initialMode={preselectedMode}
          onSave={(tx) => {
            if (Array.isArray(tx)) {
              tx.forEach(t => handleAddTransaction(t));
            } else {
              handleAddTransaction(tx);
            }
            setIsAddModalOpen(false);
          }}
          onClose={() => setIsAddModalOpen(false)}
          settings={state.settings}
          posTerminals={filteredPosTerminals}
        />
      )}

      {editingTransaction && (
        <TransactionForm
          currentUser={state.currentUser}
          availableEmployees={availableEmployees}
          terminalFeeRate={state.terminalFeeRate}
          initialTransaction={editingTransaction}
          onSave={(tx) => {
            if (Array.isArray(tx)) {
              tx.forEach(t => handleUpdateTransaction(t));
            } else {
              handleUpdateTransaction(tx as Transaction);
            }
            setEditingTransaction(null);
          }}
          onClose={() => setEditingTransaction(null)}
          settings={state.settings}
          posTerminals={filteredPosTerminals}
        />
      )}

      <BillingModal
        isOpen={isBillingModalOpen}
        onClose={() => {
          setIsBillingModalOpen(false);
          setBillingInitialPlan(null);
        }}
        currentUser={state.currentUser}
        showAppNotification={showAppNotification}
        initialSelectedPlan={billingInitialPlan}
      />

      <SubscriptionDetailsModal
        isOpen={isSubscriptionDetailsOpen}
        onClose={() => setIsSubscriptionDetailsOpen(false)}
        activeSubscription={activeSubscription}
        currentUser={state.currentUser}
        usageStats={{
          totalTransactions: authorizedTransactions?.length || 0,
          totalCashiers: teamUsers?.filter(u => u.role === 'Employee')?.length || 0,
          totalTerminals: filteredPosTerminals?.length || 0,
          totalRealizedGain: authorizedTransactions?.reduce((acc: number, t: any) => acc + (t.profit || 0), 0) || 0
        }}
        onOpenBillingModal={() => {
          setBillingInitialPlan(null);
          setIsBillingModalOpen(true);
        }}
        onOpenUploadReceiptModal={() => setIsUploadReceiptModalOpen(true)}
        onRefreshSubscription={handleRefreshSubscription}
        isRefreshingSubscription={isRefreshingSubscription}
      />

      <UploadReceiptModal
        isOpen={isUploadReceiptModalOpen}
        onClose={() => setIsUploadReceiptModalOpen(false)}
        currentUser={state.currentUser}
        showAppNotification={showAppNotification}
        onSuccess={handleRefreshSubscription}
      />

      {/* 14. SUBSCRIPTION EXPIRED DIALOG */}
      <AnimatePresence>
        {isSubscriptionExpiredDialogOpen && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white border border-neutral-200 rounded-3xl max-w-md w-full shadow-2xl p-6 relative overflow-hidden text-center"
            >
              {/* Close Button */}
              <button 
                onClick={() => setIsSubscriptionExpiredDialogOpen(false)}
                className="absolute top-4 right-4 text-neutral-400 hover:text-neutral-600 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="space-y-4">
                {/* Visual Icon */}
                <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto text-red-600 border border-red-100 shadow-sm">
                  <ShieldAlert className="w-8 h-8" />
                </div>

                <div className="space-y-2">
                  <h3 className="text-xl font-extrabold text-neutral-900 tracking-tight">Subscription Expired</h3>
                  <div className="text-sm text-neutral-600 space-y-3 leading-relaxed">
                    <p className="font-semibold text-red-600 bg-red-50 py-1.5 px-3 rounded-full inline-block">
                      Your 14-day free trial or paid subscription has expired.
                    </p>
                    <p className="font-medium text-neutral-700">
                      To continue creating transactions and managing your business, please renew your subscription.
                    </p>
                    <p className="text-xs bg-neutral-50 p-3 rounded-2xl border border-neutral-200/80 text-neutral-600 font-medium">
                      Your data is safe. Your transaction history, reports, Realized Gain, managers, and cashiers remain available in read-only mode.
                    </p>
                  </div>
                </div>

                {/* Buttons Stack */}
                <div className="space-y-2.5 pt-4">
                  <button
                    onClick={() => {
                      setIsSubscriptionExpiredDialogOpen(false);
                      setBillingInitialPlan(null);
                      setIsBillingModalOpen(true);
                    }}
                    className="w-full bg-[#00B87A] hover:bg-[#009E66] text-white py-3 rounded-2xl font-bold text-sm shadow-md transition-all transform hover:-translate-y-0.5 active:translate-y-0 cursor-pointer flex items-center justify-center gap-2"
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>View Subscription Plans</span>
                  </button>

                  <button
                    onClick={() => {
                      setIsSubscriptionExpiredDialogOpen(false);
                      setIsUploadReceiptModalOpen(true);
                    }}
                    className="w-full bg-white border border-neutral-200 hover:border-neutral-300 text-neutral-700 py-2.5 rounded-2xl font-bold text-sm shadow-xs transition-colors cursor-pointer flex items-center justify-center gap-2"
                  >
                    <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                    <span>Upload Payment Receipt</span>
                  </button>

                  <button
                    onClick={() => {
                      const whatsappUrl = `https://wa.me/2348000000000?text=${encodeURIComponent(`Hello POSTRACK Support, I need assistance renewing my subscription for business ${state.settings?.businessName || ''} (${activeUser?.name || ''}).`)}`;
                      window.open(whatsappUrl, '_blank');
                    }}
                    className="w-full bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200/80 py-2.5 rounded-2xl font-bold text-sm transition-colors cursor-pointer flex items-center justify-center gap-2"
                  >
                    <Headphones className="w-4 h-4 text-emerald-600" />
                    <span>Contact Support</span>
                  </button>

                  <button
                    onClick={handleRefreshSubscription}
                    disabled={isRefreshingSubscription}
                    className="w-full bg-neutral-100 hover:bg-neutral-200 text-neutral-700 py-2.5 rounded-2xl font-bold text-sm transition-colors cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {isRefreshingSubscription ? (
                      <div className="w-4 h-4 border-2 border-neutral-500 border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <RotateCcw className="w-4 h-4 text-neutral-500" />
                    )}
                    <span>Refresh Subscription Status</span>
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {isProfileModalOpen && (
        <ProfileModal
          currentUser={activeUser}
          registeredUsers={registeredUsers}
          transactions={state.transactions}
          onRegisterUser={handleRegisterUser}
          onUpdateUserPin={handleUpdateUserPin}
          onUpdateUser={handleUpdateUser}
          onDeleteUser={handleDeleteUser}
          onSwitchUser={(user) => {
            dispatch({ type: 'SWITCH_USER', payload: user });
          }}
          onClose={() => setIsProfileModalOpen(false)}
          isSuperAdmin={isSuperAdmin}
        />
      )}

      {isShiftModalOpen && state.currentUser.role === 'Manager' && (
        <ShiftControlModal
          isOpen={isShiftModalOpen}
          onClose={() => setIsShiftModalOpen(false)}
          currentUser={state.currentUser}
          registeredUsers={registeredUsers}
          currentShiftStats={currentShiftStats}
          onSwitchUser={(user) => {
            dispatch({ type: 'SWITCH_USER', payload: user });
          }}
          onOpenStaffDirectory={() => {
            setIsProfileModalOpen(true);
          }}
        />
      )}

      {isSettingsModalOpen && (
        <SettingsModal
          settings={state.settings!}
          terminalFeeRate={state.terminalFeeRate}
          dailyTarget={state.dailyTarget}
          onUpdateSettings={(newSettings) => {
            dispatch({ type: 'UPDATE_SETTINGS', payload: newSettings });
          }}
          onUpdateTerminalRate={(rate) => {
            dispatch({ type: 'SET_TERMINAL_RATE', payload: rate });
          }}
          onUpdateDailyTarget={(target) => {
            dispatch({ type: 'SET_DAILY_TARGET', payload: target });
          }}
          onResetDatabase={() => {
            dispatch({ type: 'RESET_DATA' });
          }}
          onClearLocalCache={async () => {
            await resetAllData();
            localStorage.clear();
            window.location.reload();
          }}
          onClose={() => setIsSettingsModalOpen(false)}
          isSuperAdmin={isSuperAdmin}
        />
      )}

      {editingEmployeeFromDashboard && (
        <EditEmployeeModal
          employee={editingEmployeeFromDashboard}
          onUpdateUser={(updated) => {
            handleUpdateUser(updated);
            setEditingEmployeeFromDashboard(null);
          }}
          onClose={() => setEditingEmployeeFromDashboard(null)}
        />
      )}

      {/* 17. HIGH-FIDELITY DIGITAL E-RECEIPT MODAL (Tailored for OPay, Moniepoint, PalmPay) */}
      {selectedReceiptTx && (() => {
        const provider = selectedReceiptTx.provider;
        const providerTxId = getProviderTransactionNumber(selectedReceiptTx);
        
        // Compute provider-specific sequential serial number
        const providerTxs = state.transactions.filter(t => t.provider === provider);
        const providerIndex = providerTxs.indexOf(selectedReceiptTx);
        const providerSerialNumber = providerTxs.length - providerIndex;

        // Custom theme configurations for dynamic provider branding
        let bgHeader = 'bg-[#00B87A]'; // OPay Green
        let textHeader = 'text-white';
        let circleBg = 'bg-white';
        let circleText = 'text-[#00B87A]';
        let brandChar = 'O';
        let badgeColor = 'bg-emerald-50 text-emerald-700 border-emerald-100';
        let indicatorColor = 'bg-emerald-500 animate-pulse';
        let slipTitle = 'OPay E-Receipt Slip';
        let transactionLabel = 'Session ID (OPay)';
        let accentText = 'text-[#00B87A]';
        let buttonBg = 'bg-[#00B87A] hover:bg-[#00a36c]';
        let containerBorder = 'border-emerald-100';

        if (provider === 'Moniepoint') {
          bgHeader = 'bg-[#0F3B8C]'; // Moniepoint Navy Blue
          circleText = 'text-[#0F3B8C]';
          brandChar = 'M';
          badgeColor = 'bg-blue-50 text-blue-700 border-blue-100';
          indicatorColor = 'bg-blue-600 animate-pulse';
          slipTitle = 'Moniepoint E-Receipt';
          transactionLabel = 'Control Reference No';
          accentText = 'text-blue-600';
          buttonBg = 'bg-[#0F3B8C] hover:bg-[#0d3175]';
          containerBorder = 'border-blue-150';
        } else if (provider === 'PalmPay') {
          bgHeader = 'bg-purple-900'; // PalmPay Deep Purple
          circleText = 'text-purple-900';
          brandChar = 'P';
          badgeColor = 'bg-orange-50 text-orange-750 border-orange-100';
          indicatorColor = 'bg-orange-500 animate-pulse';
          slipTitle = 'PalmPay Certified Slip';
          transactionLabel = 'PalmPay Bill Ref';
          accentText = 'text-orange-600';
          buttonBg = 'bg-orange-600 hover:bg-orange-700';
          containerBorder = 'border-purple-150';
        }

        return (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl w-full max-w-sm sm:max-w-md overflow-hidden shadow-2xl border border-neutral-200 flex flex-col max-h-[90vh]">
              {/* Header branding band with Provider standard color */}
              <div className={`${bgHeader} text-white px-5 py-4 flex justify-between items-center shrink-0 transition-colors duration-300`}>
                <div className="flex items-center gap-2">
                  <div className={`w-7 h-7 rounded-full bg-white ${circleText} flex items-center justify-center font-black text-sm select-none`}>
                    {brandChar}
                  </div>
                  <span className="font-extrabold text-sm tracking-tight">{slipTitle}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedReceiptTx(null)}
                  className="p-1 hover:bg-white/10 rounded-full transition text-white/90 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Receipt Thermal Scroll Structure */}
              <div id="printable-receipt" className="overflow-y-auto p-6 space-y-6 flex-grow bg-neutral-50/50 print:bg-white print:p-0 print:m-0 print:space-y-4">
                
                {/* Receipt Head */}
                <div className="text-center space-y-1">
                  <h3 className="text-lg font-black text-neutral-800 tracking-tight">
                    {state.settings?.businessName || `${provider} Agent Outlet`}
                  </h3>
                  {state.settings?.receiptAddress && (
                    <p className="text-[9px] text-neutral-500 font-medium leading-tight">
                      {state.settings.receiptAddress}
                    </p>
                  )}
                  {state.settings?.receiptPhone && (
                    <p className="text-[9px] text-neutral-400 font-mono">
                      Tel: {state.settings.receiptPhone}
                    </p>
                  )}
                  <p className="text-[10px] font-mono font-medium text-neutral-400 mt-1">OFFICIAL TRANSACTION RECORD</p>
                  <div className={`inline-flex items-center gap-1.5 px-3 py-1 ${badgeColor} border rounded-full text-[10px] font-extrabold font-mono uppercase mt-2 select-none`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${indicatorColor}`} /> Successful
                  </div>
                </div>

                {/* Bounded Receipt Specs */}
                <div className="bg-white border border-neutral-200/70 p-4 rounded-2xl shadow-sm font-mono text-xs space-y-3">
                  <div className="flex justify-between items-start gap-2">
                    <span className="text-neutral-400 text-[10px] uppercase font-bold tracking-wider">{transactionLabel}</span>
                    <div className="flex items-center gap-1.5 text-right">
                      <span className="font-black text-neutral-800 select-all">{providerTxId}</span>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(providerTxId);
                          setCopiedTxId(providerTxId);
                          setTimeout(() => setCopiedTxId(null), 2000);
                        }}
                        className="p-1 hover:bg-neutral-100 rounded text-neutral-400 hover:text-neutral-600 transition flex items-center justify-center"
                        title="Copy transaction ID"
                      >
                        {copiedTxId === providerTxId ? (
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="border-t border-dashed border-neutral-200 pt-2.5 flex justify-between">
                    <span className="text-neutral-400 text-[10px] uppercase font-bold tracking-wider">Receipt No.</span>
                    <span className="text-neutral-800 font-extrabold text-right">
                      {provider === 'OPay' ? 'OP' : provider === 'Moniepoint' ? 'MP' : 'PP'}-{providerSerialNumber}
                    </span>
                  </div>

                  <div className="border-t border-dashed border-neutral-200 pt-2.5 flex justify-between">
                    <span className="text-neutral-400 text-[10px] uppercase font-bold tracking-wider">Timestamp</span>
                    <span className="text-neutral-800 font-extrabold text-right">
                      {new Date(selectedReceiptTx.timestamp).toLocaleString()}
                    </span>
                  </div>

                  <div className="border-t border-dashed border-neutral-200 pt-2.5 flex justify-between">
                    <span className="text-neutral-400 text-[10px] uppercase font-bold tracking-wider">Operator Shift</span>
                    <span className="text-neutral-800 font-extrabold text-right">{selectedReceiptTx.employeeName}</span>
                  </div>

                  <div className="border-t border-dashed border-neutral-200 pt-2.5 flex justify-between">
                    <span className="text-neutral-400 text-[10px] uppercase font-bold tracking-wider">Category</span>
                    <span className={`font-black text-right ${
                      selectedReceiptTx.type === 'Withdrawal' 
                        ? 'text-orange-600' 
                        : selectedReceiptTx.type === 'Deposit' 
                          ? 'text-blue-600' 
                          : 'text-[#00B87A]'
                    }`}>
                      {selectedReceiptTx.type}
                    </span>
                  </div>

                  <div className="border-t border-dashed border-neutral-200 pt-2.5 flex justify-between">
                    <span className="text-neutral-400 text-[10px] uppercase font-bold tracking-wider">POS Gateway</span>
                    <span className="text-neutral-800 font-extrabold text-right uppercase">{selectedReceiptTx.provider}</span>
                  </div>

                  {selectedReceiptTx.subType && (
                    <div className="border-t border-dashed border-neutral-200 pt-2.5 flex justify-between">
                      <span className="text-neutral-400 text-[10px] uppercase font-bold tracking-wider">Sub-Channel</span>
                      <span className="text-neutral-800 font-extrabold text-right">
                        {selectedReceiptTx.subType === 'SameBank' ? `${provider} Native` : 'Other Banks'}
                      </span>
                    </div>
                  )}

                  {selectedReceiptTx.destinationBank && (
                    <div className="border-t border-dashed border-neutral-200 pt-2.5 flex justify-between">
                      <span className="text-neutral-400 text-[10px] uppercase font-bold tracking-wider">
                        {selectedReceiptTx.type === 'Airtime' ? 'Telco Network' : 'Destination Bank'}
                      </span>
                      <span className="text-neutral-800 font-extrabold text-right uppercase">
                        {selectedReceiptTx.destinationBank}
                      </span>
                    </div>
                  )}

                  {(selectedReceiptTx.customerName || selectedReceiptTx.accountName || selectedReceiptTx.accountNumber || selectedReceiptTx.customerPhone) && (
                    <div className="border-t border-dashed border-neutral-200 pt-2.5 space-y-2">
                      <span className="text-neutral-400 text-[10px] uppercase font-bold tracking-wider block mb-1">Customer Information</span>
                      <div className="bg-neutral-50/50 rounded-xl p-2.5 border border-neutral-100 space-y-1.5">
                        <div className="flex justify-between items-center">
                          <span className="text-neutral-400 text-[9px] uppercase font-bold">Name</span>
                          <span className="text-neutral-800 font-black text-right uppercase truncate max-w-[200px]">{selectedReceiptTx.customerName || selectedReceiptTx.accountName || '---'}</span>
                        </div>
                        {selectedReceiptTx.accountNumber && (
                          <div className="flex justify-between items-center">
                            <span className="text-neutral-400 text-[9px] uppercase font-bold">Account</span>
                            <span className="text-neutral-800 font-black font-mono text-right">{selectedReceiptTx.accountNumber}</span>
                          </div>
                        )}
                        {selectedReceiptTx.customerPhone && (
                          <div className="flex justify-between items-center">
                            <span className="text-neutral-400 text-[9px] uppercase font-bold">Phone</span>
                            <span className="text-neutral-800 font-black font-mono text-right">{selectedReceiptTx.customerPhone}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="border-t border-neutral-200 pt-3 flex justify-between items-center text-sm">
                    <span className="text-neutral-500 font-sans font-bold">Transaction Amount</span>
                    <span className="font-extrabold text-neutral-900 font-mono text-base">
                      {formatNaira(selectedReceiptTx.amount)}
                    </span>
                  </div>

                  <div className="border-t border-dashed border-neutral-200 pt-2.5 flex justify-between items-center text-[11px]">
                    <span className="text-neutral-400 uppercase font-bold tracking-wider">Cut Charged</span>
                    <span className={`font-extrabold ${accentText}`}>{formatNaira(selectedReceiptTx.customerFee)}</span>
                  </div>

                  <div className="border-t border-dashed border-neutral-200 pt-2.5 flex justify-between items-center text-[11px]">
                    <span className="text-neutral-400 uppercase font-bold tracking-wider">Terminal Base Cost</span>
                    <span className="font-extrabold text-red-500">-{formatNaira(selectedReceiptTx.terminalFee)}</span>
                  </div>

                  {selectedReceiptTx.cbnCharge && selectedReceiptTx.cbnCharge > 0 ? (
                    <div className="border-t border-dashed border-neutral-200 pt-2.5 flex justify-between items-center text-[11px]">
                      <span className="text-neutral-400 uppercase font-bold tracking-wider">CBN EMTL Levy</span>
                      <span className="font-extrabold text-red-500">-{formatNaira(selectedReceiptTx.cbnCharge)}</span>
                    </div>
                  ) : null}

                  <div className="border-t border-neutral-200 pt-3 flex justify-between items-center text-sm bg-neutral-50 -mx-4 -mb-4 p-4 rounded-b-2xl">
                    <span className="text-neutral-800 font-sans font-black">Net Earnings Gain</span>
                    <span className={`font-black ${accentText} font-mono text-sm sm:text-base`}>
                      {formatNaira(selectedReceiptTx.profit)}
                    </span>
                  </div>
                </div>

                {/* Notes block if present */}
                {selectedReceiptTx.notes && (
                  <div className="bg-amber-50 border border-amber-200 p-3.5 rounded-2xl space-y-1">
                    <span className="text-[10px] font-mono font-extrabold uppercase tracking-wider text-amber-700">Audit Notes</span>
                    <p className="text-xs text-neutral-700 font-semibold leading-relaxed italic">
                      "{selectedReceiptTx.notes}"
                    </p>
                  </div>
                )}

                {/* QR Code Verification */}
                <div className="flex flex-col items-center justify-center p-4 bg-white border border-neutral-100 rounded-2xl shadow-sm space-y-2">
                  <div className="p-2 bg-white rounded-xl shadow-xs border border-neutral-100">
                    <QRCodeSVG 
                      value={`https://verify.pos.app/receipt/${providerTxId}`}
                      size={100}
                      level="Q"
                      includeMargin={false}
                    />
                  </div>
                  <div className="text-center">
                    <span className="block text-[10px] font-bold text-neutral-800 tracking-tight uppercase">Scan to Verify</span>
                    <span className="block text-[9px] font-mono text-neutral-400 mt-0.5 break-all max-w-[200px]">Ref: {providerTxId}</span>
                  </div>
                </div>

                {/* Custom Branded Footer Note */}
                {state.settings?.receiptFooter && (
                  <p className={`text-[9.5px] ${accentText} font-bold leading-normal text-center bg-neutral-50 p-2.5 rounded-xl border border-dashed border-neutral-200`}>
                    {state.settings.receiptFooter}
                  </p>
                )}

                {/* Safety notice disclaimer */}
                <p className="text-[9px] text-neutral-400 font-mono font-bold leading-normal text-center bg-neutral-100 p-2.5 rounded-xl border border-neutral-200/50">
                  This transaction record is locked securely. To correct discrepancies, consult with shift managers.
                </p>

              </div>

              {/* Footer Buttons Actions */}
              <div className="bg-neutral-100 border-t border-neutral-200 p-4 px-5 flex gap-3 select-none shrink-0 print-hide">
                <button
                  type="button"
                  onClick={() => {
                    window.print();
                  }}
                  className={`flex-1 py-3 ${buttonBg} text-white rounded-2xl text-xs font-black transition cursor-pointer active:scale-95 text-center shadow-md`}
                >
                  Print Slip
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedReceiptTx(null)}
                  className="flex-1 py-3 bg-white hover:bg-neutral-50 border border-neutral-250 text-neutral-600 rounded-2xl text-xs font-bold transition cursor-pointer active:scale-95 text-center"
                >
                  Close Receipt
                </button>
              </div>
            </div>
          </div>
        );
      })()}



      {isReconCalcOpen && (
        <CashierReconciliationCalculator 
          onClose={() => setIsReconCalcOpen(false)}
          onSave={(data) => {
            showAppNotification('Profit Calculation saved successfully.', 'success');
          }}
        />
      )}

      {appNotification && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[200] animate-fade-in flex items-center justify-center pointer-events-none">
          <div className={`px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-3 border ${
            appNotification.type === 'error' ? 'bg-red-50 border-red-200 text-red-700' :
            appNotification.type === 'info' ? 'bg-blue-50 border-blue-200 text-blue-700' :
            'bg-[#00B87A]/10 border-[#00B87A]/30 text-[#00B87A]'
          }`}>
            <p className="text-sm font-bold tracking-tight">{appNotification.message}</p>
          </div>
        </div>
      )}

      {/* Direct Partial Debt Settlement Modal (Carousel Triggered) */}
      {carouselSettlingTx && (
        <div className="fixed inset-0 bg-black/65 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-in fade-in duration-200 overflow-y-auto">
          <div className="bg-white text-neutral-800 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-5 relative border border-neutral-100 animate-in slide-in-from-bottom-4 duration-250">
            {/* Close Button */}
            <button
              type="button"
              onClick={() => setCarouselSettlingTx(null)}
              className="absolute right-4 top-4 p-1.5 rounded-full bg-neutral-100 text-neutral-500 hover:text-neutral-800 transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Header */}
            <div className="space-y-1 pr-6">
              <span className="text-[10px] bg-amber-100 text-amber-800 font-mono font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full">
                Quick Debt Settle
              </span>
              <h3 className="text-lg font-extrabold text-neutral-900 tracking-tight flex items-center gap-1.5 mt-1">
                Settle Deferred Charge
              </h3>
              <p className="text-xs text-neutral-500">
                Record a partial or full payment for this customer's pending debt.
              </p>
            </div>

            {/* Debtor Snapshot Panel */}
            <div className="bg-neutral-50 border border-neutral-200/60 p-3.5 rounded-2xl space-y-2.5 text-xs text-neutral-700 font-medium">
              <div className="flex justify-between items-center border-b border-neutral-200/50 pb-2">
                <span className="text-neutral-400 uppercase font-mono text-[9px] font-bold">Client / Debtor</span>
                <span className="font-extrabold text-neutral-800">{carouselSettlingTx.customerName || 'Walk-in Client'}</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div>
                  <span className="text-neutral-400 uppercase font-mono text-[8px] block font-bold">Transaction Info</span>
                  <span className="font-bold text-neutral-800">{carouselSettlingTx.type} ({carouselSettlingTx.provider})</span>
                </div>
                <div>
                  <span className="text-neutral-400 uppercase font-mono text-[8px] block font-bold">Tx Amount</span>
                  <span className="font-bold text-neutral-800 font-mono">{formatNaira(carouselSettlingTx.amount)}</span>
                </div>
              </div>
            </div>

            {/* Settlement Calculations & Presets */}
            {(() => {
              const totalTarget = (carouselSettlingTx.originalFeeAmount !== undefined && carouselSettlingTx.originalFeeAmount > 0)
                ? carouselSettlingTx.originalFeeAmount 
                : (carouselSettlingTx.unpaidFeeAmount || carouselSettlingTx.customerFee || 200);
              const prevPaid = carouselSettlingTx.chargesPaidAmount || 0;
              const remainingUnpaid = Math.max(0, totalTarget - prevPaid);
              
              const currentPayment = parseFloat(carouselSettleAmount) || 0;
              const finalOutstanding = Math.max(0, remainingUnpaid - currentPayment);
              const isCompleted = finalOutstanding <= 0.01;

              return (
                <div className="space-y-4">
                  {/* Financial Grid */}
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="bg-neutral-50 border border-neutral-200/50 p-2.5 rounded-xl shadow-inner">
                      <span className="text-[9px] text-neutral-400 font-mono uppercase font-bold block">Total Debt</span>
                      <span className="text-sm font-black text-neutral-800 font-mono">{formatNaira(totalTarget)}</span>
                    </div>
                    <div className="bg-neutral-50 border border-neutral-200/50 p-2.5 rounded-xl shadow-inner">
                      <span className="text-[9px] text-neutral-400 font-mono uppercase font-bold block">Paid Prior</span>
                      <span className="text-sm font-black text-emerald-600 font-mono">{formatNaira(prevPaid)}</span>
                    </div>
                    <div className="bg-neutral-50 border border-neutral-200/50 p-2.5 rounded-xl shadow-inner">
                      <span className="text-[9px] text-neutral-400 font-mono uppercase font-bold block">Current Bal</span>
                      <span className="text-sm font-black text-red-600 font-mono">{formatNaira(remainingUnpaid)}</span>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="w-full h-2 bg-neutral-100 rounded-full overflow-hidden flex border border-neutral-200/30">
                    {totalTarget > 0 && (
                      <>
                        <div style={{ width: `${(prevPaid / totalTarget) * 100}%` }} className="h-full bg-emerald-500" />
                        <div style={{ width: `${(Math.min(remainingUnpaid, currentPayment) / totalTarget) * 100}%` }} className="h-full bg-emerald-400 animate-pulse" />
                        <div style={{ width: `${(finalOutstanding / totalTarget) * 100}%` }} className="h-full bg-red-100" />
                      </>
                    )}
                  </div>

                  {/* Input field */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center">
                      <label htmlFor="carousel-settle-amount" className="block text-xs font-bold uppercase tracking-wider text-neutral-800 font-mono">
                        💵 Amount Paid Today (₦)
                      </label>
                      <span className="text-[9px] text-neutral-400 font-mono">
                        Max: {formatNaira(remainingUnpaid)}
                      </span>
                    </div>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500 font-mono text-xs">₦</span>
                      <input
                        id="carousel-settle-amount"
                        type="number"
                        value={carouselSettleAmount === '0' ? '' : carouselSettleAmount}
                        onChange={(e) => setCarouselSettleAmount(e.target.value)}
                        className="w-full bg-white border-2 border-emerald-500 focus:border-emerald-600 rounded-xl pl-7 pr-3 py-2 text-neutral-850 font-mono text-sm font-black focus:outline-none focus:ring-2 focus:ring-emerald-500/10"
                        placeholder="Enter amount paid now"
                        max={remainingUnpaid || undefined}
                      />
                    </div>

                    {/* Presets */}
                    {remainingUnpaid > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        <button
                          type="button"
                          onClick={() => setCarouselSettleAmount(Math.round(remainingUnpaid * 0.25).toString())}
                          className="px-2.5 py-1 text-[10px] font-bold font-mono bg-neutral-100 hover:bg-neutral-200 rounded-lg cursor-pointer transition active:scale-95"
                        >
                          25% ({formatNaira(Math.round(remainingUnpaid * 0.25))})
                        </button>
                        <button
                          type="button"
                          onClick={() => setCarouselSettleAmount(Math.round(remainingUnpaid * 0.50).toString())}
                          className="px-2.5 py-1 text-[10px] font-bold font-mono bg-neutral-100 hover:bg-neutral-200 rounded-lg cursor-pointer transition active:scale-95"
                        >
                          50% ({formatNaira(Math.round(remainingUnpaid * 0.50))})
                        </button>
                        <button
                          type="button"
                          onClick={() => setCarouselSettleAmount(Math.round(remainingUnpaid * 0.75).toString())}
                          className="px-2.5 py-1 text-[10px] font-bold font-mono bg-neutral-100 hover:bg-neutral-200 rounded-lg cursor-pointer transition active:scale-95"
                        >
                          75% ({formatNaira(Math.round(remainingUnpaid * 0.75))})
                        </button>
                        <button
                          type="button"
                          onClick={() => setCarouselSettleAmount(remainingUnpaid.toString())}
                          className="px-2.5 py-1 text-[10px] font-black font-mono bg-emerald-100 hover:bg-emerald-200 text-emerald-800 rounded-lg cursor-pointer transition active:scale-95 border border-emerald-200/50"
                        >
                          100% Full ({formatNaira(remainingUnpaid)})
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Settle Details Form */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="block text-[9px] font-bold uppercase tracking-wider text-neutral-400 font-mono">
                        Payment Method
                      </label>
                      <select
                        value={carouselSettleMethod}
                        onChange={(e: any) => setCarouselSettleMethod(e.target.value)}
                        className="w-full bg-white border border-neutral-200 rounded-xl px-2 py-1.5 text-xs font-semibold focus:outline-none"
                      >
                        <option value="Cash">💵 Cash</option>
                        <option value="CardDebit">💳 Card Debit</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="block text-[9px] font-bold uppercase tracking-wider text-neutral-400 font-mono">
                        Note
                      </label>
                      <input
                        type="text"
                        value={carouselSettleNote}
                        onChange={(e) => setCarouselSettleNote(e.target.value)}
                        className="w-full bg-white border border-neutral-200 rounded-xl px-2 py-1.5 text-xs font-semibold focus:outline-none"
                        placeholder="E.g. Paid cash balance"
                      />
                    </div>
                  </div>

                  {/* Outcome Preview Card */}
                  <div className={`p-3 rounded-2xl border text-xs space-y-1 ${
                    isCompleted ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-amber-50 border-amber-200 text-amber-800'
                  }`}>
                    <div className="font-bold flex justify-between">
                      <span>Settle Preview:</span>
                      <span className="font-mono uppercase text-[10px]">{isCompleted ? 'Cleared' : 'Partial'}</span>
                    </div>
                    <p className="text-[10px] opacity-95">
                      {isCompleted 
                        ? `Paying ${formatNaira(currentPayment)} clears this debt in full with 0 balance.` 
                        : `Paying ${formatNaira(currentPayment)} leaves an active remaining debt of ${formatNaira(finalOutstanding)}.`
                      }
                    </p>
                  </div>

                  {/* Settle Action Button */}
                  <div className="grid grid-cols-2 gap-2.5 pt-2">
                    <button
                      type="button"
                      onClick={() => setCarouselSettlingTx(null)}
                      className="py-2.5 px-4 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-bold rounded-xl text-xs font-mono uppercase cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        const originalFee = (carouselSettlingTx.originalFeeAmount !== undefined && carouselSettlingTx.originalFeeAmount > 0)
                          ? carouselSettlingTx.originalFeeAmount 
                          : (carouselSettlingTx.unpaidFeeAmount || carouselSettlingTx.customerFee || 200);
                        
                        const totalPaid = prevPaid + currentPayment;
                        const remaining = Math.max(0, originalFee - totalPaid);
                        const isDone = remaining <= 0.01;

                        const newPaymentRecord = {
                          id: generateId(),
                          date: new Date().toISOString(),
                          amount: currentPayment,
                          collectorName: state.currentUser?.name || 'Cashier',
                          note: carouselSettleNote.trim() || 'Direct settlement from Carousel'
                        };

                        const updatedPayments = [...(carouselSettlingTx.chargePayments || []), newPaymentRecord];

                        const finalCustomerFee = totalPaid;
                        const updatedProfit = finalCustomerFee - carouselSettlingTx.terminalFee - (carouselSettlingTx.cbnCharge || 0);
                        const updatedTotalCustomerCharged = carouselSettleMethod === 'CardDebit' 
                          ? (carouselSettlingTx.amount + finalCustomerFee) 
                          : carouselSettlingTx.amount;

                        if (state.currentUser?.role === 'Employee') {
                          const updatedTx: Transaction = {
                            ...carouselSettlingTx,
                            originalFeeAmount: originalFee,
                            pendingSettlement: {
                              requestedBy: state.currentUser.name,
                              requestedById: state.currentUser.id,
                              requestedAt: new Date().toISOString(),
                              feeMethod: carouselSettleMethod,
                              paidAmount: currentPayment,
                              note: carouselSettleNote.trim() || 'Carousel Settle by Cashier',
                              proposedChargesStatus: isDone ? 'Paid' : 'PartiallyPaid',
                              proposedUnpaidAmount: isDone ? undefined : remaining,
                              proposedTotalPaidSoFar: totalPaid,
                              proposedPaymentRecord: newPaymentRecord
                            }
                          };
                          await handleUpdateTransaction(updatedTx);
                          alert(`📢 Settlement request of ₦${currentPayment.toLocaleString()} for ${carouselSettlingTx.customerName || 'Customer'} submitted! Pending Manager approval.`);
                          setCarouselSettlingTx(null);
                          return;
                        }

                        const updatedTx: Transaction = {
                          ...carouselSettlingTx,
                          customerFee: finalCustomerFee,
                          profit: updatedProfit,
                          totalCustomerCharged: updatedTotalCustomerCharged,
                          feeMethod: carouselSettleMethod,
                          chargesStatus: isDone ? 'Paid' : 'PartiallyPaid',
                          unpaidFeeAmount: isDone ? undefined : remaining,
                          originalFeeAmount: originalFee,
                          chargesPaidAmount: totalPaid,
                          chargePayments: updatedPayments
                        };

                        await handleUpdateTransaction(updatedTx);

                        // Audio chime
                        try {
                          const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
                          if (AudioContextClass) {
                            const ctx = new AudioContextClass();
                            const now = ctx.currentTime;
                            const osc = ctx.createOscillator();
                            const gain = ctx.createGain();
                            osc.type = 'sine';
                            osc.frequency.setValueAtTime(523.25, now);
                            gain.gain.setValueAtTime(0.12, now);
                            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
                            osc.connect(gain);
                            gain.connect(ctx.destination);
                            osc.start(now);
                            osc.stop(now + 0.15);
                          }
                        } catch (e) {}

                        alert(`Successfully recorded payment of ${formatNaira(currentPayment)} for ${carouselSettlingTx.customerName || 'Customer'}!`);
                        setCarouselSettlingTx(null);
                      }}
                      className="py-2.5 px-4 bg-[#00B87A] hover:bg-emerald-600 text-white font-black rounded-xl text-xs font-mono uppercase shadow-md active:scale-95 cursor-pointer flex items-center justify-center"
                    >
                      ✓ Save Payment
                    </button>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      <NetworkAdvisorModal
        isOpen={isNetworkAdvisorOpen}
        onClose={() => setIsNetworkAdvisorOpen(false)}
      />

      {/* Permanent Floating WhatsApp Support Option */}
      <WhatsAppSupportButton
        variant="floating"
        userName={activeUser?.name}
        businessName={state.settings?.businessName}
        phone={activeUser?.phone}
        role={activeUser?.role}
        buttonText="Contact Support"
      />

      {/* 5-SECOND TEMPORARY APPROVAL UNDO TOAST NOTIFICATION FOR MANAGER */}
      {approvalToast && (
        <div className="fixed bottom-6 right-6 z-50 animate-in slide-in-from-bottom-5 duration-300">
          <div className="bg-neutral-900/95 backdrop-blur-md border-2 border-emerald-500/80 text-white rounded-2xl p-4 shadow-2xl flex items-center gap-4 max-w-md">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
              <span className="text-xl animate-bounce">⚡</span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h5 className="text-xs font-black uppercase text-emerald-400 font-mono tracking-wider">
                  Settlement Approved
                </h5>
                <span className="bg-emerald-500/30 text-emerald-300 font-mono font-bold text-[10px] px-2 py-0.5 rounded-full border border-emerald-500/40">
                  {approvalToast.secondsRemaining}s
                </span>
              </div>
              <p className="text-xs font-medium text-neutral-200 truncate mt-0.5">
                {approvalToast.message}
              </p>
            </div>
            <button
              type="button"
              onClick={() => handleReverseTransaction(approvalToast.tx)}
              className="bg-amber-500 hover:bg-amber-400 text-neutral-950 text-xs font-black px-3 py-2 rounded-xl uppercase tracking-wider font-mono transition cursor-pointer active:scale-95 shadow-md shrink-0 flex items-center gap-1"
            >
              <span>↺ UNDO</span>
            </button>
            <button
              type="button"
              onClick={() => {
                if (toastTimerRef.current) clearInterval(toastTimerRef.current);
                setApprovalToast(null);
              }}
              className="text-neutral-400 hover:text-white text-sm font-bold p-1 cursor-pointer shrink-0"
            >
              ✕
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
