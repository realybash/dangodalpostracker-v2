/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Transaction, TransactionType, ProviderType, User, AppSettings, SubTransfer, PosTerminal } from '../types';
import { calculateTerminalFee, calculateCBNCharge, generateId, formatNaira, getRecommendedAgentFee, getCalculatedFinancials, getDefaultPricingProfiles } from '../utils';
import { AudioRecorder } from './AudioRecorder';
import { X, Sparkles, Check, Info, Mic, MicOff, Plus, Trash2, Lock, Unlock, ShieldCheck, AlertTriangle, CreditCard, Smartphone, ArrowRightLeft, Wallet, Landmark, PieChart, Search, Globe, Wifi, Hourglass, BarChart3, User as UserIcon, Cpu, Banknote, Zap, ReceiptText, Scissors } from 'lucide-react';

// @ts-ignore
import moniepointPosImg from '../assets/images/moniepoint_pos_1784102666214.jpg';
// @ts-ignore
import opayPosImg from '../assets/images/opay_pos_1784102682058.jpg';
// @ts-ignore
import palmpayPosImg from '../assets/images/palmpay_pos_1784102696111.jpg';

// Synthesize premium, zero-dependency audible alert triggers using browser's native Web Audio API
export const playStatusSound = (status: 'Success' | 'Pending' | 'Failed') => {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();

    if (status === 'Success') {
      // Modern dual-tone high-fidelity financial success chime (C5 -> G5)
      const now = ctx.currentTime;
      
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(523.25, now); // C5
      gain1.gain.setValueAtTime(0.12, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.15);

      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(783.99, now + 0.1); // G5
      gain2.gain.setValueAtTime(0.12, now + 0.1);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.1);
      osc2.stop(now + 0.35);
    } else if (status === 'Pending') {
      // Pleasant subtle mid-tone dual soft clicking/tap trigger for pending state
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(440, now); // A4
      gain.gain.setValueAtTime(0.06, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.12);
    } else if (status === 'Failed') {
      // Low-frequency cautionary buzz/warning tone (descending sawtooth frequency + triangle)
      const now = ctx.currentTime;
      
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sawtooth';
      osc1.frequency.setValueAtTime(140, now);
      osc1.frequency.linearRampToValueAtTime(80, now + 0.35); // Descending pitch
      gain1.gain.setValueAtTime(0.15, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.37);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.37);

      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(133, now); // Slightly dissonant frequency
      gain2.gain.setValueAtTime(0.1, now);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now);
      osc2.stop(now + 0.3);
    }
  } catch (e) {
    console.warn("Web Audio API warning: context was blocked or not supported", e);
  }
};

export const BANK_OPTIONS = [
  { id: 'Moniepoint', title: 'Moniepoint', abbrev: 'MPN', color: 'border-blue-100 text-blue-800 bg-white hover:bg-blue-50', activeColor: 'bg-blue-600 border-blue-600 text-white shadow-sm', logoBg: 'bg-blue-600 text-white' },
  { id: 'OPay', title: 'OPay', abbrev: 'OPY', color: 'border-emerald-100 text-emerald-800 bg-white hover:bg-emerald-50', activeColor: 'bg-[#00B87A] border-[#00B87A] text-white shadow-sm', logoBg: 'bg-[#00B87A] text-white' },
  { id: 'PalmPay', title: 'PalmPay', abbrev: 'PAL', color: 'border-orange-100 text-orange-800 bg-white hover:bg-orange-50', activeColor: 'bg-orange-500 border-orange-500 text-white shadow-sm', logoBg: 'bg-orange-500 text-white' },
  { id: 'Access Bank', title: 'Access Bank', abbrev: 'ACC', color: 'border-orange-100 text-orange-800 bg-white hover:bg-orange-50', activeColor: 'bg-orange-600 border-orange-600 text-white shadow-sm', logoBg: 'bg-orange-600 text-white' },
  { id: 'GTBank', title: 'GTBank', abbrev: 'GTB', color: 'border-amber-100 text-amber-800 bg-white hover:bg-amber-50', activeColor: 'bg-amber-600 border-amber-600 text-white shadow-sm', logoBg: 'bg-amber-600 text-white' },
  { id: 'Zenith Bank', title: 'Zenith Bank', abbrev: 'ZEN', color: 'border-red-100 text-red-800 bg-white hover:bg-red-50', activeColor: 'bg-red-600 border-red-600 text-white shadow-sm', logoBg: 'bg-red-600 text-white' },
  { id: 'UBA', title: 'UBA', abbrev: 'UBA', color: 'border-red-100 text-red-800 bg-white hover:bg-red-50', activeColor: 'bg-red-700 border-red-700 text-white shadow-sm', logoBg: 'bg-red-700 text-white' },
  { id: 'First Bank', title: 'First Bank', abbrev: 'FBN', color: 'border-yellow-100 text-yellow-800 bg-white hover:bg-yellow-50', activeColor: 'bg-amber-700 border-amber-700 text-white shadow-sm', logoBg: 'bg-amber-700 text-white' },
  { id: 'Union Bank', title: 'Union Bank', abbrev: 'UBN', color: 'border-sky-100 text-sky-800 bg-white hover:bg-sky-50', activeColor: 'bg-sky-500 border-sky-500 text-white shadow-sm', logoBg: 'bg-sky-500 text-white' },
  { id: 'Fidelity Bank', title: 'Fidelity Bank', abbrev: 'FID', color: 'border-blue-100 text-blue-800 bg-white hover:bg-blue-50', activeColor: 'bg-blue-800 border-blue-800 text-white shadow-sm', logoBg: 'bg-blue-800 text-white' },
  { id: 'Sterling Bank', title: 'Sterling Bank', abbrev: 'STB', color: 'border-red-100 text-red-800 bg-white hover:bg-red-50', activeColor: 'bg-red-500 border-red-500 text-white shadow-sm', logoBg: 'bg-red-500 text-white' },
  { id: 'Wema Bank', title: 'Wema Bank', abbrev: 'WEM', color: 'border-purple-100 text-purple-800 bg-white hover:bg-purple-50', activeColor: 'bg-purple-600 border-purple-600 text-white shadow-sm', logoBg: 'bg-purple-600 text-white' },
  { id: 'Stanbic IBTC', title: 'Stanbic IBTC', abbrev: 'SIB', color: 'border-blue-100 text-blue-800 bg-white hover:bg-blue-50', activeColor: 'bg-blue-700 border-blue-700 text-white shadow-sm', logoBg: 'bg-blue-700 text-white' },
  { id: 'EcoBank', title: 'EcoBank', abbrev: 'ECO', color: 'border-teal-100 text-teal-800 bg-white hover:bg-teal-50', activeColor: 'bg-teal-600 border-teal-600 text-white shadow-sm', logoBg: 'bg-teal-600 text-white' },
  { id: 'FCMB', title: 'FCMB', abbrev: 'FCM', color: 'border-fuchsia-100 text-fuchsia-800 bg-white hover:bg-fuchsia-50', activeColor: 'bg-fuchsia-700 border-fuchsia-700 text-white shadow-sm', logoBg: 'bg-fuchsia-700 text-white' },
  { id: 'Kuda Bank', title: 'Kuda Bank', abbrev: 'KUD', color: 'border-emerald-100 text-emerald-800 bg-white hover:bg-emerald-50', activeColor: 'bg-emerald-950 border-emerald-950 text-white shadow-sm', logoBg: 'bg-emerald-950 text-white' },
  { id: 'Keystone Bank', title: 'Keystone Bank', abbrev: 'KEY', color: 'border-blue-100 text-blue-800 bg-white hover:bg-blue-50', activeColor: 'bg-blue-900 border-blue-900 text-white shadow-sm', logoBg: 'bg-blue-900 text-white' },
  { id: 'Polaris Bank', title: 'Polaris Bank', abbrev: 'POL', color: 'border-indigo-100 text-indigo-800 bg-white hover:bg-indigo-50', activeColor: 'bg-indigo-900 border-indigo-900 text-white shadow-sm', logoBg: 'bg-indigo-900 text-white' },
  { id: 'Providus Bank', title: 'Providus Bank', abbrev: 'PRV', color: 'border-yellow-100 text-yellow-800 bg-white hover:bg-yellow-50', activeColor: 'bg-yellow-600 border-yellow-600 text-white shadow-sm', logoBg: 'bg-yellow-600 text-white' },
  { id: 'Jaiz Bank', title: 'Jaiz Bank', abbrev: 'JAI', color: 'border-green-100 text-green-800 bg-white hover:bg-green-50', activeColor: 'bg-green-700 border-green-700 text-white shadow-sm', logoBg: 'bg-green-700 text-white' },
  { id: 'Taj Bank', title: 'Taj Bank', abbrev: 'TAJ', color: 'border-emerald-100 text-emerald-800 bg-white hover:bg-emerald-50', activeColor: 'bg-emerald-800 border-emerald-800 text-white shadow-sm', logoBg: 'bg-emerald-800 text-white' },
  { id: 'Nomba', title: 'Nomba', abbrev: 'NOM', color: 'border-zinc-100 text-zinc-800 bg-white hover:bg-zinc-50', activeColor: 'bg-zinc-800 border-zinc-800 text-white shadow-sm', logoBg: 'bg-zinc-800 text-white' },
  { id: 'Others', title: 'Others', abbrev: 'OTH', color: 'border-neutral-100 text-neutral-800 bg-white hover:bg-neutral-50', activeColor: 'bg-neutral-700 border-neutral-700 text-white shadow-sm', logoBg: 'bg-neutral-700 text-white' }
];

export const DATA_PLANS: Record<string, { name: string; price: number }[]> = {
  MTN: [
    { name: '100MB (1-Day)', price: 100 },
    { name: '1.5GB (30-Day)', price: 1200 },
    { name: '2GB (30-Day)', price: 1500 },
    { name: '3GB (30-Day)', price: 2000 },
    { name: '5GB (30-Day)', price: 3000 },
    { name: '10GB (30-Day)', price: 5000 },
    { name: '20GB (30-Day)', price: 8000 }
  ],
  Airtel: [
    { name: '100MB (1-Day)', price: 100 },
    { name: '1.5GB (30-Day)', price: 1200 },
    { name: '2GB (30-Day)', price: 1500 },
    { name: '3GB (30-Day)', price: 2000 },
    { name: '5GB (30-Day)', price: 3000 },
    { name: '10GB (30-Day)', price: 5000 },
    { name: '20GB (30-Day)', price: 8000 }
  ],
  Glo: [
    { name: '150MB (1-Day)', price: 100 },
    { name: '1.9GB (30-Day)', price: 1000 },
    { name: '3.5GB (30-Day)', price: 1500 },
    { name: '5.2GB (30-Day)', price: 2000 },
    { name: '10.8GB (30-Day)', price: 3000 },
    { name: '15.6GB (30-Day)', price: 4000 },
    { name: '32.5GB (30-Day)', price: 8000 }
  ],
  '9mobile': [
    { name: '100MB (1-Day)', price: 100 },
    { name: '1.5GB (30-Day)', price: 1200 },
    { name: '2GB (30-Day)', price: 1500 },
    { name: '3GB (30-Day)', price: 2000 },
    { name: '5GB (30-Day)', price: 3000 },
    { name: '10GB (30-Day)', price: 5000 },
    { name: '20GB (30-Day)', price: 8000 }
  ]
};

interface TransactionFormProps {
  currentUser: User;
  availableEmployees: User[];
  terminalFeeRate: number;
  onSave: (newTx: Transaction | Transaction[]) => void;
  onClose: () => void;
  initialType?: TransactionType;
  initialMode?: 'Standard' | 'SplitWithdrawal';
  initialTransaction?: Transaction;
  settings?: AppSettings;
  posTerminals?: PosTerminal[];
}

export function TransactionForm({
  currentUser,
  availableEmployees,
  terminalFeeRate,
  onSave,
  onClose,
  initialType,
  initialMode = 'Standard',
  initialTransaction,
  settings,
  posTerminals
}: TransactionFormProps) {
  const [type, setType] = useState<TransactionType>(
    initialTransaction ? initialTransaction.type : (initialType || settings?.defaultType || 'Withdrawal')
  );
  const [provider, setProvider] = useState<ProviderType>(
    initialTransaction ? initialTransaction.provider : (settings?.defaultProvider || 'OPay')
  );
  const [paymentMethod, setPaymentMethod] = useState<'Card' | 'Transfer'>(
    initialTransaction ? (initialTransaction.paymentMethod || 'Card') : 'Card'
  );
  const [subType, setSubType] = useState<'SameBank' | 'OtherBank'>('OtherBank');
  const [destinationBank, setDestinationBank] = useState<ProviderType>('OPay');
  const [bankSearchQuery, setBankSearchQuery] = useState('');
  const [amount, setAmount] = useState<number>(
    initialTransaction ? initialTransaction.amount : 0
  );
  const [customerFee, setCustomerFee] = useState<number>(
    initialTransaction ? initialTransaction.customerFee : 0
  );
  const [employeeId, setEmployeeId] = useState<string>(
    initialTransaction ? initialTransaction.employeeId : currentUser.id
  );
  const [notes, setNotes] = useState<string>(
    initialTransaction ? (initialTransaction.notes || '') : ''
  );
  const [selectedPlanName, setSelectedPlanName] = useState<string>('');
  const [customerPhone, setCustomerPhone] = useState<string>(
    initialTransaction ? (initialTransaction.customerPhone || '') : ''
  );
  const [customerAddress, setCustomerAddress] = useState<string>(
    initialTransaction ? (initialTransaction.customerAddress || '') : ''
  );
  const [audioNote, setAudioNote] = useState<string>(
    initialTransaction ? (initialTransaction.audioNote || '') : ''
  );
  const [accountName, setAccountName] = useState<string>(
    initialTransaction ? (initialTransaction.accountName || '') : ''
  );
  const [accountNumber, setAccountNumber] = useState<string>(
    initialTransaction ? (initialTransaction.accountNumber || '') : ''
  );
  const [customTimestamp, setCustomTimestamp] = useState<string>(
    initialTransaction ? initialTransaction.timestamp : new Date().toISOString()
  );

  const toLocalDatetimeString = (isoString: string) => {
    try {
      const d = new Date(isoString);
      if (isNaN(d.getTime())) return '';
      const tzOffset = d.getTimezoneOffset() * 60000;
      const localISOTime = new Date(d.getTime() - tzOffset).toISOString().slice(0, 16);
      return localISOTime;
    } catch (e) {
      return '';
    }
  };

  const toISOStringFromLocal = (localValue: string) => {
    try {
      if (!localValue) return new Date().toISOString();
      const d = new Date(localValue);
      if (isNaN(d.getTime())) return new Date().toISOString();
      return d.toISOString();
    } catch (e) {
      return new Date().toISOString();
    }
  };
  const [status, setStatus] = useState<'Success' | 'Pending' | 'Failed'>(
    initialTransaction ? initialTransaction.status : 'Success'
  );
  const [feeMethod, setFeeMethod] = useState<'CardDebit' | 'Cash'>(
    initialTransaction?.feeMethod || 'Cash'
  );
  const [withdrawChargeMode, setWithdrawChargeMode] = useState<'CardAddOn' | 'SeparateCash' | 'DeductFromCash'>(() => {
    if (initialTransaction?.feeMethod === 'CardDebit') return 'CardAddOn';
    if (initialTransaction?.notes?.includes('(Deduct charges from Cash)')) return 'DeductFromCash';
    return 'SeparateCash';
  });

  const [withdrawScenario, setWithdrawScenario] = useState<'CashHandout' | 'CardSwipe'>('CashHandout');

  useEffect(() => {
    if (type === 'Withdrawal' || type === 'Transfer' || type === 'Deposit' || type === 'Airtime' || type === 'Data') {
      if (provider.toLowerCase() === destinationBank.toLowerCase()) {
        setSubType('SameBank');
      } else {
        setSubType('OtherBank');
      }
    } else {
      setSubType('OtherBank');
    }
  }, [provider, destinationBank, type]);

  useEffect(() => {
    if (type === 'Withdrawal') {
      if (withdrawChargeMode === 'CardAddOn') {
        setFeeMethod('CardDebit');
      } else {
        setFeeMethod('Cash');
      }
    }
  }, [withdrawChargeMode, type]);

  const [mode, setMode] = useState<'Standard' | 'SplitWithdrawal'>(
    initialTransaction?.mode || initialMode
  );
  const [subTransfers, setSubTransfers] = useState<SubTransfer[]>(
    initialTransaction?.subTransfers || []
  );
  const [remainingBalance, setRemainingBalance] = useState<number>(
    initialTransaction?.remainingBalance || 0
  );
  const [chargesStatus, setChargesStatus] = useState<'Paid' | 'Unpaid'>(
    initialTransaction ? (initialTransaction.chargesStatus || 'Paid') : 'Paid'
  );
  const [customerName, setCustomerName] = useState<string>(
    initialTransaction ? (initialTransaction.customerName || '') : ''
  );
  const [isFeeWaived, setIsFeeWaived] = useState<boolean>(
    initialTransaction ? initialTransaction.customerFee === 0 : false
  );

  const availableTerminals = useMemo(() => {
    if (posTerminals && posTerminals.length > 0) return posTerminals;
    if (settings?.posTerminals && settings.posTerminals.length > 0) return settings.posTerminals;
    return [];
  }, [posTerminals, settings?.posTerminals]);

  const [selectedTerminalId, setSelectedTerminalId] = useState<string>(() => {
    if (initialTransaction?.terminalId) return initialTransaction.terminalId;
    const terms = (posTerminals && posTerminals.length > 0) ? posTerminals : (settings?.posTerminals || []);
    return terms.find(t => t.isDefault)?.id || terms[0]?.id || '';
  });

  useEffect(() => {
    if (!selectedTerminalId && availableTerminals.length > 0) {
      const def = availableTerminals.find(t => t.isDefault) || availableTerminals[0];
      if (def) setSelectedTerminalId(def.id);
    }
  }, [availableTerminals, selectedTerminalId]);
  const [isNetworkLocked, setIsNetworkLocked] = useState<boolean>(false);
  const [basket, setBasket] = useState<Transaction[]>([]);

  // Unified Web Speech API Integration
  const [isListening, setIsListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const [speechError, setSpeechError] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      setSpeechSupported(true);
      const rec = new SpeechRecognition();
      rec.continuous = false;
      rec.interimResults = false;
      rec.lang = 'en-US';

      rec.onstart = () => {
        setIsListening(true);
        setSpeechError(null);
      };

      rec.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        if (transcript) {
          setNotes((prev) => {
            const trimmed = prev.trim();
            return trimmed ? `${trimmed} ${transcript}` : transcript;
          });
        }
      };

      rec.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        if (event.error === 'not-allowed') {
          setSpeechError('Microphone permission denied.');
        } else {
          setSpeechError(`Error: ${event.error}`);
        }
        setIsListening(false);
      };

      rec.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = rec;
    }

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch (e) {
          // ignore
        }
      }
    };
  }, []);

  const toggleListening = () => {
    if (!recognitionRef.current) return;

    if (isListening) {
      recognitionRef.current.stop();
    } else {
      try {
        setSpeechError(null);
        recognitionRef.current.start();
      } catch (err) {
        console.error('Error starting speech recognition:', err);
        setIsListening(false);
      }
    }
  };
  
  // Custom input triggers
  const [amountInput, setAmountInput] = useState(
    initialTransaction ? initialTransaction.amount.toString() : ''
  );
  const [feeInput, setFeeInput] = useState(
    initialTransaction 
      ? (initialTransaction.chargesStatus === 'Unpaid' 
          ? (initialTransaction.unpaidFeeAmount ?? initialTransaction.customerFee).toString() 
          : initialTransaction.customerFee.toString()) 
      : ''
  );

  useEffect(() => {
    if (mode === 'SplitWithdrawal') {
      const totalSubAmount = subTransfers.reduce((sum, st) => sum + st.amount, 0);
      setRemainingBalance(amount - totalSubAmount - customerFee);
    } else {
      setRemainingBalance(0);
    }
  }, [amount, subTransfers, mode, customerFee]);

  // Sync destination bank to provider if network is locked (Prevents Cashier Fraud/Mismatch)
  useEffect(() => {
    if (isNetworkLocked) {
      setDestinationBank(provider);
    }
  }, [provider, isNetworkLocked]);

  // Helper to format numbers with commas
  const formatNumber = (val: string): string => {
    const parts = val.split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return parts.join('.');
  };

  // Sync state values on input change
  useEffect(() => {
    const parsedAmount = parseFloat(amountInput.replace(/,/g, ''));
    if (!isNaN(parsedAmount)) {
      setAmount(parsedAmount);
    } else {
      setAmount(0);
    }
  }, [amountInput]);

  useEffect(() => {
    const parsedFee = parseFloat(feeInput.replace(/,/g, ''));
    if (!isNaN(parsedFee)) {
      setCustomerFee(parsedFee);
      if (parsedFee > 0 && isFeeWaived) {
        setIsFeeWaived(false);
      }
    } else {
      setCustomerFee(0);
    }
  }, [feeInput, isFeeWaived]);


  // Trigger quick recommendation update
  const applyRecommendedFee = () => {
    setIsFeeWaived(false);
    const effectiveType = ((type === 'Withdrawal' || type === 'Transfer') && paymentMethod === 'Transfer') ? 'Cash Out (Transfer)' : type;
    const financials = getCalculatedFinancials(amount, effectiveType, provider, settings, destinationBank);
    setFeeInput(financials.customerCharge.toString());
    setCustomerFee(financials.customerCharge);
  };

  // Automatic fee calculation removed as requested by user.
  useEffect(() => {
    // Fee remains as manually entered.
  }, []);


  const isFirstRender = useRef(true);

  // Ensure fee is synchronized if fee is waived, but do NOT automatically overwrite fee input when typing the amount to avoid unwanted automatic charges
  useEffect(() => {
    if (initialTransaction && isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    
    if (isFirstRender.current) {
      isFirstRender.current = false;
    }

    if (isFeeWaived) {
      setFeeInput('0');
      setCustomerFee(0);
    }
  }, [isFeeWaived, initialTransaction]);

  const getTransactionObject = (finalStatus: 'Success' | 'Failed'): Transaction => {
    const activeTerminal = availableTerminals?.find(t => t.id === selectedTerminalId);
    
    // Use derived values from the dynamic Withdrawal Calculator
    const { baseCash, cardSwipe, cashHandout } = getWithdrawalDetails();

    const actualAmount = type === 'Withdrawal' ? cardSwipe : amount;

    const effectiveType = (type === 'Withdrawal' && paymentMethod === 'Transfer') ? 'Cash Out (Transfer)' : type;
    const financials = getCalculatedFinancials(actualAmount, effectiveType, provider, settings, destinationBank);

    // Maintain legacy compatibility while populating new fields
    const actualCustomerFee = isFeeWaived ? 0 : (chargesStatus === 'Unpaid' ? 0 : customerFee);
    const unpaidFeeAmount = chargesStatus === 'Unpaid' ? customerFee : undefined;
    
    // Adjust profit based on manual fee overrides
    // We do NOT want waived transactions to reduce or deduct the agent's profit.
    const isUnpaid = chargesStatus === 'Unpaid';
    const actualProfit = isUnpaid 
      ? 0 
      : isFeeWaived
        ? 0 // Waived transactions yield exactly ₦0 profit (company absorbs cost, daily profit does NOT decrease)
        : customerFee - financials.providerCharge - (financials.cbnCharge || 0) + (financials.cashback || 0);

    // We keep the standard realistic provider charge and CBN charge even if profit is floored to 0
    const actualTerminalFee = financials.providerCharge;
    const actualCbnCharge = financials.cbnCharge;

    // Customer card debit / total charged amount
    const totalCustomerCharged = actualAmount;

    // Append notes details based on withdrawal charge mode
    let finalNotes = notes;
    if (type === 'Withdrawal') {
      const modeNote = 
        withdrawChargeMode === 'CardAddOn' ? '(Charges inside Card Debit)' :
        withdrawChargeMode === 'DeductFromCash' ? '(Deduct charges from Cash)' :
        '(Charges paid separately in Cash)';
      const scenarioNote = withdrawScenario === 'CardSwipe' ? '(Specified by Card Swipe Amount)' : '(Specified by Cash Handout Amount)';
      if (!finalNotes.includes(modeNote)) {
        finalNotes = finalNotes ? `${finalNotes} ${modeNote}` : modeNote;
      }
      if (!finalNotes.includes(scenarioNote)) {
        finalNotes = `${finalNotes} ${scenarioNote}`;
      }
    }

    return {
      id: initialTransaction ? initialTransaction.id : generateId(),
      employeeId: employeeId,
      employeeName: [currentUser, ...availableEmployees].find(emp => emp.id === employeeId)?.name || currentUser.name,
      type,
      provider,
      subType,
      amount: type === 'Withdrawal' ? baseCash : amount,
      customerFee: actualCustomerFee,
      terminalFee: actualTerminalFee, 
      cbnCharge: actualCbnCharge, 
      profit: actualProfit, 
      feeMethod: (type === 'Withdrawal' && paymentMethod === 'Transfer') ? 'Transfer' : ((type === 'Withdrawal' && withdrawChargeMode === 'CardAddOn') ? 'CardDebit' : 'Cash'),
      paymentMethod,
      destinationBank: (type === 'Transfer' || type === 'Deposit' || type === 'Airtime' || type === 'Data' || type === 'Withdrawal') ? destinationBank : undefined,
      totalCustomerCharged,
      timestamp: customTimestamp,
      notes: finalNotes.trim() || undefined,
      customerPhone: customerPhone.trim() || undefined,
      accountName: accountName.trim() || undefined,
      accountNumber: accountNumber.trim() || undefined,
      status: finalStatus,
      mode,
      subTransfers,
      remainingBalance,
      chargesStatus,
      customerName: (chargesStatus === 'Unpaid' || chargesStatus === 'PartiallyPaid') ? customerName.trim() : undefined,
      unpaidFeeAmount,
      originalFeeAmount: initialTransaction?.originalFeeAmount !== undefined ? initialTransaction.originalFeeAmount : (chargesStatus === 'Unpaid' ? customerFee : undefined),
      chargesPaidAmount: initialTransaction?.chargesPaidAmount !== undefined ? initialTransaction.chargesPaidAmount : (chargesStatus === 'Unpaid' ? 0 : undefined),
      chargePayments: initialTransaction?.chargePayments !== undefined ? initialTransaction.chargePayments : (chargesStatus === 'Unpaid' ? [] : undefined),
      terminalId: selectedTerminalId || undefined,
      terminalName: activeTerminal?.name || undefined,
      audioNote: audioNote || undefined,
      // Comprehensive Senior Fintech Fields
      customerCharge: actualCustomerFee,
      providerCharge: actualTerminalFee,
      agentProfit: actualProfit,
      netProfit: actualProfit,
      vatAmount: financials.vatAmount,
      cashback: financials.cashback,
      commissionAmount: financials.commissionAmount,
      settlementCharge: financials.settlementCharge,
      merchantProfit: actualProfit,
      balanceBefore: 0, // Should be populated by backend later
      balanceAfter: 0,
      referenceNumber: generateId(), // Placeholder
      rrn: generateId(),
      stan: generateId(),
      createdBy: currentUser.id,
      cashierId: currentUser.role === 'Employee' ? currentUser.id : employeeId,
      ownerId: currentUser.role === 'Manager' ? currentUser.id : (currentUser.ownerId || 'mgr_1'),
      branchName: settings?.businessName || 'Default Branch'
    };
  };

  const executeFinalSave = (finalStatus: 'Success' | 'Failed') => {
    const savedTx = getTransactionObject(finalStatus);
    
    if (basket.length > 0) {
      onSave([...basket, savedTx]);
    } else {
      onSave(savedTx);
    }

    if (!settings || settings.soundEnabled) {
      playStatusSound(finalStatus);
    }

    if (settings?.voiceEnabled && 'speechSynthesis' in window && finalStatus === 'Success') {
      try {
        window.speechSynthesis.cancel();
        const speechMsg = `Successful ${type} of ${type === 'Withdrawal' ? baseCash : amount} Naira recorded.`;
        const utterance = new SpeechSynthesisUtterance(speechMsg);
        utterance.rate = 1.0;
        window.speechSynthesis.speak(utterance);
      } catch (e) {
        console.warn('Speech synthesis skipped', e);
      }
    }
  };

  const handleAddToBasket = () => {
    if (availableTerminals.length > 0 && !selectedTerminalId) {
      alert('⚠️ POS Terminal Required: Please select your active POS terminal before adding to batch.');
      return;
    }

    if (amount <= 0) {
      alert('Transaction amount must be greater than zero');
      return;
    }

    if (customerFee < 0) {
      alert('Fee charged to customer cannot be negative');
      return;
    }

    const tx = getTransactionObject('Success');
    setBasket((prev) => [...prev, tx]);

    // Reset fields for the next entry
    setAmountInput('');
    setFeeInput('');
    setNotes('');
    setCustomerPhone('');
    setCustomerName('');
    setAccountName('');
    setAccountNumber('');
    setIsFeeWaived(false);
    setSubTransfers([]);
    setMode('Standard');
    setChargesStatus('Paid');

    // Chime
    if (!settings || settings.soundEnabled) {
      try {
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.frequency.setValueAtTime(880, audioCtx.currentTime);
        gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.15);
      } catch (e) {}
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (availableTerminals.length > 0 && !selectedTerminalId) {
      alert('⚠️ POS Terminal Required: Please select your active POS terminal before approving this transaction.');
      return;
    }

    if (amount <= 0) {
      alert('Transaction amount must be greater than zero');
      return;
    }

    if (customerFee < 0) {
      alert('Fee charged to customer cannot be negative');
      return;
    }

    if (mode === 'SplitWithdrawal') {
      const totalSent = subTransfers.reduce((sum, st) => sum + st.amount, 0);
      if (totalSent + customerFee > amount) {
        alert(`Distribution error: Total sent (${formatNaira(totalSent)}) plus fees (${formatNaira(customerFee)}) exceeds withdrawal amount (${formatNaira(amount)}).`);
        return;
      }
      
      const hasEmpty = subTransfers.some(st => !st.recipientName || !st.accountNumber || st.amount <= 0);
      if (hasEmpty) {
        alert('Please complete all recipient details and ensure amounts are valid.');
        return;
      }
    }

    // Direct offline submission fallback
    executeFinalSave(status);
  };

  const activeTerminal = availableTerminals?.find(t => t.id === selectedTerminalId);
  const activeFeeRate = (activeTerminal?.terminalFeeRate !== undefined) ? (activeTerminal.terminalFeeRate as any) : terminalFeeRate;
  
  // Derived values for Withdrawal Calculations
  const getWithdrawalDetails = () => {
    const rawAmt = amount;
    const fee = customerFee;
    
    let baseCash = rawAmt;
    let cardSwipe = rawAmt;
    let cashHandout = rawAmt;
    let separateCashFee = 0;
    
    if (type === 'Withdrawal') {
      if (withdrawScenario === 'CashHandout') {
        baseCash = rawAmt;
        if (withdrawChargeMode === 'CardAddOn') {
          cardSwipe = rawAmt + fee;
          cashHandout = rawAmt;
        } else if (withdrawChargeMode === 'SeparateCash') {
          cardSwipe = rawAmt;
          cashHandout = rawAmt;
          separateCashFee = fee;
        } else { // DeductFromCash
          cardSwipe = rawAmt;
          cashHandout = Math.max(0, rawAmt - fee);
        }
      } else { // CardSwipe
        cardSwipe = rawAmt;
        if (withdrawChargeMode === 'CardAddOn') {
          baseCash = Math.max(0, rawAmt - fee);
          cashHandout = baseCash;
        } else if (withdrawChargeMode === 'SeparateCash') {
          baseCash = rawAmt;
          cashHandout = rawAmt;
          separateCashFee = fee;
        } else { // DeductFromCash
          baseCash = rawAmt;
          cashHandout = Math.max(0, rawAmt - fee);
        }
      }
    }
    
    return { baseCash, cardSwipe, cashHandout, separateCashFee };
  };

  const { baseCash, cardSwipe, cashHandout, separateCashFee } = getWithdrawalDetails();

  const liveAmountForTerminalFee = type === 'Withdrawal' ? cardSwipe : amount;
  const effectiveTypeLive = (type === 'Withdrawal' && paymentMethod === 'Transfer') ? 'Cash Out (Transfer)' : type;
  
  // UNIFIED CALCULATION SERVICE CALL
  const liveFinancials = getCalculatedFinancials(liveAmountForTerminalFee, effectiveTypeLive, provider, settings, destinationBank);
  
  const liveTerminalFee = liveFinancials.providerCharge;
  const liveCbnCharge = liveFinancials.cbnCharge;

  // Manual POS Selection Rules: Required if physical terminals are configured
  const isPosRequired = availableTerminals.length > 0;
  const isPosMissing = availableTerminals.length > 0 && !selectedTerminalId;
  const isFormSubmitAllowed = liveFinancials.isConfigured && !isPosMissing;

  const fastAmounts = [5000, 10000, 15000, 20000, 50000];

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-neutral-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white border border-neutral-200 rounded-3xl w-full max-w-lg shadow-2xl overflow-y-auto max-h-[90vh] animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header toolbar banner */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-neutral-100 bg-neutral-50/50">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 bg-emerald-50 text-[#00B87A] rounded-full">
              <Sparkles className="w-5 h-5 stroke-[2]" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-neutral-800 tracking-tight">
                {initialTransaction ? 'Edit POS Receipt' : 'Record POS Receipt'}
              </h3>
              <p className="text-[11px] text-neutral-500 mt-0.5 font-medium">Using Realistic 2024/2025 {provider} market rates</p>
            </div>
          </div>
          <button 
            type="button"
            onClick={onClose}
            className="text-neutral-400 hover:text-neutral-700 p-1.5 rounded-xl hover:bg-neutral-100 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Main Form Grid */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          
          {/* Active Ticket Basket */}
          {basket.length > 0 && (
            <div className="bg-neutral-50 border border-neutral-200 rounded-2xl p-4.5 space-y-3.5 animate-in slide-in-from-top duration-200">
              <div className="flex items-center justify-between border-b border-neutral-250 pb-2.5">
                <span className="text-[11px] font-black text-neutral-850 font-mono flex items-center gap-2 tracking-wide">
                  <span className="flex items-center justify-center w-5 h-5 bg-[#00B87A] text-white rounded-full text-[10px] font-black animate-pulse">
                    {basket.length}
                  </span>
                  ACTIVE BATCH TICKET
                </span>
                <button
                  type="button"
                  onClick={() => setBasket([])}
                  className="text-[10px] font-bold text-red-500 hover:text-red-650 bg-red-50 hover:bg-red-100/65 px-2.5 py-1 rounded-lg transition"
                >
                  Clear Batch
                </button>
              </div>

              {/* Basket list scrollable area */}
              <div className="max-h-[160px] overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                {basket.map((tx, idx) => {
                  const borderColors = {
                    Moniepoint: 'border-l-blue-500',
                    OPay: 'border-l-[#00B87A]',
                    PalmPay: 'border-l-orange-500'
                  };
                  return (
                    <div
                      key={tx.id || idx}
                      className={`bg-white border border-neutral-150 rounded-xl p-2.5 pl-3 border-l-4 ${borderColors[tx.provider]} flex items-center justify-between gap-3.5 text-xs shadow-xs hover:shadow-sm transition`}
                    >
                      <div className="min-w-0 flex-1 space-y-0.5">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className={`text-[9px] font-black uppercase tracking-wider px-1.5 py-0.2 rounded font-mono ${
                            tx.type === 'Withdrawal' ? 'bg-blue-50 text-blue-700' :
                            tx.type === 'Deposit' ? 'bg-emerald-50 text-emerald-700' :
                            'bg-amber-50 text-amber-700'
                          }`}>
                            {tx.type === 'Withdrawal' && '📥 Withdraw'}
                            {tx.type === 'Deposit' && '📤 Money Receive'}
                            {tx.type === 'Transfer' && '💸 Transfer'}
                          </span>
                          <span className="text-[10px] font-bold text-neutral-400 font-mono">
                            {tx.provider}
                          </span>
                        </div>
                        <p className="text-[11px] font-extrabold text-neutral-700 truncate">
                          Amount: <span className="font-mono text-neutral-900">{formatNaira(tx.amount)}</span>
                          {tx.customerFee > 0 && (
                            <span className="text-neutral-450 font-normal ml-1.5">
                              (Fee: <span className="font-mono font-medium">{formatNaira(tx.customerFee)}</span>)
                            </span>
                          )}
                        </p>
                        {tx.notes && (
                          <p className="text-[9px] text-neutral-450 truncate font-sans">
                            📝 {tx.notes}
                          </p>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => setBasket((prev) => prev.filter((_, i) => i !== idx))}
                        className="text-neutral-400 hover:text-red-500 p-1.5 rounded-lg hover:bg-neutral-50 transition cursor-pointer"
                        title="Remove from batch"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>

              {/* Consolidated summary card */}
              <div className="bg-white border border-neutral-200 p-3.5 rounded-xl space-y-2 shadow-xs text-xs font-medium">
                <div className="flex justify-between items-center text-neutral-500">
                  <span>Total POS Withdrawals (Inflow):</span>
                  <span className="font-mono font-bold text-neutral-800">{formatNaira(basket.reduce((sum, t) => t.type === 'Withdrawal' ? sum + t.amount : sum, 0))}</span>
                </div>
                <div className="flex justify-between items-center text-neutral-500">
                  <span>Total Outgoing (Transfers/Money Receive):</span>
                  <span className="font-mono font-bold text-neutral-800">-{formatNaira(basket.reduce((sum, t) => (t.type === 'Transfer' || t.type === 'Deposit') ? sum + t.amount : sum, 0))}</span>
                </div>
                <div className="flex justify-between items-center text-neutral-500 pb-1.5 border-b border-neutral-100">
                  <span>Total Agent Fees (Revenue):</span>
                  <span className="font-mono font-bold text-neutral-800">+{formatNaira(basket.reduce((sum, t) => sum + t.customerFee, 0))}</span>
                </div>

                {/* Net Physical Cash Handout Balance */}
                {(() => {
                  const totWithdrawals = basket.reduce((sum, t) => t.type === 'Withdrawal' ? sum + t.amount : sum, 0);
                  const totOutgoings = basket.reduce((sum, t) => (t.type === 'Transfer' || t.type === 'Deposit') ? sum + t.amount : sum, 0);
                  const totFees = basket.reduce((sum, t) => sum + t.customerFee, 0);

                  const cashFlow = totWithdrawals - totOutgoings - totFees;

                  return (
                    <div className="flex justify-between items-center pt-1.5">
                      <span className="font-bold text-neutral-700">
                        {cashFlow >= 0 ? '👉 Cash Handout to Customer:' : '👈 Collect from Customer:'}
                      </span>
                      <span className={`text-sm font-black font-mono ${cashFlow >= 0 ? 'text-[#00B87A]' : 'text-amber-600'}`}>
                        {formatNaira(Math.abs(cashFlow))}
                      </span>
                    </div>
                  );
                })()}
              </div>

              {/* Complete save button for the batch */}
              <button
                type="button"
                onClick={() => {
                  onSave(basket);
                  setBasket([]);
                  onClose();
                  if (!settings || settings.soundEnabled) {
                    playStatusSound('Success');
                  }
                }}
                className="w-full bg-[#00B87A] hover:bg-emerald-600 text-white font-black py-3 rounded-xl cursor-pointer text-xs shadow-md shadow-[#00B87A]/15 transition flex items-center justify-center gap-1.5"
              >
                <Check className="w-4 h-4 stroke-[3]" />
                Post All {basket.length} Transactions (Save Batch)
              </button>
            </div>
          )}
          
          {/* Operation Mode Selection (Standard or Split) */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-neutral-450 mb-2 font-mono">
              Transaction Mode
            </label>
            <div className="grid grid-cols-2 gap-2">
              {(['Standard', 'SplitWithdrawal'] as const).map((m) => {
                const isSelected = mode === m;
                return (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMode(m)}
                    className={`py-2 px-1 rounded-xl text-xs font-bold border transition cursor-pointer text-center ${
                      isSelected 
                        ? 'bg-emerald-50/60 border-[#00B87A] text-[#00B87A] font-black' 
                        : 'bg-neutral-50 border-neutral-100 text-neutral-500 hover:text-neutral-800 hover:border-neutral-300'
                    }`}
                  >
                    {m === 'Standard' ? 'Standard' : 'Withdraw & Send'}
                  </button>
                );
              })}
            </div>
            {mode === 'SplitWithdrawal' && (
              <p className="mt-1.5 text-[10px] text-[#00B87A] font-bold leading-tight bg-emerald-50 p-2 rounded-lg border border-emerald-100 flex items-center gap-2">
                <Sparkles className="w-3 h-3 shrink-0" />
                Withdraw cash and immediately send to multiple bank accounts.
              </p>
            )}
          </div>

          {/* Active Category Display - Highly friendly and accessible for all operators */}
          <div className="bg-neutral-50/60 border border-neutral-200/50 rounded-2xl p-4 flex items-center justify-between gap-3 shadow-xs animate-in fade-in duration-200">
            <div className="flex items-center gap-3.5">
              <div className={`p-3 rounded-2xl text-white shadow-md ${
                type === 'Withdrawal' ? 'bg-blue-600' :
                type === 'Deposit' ? 'bg-emerald-600' :
                type === 'Transfer' ? 'bg-indigo-600' :
                type === 'Airtime' ? 'bg-purple-600' :
                'bg-violet-600'
              }`}>
                {type === 'Withdrawal' && <Wallet className="w-5.5 h-5.5 stroke-[2]" />}
                {type === 'Deposit' && <Wallet className="w-5.5 h-5.5 stroke-[2]" />}
                {type === 'Transfer' && <Landmark className="w-5.5 h-5.5 stroke-[2]" />}
                {type === 'Airtime' && <Smartphone className="w-5.5 h-5.5 stroke-[2]" />}
                {type === 'Data' && <Globe className="w-5.5 h-5.5 stroke-[2]" />}
              </div>
              <div>
                <span className="block text-[9.5px] font-black uppercase tracking-widest text-neutral-450 font-mono mb-0.5">
                  ACTIVE OPERATION MODE
                </span>
                <h4 className="text-sm sm:text-base font-black text-neutral-800 leading-tight">
                  {type === 'Withdrawal' && '📥 Cash Withdrawal Mode'}
                  {type === 'Deposit' && '📤 Money Receive Mode'}
                  {type === 'Transfer' && '💸 Bank Transfer Mode'}
                  {type === 'Airtime' && '📱 Airtime Sale Mode'}
                  {type === 'Data' && '🌐 Data Bundle Sale Mode'}
                </h4>
              </div>
            </div>
            
            {/* Active Status Pill */}
            <span className={`text-[10px] font-black px-3 py-1 rounded-full font-mono uppercase tracking-wider flex items-center gap-1.5 ${
              type === 'Withdrawal' ? 'bg-blue-100 text-blue-800' :
              type === 'Deposit' ? 'bg-emerald-100 text-emerald-800' :
              type === 'Transfer' ? 'bg-indigo-100 text-indigo-800' :
              type === 'Airtime' ? 'bg-purple-100 text-purple-800' :
              'bg-violet-100 text-violet-800'
            }`}>
              <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
              Selected
            </span>
          </div>

          {/* Active POS Sync: OPay provider rate and settlement rules are locked for this transaction. */}
          {selectedTerminalId && (
            <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-2xl flex items-center gap-3 animate-in fade-in zoom-in-95 duration-200 shadow-sm mb-4">
              <div className="p-2 bg-[#00B87A] text-white rounded-full">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-[11px] font-black text-emerald-800 uppercase tracking-wider flex items-center gap-1.5 font-mono">
                  ACTIVE POS SYNC: {availableTerminals?.find(t => t.id === selectedTerminalId)?.name}
                </h4>
                <p className="text-[10px] text-emerald-700/80 font-medium">
                  {availableTerminals?.find(t => t.id === selectedTerminalId)?.provider} provider rate and settlement rules are locked for this transaction.
                </p>
              </div>
            </div>
          )}
          
          {/* Link Physical POS Device - Premium Interactive Section */}
          {availableTerminals && availableTerminals.length > 0 && (
            <div className={`p-4 rounded-3xl shadow-xl transition-all duration-500 border relative overflow-hidden animate-in fade-in slide-in-from-bottom-4 ${
              isPosMissing 
                ? 'bg-[#FFB000] shadow-amber-200/20 border-amber-400/80 ring-2 ring-amber-500/20' 
                : 'bg-amber-400 p-4 rounded-3xl shadow-xl shadow-amber-200/20 border border-amber-400/50'
            }`}>
              {/* Decorative Background Elements */}
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-2xl"></div>
              <div className="absolute bottom-0 left-0 w-24 h-24 bg-black/5 rounded-full -ml-12 -mb-12 blur-xl"></div>
              
              <div className="flex items-center justify-between mb-3 relative z-10">
                 <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-lg bg-white/20 backdrop-blur-md flex items-center justify-center shadow-sm border border-white/30">
                      <Cpu className="w-3.5 h-3.5 text-neutral-900" />
                    </div>
                    <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-900 font-mono">LINK PHYSICAL POS DEVICE</h3>
                 </div>
                 <div className="flex gap-1">
                    <span className="text-[7px] bg-amber-900/10 text-neutral-900 px-1.5 py-0.5 rounded-md font-black uppercase tracking-widest border border-black/5">REQUIRED</span>
                    {selectedTerminalId ? (
                      <div className="flex items-center gap-1 text-[7px] bg-emerald-900/20 text-emerald-950 px-2 py-0.5 rounded-md font-black uppercase tracking-widest border border-emerald-900/30">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-800 animate-ping"></span>
                        POS LINKED & READY
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 text-[7px] bg-red-900/20 text-red-950 px-2 py-0.5 rounded-md font-black uppercase tracking-widest border border-red-900/30 animate-pulse">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-800 animate-ping"></span>
                        AWAITING SELECTION
                      </div>
                    )}
                 </div>
              </div>

              {/* High visibility alert when POS terminal is not selected */}
              {isPosMissing ? (
                <div className="bg-neutral-900 text-amber-300 text-[10px] font-black font-mono px-3.5 py-2.5 rounded-2xl flex items-center gap-2 mb-3 shadow-lg border border-amber-400/40 animate-pulse relative z-10">
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                  <span className="leading-tight">MANUAL POS SELECTION REQUIRED: Tap a terminal device below to authorize and approve this transaction.</span>
                </div>
              ) : (
                <div className="bg-neutral-900 text-emerald-400 text-[10px] font-black font-mono px-3.5 py-2 rounded-2xl flex items-center justify-between mb-3 shadow-lg border border-emerald-500/30 relative z-10">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span className="leading-tight uppercase font-mono">LINKED: {availableTerminals.find(t => t.id === selectedTerminalId)?.name} ({availableTerminals.find(t => t.id === selectedTerminalId)?.provider})</span>
                  </div>
                  <span className="text-[8px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-md border border-emerald-500/40">READY</span>
                </div>
              )}

              <div className="space-y-2 relative z-10 max-h-[300px] overflow-y-auto pr-1 custom-scrollbar">
                {availableTerminals.map(term => {
                  const isSelected = selectedTerminalId === term.id;
                  return (
                    <button 
                      key={term.id}
                      type="button"
                      onClick={() => {
                        setSelectedTerminalId(term.id);
                        setProvider(term.provider as any);
                        
                        if (!settings || settings.soundEnabled) {
                          playStatusSound('Pending');
                        }
                      }}
                      className={`w-full bg-white rounded-2xl p-3.5 text-left relative overflow-hidden transition-all duration-300 border-2 group active:scale-[0.98] ${
                        isSelected 
                          ? 'border-neutral-900 shadow-2xl shadow-amber-900/20 ring-4 ring-neutral-900/5' 
                          : 'border-transparent hover:border-white/50 hover:bg-neutral-50 shadow-sm'
                      }`}
                    >
                      {/* Selection indicator background for active card */}
                      {isSelected && (
                        <div className="absolute top-0 right-0 w-32 h-32 bg-amber-400/10 rounded-full -mr-16 -mt-16 blur-2xl animate-pulse"></div>
                      )}

                      <div className="flex justify-between items-center mb-2 relative z-10">
                         <div className="flex items-center gap-2">
                            <span className={`text-[8px] px-2 py-0.5 rounded-md font-black uppercase tracking-[0.15em] shadow-sm border ${
                              term.provider === 'OPay' 
                                ? 'bg-[#00B87A] text-white border-emerald-400' 
                                : term.provider === 'Moniepoint'
                                ? 'bg-blue-600 text-white border-blue-400'
                                : 'bg-orange-500 text-white border-orange-400'
                            }`}>
                              {term.provider}
                            </span>
                            <span className="text-[9px] font-mono font-black text-neutral-400 tracking-tighter">S/N: {term.serialNumber || 'N/A'}</span>
                         </div>
                         <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all duration-300 ${
                           isSelected 
                             ? 'border-neutral-900 bg-neutral-900 shadow-lg scale-110' 
                             : 'border-neutral-200 group-hover:border-neutral-300'
                         }`}>
                            {isSelected && <Check className="w-3 h-3 text-white stroke-[3]" />}
                         </div>
                      </div>

                      <h4 className={`text-base font-black uppercase tracking-tighter mb-2 transition-colors ${
                        isSelected ? 'text-neutral-900' : 'text-neutral-500'
                      }`}>
                        {term.name}
                      </h4>

                      <div className="flex justify-between items-center relative z-10">
                         <div className={`text-[9px] font-mono font-black uppercase tracking-widest transition-colors ${
                           isSelected ? 'text-neutral-400' : 'text-neutral-300'
                         }`}>
                            ACCT: <span className={isSelected ? 'text-neutral-900' : 'text-neutral-500'}>{term.posAccountNo || 'N/A'}</span>
                         </div>
                         <div className="flex items-center gap-2">
                            <span className={`w-1.5 h-1.5 rounded-full shadow-sm ${
                              isSelected ? 'bg-[#00B87A] animate-ping' : 'bg-neutral-200'
                            }`}></span>
                            <span className={`text-[8px] font-black uppercase tracking-[0.2em] font-mono transition-colors ${
                              isSelected ? 'text-neutral-900' : 'text-neutral-400'
                            }`}>
                              {isSelected ? 'LINKED ACTIVE' : 'TAP TO LINK'}
                            </span>
                         </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* POS Host Provider Gateways */}
          {availableTerminals && availableTerminals.length > 0 ? (
            <div>
              <div className="flex items-center justify-between mb-2.5">
                <label className="block text-[10px] font-black uppercase tracking-widest text-neutral-500 font-mono flex items-center gap-1.5">
                  <Smartphone className="w-3.5 h-3.5 text-neutral-500 animate-pulse" />
                  <span>POS Terminal Hardware Channel</span>
                </label>
                <span className="text-[8.5px] font-black bg-neutral-100 text-neutral-500 px-2 py-0.5 rounded-md font-mono uppercase tracking-wider">
                  Touch to match your physical device
                </span>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {(['Moniepoint', 'OPay', 'PalmPay'] as const)
                  .filter(pvd => 
                    availableTerminals?.some(t => 
                      t.provider.toLowerCase() === pvd.toLowerCase() ||
                      t.name.toLowerCase().includes(pvd.toLowerCase())
                    )
                  )
                  .map((pvd) => {
                  const isSelected = provider === pvd;
                  // Core branding colors matching true providers
                  const brandColors = {
                    Moniepoint: 'border-blue-500 text-blue-700 bg-blue-50/80 font-black ring-2 ring-blue-500/30 shadow-md scale-[1.04]',
                    OPay: 'border-[#00B87A] text-[#00B87A] bg-emerald-50/80 font-black ring-2 ring-[#00B87A]/30 shadow-md scale-[1.04]',
                    PalmPay: 'border-orange-500 text-orange-600 bg-orange-50/80 font-black ring-2 ring-orange-500/30 shadow-md scale-[1.04]'
                  };
                  
                  const posImages = {
                    Moniepoint: moniepointPosImg,
                    OPay: opayPosImg,
                    PalmPay: palmpayPosImg
                  };

                  const subLabels = {
                    Moniepoint: { text: '🔵 BLUE MACHINE', bg: 'bg-blue-100 text-blue-800' },
                    OPay: { text: '🟢 GREEN MACHINE', bg: 'bg-emerald-100 text-emerald-800' },
                    PalmPay: { text: '🟠 ORANGE MACHINE', bg: 'bg-orange-100 text-orange-800' }
                  };

                  return (
                    <button
                      key={pvd}
                      type="button"
                      onClick={() => {
                        setProvider(pvd);
                        if (availableTerminals && availableTerminals.length > 0) {
                          const matchingTerminal = availableTerminals.find(
                             t => t.provider.toLowerCase() === pvd.toLowerCase() || t.name.toLowerCase().includes(pvd.toLowerCase())
                          );
                          if (matchingTerminal) {
                            setSelectedTerminalId(matchingTerminal.id);
                          } else {
                            setSelectedTerminalId('');
                          }
                        }
                      }}
                      className={`group py-4 px-2 rounded-2xl text-[12px] sm:text-base font-extrabold border transition-all duration-300 cursor-pointer flex flex-col items-center justify-center gap-2 select-none active:scale-95 ${
                        isSelected 
                          ? brandColors[pvd]
                          : 'bg-white border-neutral-200 text-neutral-500 hover:bg-neutral-50 hover:text-neutral-800 hover:border-neutral-300 shadow-sm'
                      }`}
                    >
                      {/* Tiny visual realistic preview */}
                      <div className={`relative w-16 h-16 sm:w-20 sm:h-20 rounded-xl bg-white overflow-hidden border-2 ${
                        isSelected 
                          ? pvd === 'Moniepoint' ? 'border-blue-400 shadow-md' : pvd === 'OPay' ? 'border-emerald-400 shadow-md' : 'border-orange-400 shadow-md'
                          : 'border-neutral-100 shadow-xs'
                      } flex items-center justify-center p-1 group-hover:scale-105 transition-transform duration-200`}>
                        <img 
                          src={posImages[pvd]} 
                          alt={`${pvd} Physical POS`} 
                          className="w-full h-full object-contain rounded-lg"
                          referrerPolicy="no-referrer"
                        />
                        {isSelected && (
                          <div className={`absolute -top-1 -right-1 w-5.5 h-5.5 rounded-full flex items-center justify-center text-white shadow-md border-2 border-white ${
                            pvd === 'Moniepoint' ? 'bg-blue-600' : pvd === 'OPay' ? 'bg-[#00B87A]' : 'bg-orange-500'
                          }`}>
                            <Check className="w-3.5 h-3.5 stroke-[4]" />
                          </div>
                        )}
                      </div>
                      <div className="text-center w-full min-w-0">
                        <span className="block text-[13px] sm:text-[15px] font-black tracking-tight leading-none text-neutral-850">{pvd}</span>
                        <span className={`inline-block mt-1.5 px-1.5 py-0.5 rounded-md text-[8px] sm:text-[9.5px] font-black font-mono tracking-wider ${subLabels[pvd].bg}`}>
                          {subLabels[pvd].text}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Visual Hardware Confirmation Card - Super accessible for non-educated operators */}
              {provider && (provider === 'Moniepoint' || provider === 'OPay' || provider === 'PalmPay') && 
               availableTerminals?.some(t => t.provider.toLowerCase() === provider.toLowerCase() || t.name.toLowerCase().includes(provider.toLowerCase())) && (
                <div className={`mt-3.5 border rounded-2xl p-4 flex items-center gap-4 animate-in fade-in slide-in-from-top-2 duration-150 shadow-sm ${
                  provider === 'Moniepoint' ? 'bg-blue-50/40 border-blue-200/60' :
                  provider === 'OPay' ? 'bg-emerald-50/40 border-emerald-200/60' :
                  'bg-orange-50/40 border-orange-200/60'
                }`}>
                  <div className="relative w-20 h-20 bg-white rounded-2xl border-2 border-neutral-100 flex items-center justify-center p-1 shrink-0 shadow-md">
                    <img 
                      src={provider === 'Moniepoint' ? moniepointPosImg : provider === 'OPay' ? opayPosImg : palmpayPosImg} 
                      alt={`${provider} Active Terminal`} 
                      className="w-full h-full object-contain rounded-xl"
                      referrerPolicy="no-referrer"
                    />
                    <span className={`absolute -bottom-2 -right-1.5 text-[9px] px-2 py-0.5 rounded-full font-black text-white shadow-md border border-white animate-pulse ${
                      provider === 'Moniepoint' ? 'bg-blue-600' : provider === 'OPay' ? 'bg-[#00B87A]' : 'bg-orange-500'
                    }`}>
                      ACTIVE
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className={`w-2 h-2 rounded-full animate-ping ${
                        provider === 'Moniepoint' ? 'bg-blue-500' : provider === 'OPay' ? 'bg-[#00B87A]' : 'bg-orange-500'
                      }`} />
                      <span className="text-[10px] font-extrabold uppercase tracking-widest text-neutral-450 font-mono">
                        MATCHING MACHINE COLOR
                      </span>
                    </div>
                    <h4 className="text-sm sm:text-base font-black text-neutral-800 leading-tight flex items-center gap-1.5">
                      {provider === 'Moniepoint' && <span className="text-blue-600 font-black">🔵 BLUE Moniepoint Machine</span>}
                      {provider === 'OPay' && <span className="text-[#00B87A] font-black">🟢 GREEN OPay Machine</span>}
                      {provider === 'PalmPay' && <span className="text-orange-600 font-black">🟠 ORANGE PalmPay Machine</span>}
                    </h4>
                    <p className="text-[11px] sm:text-xs font-bold text-neutral-500 leading-relaxed mt-1">
                      {provider === 'Moniepoint' && '👉 Pick the BLUE POS machine from the table. Insert customer card and press OK.'}
                      {provider === 'OPay' && '👉 Pick the GREEN POS machine from the table. Insert customer card and press OK.'}
                      {provider === 'PalmPay' && '👉 Pick the ORANGE POS machine from the table. Insert customer card and press OK.'}
                    </p>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-amber-50/90 border border-amber-200 p-4 rounded-2xl flex items-center justify-between gap-3 text-amber-900 shadow-xs my-2">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center shrink-0 border border-amber-300">
                  <AlertTriangle className="w-5 h-5 text-amber-700" />
                </div>
                <div>
                  <h4 className="text-xs font-black font-mono uppercase tracking-wider text-amber-950">
                    POS Terminal Required
                  </h4>
                  <p className="text-[11px] font-bold text-amber-800 mt-0.5">
                    {currentUser?.role === 'Manager'
                      ? <>You must register a POS terminal on the <strong className="font-extrabold text-amber-950">Registered POS Terminals</strong> page before you can record any transactions.</>
                      : <>Ask your Store Manager to register a POS terminal on the <strong className="font-extrabold text-amber-950">Registered POS Terminals</strong> page. Transactions cannot be recorded without a linked terminal.</>
                    }
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Destination Network selection block */}
          <div className="mt-6 mb-2 space-y-3.5">
            {/* Transaction Type Selection Grid */}
            <div className="space-y-2">
              <div className="flex items-center justify-between px-0.5">
                <label className="text-[11px] font-black uppercase tracking-[0.15em] text-neutral-500 font-mono flex items-center gap-2">
                  Transaction Type (What is the Customer Doing?) 🚀
                </label>
              </div>
              <div className="grid grid-cols-5 gap-2">
                {[
                  { id: 'Withdrawal', label: 'Withdrawal', icon: <Wallet className="w-4 h-4" />, activeColor: 'bg-blue-600 border-blue-600 text-white shadow-blue-600/20 shadow-lg' },
                  { id: 'Deposit', label: 'Deposit', icon: <Wallet className="w-4 h-4" />, activeColor: 'bg-emerald-600 border-emerald-600 text-white shadow-emerald-600/20 shadow-lg' },
                  { id: 'Transfer', label: 'Transfer', icon: <Landmark className="w-4 h-4" />, activeColor: 'bg-indigo-600 border-indigo-600 text-white shadow-indigo-600/20 shadow-lg' },
                  { id: 'Airtime', label: 'Airtime', icon: <Smartphone className="w-4 h-4" />, activeColor: 'bg-purple-600 border-purple-600 text-white shadow-purple-600/20 shadow-lg' },
                  { id: 'Data', label: 'Data', icon: <Globe className="w-4 h-4" />, activeColor: 'bg-violet-600 border-violet-600 text-white shadow-violet-600/20 shadow-lg' },
                ].map((t) => {
                  const isActive = type === t.id;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setType(t.id as TransactionType)}
                      className={`flex flex-col items-center justify-center gap-1.5 py-2.5 px-1 rounded-2xl border transition-all duration-300 cursor-pointer ${
                        isActive 
                          ? t.activeColor 
                          : 'bg-neutral-50 border-neutral-100 text-neutral-400 hover:border-neutral-200 hover:bg-neutral-100 hover:text-neutral-600'
                      }`}
                    >
                      {t.icon}
                      <span className="text-[9px] font-black uppercase tracking-tighter font-mono">{t.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center justify-between mb-2 pt-1">
              <label className="block text-xs font-bold uppercase tracking-wider text-neutral-450 font-mono flex items-center gap-1.5">
                {type === 'Withdrawal' && (
                  <>
                    <CreditCard className="w-3.5 h-3.5 text-emerald-500" />
                    <span>ATM Card Issuer Bank</span>
                  </>
                )}
                {type === 'Transfer' && (
                  <>
                    <Landmark className="w-3.5 h-3.5 text-blue-500" />
                    <span>Destination Bank</span>
                  </>
                )}
                {type === 'Deposit' && (
                  <>
                    <Wallet className="w-3.5 h-3.5 text-orange-500" />
                    <span>Money Receive Wallet Destination</span>
                  </>
                )}
                {type === 'Airtime' && (
                  <>
                    <Smartphone className="w-3.5 h-3.5 text-purple-500" />
                    <span>Telecommunication Network</span>
                  </>
                )}
                {type === 'Data' && (
                  <>
                    <Globe className="w-3.5 h-3.5 text-violet-500" />
                    <span>Data Network Operator</span>
                  </>
                )}
              </label>
              {type !== 'Airtime' && type !== 'Data' && (
                <span className="text-[10px] font-mono text-neutral-400 font-bold">
                  Selected: <span className="text-neutral-700 font-extrabold">{destinationBank || 'None'}</span>
                </span>
              )}
            </div>

            {type === 'Airtime' || type === 'Data' ? (
              <div className="space-y-4">
                <div className="grid grid-cols-4 gap-2 animate-in fade-in slide-in-from-top-2 duration-150">
                  {([
                    { id: 'MTN', title: 'MTN', color: 'border-amber-200 text-amber-800 bg-white hover:bg-amber-50', activeColor: 'bg-amber-500 border-amber-500 text-white shadow-md' },
                    { id: 'Airtel', title: 'Airtel', color: 'border-red-200 text-red-800 bg-white hover:bg-red-50', activeColor: 'bg-red-600 border-red-600 text-white shadow-md' },
                    { id: 'Glo', title: 'Glo', color: 'border-green-200 text-green-800 bg-white hover:bg-green-50', activeColor: 'bg-green-600 border-green-600 text-white shadow-md' },
                    { id: '9mobile', title: '9mobile', color: 'border-emerald-200 text-emerald-800 bg-white hover:bg-emerald-50', activeColor: 'bg-emerald-600 border-emerald-600 text-white shadow-md' }
                  ] as const).map((opt) => {
                    const isActive = destinationBank === opt.id;

                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => {
                          setDestinationBank(opt.id as any);
                          setSelectedPlanName('');
                        }}
                        className={`p-2 sm:p-3 rounded-xl border text-center transition-all duration-155 cursor-pointer flex flex-col items-center justify-center select-none active:scale-[0.98] min-h-[70px] ${
                          isActive 
                            ? `${opt.activeColor} scale-[1.02] font-bold ring-2 ring-offset-1 ring-amber-500` 
                            : `${opt.color}`
                        }`}
                      >
                        <div className="flex items-center gap-1.5 mb-1.5">
                          <div className={`w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold ${
                            isActive ? 'bg-white text-black' : 
                            opt.id === 'MTN' ? 'bg-amber-500 text-white' :
                            opt.id === 'Airtel' ? 'bg-red-600 text-white' :
                            opt.id === 'Glo' ? 'bg-green-600 text-white' : 'bg-emerald-600 text-white'
                          }`}>
                            {opt.id[0]}
                          </div>
                          <span className="text-[11px] sm:text-sm font-extrabold tracking-tight leading-tight">{opt.title}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {type === 'Data' && (
                  <div className="animate-in fade-in slide-in-from-top-3 duration-200 bg-neutral-50/50 border border-neutral-200/60 p-3.5 rounded-2xl">
                    <p className="text-[10px] font-mono font-black text-neutral-400 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                      <Wifi className="w-3.5 h-3.5 text-violet-500" />
                      <span>Select Data Bundle Plan</span>
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-[145px] overflow-y-auto pr-1.5 scrollbar-thin scrollbar-thumb-neutral-300">
                      {(DATA_PLANS[destinationBank as string] || DATA_PLANS['MTN']).map((plan) => {
                        const isPlanActive = selectedPlanName === plan.name;
                        return (
                          <button
                            key={plan.name}
                            type="button"
                            onClick={() => {
                              setSelectedPlanName(plan.name);
                              setAmountInput(plan.price.toString());
                              setNotes(`${destinationBank} Data Bundle: ${plan.name}`);
                            }}
                            className={`p-2.5 rounded-xl border text-left transition-all duration-150 cursor-pointer flex flex-col justify-between select-none active:scale-[0.98] min-h-[52px] ${
                              isPlanActive
                                ? 'bg-violet-50 border-violet-500 text-violet-900 ring-2 ring-offset-1 ring-violet-500 scale-[1.01] font-bold'
                                : 'bg-white border-neutral-200 hover:border-violet-300 text-neutral-700 hover:bg-neutral-50'
                            }`}
                          >
                            <span className="text-[10px] sm:text-[11px] font-extrabold leading-tight block truncate w-full">{plan.name}</span>
                            <span className={`text-[10px] font-mono font-black block mt-1 ${isPlanActive ? 'text-violet-600' : 'text-neutral-500'}`}>
                              ₦{plan.price.toLocaleString()}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-neutral-50 border border-neutral-200/60 rounded-2xl p-3 animate-in fade-in slide-in-from-top-2 duration-150">
                {/* Search query input block */}
                <div className="relative mb-3 flex items-center bg-white rounded-xl px-3 py-2 border border-neutral-200 shadow-sm focus-within:ring-2 focus-within:ring-[#00B87A] focus-within:border-transparent transition-all">
                  <Search className="w-4 h-4 text-neutral-400 mr-2 shrink-0" />
                  <input
                    type="text"
                    placeholder="Search Bank/ATM Card (e.g. GTB, Zenith, Access, Kuda...)"
                    value={bankSearchQuery}
                    onChange={(e) => setBankSearchQuery(e.target.value)}
                    className="w-full bg-transparent border-none text-xs font-bold text-neutral-700 placeholder-neutral-400 focus:outline-none"
                  />
                  {bankSearchQuery && (
                    <button
                      type="button"
                      onClick={() => setBankSearchQuery('')}
                      className="text-[10px] bg-neutral-100 hover:bg-neutral-200 text-neutral-500 font-black px-2 py-0.5 rounded-lg cursor-pointer transition"
                    >
                      CLEAR
                    </button>
                  )}
                </div>

                {/* Search Results / All Banks Section */}
                <div>
                  <p className="text-[9.5px] font-mono font-black text-neutral-400 uppercase tracking-wider mb-1.5 flex items-center justify-between gap-1">
                    <span>{bankSearchQuery ? `🔍 Search Results (${BANK_OPTIONS.filter(b => b.title.toLowerCase().includes(bankSearchQuery.toLowerCase())).length})` : '🏦 Supported Banks'}</span>
                    {!bankSearchQuery && <span className="text-[8.5px] text-neutral-450 normal-case font-sans font-bold bg-neutral-150 px-1.5 py-0.5 rounded-md animate-pulse">(Scroll to find your bank)</span>}
                  </p>
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5 max-h-[145px] overflow-y-auto pr-1.5 scrollbar-thin scrollbar-thumb-neutral-300 scrollbar-track-transparent scroll-smooth">
                    {BANK_OPTIONS.filter(b => 
                      b.title.toLowerCase().includes(bankSearchQuery.toLowerCase()) || 
                      b.abbrev.toLowerCase().includes(bankSearchQuery.toLowerCase())
                    ).map((opt) => {
                      const isActive = destinationBank === opt.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => setDestinationBank(opt.id)}
                          className={`p-1 sm:p-1.5 rounded-xl border text-center transition-all duration-150 cursor-pointer flex flex-col items-center justify-center select-none active:scale-[0.98] min-h-[48px] sm:min-h-[52px] ${
                            isActive
                              ? `${opt.activeColor} scale-[1.03] font-black ring-2 ring-offset-1 ring-[#00B87A]`
                              : `${opt.color} border-neutral-200/50`
                          }`}
                        >
                          <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-black mb-1 shadow-sm ${
                            isActive ? 'bg-white text-black' : opt.logoBg
                          }`}>
                            {opt.abbrev}
                          </div>
                          <span className="text-[9px] sm:text-[9.5px] font-bold tracking-tight leading-none truncate w-full px-0.5">{opt.title}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Redesigned Amount and Service Charge Section (Image-Inspired) */}
          <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-[2.5rem] p-6 shadow-2xl shadow-blue-200/50 border border-white/10 relative overflow-hidden">
            {/* Decorative background circle */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -mr-32 -mt-32 blur-3xl pointer-events-none"></div>
            
            <div className="space-y-6 relative z-10">
              {/* Type the Amount Section */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 px-1">
                  <h3 className="text-white text-[13px] font-black uppercase tracking-[0.15em] font-mono flex items-center gap-2">
                    Type the Amount <span className="text-xl">💰</span>
                  </h3>
                </div>
                
                <div className="relative group">
                  <div className="bg-white rounded-[2rem] px-8 py-5 shadow-inner flex items-center transition-all group-focus-within:ring-4 group-focus-within:ring-white/20">
                    <span className="text-blue-600 font-black text-3xl font-mono mr-3 select-none">₦</span>
                    <input
                      id="amount-input"
                      type="text"
                      inputMode="decimal"
                      value={amountInput}
                      onChange={(e) => {
                        const val = e.target.value.replace(/,/g, '');
                        if (/^\d*\.?\d*$/.test(val)) {
                          setAmountInput(formatNumber(val));
                        }
                      }}
                      className="w-full bg-transparent border-none focus:ring-0 text-blue-600 font-mono text-4xl font-black placeholder:text-blue-100 p-0"
                      placeholder="0.00"
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Dashed Divider */}
              <div className="border-t-2 border-dashed border-white/20 my-2"></div>

              {/* Transaction Fee Section */}
              <div className="space-y-4">
                <h3 className="text-white text-[13px] font-black uppercase tracking-[0.15em] font-mono flex items-center gap-2 px-1">
                  Transaction Fee <span className="text-xl">💎</span>
                </h3>

                <div className="bg-blue-900/30 backdrop-blur-md rounded-[2rem] p-2 flex gap-2 border border-white/10">
                  <button
                    type="button"
                    onClick={() => {
                      setIsFeeWaived(false);
                      applyRecommendedFee();
                    }}
                    className={`flex-1 py-4 px-4 rounded-[1.5rem] flex items-center justify-center gap-3 transition-all duration-300 ${
                      !isFeeWaived
                        ? 'bg-white text-blue-600 shadow-lg scale-[1.02]'
                        : 'bg-transparent text-white/70 hover:text-white'
                    }`}
                  >
                    <span className="text-xl">💳</span>
                    <div className="text-left">
                      <p className="text-[11px] font-black uppercase leading-none font-mono">Apply</p>
                      <p className="text-[10px] font-bold uppercase opacity-80 font-mono">Charge</p>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsFeeWaived(true);
                      setFeeInput('0');
                      setCustomerFee(0);
                    }}
                    className={`flex-1 py-4 px-4 rounded-[1.5rem] flex items-center justify-center gap-3 transition-all duration-300 ${
                      isFeeWaived
                        ? 'bg-white text-rose-600 shadow-lg scale-[1.02]'
                        : 'bg-transparent text-white/70 hover:text-white'
                    }`}
                  >
                    <span className="text-xl">🎉</span>
                    <div className="text-left">
                      <p className="text-[11px] font-black uppercase leading-none font-mono">Waive</p>
                      <p className="text-[10px] font-bold uppercase opacity-80 font-mono">(₦0)</p>
                    </div>
                  </button>
                </div>

                {!isFeeWaived ? (
                  <div className="animate-in zoom-in-95 duration-300">
                    <div className="bg-white rounded-[2rem] px-8 py-4 shadow-inner flex items-center">
                      <span className="text-blue-500 font-black text-2xl font-mono mr-3 select-none">₦</span>
                      <input
                        id="fee-input"
                        type="text"
                        inputMode="decimal"
                        value={feeInput}
                        onChange={(e) => {
                          const val = e.target.value.replace(/,/g, '');
                          if (/^\d*\.?\d*$/.test(val)) {
                            setFeeInput(formatNumber(val));
                          }
                        }}
                        className="w-full bg-transparent border-none focus:ring-0 text-blue-500 font-mono text-3xl font-black placeholder:text-blue-100 p-0"
                        placeholder="0.00"
                        required
                      />
                    </div>
                    <p className="mt-3 text-center text-white/60 text-[10px] font-bold uppercase font-mono tracking-widest">
                      Enter the extra fee to collect
                    </p>
                  </div>
                ) : (
                  <div className="bg-white/10 backdrop-blur-md rounded-[2rem] p-5 border border-white/5 flex items-center gap-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center text-2xl shadow-inner border border-white/10">🎁</div>
                    <div>
                      <h4 className="text-white text-[11px] font-black uppercase tracking-widest font-mono">Free Transaction</h4>
                      <p className="text-white/60 text-[10px] font-bold font-mono uppercase tracking-tight">No profit fee will be charged.</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>


          {/* Fee Billing Method Selector Option - Custom OPay Settlement Guide */}
          {type === 'Withdrawal' ? (
            <div className="bg-neutral-50/50 border border-neutral-200 rounded-3xl p-5 space-y-6 shadow-sm overflow-hidden relative">
              <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full -mr-16 -mt-16 blur-2xl"></div>
              
              {/* Scenario Toggle Block */}
              <div className="space-y-3 relative z-10">
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                  <label className="block text-[11px] font-black uppercase tracking-widest text-neutral-500 font-mono">
                    Step 1: Choose Scenario
                  </label>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    key="scenario-handout"
                    type="button"
                    onClick={() => setWithdrawScenario('CashHandout')}
                    className={`group py-3.5 px-2 rounded-2xl text-xs font-black border-2 transition-all cursor-pointer text-center flex flex-col items-center justify-center gap-2 leading-tight shadow-sm ${
                      withdrawScenario === 'CashHandout'
                        ? 'bg-emerald-600 border-emerald-600 text-white ring-4 ring-emerald-500/10'
                        : 'bg-white border-neutral-100 text-neutral-400 hover:border-emerald-200 hover:bg-emerald-50/30'
                    }`}
                  >
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xl mb-1 shadow-inner ${
                      withdrawScenario === 'CashHandout' ? 'bg-emerald-500/20' : 'bg-neutral-50'
                    }`}>💵</div>
                    <span className="uppercase tracking-tight font-mono">Cash Handout</span>
                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                      withdrawScenario === 'CashHandout' ? 'bg-white/20 text-white' : 'bg-neutral-100 text-neutral-400'
                    }`}>Customer wants ₦{amount.toLocaleString()}</span>
                  </button>
                  <button
                    key="scenario-swipe"
                    type="button"
                    onClick={() => setWithdrawScenario('CardSwipe')}
                    className={`group py-3.5 px-2 rounded-2xl text-xs font-black border-2 transition-all cursor-pointer text-center flex flex-col items-center justify-center gap-2 leading-tight shadow-sm ${
                      withdrawScenario === 'CardSwipe'
                        ? 'bg-blue-600 border-blue-600 text-white ring-4 ring-blue-500/10'
                        : 'bg-white border-neutral-100 text-neutral-400 hover:border-blue-200 hover:bg-blue-50/30'
                    }`}
                  >
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xl mb-1 shadow-inner ${
                      withdrawScenario === 'CardSwipe' ? 'bg-blue-500/20' : 'bg-neutral-50'
                    }`}>💳</div>
                    <span className="uppercase tracking-tight font-mono">Card Swipe</span>
                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                      withdrawScenario === 'CardSwipe' ? 'bg-white/20 text-white' : 'bg-neutral-100 text-neutral-400'
                    }`}>Debit ₦{amount.toLocaleString()} Card</span>
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-4 border-t border-neutral-100 pt-6 relative z-10">
                <div className="w-12 h-12 rounded-[1.2rem] bg-neutral-50 text-neutral-400 flex items-center justify-center text-xl shadow-inner border border-neutral-100">
                  <Smartphone className="w-6 h-6 opacity-40" />
                </div>
                <div>
                  <h4 className="text-[12px] font-black text-neutral-900 uppercase tracking-[0.15em] font-mono flex items-center gap-2">
                    Step 2: Charge Method
                    <span className="text-[9px] bg-blue-50 text-blue-600 px-2 py-1 rounded-lg font-black uppercase tracking-widest border border-blue-100">{provider} POS</span>
                  </h4>
                  <p className="text-[10px] text-neutral-400 font-bold uppercase tracking-widest font-mono mt-0.5">
                    How is the customer paying the <span className="text-neutral-900">{formatNaira(customerFee)}</span> fee?
                  </p>
                </div>
              </div>

              {/* Three Option Cards */}
              <div className="grid grid-cols-1 gap-4 relative z-10">
                
                {/* 1. Add Charges to Card Debit (YES) */}
                <button
                  type="button"
                  onClick={() => setWithdrawChargeMode('CardAddOn')}
                  className={`group p-5 rounded-[2rem] border-2 text-left cursor-pointer transition-all flex flex-col gap-3 relative overflow-hidden ${
                    withdrawChargeMode === 'CardAddOn'
                      ? 'border-blue-500 bg-white shadow-lg ring-4 ring-blue-500/5'
                      : 'border-neutral-100 bg-white hover:border-blue-200'
                  }`}
                >
                  <div className="flex items-center justify-between w-full relative z-10">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-colors shadow-sm ${
                        withdrawChargeMode === 'CardAddOn' ? 'bg-blue-500 text-white' : 'bg-neutral-50 text-neutral-400'
                      }`}>
                        <CreditCard className="w-5 h-5" />
                      </div>
                      <span className={`text-[12px] font-black uppercase tracking-wider font-mono ${
                        withdrawChargeMode === 'CardAddOn' ? 'text-blue-900' : 'text-neutral-500'
                      }`}>
                        Add Fee to Card
                      </span>
                    </div>
                    <div className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${
                      withdrawChargeMode === 'CardAddOn' ? 'bg-blue-50 text-blue-600' : 'bg-neutral-50 text-neutral-400'
                    }`}>Inside Card</div>
                  </div>
                  <div className="space-y-1.5 mt-1 relative z-10">
                    <p className={`text-[11px] uppercase font-bold tracking-tight ${withdrawChargeMode === 'CardAddOn' ? 'text-blue-600' : 'text-neutral-400'}`}>
                      Customer says: <span className="text-neutral-800 font-black">"Add it to my card."</span>
                    </p>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[10px] font-black uppercase">
                      <div className="flex items-center gap-2">
                        <span className="text-neutral-400">Swipe Card:</span>
                        <span className="text-neutral-900">{formatNaira(cardSwipe)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-neutral-400">Handout:</span>
                        <span className="text-neutral-900">{formatNaira(cashHandout)}</span>
                      </div>
                    </div>
                  </div>
                </button>

                {/* 2. Customer Pays Charges in Cash (NO) */}
                <button
                  type="button"
                  onClick={() => setWithdrawChargeMode('SeparateCash')}
                  className={`group p-5 rounded-[2rem] border-2 text-left cursor-pointer transition-all flex flex-col gap-3 relative overflow-hidden ${
                    withdrawChargeMode === 'SeparateCash'
                      ? 'border-emerald-500 bg-white shadow-lg ring-4 ring-emerald-500/5'
                      : 'border-neutral-100 bg-white hover:border-emerald-200'
                  }`}
                >
                  <div className="flex items-center justify-between w-full relative z-10">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-colors shadow-sm ${
                        withdrawChargeMode === 'SeparateCash' ? 'bg-[#00B87A] text-white' : 'bg-neutral-50 text-neutral-400'
                      }`}>
                        <Banknote className="w-5 h-5" />
                      </div>
                      <span className={`text-[12px] font-black uppercase tracking-wider font-mono ${
                        withdrawChargeMode === 'SeparateCash' ? 'text-emerald-900' : 'text-neutral-500'
                      }`}>
                        Customer Pays Cash Fee
                      </span>
                    </div>
                    <div className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${
                      withdrawChargeMode === 'SeparateCash' ? 'bg-emerald-50 text-emerald-600' : 'bg-neutral-50 text-neutral-400'
                    }`}>Separate Cash</div>
                  </div>
                  <div className="space-y-1.5 mt-1 relative z-10">
                    <p className={`text-[11px] uppercase font-bold tracking-tight ${withdrawChargeMode === 'SeparateCash' ? 'text-emerald-600' : 'text-neutral-400'}`}>
                      Customer says: <span className="text-neutral-800 font-black">"I'll pay the fee in cash."</span>
                    </p>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[10px] font-black uppercase">
                      <div className="flex items-center gap-2">
                        <span className="text-neutral-400">Swipe Card:</span>
                        <span className="text-neutral-900">{formatNaira(cardSwipe)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-emerald-500">Collect Fee:</span>
                        <span className="text-emerald-600">{formatNaira(customerFee)}</span>
                      </div>
                    </div>
                  </div>
                </button>

                {/* 3. Deduct Charges from Cash (Customer gets less cash) */}
                <button
                  type="button"
                  onClick={() => setWithdrawChargeMode('DeductFromCash')}
                  className={`group p-5 rounded-[2rem] border-2 text-left cursor-pointer transition-all flex flex-col gap-3 relative overflow-hidden ${
                    withdrawChargeMode === 'DeductFromCash'
                      ? 'border-amber-500 bg-white shadow-lg ring-4 ring-amber-500/5'
                      : 'border-neutral-100 bg-white hover:border-amber-200'
                  }`}
                >
                  <div className="flex items-center justify-between w-full relative z-10">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-colors shadow-sm ${
                        withdrawChargeMode === 'DeductFromCash' ? 'bg-amber-500 text-white' : 'bg-neutral-50 text-neutral-400'
                      }`}>
                        <Scissors className="w-5 h-5" />
                      </div>
                      <span className={`text-[12px] font-black uppercase tracking-wider font-mono ${
                        withdrawChargeMode === 'DeductFromCash' ? 'text-amber-900' : 'text-neutral-500'
                      }`}>
                        Subtract Fee from Cash
                      </span>
                    </div>
                    <div className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${
                      withdrawChargeMode === 'DeductFromCash' ? 'bg-amber-50 text-amber-600' : 'bg-neutral-50 text-neutral-400'
                    }`}>Deduct from Handout</div>
                  </div>
                  <div className="space-y-1.5 mt-1 relative z-10">
                    <p className={`text-[11px] uppercase font-bold tracking-tight ${withdrawChargeMode === 'DeductFromCash' ? 'text-amber-600' : 'text-neutral-400'}`}>
                      Customer says: <span className="text-neutral-800 font-black">"Take fee from the cash."</span>
                    </p>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[10px] font-black uppercase">
                      <div className="flex items-center gap-2">
                        <span className="text-neutral-400">Swipe Card:</span>
                        <span className="text-neutral-900">{formatNaira(cardSwipe)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-amber-500">Handout:</span>
                        <span className="text-amber-600">{formatNaira(cashHandout)}</span>
                      </div>
                    </div>
                  </div>
                </button>


              </div>

              {/* LOSS PREVENTION ALERT FLAG - Refined */}
              <div className={`relative z-10 p-6 rounded-[2rem] border-2 flex gap-5 items-center transition-all shadow-sm overflow-hidden ${
                withdrawChargeMode === 'SeparateCash' 
                  ? 'bg-amber-50 border-amber-200 text-amber-900 ring-8 ring-amber-100/50'
                  : withdrawChargeMode === 'DeductFromCash'
                  ? 'bg-purple-50 border-purple-200 text-purple-900'
                  : 'bg-emerald-50 border-emerald-200 text-emerald-900'
              }`}>
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-3xl shadow-inner flex-shrink-0 ${
                   withdrawChargeMode === 'SeparateCash' ? 'bg-amber-200' : withdrawChargeMode === 'DeductFromCash' ? 'bg-purple-200' : 'bg-emerald-200'
                }`}>
                  {withdrawChargeMode === 'SeparateCash' ? '🚨' : '✅'}
                </div>
                <div className="space-y-1.5 relative z-10">
                  <h5 className="text-[12px] font-black uppercase font-mono tracking-widest flex items-center gap-2">
                    {withdrawChargeMode === 'SeparateCash' ? 'ALERT: STOP! READ THIS' : 'CASHIER INSTRUCTION'}
                    <span className="w-2.5 h-2.5 rounded-full bg-current animate-ping"></span>
                  </h5>
                  <p className="text-[12px] leading-tight font-black font-mono uppercase tracking-tight">
                    {withdrawChargeMode === 'SeparateCash' ? (
                      <span>
                        DEBIT CARD <strong className="underline decoration-4 underline-offset-4">{formatNaira(cardSwipe)}</strong>.
                        <br />
                        <span className="text-amber-600 bg-amber-100 px-1">!!! DO NOT GIVE CASH !!!</span> UNTIL THEY HAND YOU <strong className="bg-amber-900 text-white px-2 py-0.5 rounded-md">{formatNaira(customerFee)} CASH</strong> FIRST!
                      </span>
                    ) : withdrawChargeMode === 'DeductFromCash' ? (
                      <span>
                        DEBIT CARD <strong className="underline decoration-4 underline-offset-4">{formatNaira(cardSwipe)}</strong>.
                        <br />
                        GIVE EXACTLY <strong className="text-purple-600 bg-purple-100 px-1">{formatNaira(cashHandout)} CASH</strong>. THE FEE STAYS IN YOUR DRAWER!
                      </span>
                    ) : (
                      <span>
                        DEBIT CARD <strong className="underline decoration-4 underline-offset-4">{formatNaira(cardSwipe)}</strong>.
                        <br />
                        HAND OVER EXACTLY <strong className="text-emerald-600 bg-emerald-100 px-1">{formatNaira(cashHandout)} CASH</strong> TO CUSTOMER.
                      </span>
                    )}
                  </p>
                </div>
              </div>

              {/* Dynamic Step-by-Step POS Reconciliation Guide */}
              <div className="bg-white border border-neutral-200 rounded-xl p-3 space-y-2 font-mono text-[10px]">
                <div className="flex justify-between border-b border-neutral-100 pb-1 text-[8px] text-neutral-450 font-black uppercase tracking-wider">
                  <span>Step-by-Step Action Guide</span>
                  <span>Amount</span>
                </div>
                
                {withdrawChargeMode === 'CardAddOn' ? (
                  <>
                    <div className="flex justify-between font-bold text-neutral-850">
                      <span>1. Input Amount on POS Terminal:</span>
                      <span className="text-emerald-600 font-black text-xs">
                        {formatNaira(cardSwipe)}
                      </span>
                    </div>
                    <div className="flex justify-between text-neutral-500">
                      <span>2. {provider} Terminal Fee ({activeFeeRate}%):</span>
                      <span>-{formatNaira(liveTerminalFee)}</span>
                    </div>
                    {liveCbnCharge > 0 && (
                      <div className="flex justify-between text-neutral-500">
                        <span>3. CBN EMTL Levy:</span>
                        <span>-{formatNaira(liveCbnCharge)}</span>
                      </div>
                    )}
                    <div className="flex justify-between font-extrabold text-blue-700 pt-1 border-t border-neutral-100">
                      <span>4. Settlement Received in POS Wallet:</span>
                      <span>{formatNaira(cardSwipe - liveTerminalFee - liveCbnCharge)}</span>
                    </div>
                    <div className="flex justify-between font-semibold text-neutral-600">
                      <span>5. Physical Cash given to Customer:</span>
                      <span className="text-neutral-800 font-bold">{formatNaira(cashHandout)}</span>
                    </div>
                    <div className="flex justify-between font-black text-emerald-700 border-t border-dashed border-neutral-200 pt-1">
                      <span>🎉 RECONCILED AGENT PROFIT:</span>
                      <span>+{formatNaira(customerFee - liveTerminalFee - liveCbnCharge)}</span>
                    </div>
                  </>
                ) : withdrawChargeMode === 'SeparateCash' ? (
                  <>
                    <div className="flex justify-between font-bold text-neutral-850">
                      <span>1. Input Amount on POS Terminal:</span>
                      <span className="text-blue-600 font-black text-xs">
                        {formatNaira(cardSwipe)}
                      </span>
                    </div>
                    <div className="flex justify-between text-neutral-500">
                      <span>2. {provider} Terminal Fee ({activeFeeRate}%):</span>
                      <span>-{formatNaira(liveTerminalFee)}</span>
                    </div>
                    {liveCbnCharge > 0 && (
                      <div className="flex justify-between text-neutral-500">
                        <span>3. CBN EMTL Levy:</span>
                        <span>-{formatNaira(liveCbnCharge)}</span>
                      </div>
                    )}
                    <div className="flex justify-between font-extrabold text-blue-700 pt-1 border-t border-neutral-100">
                      <span>4. Settlement Received in POS Wallet:</span>
                      <span>{formatNaira(cardSwipe - liveTerminalFee - liveCbnCharge)}</span>
                    </div>
                    <div className="flex justify-between font-semibold text-emerald-600">
                      <span>5. Physical Fee Cash Collected:</span>
                      <span className="text-emerald-600 font-bold">+{formatNaira(customerFee)}</span>
                    </div>
                    <div className="flex justify-between font-semibold text-neutral-600">
                      <span>6. Physical Cash given to Customer:</span>
                      <span className="text-neutral-800 font-bold">{formatNaira(cashHandout)}</span>
                    </div>
                    <div className="flex justify-between font-black text-emerald-700 border-t border-dashed border-neutral-200 pt-1">
                      <span>🎉 RECONCILED AGENT PROFIT:</span>
                      <span>+{formatNaira(customerFee - liveTerminalFee - liveCbnCharge)}</span>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex justify-between font-bold text-neutral-850">
                      <span>1. Input Amount on POS Terminal:</span>
                      <span className="text-neutral-800 font-black text-xs">
                        {formatNaira(cardSwipe)}
                      </span>
                    </div>
                    <div className="flex justify-between text-neutral-500">
                      <span>2. {provider} Terminal Fee ({activeFeeRate}%):</span>
                      <span>-{formatNaira(liveTerminalFee)}</span>
                    </div>
                    {liveCbnCharge > 0 && (
                      <div className="flex justify-between text-neutral-500">
                        <span>3. CBN EMTL Levy:</span>
                        <span>-{formatNaira(liveCbnCharge)}</span>
                      </div>
                    )}
                    <div className="flex justify-between font-extrabold text-blue-700 pt-1 border-t border-neutral-100">
                      <span>4. Settlement Received in POS Wallet:</span>
                      <span>{formatNaira(cardSwipe - liveTerminalFee - liveCbnCharge)}</span>
                    </div>
                    <div className="flex justify-between font-semibold text-purple-700">
                      <span>5. Cash to hand over (Charges Deducted):</span>
                      <span className="font-extrabold">{formatNaira(cashHandout)}</span>
                    </div>
                    <div className="flex justify-between font-black text-emerald-700 border-t border-dashed border-neutral-200 pt-1">
                      <span>🎉 RECONCILED AGENT PROFIT:</span>
                      <span>+{formatNaira(customerFee - liveTerminalFee - liveCbnCharge)}</span>
                    </div>
                  </>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-white border border-neutral-100 rounded-[1.5rem] p-4 space-y-4 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between px-1">
                <label className="text-[10px] font-black uppercase tracking-[0.15em] text-neutral-500 font-mono flex items-center gap-1.5">
                  <CreditCard className="w-3.5 h-3.5 text-amber-500" /> Fee Billing
                </label>
                <span className="text-[8px] font-bold text-neutral-400 font-mono uppercase tracking-tighter">
                  ({feeMethod === 'Cash' ? 'Cash' : 'Split'})
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setFeeMethod('Cash')}
                  className={`py-3 px-2 rounded-xl text-[9px] font-black transition-all duration-300 cursor-pointer border-2 text-center uppercase font-mono flex flex-col items-center justify-center gap-1 shadow-xs ${
                    feeMethod === 'Cash'
                      ? 'bg-[#00B87A] border-[#00B87A] text-white ring-2 ring-[#00B87A]/10'
                      : 'bg-white border-neutral-100 text-neutral-500 hover:border-emerald-200 hover:bg-emerald-50/30'
                  }`}
                >
                  <span>In-Cash</span>
                  <span className="text-[7px] opacity-60">(Standard)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setFeeMethod('CardDebit')}
                  className={`py-3 px-2 rounded-xl text-[9px] font-black transition-all duration-300 cursor-pointer border-2 text-center uppercase font-mono flex flex-col items-center justify-center gap-1 shadow-xs ${
                    feeMethod === 'CardDebit'
                      ? 'bg-[#00B87A] border-[#00B87A] text-white ring-2 ring-[#00B87A]/10'
                      : 'bg-white border-neutral-100 text-neutral-500 hover:border-emerald-200 hover:bg-emerald-50/30'
                  }`}
                >
                  <span>Split</span>
                  <span className="text-[7px] opacity-60">(Withdrawal)</span>
                </button>
              </div>
              <div className="bg-neutral-50 p-2.5 rounded-xl border border-dashed border-neutral-200">
                <p className="text-[9px] text-neutral-600 leading-tight font-mono font-bold uppercase tracking-tighter text-center">
                  {feeMethod === 'Cash' ? (
                    <span>Customer debited <span className="text-emerald-600 font-black">{formatNaira(amount)}</span> + Fee <span className="text-emerald-600 font-black">{formatNaira(customerFee)}</span></span>
                  ) : (
                    <span>Customer debited <span className="text-emerald-600 font-black">{formatNaira(amount + customerFee)}</span> (Fee Deducted)</span>
                  )}
                </p>
              </div>
            </div>
          )}

          {/* Assigned Employee / Operator selector - Cleaned up to match image */}
          <div className="bg-neutral-50 border border-neutral-100 p-5 rounded-2xl flex items-center justify-between shadow-sm">
            <span className="text-[12px] text-neutral-500 font-black uppercase tracking-widest font-mono">Employee Shift Authority:</span>
            {currentUser.role === 'Manager' ? (
              <select
                value={employeeId}
                onChange={(e) => setEmployeeId(e.target.value)}
                className="bg-white border-2 border-neutral-200 text-[#00B87A] rounded-xl px-4 py-2 text-xs font-black font-mono focus:outline-none focus:border-[#00B87A] transition-all cursor-pointer shadow-inner"
              >
                <option value={currentUser.id}>{currentUser.name.toUpperCase()} (MANAGER)</option>
                {availableEmployees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.name.toUpperCase()} (EMPLOYEE)
                  </option>
                ))}
              </select>
            ) : (
              <span className="text-[13px] font-black text-[#00B87A] font-mono tracking-widest bg-emerald-50 px-3 py-1 rounded-lg border border-emerald-100">{currentUser.name.toUpperCase()}</span>
            )}
          </div>

          {mode === 'SplitWithdrawal' && (
            <div className="bg-emerald-50/30 border border-emerald-100 rounded-2xl p-5 space-y-5 animate-in slide-in-from-top-2 duration-300">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <label className="block text-xs font-black uppercase tracking-widest text-[#00B87A] font-mono">
                    Recipient List (Withdraw & Send)
                  </label>
                  <p className="text-[10px] text-emerald-600 font-medium">Add one or many bank accounts to receive this money.</p>
                </div>
                <div className="bg-emerald-100 text-[#00B87A] px-2 py-1 rounded-lg text-[10px] font-black font-mono">
                  STEP 2: DISTRIBUTION
                </div>
              </div>
              
              <div className="space-y-4">
                {subTransfers.map((st, index) => (
                  <div 
                    key={index} 
                    className="bg-white border border-neutral-200 p-4 rounded-xl space-y-3 shadow-xs relative hover:border-[#00B87A]/35 transition-all"
                  >
                    {/* Header Row with Serial Number and Delete button */}
                    <div className="flex items-center justify-between border-b border-neutral-100 pb-2">
                      <span className="text-xs font-bold text-neutral-500 font-mono flex items-center gap-1.5">
                        <span className="flex items-center justify-center w-5 h-5 bg-[#00B87A]/10 text-[#00B87A] rounded-full text-[10px] font-black">
                          #{index + 1}
                        </span>
                        Transfer Entry #{index + 1}
                      </span>
                      {subTransfers.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setSubTransfers(subTransfers.filter((_, i) => i !== index))}
                          className="text-red-500 hover:text-red-600 hover:bg-red-50/50 p-1.5 rounded-lg transition-colors cursor-pointer"
                          title="Remove this split"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>

                    {/* Inputs Row with larger touch targets and labels */}
                    <div className="grid grid-cols-12 gap-3.5">
                      {/* Account Name */}
                      <div className="col-span-12 sm:col-span-5 space-y-1.5">
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-neutral-450 font-mono">
                          Account Name (Recipient)
                        </label>
                        <input
                          placeholder="Recipient Name"
                          value={st.recipientName}
                          onChange={(e) => {
                            const updated = [...subTransfers];
                            updated[index].recipientName = e.target.value;
                            setSubTransfers(updated);
                          }}
                          className="w-full text-sm p-3 h-11 rounded-lg border border-neutral-250 focus:outline-none focus:border-[#00B87A] focus:ring-1 focus:ring-[#00B87A] bg-white text-neutral-800 font-medium shadow-xs transition"
                        />
                      </div>

                      {/* Account Number */}
                      <div className="col-span-12 sm:col-span-4 space-y-1.5">
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-neutral-450 font-mono">
                          Account Number
                        </label>
                        <input
                          placeholder="Acct No"
                          value={st.accountNumber}
                          onChange={(e) => {
                            const updated = [...subTransfers];
                            updated[index].accountNumber = e.target.value;
                            setSubTransfers(updated);
                          }}
                          className="w-full text-sm p-3 h-11 rounded-lg border border-neutral-250 focus:outline-none focus:border-[#00B87A] focus:ring-1 focus:ring-[#00B87A] bg-white text-neutral-800 font-mono shadow-xs transition"
                        />
                      </div>

                      {/* Amount with Serial Number */}
                      <div className="col-span-12 sm:col-span-3 space-y-1.5">
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-neutral-450 font-mono flex items-center justify-between">
                          <span>Amount</span>
                          <span className="text-[#00B87A] font-black text-[10px]">Amt #{index + 1}</span>
                        </label>
                        <input
                          placeholder="₦ 0"
                          type="number"
                          value={st.amount || ''}
                          onChange={(e) => {
                            const updated = [...subTransfers];
                            updated[index].amount = parseFloat(e.target.value) || 0;
                            setSubTransfers(updated);
                          }}
                          className="w-full text-sm p-3 h-11 rounded-lg border border-neutral-250 focus:outline-none focus:border-[#00B87A] focus:ring-1 focus:ring-[#00B87A] bg-white font-bold text-neutral-800 shadow-xs transition"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setSubTransfers([...subTransfers, { recipientName: '', accountNumber: '', amount: 0 }])}
                className="flex items-center gap-1.5 text-xs text-[#00B87A] font-black cursor-pointer bg-white border border-neutral-200 px-3 py-2 rounded-xl hover:bg-neutral-50 transition-colors shadow-xs"
              >
                <Plus className="w-4 h-4" /> Add Another Recipient Account
              </button>
              <div className="text-xs font-bold text-neutral-700 bg-neutral-100 p-3 rounded-lg space-y-1">
                <div className="flex justify-between">
                  <span>Gross Withdrawal:</span>
                  <span>{formatNaira(amount)}</span>
                </div>
                <div className="flex justify-between text-neutral-500">
                  <span>Total Sent to Bank(s):</span>
                  <span>-{formatNaira(subTransfers.reduce((sum, st) => sum + st.amount, 0))}</span>
                </div>
                <div className="flex justify-between text-neutral-500">
                  <span>Operating Fees:</span>
                  <span>-{formatNaira(customerFee)}</span>
                </div>
                <div className="flex justify-between pt-2 border-t border-neutral-200">
                  <span>Physical Cash to Customer:</span>
                  <span className={`font-black ${(amount - subTransfers.reduce((sum, st) => sum + st.amount, 0) - customerFee) < 0 ? 'text-red-600' : 'text-[#00B87A]'}`}>
                    {formatNaira(amount - subTransfers.reduce((sum, st) => sum + st.amount, 0) - customerFee)}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Transaction Status Selection */}
          <div className="space-y-3">
            <label className="block text-[11px] font-black uppercase tracking-[0.2em] text-neutral-450 font-mono">
              Transaction Status
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(['Success', 'Pending', 'Failed'] as const).map((s) => {
                const isActive = status === s;
                const activeColor =
                  s === 'Success'
                    ? 'bg-[#00B87A] border-[#00B87A] text-white shadow-[#00B87A]/15 shadow-md'
                    : s === 'Pending'
                    ? 'bg-amber-500 border-amber-500 text-white shadow-amber-500/15 shadow-md'
                    : 'bg-red-500 border-red-500 text-white shadow-red-500/15 shadow-md';
                const inactiveColor =
                  s === 'Success'
                    ? 'bg-neutral-50 hover:bg-emerald-50 border-neutral-200 text-neutral-600 hover:text-emerald-700 hover:border-emerald-250'
                    : s === 'Pending'
                    ? 'bg-neutral-50 hover:bg-amber-50 border-neutral-200 text-neutral-600 hover:text-amber-700 hover:border-amber-250'
                    : 'bg-neutral-50 hover:bg-red-50 border-neutral-200 text-neutral-600 hover:text-red-700 hover:border-red-250';

                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => {
                      setStatus(s);
                      if (!settings || settings.soundEnabled) {
                        playStatusSound(s);
                      }
                    }}
                    className={`py-3 px-2 border rounded-2xl text-[11px] font-black transition cursor-pointer select-none text-center uppercase font-mono tracking-tighter ${
                      isActive ? activeColor : inactiveColor
                    }`}
                  >
                    {s}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Unpaid / Paid Charges Toggle - Compact & Professional layout */}
          <div className="bg-[#2D1F16] rounded-[2rem] p-5 space-y-4 shadow-2xl border border-white/5 relative overflow-hidden">
            {/* Background decorative glow */}
            <div className="absolute -bottom-12 -left-12 w-32 h-32 bg-[#00B87A]/5 rounded-full blur-[40px] pointer-events-none"></div>
            
            <div className="flex items-center justify-between px-1 relative z-10">
              <label className="text-[11px] font-black uppercase tracking-[0.15em] text-white font-mono flex items-center gap-2">
                <span className="text-base">⏳</span> Charges Status
              </label>
              <div className="bg-white/5 backdrop-blur-md text-white/40 text-[8px] font-mono font-black uppercase tracking-[0.1em] px-2.5 py-1 rounded-md border border-white/5">
                Defer Option
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 relative z-10">
              <button
                type="button"
                onClick={() => setChargesStatus('Paid')}
                className={`group py-4 px-3 rounded-2xl text-[10px] font-black transition-all duration-300 cursor-pointer flex flex-col items-center justify-center gap-1 uppercase font-mono shadow-xl ${
                  chargesStatus === 'Paid'
                    ? 'bg-[#00B87A] text-white ring-4 ring-[#00B87A]/10'
                    : 'bg-white/5 border border-white/5 text-white/30 hover:bg-white/10 hover:text-white/50'
                }`}
              >
                <span className="text-lg">✓</span>
                <span>Paid Now</span>
              </button>
              
              <button
                type="button"
                onClick={() => setChargesStatus('Unpaid')}
                className={`group py-4 px-3 rounded-2xl text-[10px] font-black transition-all duration-300 cursor-pointer flex flex-col items-center justify-center gap-1 uppercase font-mono shadow-xl ${
                  chargesStatus === 'Unpaid'
                    ? 'bg-[#F59E0B] text-white ring-4 ring-[#F59E0B]/10'
                    : 'bg-white/5 border border-white/5 text-white/30 hover:bg-white/10 hover:text-white/50'
                }`}
              >
                <span className="text-lg">⏳</span>
                <span>Pay Later</span>
              </button>
            </div>

            {chargesStatus === 'Unpaid' && (
              <div className="space-y-2 pt-1 animate-in slide-in-from-top-2 duration-200 relative z-10">
                <div className="h-px bg-white/5 w-full mb-2"></div>
                <label htmlFor="debtor-name" className="block text-[9px] font-black uppercase tracking-[0.05em] text-white/40 font-mono pl-1">
                  Debtor Name <span className="text-red-400">*</span>
                </label>
                <input
                  id="debtor-name"
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="relative w-full bg-white/5 border border-white/10 focus:border-white/30 rounded-xl px-4 py-3 text-xs text-white focus:outline-none font-black placeholder:text-white/10 backdrop-blur-sm transition-all"
                  placeholder="NAME..."
                  required={chargesStatus === 'Unpaid'}
                />
              </div>
            )}
          </div>

          {/* Customer Information Block - Professional Gradient Design */}
          <div className="bg-gradient-to-br from-[#00B87A] to-[#008A5E] rounded-[2.5rem] p-7 space-y-6 shadow-xl relative overflow-hidden border border-white/10">
            {/* Background decorative circles */}
            <div className="absolute -top-10 -right-10 w-32 h-32 bg-white/10 rounded-full blur-2xl"></div>
            <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-black/10 rounded-full blur-2xl"></div>

            <div className="flex items-center gap-4 relative z-10">
              <div className="bg-white/20 backdrop-blur-md p-3 rounded-2xl border border-white/20 shadow-inner">
                <UserIcon className="w-6 h-6 text-white" />
              </div>
              <div className="flex flex-col">
                <label className="text-[14px] font-black uppercase tracking-[0.2em] text-white font-mono leading-none">
                  Customer Info
                </label>
                <span className="text-[9px] font-bold text-white/60 uppercase tracking-widest mt-1">
                  Optional details for receipt
                </span>
              </div>
            </div>

            <div className="space-y-5 relative z-10">
              {/* Account Name */}
              <div className="space-y-2">
                <label className="block text-[10px] font-black uppercase tracking-[0.1em] text-white/80 font-mono pl-1">
                  Account Name
                </label>
                <div className="relative group">
                  <input
                    type="text"
                    value={accountName}
                    onChange={(e) => setAccountName(e.target.value)}
                    className="w-full bg-white border-0 rounded-[1.4rem] px-6 py-4.5 text-[13px] text-neutral-800 focus:outline-none focus:ring-4 focus:ring-white/30 font-black placeholder:text-neutral-300 transition-all shadow-xl"
                    placeholder="e.g. ALIYA MUSA"
                  />
                  <div className="absolute right-5 top-1/2 -translate-y-1/2">
                     <Mic className="w-4 h-4 text-[#00B87A]/40" />
                  </div>
                </div>
              </div>

              {/* Account Number */}
              <div className="space-y-2">
                <label className="block text-[10px] font-black uppercase tracking-[0.1em] text-white/80 font-mono pl-1">
                  Account Number
                </label>
                <input
                  type="text"
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, ''))}
                  className="w-full bg-white border-0 rounded-[1.4rem] px-6 py-4.5 text-[13px] text-neutral-800 focus:outline-none focus:ring-4 focus:ring-white/30 font-black placeholder:text-neutral-300 transition-all shadow-xl"
                  placeholder="0123456789"
                />
              </div>

              {/* Phone Number */}
              <div className="space-y-2">
                <label className="block text-[10px] font-black uppercase tracking-[0.1em] text-white/80 font-mono pl-1">
                  Phone Number
                </label>
                <input
                  type="tel"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value.replace(/\D/g, ''))}
                  className="w-full bg-white border-0 rounded-[1.4rem] px-6 py-4.5 text-[13px] text-neutral-800 focus:outline-none focus:ring-4 focus:ring-white/30 font-black placeholder:text-neutral-300 transition-all shadow-xl"
                  placeholder="0801 234 5678"
                />
              </div>
            </div>
          </div>

          {/* Optional Operation Notes - Refined Style */}
          <div className="space-y-4">
            <div className="flex items-center gap-3 px-1">
              <label htmlFor="notes-input" className="text-[11px] font-black uppercase tracking-[0.2em] text-neutral-400 font-mono flex items-center gap-2">
                Notes <Plus className="w-3 h-3" />
              </label>
              <div className="h-px flex-1 bg-neutral-100"></div>
            </div>
            
            <div className="relative group">
              <input
                id="notes-input"
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full bg-white border border-neutral-100 rounded-[1.4rem] pl-6 pr-12 py-5 text-[14px] text-neutral-800 focus:outline-none focus:ring-4 focus:ring-[#00B87A]/10 font-medium shadow-sm transition-all placeholder:text-neutral-300"
                placeholder="e.g. Card transaction, or custom customer message..."
              />
              <div className="absolute right-5 top-1/2 -translate-y-1/2">
                {speechSupported && (
                  <button
                    type="button"
                    onClick={toggleListening}
                    className={`p-2 rounded-xl transition-all ${
                      isListening ? 'bg-red-500 text-white animate-pulse' : 'text-neutral-300 hover:text-[#00B87A]'
                    }`}
                  >
                    <Mic className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
            
            <div className="bg-neutral-50/50 border border-neutral-100 p-2 rounded-[1.4rem] shadow-inner">
               <AudioRecorder onSave={setAudioNote} initialAudio={audioNote} />
            </div>
          </div>



          {/* Live computes summary block - Compact professional version */}
          <div className={`p-5 rounded-[2rem] space-y-5 transition-all duration-500 border-2 ${
            liveFinancials.isConfigured 
              ? 'bg-[#F9FBFB] border-emerald-100/30 shadow-sm' 
              : 'bg-red-50/30 border-red-100 animate-pulse'
          }`}>
            {/* Header section with pulsating dot */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-2.5 h-2.5 rounded-full ${liveFinancials.isConfigured ? 'bg-[#00B87A] shadow-[0_0_8px_#00B87A]' : 'bg-red-500'} animate-pulse`}></div>
                <div className="flex flex-col">
                  <span className={`text-[11px] font-black uppercase tracking-[0.15em] font-mono leading-none ${liveFinancials.isConfigured ? 'text-[#00B87A]' : 'text-red-600'}`}>
                    LIVE PROJECTED
                  </span>
                  <span className={`text-[9px] font-black uppercase tracking-[0.1em] font-mono mt-1 ${liveFinancials.isConfigured ? 'text-emerald-800/30' : 'text-red-400'}`}>
                    COMMISSION COMPUTATION
                  </span>
                </div>
              </div>
              <div className="bg-neutral-100 px-3.5 py-2 rounded-xl border border-neutral-200/30">
                <span className="text-[8px] font-black text-neutral-400 uppercase tracking-widest font-mono">
                  REAL-TIME CALC
                </span>
              </div>
            </div>

            {!liveFinancials.isConfigured ? (
              <div className="flex items-start gap-3 py-2">
                <AlertTriangle className="w-5 h-5 text-red-500 mt-0.5 shrink-0" />
                <p className="text-[11px] font-black text-red-700 leading-relaxed uppercase tracking-tight font-mono">
                  {liveFinancials.error || "No pricing rule found for this transaction combination."}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* 2x2 Grid of Financial Cards - More compact */}
                <div className="grid grid-cols-2 gap-3">
                  {/* Card 1: Machine Cost */}
                  <div className="bg-[#FFF5F5] p-4 rounded-[1.4rem] border border-red-100 flex flex-col gap-1.5 shadow-sm">
                    <div className="flex items-center gap-2 text-red-400">
                      <Cpu className="w-3.5 h-3.5" />
                      <span className="text-[9px] font-black uppercase tracking-widest truncate">MACHINE COST</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[16px] font-black font-mono text-red-500">
                        -{formatNaira(liveTerminalFee)}
                      </span>
                      <span className="text-[8px] font-bold text-red-300 uppercase tracking-tighter">To {provider}</span>
                    </div>
                  </div>

                  {/* Card 2: Govt Levy */}
                  <div className="bg-[#FFFBEB] p-4 rounded-[1.4rem] border border-amber-100 flex flex-col gap-1.5 shadow-sm">
                    <div className="flex items-center gap-2 text-amber-600">
                      <Landmark className="w-3.5 h-3.5" />
                      <span className="text-[9px] font-black uppercase tracking-widest truncate">GOVT LEVY</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[16px] font-black font-mono text-amber-600">
                        -{formatNaira(liveCbnCharge)}
                      </span>
                      <span className="text-[8px] font-bold text-amber-300 uppercase tracking-tighter">Stamp Duty</span>
                    </div>
                  </div>

                  {/* Card 3: Client Fee */}
                  <div className="bg-[#F5F7FF] p-4 rounded-[1.4rem] border border-blue-100 flex flex-col gap-1.5 shadow-sm">
                    <div className="flex items-center gap-2 text-blue-600">
                      <ReceiptText className="w-3.5 h-3.5" />
                      <span className="text-[9px] font-black uppercase tracking-widest truncate">CLIENT FEE</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[16px] font-black font-mono text-blue-800">
                        +{formatNaira(customerFee)}
                      </span>
                      <span className="text-[8px] font-bold text-blue-300 uppercase tracking-tighter">Collected</span>
                    </div>
                  </div>

                  {/* Card 4: Net Earnings */}
                  <div className="bg-[#00B87A] p-4 rounded-[1.4rem] flex flex-col gap-1.5 shadow-lg shadow-emerald-500/10 text-white">
                    <div className="flex items-center gap-2 text-white/60">
                      <Banknote className="w-3.5 h-3.5" />
                      <span className="text-[9px] font-black uppercase tracking-widest truncate">NET PROFIT</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[16px] font-black font-mono text-white">
                        {formatNaira(customerFee - liveTerminalFee - liveCbnCharge)}
                      </span>
                      <span className="text-[8px] font-bold text-white/60 uppercase tracking-tighter">Take-home</span>
                    </div>
                  </div>
                </div>

                {/* Bottom Summary Insight Box - Scaled down */}
                <div className="bg-white border border-neutral-100 rounded-[1.5rem] p-4 flex items-center gap-3 shadow-sm">
                  <div className="bg-[#00B87A]/10 p-2.5 rounded-xl shrink-0">
                    <Zap className="w-4 h-4 text-[#00B87A] fill-[#00B87A]" />
                  </div>
                  <p className="text-[11px] text-neutral-600 leading-tight font-medium">
                    You gained <span className="font-black text-[#00B87A]">{formatNaira(customerFee - liveTerminalFee - liveCbnCharge)}</span> profit after <span className="font-black text-neutral-900">{formatNaira(liveTerminalFee + liveCbnCharge)}</span> costs.
                  </p>
                </div>
              </div>
            )}
          </div>


          {/* Action buttons */}
          <div className="flex gap-2.5 pt-2 flex-wrap sm:flex-nowrap">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 min-w-[80px] bg-neutral-100 hover:bg-neutral-150 border border-neutral-200 text-neutral-600 font-bold py-3 rounded-2xl cursor-pointer text-xs text-center transition"
            >
              Cancel
            </button>
            
            {!initialTransaction && (
              <button
                type="button"
                onClick={handleAddToBasket}
                disabled={!isFormSubmitAllowed}
                className={`flex-1 min-w-[130px] font-extrabold py-3 rounded-2xl cursor-pointer text-xs transition flex items-center justify-center gap-1.5 ${
                  isFormSubmitAllowed 
                    ? 'bg-neutral-50 hover:bg-neutral-100 border border-[#00B87A]/30 hover:border-[#00B87A] text-[#00B87A]' 
                    : 'bg-neutral-100 border-neutral-200 text-neutral-400 cursor-not-allowed opacity-60'
                }`}
                title={
                  isPosMissing 
                    ? "POS Terminal selection required before adding to batch" 
                    : liveFinancials.isConfigured 
                      ? "Add current transaction to batch ticket and start another" 
                      : "Pricing rule missing - cannot add to batch"
                }
              >
                <Plus className={`w-4 h-4 stroke-[2] ${isFormSubmitAllowed ? 'text-[#00B87A]' : 'text-neutral-300'}`} />
                {isPosMissing ? 'Select POS First' : 'Add to Batch'}
              </button>
            )}

            <button
              type="submit"
              disabled={!isFormSubmitAllowed}
              className={`flex-1 min-w-[140px] font-extrabold py-3 rounded-2xl cursor-pointer text-xs shadow-lg transition flex items-center justify-center gap-1.5 ${
                isFormSubmitAllowed 
                  ? 'bg-[#00B87A] hover:bg-emerald-600 text-white shadow-[#00B87A]/20' 
                  : 'bg-neutral-300 text-neutral-500 shadow-none cursor-not-allowed'
              }`}
              title={
                isPosMissing 
                  ? "Select a POS terminal device above to approve this transaction" 
                  : undefined
              }
            >
              {isFormSubmitAllowed ? <Check className="w-4 h-4 stroke-[3]" /> : <Lock className="w-4 h-4" />}
              {isPosMissing 
                ? 'Select POS Terminal First' 
                : initialTransaction 
                  ? 'Update Receipt' 
                  : basket.length > 0 
                    ? 'Confirm & Save All' 
                    : (liveFinancials.isConfigured ? 'Confirm Receipt' : 'Pricing Restricted')}
            </button>
          </div>

        </form>

      </div>
    </div>
  );
}
