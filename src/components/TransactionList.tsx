/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Transaction, TransactionType, ProviderType, User, AppSettings, HistoryFilter, HistoryFilterType } from '../types';
import { formatNaira, getProviderTransactionNumber, getFriendlyTypeLabel, analyzeQuery } from '../utils';
import { 
  Search, 
  Trash2, 
  Download, 
  Filter, 
  Calendar,
  Layers,
  ArrowRightLeft,
  ArrowRight,
  RefreshCcw,
  Globe,
  DollarSign,
  Pencil,
  FileCheck,
  Settings,
  X,
  CreditCard,
  Info,
  ArrowUpRight,
  ArrowDownLeft,
  Receipt,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Smartphone,
  Play,
  Pause,
  Mic,
  Clock,
  ShieldAlert,
  Sparkles
} from 'lucide-react';

const getBankBadgeStyle = (bankName: string): string => {
  switch (bankName) {
    case 'OPay': return 'bg-emerald-50 text-[#00B87A] border-emerald-200';
    case 'Moniepoint': return 'bg-blue-50 text-blue-700 border-blue-200';
    case 'PalmPay': return 'bg-orange-50 text-orange-700 border-orange-200';
    case 'Access Bank': return 'bg-orange-50 text-orange-700 border-orange-200';
    case 'GTBank': return 'bg-amber-50 text-amber-700 border-amber-200';
    case 'Zenith Bank': return 'bg-red-50 text-red-700 border-red-200';
    case 'UBA': return 'bg-red-50 text-red-800 border-red-200';
    case 'First Bank': return 'bg-yellow-50 text-amber-800 border-yellow-200';
    case 'Union Bank': return 'bg-sky-50 text-sky-700 border-sky-200';
    case 'Fidelity Bank': return 'bg-blue-50 text-blue-900 border-blue-200';
    case 'Sterling Bank': return 'bg-red-50 text-red-600 border-red-200';
    case 'Wema Bank': return 'bg-purple-50 text-purple-700 border-purple-200';
    case 'Stanbic IBTC': return 'bg-indigo-50 text-indigo-700 border-indigo-200';
    case 'EcoBank': return 'bg-teal-50 text-teal-700 border-teal-200';
    case 'FCMB': return 'bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200';
    case 'Kuda Bank': return 'bg-emerald-50 text-emerald-950 border-emerald-200';
    case 'Keystone Bank': return 'bg-blue-50 text-blue-900 border-blue-200';
    case 'Polaris Bank': return 'bg-indigo-50 text-indigo-900 border-indigo-200';
    case 'Providus Bank': return 'bg-yellow-50 text-yellow-800 border-yellow-200';
    case 'Jaiz Bank': return 'bg-green-50 text-green-800 border-green-200';
    case 'Taj Bank': return 'bg-emerald-50 text-emerald-800 border-emerald-200';
    case 'Nomba': return 'bg-zinc-50 text-zinc-800 border-zinc-200';
    case 'MTN': return 'bg-amber-50 text-amber-700 border-amber-200';
    case 'Airtel': return 'bg-red-50 text-red-700 border-red-200';
    case 'Glo': return 'bg-green-50 text-green-700 border-green-200';
    case '9mobile': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    default: return 'bg-neutral-50 text-neutral-700 border-neutral-200';
  }
};

interface TransactionListProps {
  currentUser: User;
  transactions: Transaction[];
  onDeleteTransaction: (id: string) => void;
  onEditTransaction: (tx: Transaction) => void;
  onViewReceipt?: (tx: Transaction) => void;
  onUpdateTransaction?: (tx: Transaction) => void;
  onBulkDeleteTransactions?: (ids: string[]) => void;
  onBulkUpdateTransactions?: (txs: Transaction[]) => void;
  settings?: AppSettings;
  onOpenSettings?: () => void;
  historyFilter: HistoryFilter;
  onSetHistoryFilter: (filter: HistoryFilter) => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  typeFilter: string;
  setTypeFilter: (t: string) => void;
  providerFilter: string;
  setProviderFilter: (p: string) => void;
}

export const TransactionList = React.memo(({
  currentUser,
  transactions,
  onDeleteTransaction,
  onEditTransaction,
  onViewReceipt,
  onUpdateTransaction,
  onBulkDeleteTransactions,
  onBulkUpdateTransactions,
  settings,
  onOpenSettings,
  historyFilter,
  onSetHistoryFilter,
  searchQuery,
  setSearchQuery,
  typeFilter,
  setTypeFilter,
  providerFilter,
  setProviderFilter
}: TransactionListProps) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [customStart, setCustomStart] = useState<string>(historyFilter?.customStart || new Date().toISOString().slice(0, 10));
  const [customEnd, setCustomEnd] = useState<string>(historyFilter?.customEnd || new Date().toISOString().slice(0, 10));
  const [isCustomDateOpen, setIsCustomDateOpen] = useState(false);
  
  // Bulk selection state for managers
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  
  // Custom tracking modes for accessibility
  const [viewMode, setViewMode] = useState<'easy' | 'advanced'>('easy');
  const [cardSize, setCardSize] = useState<'small' | 'medium' | 'large'>('small');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [expandedTxId, setExpandedTxId] = useState<string | null>(null);

  // Employee editing settle state
  const [settlingTx, setSettlingTx] = useState<Transaction | null>(null);
  const [settleFeeInput, setSettleFeeInput] = useState<string>('');
  const [settleFeeMethod, setSettleFeeMethod] = useState<'Cash' | 'CardDebit'>('Cash');
  
  // Audio playback state
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
  const [currentAudio, setCurrentAudio] = useState<HTMLAudioElement | null>(null);

  useEffect(() => {
    return () => {
      if (currentAudio) {
        currentAudio.pause();
      }
    };
  }, [currentAudio]);

  const playAudioNote = (txId: string, base64Audio: string) => {
    if (playingAudioId === txId && currentAudio) {
      currentAudio.pause();
      setPlayingAudioId(null);
      setCurrentAudio(null);
    } else {
      if (currentAudio) {
        currentAudio.pause();
      }
      const audio = new Audio(base64Audio);
      audio.onended = () => {
        setPlayingAudioId(null);
        setCurrentAudio(null);
      };
      audio.onerror = () => {
        setPlayingAudioId(null);
        setCurrentAudio(null);
      };
      audio.play().catch(err => {
        console.error("Audio playback error:", err);
      });
      setPlayingAudioId(txId);
      setCurrentAudio(audio);
    }
  };

  useEffect(() => {
    if (settlingTx) {
      setSettleFeeInput((settlingTx.unpaidFeeAmount ?? settlingTx.customerFee ?? 0).toString());
      setSettleFeeMethod(settlingTx.feeMethod || 'Cash');
    }
  }, [settlingTx]);

  const handleCopy = (id: string) => {
    navigator.clipboard.writeText(id).catch(() => {});
    setCopiedId(id);
    setTimeout(() => {
      setCopiedId(null);
    }, 2000);
  };

  const handleApproveSettlement = (tx: Transaction) => {
    if (!tx.pendingSettlement || !onUpdateTransaction) return;
    
    const ps = tx.pendingSettlement;
    const updatedPayments = [...(tx.chargePayments || []), ps.proposedPaymentRecord];
    
    // Realistic Profit = (Total Paid Fees) - (Terminal Fee) - (CBN Charge) + (Cashback)
    const totalPaidFees = ps.proposedTotalPaidSoFar;
    const terminalFee = tx.terminalFee || 0;
    const cbnCharge = tx.cbnCharge || 0;
    const cashback = tx.cashback || 0;
    const updatedProfit = totalPaidFees - terminalFee - cbnCharge + cashback;

    const updatedTx: Transaction = {
      ...tx,
      chargesStatus: ps.proposedChargesStatus,
      chargesPaidAmount: ps.proposedTotalPaidSoFar,
      unpaidFeeAmount: ps.proposedUnpaidAmount,
      chargePayments: updatedPayments,
      customerFee: ps.proposedTotalPaidSoFar + (ps.proposedUnpaidAmount || 0), // Restore full fee context
      profit: updatedProfit,
      agentProfit: updatedProfit,
      netProfit: updatedProfit,
      feeMethod: ps.feeMethod || tx.feeMethod,
      pendingSettlement: undefined, // Clear the pending flag
      approvalStatus: 'approved',
      status: 'Success',
      approved: true,
      approvedBy: currentUser?.id || 'manager',
      approvedAt: new Date().toISOString()
    };
    
    onUpdateTransaction(updatedTx);
  };

  const handleRejectSettlement = (tx: Transaction) => {
    if (!onUpdateTransaction) return;
    const updatedTx: Transaction = {
      ...tx,
      pendingSettlement: undefined
    };
    onUpdateTransaction(updatedTx);
  };

  // Compute accumulated stats for visual quick-tabs
  const stats = useMemo(() => {
    let withdrawCount = 0;
    let withdrawVol = 0;
    let transferCount = 0;
    let transferVol = 0;
    let depositCount = 0;
    let depositVol = 0;
    let airtimeCount = 0;
    let airtimeVol = 0;

    let opayCount = 0;
    let opayVol = 0;
    let moniepointCount = 0;
    let moniepointVol = 0;
    let palmpayCount = 0;
    let palmpayVol = 0;

    transactions.forEach((tx) => {
      if (tx.type === 'Withdrawal' || tx.type === 'Cash Out (Transfer)') {
        withdrawCount++;
        withdrawVol += tx.amount;
      } else if (tx.type === 'Transfer') {
        transferCount++;
        transferVol += tx.amount;
      } else if (tx.type === 'Deposit') {
        depositCount++;
        depositVol += tx.amount;
      } else if (tx.type === 'Airtime' || tx.type === 'Data') {
        airtimeCount++;
        airtimeVol += tx.amount;
      }

      if (tx.provider === 'Dan Godal Postracker') {
        opayCount++;
        opayVol += tx.amount;
      } else if (tx.provider === 'Moniepoint') {
        moniepointCount++;
        moniepointVol += tx.amount;
      } else if (tx.provider === 'PalmPay') {
        palmpayCount++;
        palmpayVol += tx.amount;
      }
    });

    return {
      allCount: transactions.length,
      allVol: transactions.reduce((acc, tx) => acc + tx.amount, 0),
      withdrawCount,
      withdrawVol,
      transferCount,
      transferVol,
      depositCount,
      depositVol,
      airtimeCount,
      airtimeVol,
      opayCount,
      opayVol,
      moniepointCount,
      moniepointVol,
      palmpayCount,
      palmpayVol
    };
  }, [transactions]);

  // Transactions are already filtered in App.tsx (Synchronization Layer)
  const filteredList = transactions;
  
  // Re-run analysis for UI display of filter pills
  const queryAnalysis = useMemo(() => analyzeQuery(searchQuery), [searchQuery]);

  // Financial Summary for filtered transactions
  const financialSummary = useMemo(() => {
    return filteredList.reduce((acc, tx) => {
      acc.totalTransactions++;
      const isSuccess = tx.status === 'Success' || (tx.status || 'Success') === 'Success';
      const isFailed = tx.status === 'Failed';
      const isPending = !isSuccess && !isFailed;

      if (isSuccess) {
        acc.totalSuccessful++;
        acc.totalVolume += tx.amount || 0;
        acc.totalCustomerFees += tx.customerFee || 0;
        acc.totalProviderCharges += tx.providerCharge || 0;
        acc.totalCBNCharges += tx.cbnCharge || 0;
        acc.totalCashback += tx.cashback || 0;
        
        // Use stored profit value as per enterprise requirements
        acc.totalProfit += tx.profit || 0;
      } else if (isFailed) {
        acc.totalFailed++;
      } else if (isPending) {
        acc.totalPending++;
      }
      return acc;
    }, {
      totalTransactions: 0,
      totalSuccessful: 0,
      totalFailed: 0,
      totalPending: 0,
      totalVolume: 0,
      totalCustomerFees: 0,
      totalProviderCharges: 0,
      totalCBNCharges: 0,
      totalCashback: 0,
      totalProfit: 0
    });
  }, [filteredList]);

  const totalItems = filteredList.length;
  const pageSize = settings?.pageSize || 10;
  const totalPages = Math.ceil(totalItems / pageSize);

  // Reset page when filters or queries change to avoid blank pages
  React.useEffect(() => {
    setCurrentPage(1);
  }, [typeFilter, providerFilter, searchQuery, historyFilter]);

  const paginatedList = useMemo(() => {
    const startIdx = (currentPage - 1) * pageSize;
    return filteredList.slice(startIdx, startIdx + pageSize);
  }, [filteredList, currentPage, pageSize]);

  // Synchronize selection with visible filtered list to avoid orphaned selections
  React.useEffect(() => {
    setSelectedIds(prev => prev.filter(id => filteredList.some(tx => tx.id === id)));
  }, [filteredList]);

  const isAllSelected = useMemo(() => {
    if (filteredList.length === 0) return false;
    return filteredList.every(tx => selectedIds.includes(tx.id));
  }, [filteredList, selectedIds]);

  const handleSelectAllToggle = (checked: boolean) => {
    if (checked) {
      const allIds = filteredList.map(tx => tx.id);
      setSelectedIds(allIds);
    } else {
      setSelectedIds([]);
    }
  };

  const toggleSelect = (id: string, checked: boolean) => {
    if (checked) {
      setSelectedIds(prev => [...prev, id]);
    } else {
      setSelectedIds(prev => prev.filter(item => item !== id));
    }
  };

  const handleBulkStatusUpdate = (newStatus: 'Success' | 'Pending' | 'Failed') => {
    const selectedTxs = transactions.filter(t => selectedIds.includes(t.id));
    const updatedTxs = selectedTxs.map(t => ({
      ...t,
      status: newStatus
    }));
    if (onBulkUpdateTransactions) {
      onBulkUpdateTransactions(updatedTxs);
    } else if (onUpdateTransaction) {
      updatedTxs.forEach(tx => onUpdateTransaction(tx));
    }
    setSelectedIds([]);
  };

  const handleBulkDebtUpdate = (newChargesStatus: 'Paid' | 'Unpaid') => {
    const selectedTxs = transactions.filter(t => selectedIds.includes(t.id));
    const updatedTxs = selectedTxs.map(t => {
      const isPaid = newChargesStatus === 'Paid';
      return {
        ...t,
        chargesStatus: newChargesStatus,
        unpaidFeeAmount: isPaid ? 0 : (t.originalFeeAmount ?? t.customerFee),
        chargesPaidAmount: isPaid ? (t.originalFeeAmount ?? t.customerFee) : 0
      };
    });
    if (onBulkUpdateTransactions) {
      onBulkUpdateTransactions(updatedTxs);
    } else if (onUpdateTransaction) {
      updatedTxs.forEach(tx => onUpdateTransaction(tx));
    }
    setSelectedIds([]);
  };

  const handleBulkDelete = () => {
    if (onBulkDeleteTransactions) {
      onBulkDeleteTransactions(selectedIds);
    } else {
      selectedIds.forEach(id => onDeleteTransaction(id));
    }
    setSelectedIds([]);
  };

  // Dynamic ledger size metrics count and volume calculations
  const metrics = useMemo(() => {
    const depositTxs = filteredList.filter(t => t.type === 'Deposit');
    const withdrawalTxs = filteredList.filter(t => t.type === 'Withdrawal');
    const transferTxs = filteredList.filter(t => t.type === 'Transfer');

    const totalDepositAmt = depositTxs.reduce((sum, t) => sum + t.amount, 0);
    const totalWithdrawalAmt = withdrawalTxs.reduce((sum, t) => sum + t.amount, 0);
    const totalTransferAmt = transferTxs.reduce((sum, t) => sum + t.amount, 0);

    const totalCount = filteredList.length;
    const totalAmount = filteredList.reduce((sum, t) => sum + (t.amount || 0), 0);
    const totalCustomerFees = filteredList.reduce((sum, t) => sum + (t.customerCharge || t.customerFee || 0), 0);
    const totalProviderCharges = filteredList.reduce((sum, t) => sum + (t.providerCharge || t.terminalFee || 0), 0);
    const totalCbnCharges = filteredList.reduce((sum, t) => sum + (t.cbnCharge || 0), 0);
    const totalProfit = filteredList.reduce((sum, t) => sum + (t.profit || 0), 0);

    return {
      depositsCount: depositTxs.length,
      depositsAmount: totalDepositAmt,
      withdrawalsCount: withdrawalTxs.length,
      withdrawalsAmount: totalWithdrawalAmt,
      transfersCount: transferTxs.length,
      transfersAmount: totalTransferAmt,
      totalCount,
      totalAmount,
      totalCustomerFees,
      totalProviderCharges,
      totalCbnCharges,
      totalProfit,
    };
  }, [filteredList]);

  const rowPadding = settings?.listDensity === 'compact' ? 'py-1.5 px-2' : 'py-3.5 px-2';

  // CSV Exporter
  const handleExportCSV = () => {
    if (filteredList.length === 0) {
      alert('No record transactions found to export.');
      return;
    }

    const headers = ['TXID', 'Bank Reference', 'Timestamp', 'Staff Operator', 'Type', 'POS Provider', 'Amount(NGN)', 'Customer FeeCharged', 'Terminal Cost', 'Profit(NGN)', 'Notes', 'Customer Phone'];
    
    const rows = filteredList.map(tx => [
      tx.id,
      getProviderTransactionNumber(tx),
      new Date(tx.timestamp).toLocaleString(),
      tx.employeeName,
      tx.type,
      tx.provider,
      tx.amount.toString(),
      tx.customerFee.toString(),
      tx.terminalFee.toString(),
      tx.profit.toString(),
      tx.notes || '',
      tx.customerPhone || ''
    ]);

    const csvContent = 
      'data:text/csv;charset=utf-8,' + 
      [headers.join(','), ...rows.map(e => e.map(val => `"${val.replace(/"/g, '""')}"`).join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `OPayStyle_ReceiptExport_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="bg-white border border-neutral-200 rounded-3xl p-5 space-y-4 shadow-sm max-h-[80vh] overflow-y-auto">
      {/* List Toolbar Actions */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-neutral-100 pb-4">
        <div>
          <h3 className="text-base font-extrabold text-neutral-800 tracking-tight flex items-center gap-1.5">
            <Layers className="text-[#00B87A] w-4.5 h-4.5" /> General Ledger Receipts
          </h3>
          <p className="text-xs text-neutral-500 mt-1 font-medium">
            Displaying {filteredList.length} of {transactions.length} processed receipts.
          </p>
        </div>

        {/* Action Button Container */}
        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
          {currentUser.role === 'Manager' && onOpenSettings && (
            <button
              type="button"
              onClick={onOpenSettings}
              className="flex-1 sm:flex-initial bg-white hover:bg-[#00B87A]/10 border border-[#00B87A]/25 text-[#00B87A] px-3.5 py-2 rounded-xl text-xs font-bold font-sans flex items-center justify-center gap-1.5 transition cursor-pointer select-none active:scale-[0.98]"
              title="Configure receipt branding and baseline commission parameters"
            >
              <Settings className="w-3.5 h-3.5" />
              Settings
            </button>
          )}

          {/* CSV Excel Exporter */}
          <button
            type="button"
            onClick={handleExportCSV}
            className="flex-1 sm:flex-initial bg-neutral-50 hover:bg-neutral-100 border border-neutral-200 text-neutral-700 hover:text-neutral-900 px-3.5 py-2 rounded-xl text-xs font-bold font-sans flex items-center justify-center gap-2 transition cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            Export CSV Log
          </button>
        </div>
      </div>

      {/* Visual Tracking Mode & Size Selector */}
      <div className="bg-neutral-50 border border-neutral-200 p-3 rounded-2xl flex flex-col lg:flex-row lg:items-center justify-between gap-3 shadow-xs">
        <div className="space-y-0.5">
          <span className="text-[10px] font-mono font-black tracking-widest text-[#00B87A] uppercase block flex items-center gap-1">
            ⭐ LEDGER VISUAL SETTINGS:
          </span>
          <p className="text-[11px] text-neutral-600 font-bold leading-normal">
            Choose display layout and density spacing. Small mode provides a beautiful, high-efficiency compact layout!
          </p>
        </div>
        
        <div className="flex flex-wrap items-center gap-2.5">
          {/* View Format Selector */}
          <div className="flex bg-neutral-200/60 p-1 rounded-xl self-start lg:self-auto shrink-0 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => setViewMode('easy')}
              className={`flex-1 sm:flex-initial px-3.5 py-1.5 rounded-lg text-xs font-black transition flex items-center justify-center gap-1 cursor-pointer ${
                viewMode === 'easy'
                  ? 'bg-[#00B87A] text-white shadow-sm'
                  : 'text-neutral-600 hover:text-neutral-900'
              }`}
            >
              💡 Easy Cards
            </button>
            <button
              type="button"
              onClick={() => setViewMode('advanced')}
              className={`flex-1 sm:flex-initial px-3.5 py-1.5 rounded-lg text-xs font-black transition flex items-center justify-center gap-1 cursor-pointer ${
                viewMode === 'advanced'
                  ? 'bg-neutral-800 text-white shadow-sm'
                  : 'text-neutral-600 hover:text-neutral-900'
              }`}
            >
              📊 Detailed Table
            </button>
          </div>

          {/* Size Density Selector */}
          <div className="flex bg-neutral-200/60 p-1 rounded-xl self-start lg:self-auto shrink-0 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => setCardSize('small')}
              className={`flex-1 sm:flex-initial px-3 py-1.5 rounded-lg text-xs font-black transition flex items-center justify-center gap-1 cursor-pointer ${
                cardSize === 'small'
                  ? 'bg-neutral-900 text-white shadow-sm'
                  : 'text-neutral-600 hover:text-neutral-900'
              }`}
              title="Compact compact high-density layout"
            >
              🗜️ Small Mode
            </button>
            <button
              type="button"
              onClick={() => setCardSize('medium')}
              className={`flex-1 sm:flex-initial px-3 py-1.5 rounded-lg text-xs font-black transition flex items-center justify-center gap-1 cursor-pointer ${
                cardSize === 'medium'
                  ? 'bg-neutral-900 text-white shadow-sm'
                  : 'text-neutral-600 hover:text-neutral-900'
              }`}
              title="Standard balanced spacing"
            >
              ⚖️ Medium
            </button>
            <button
              type="button"
              onClick={() => setCardSize('large')}
              className={`flex-1 sm:flex-initial px-3 py-1.5 rounded-lg text-xs font-black transition flex items-center justify-center gap-1 cursor-pointer ${
                cardSize === 'large'
                  ? 'bg-neutral-900 text-white shadow-sm'
                  : 'text-neutral-600 hover:text-neutral-900'
              }`}
              title="Large cozy readability layout"
            >
              🔍 Large
            </button>
          </div>
        </div>
      </div>

      {/* Dynamic Sized Transaction History Metrics Summary */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
        {/* Metric 1: Number of Transactions */}
        <div className="bg-neutral-50/50 border border-neutral-200/60 p-2 rounded-xl flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-neutral-100 text-neutral-600 flex items-center justify-center shrink-0 border border-neutral-200">
            <Receipt className="w-4 h-4 stroke-[2.3]" />
          </div>
          <div className="min-w-0">
            <span className="text-[9px] font-mono font-black text-neutral-400 uppercase tracking-wider block leading-none">
              Transactions
            </span>
            <div className="text-[11px] font-mono font-black text-neutral-800 mt-0.5 leading-none">
              {metrics.totalCount} receipts
            </div>
          </div>
        </div>

        {/* Metric 2: Total Transaction Amount */}
        <div className="bg-neutral-50/50 border border-neutral-200/60 p-2 rounded-xl flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 border border-blue-100">
            <Layers className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <span className="text-[9px] font-mono font-black text-neutral-400 uppercase tracking-wider block leading-none">
              Total Amount
            </span>
            <div className="text-[11px] font-mono font-black text-neutral-800 mt-0.5 leading-none truncate">
              {formatNaira(metrics.totalAmount)}
            </div>
          </div>
        </div>

        {/* Metric 3: Total Customer Fees */}
        <div className="bg-neutral-50/50 border border-neutral-200/60 p-2 rounded-xl flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0 border border-indigo-100">
            <DollarSign className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <span className="text-[9px] font-mono font-black text-neutral-400 uppercase tracking-wider block leading-none">
              Customer Fees
            </span>
            <div className="text-[11px] font-mono font-black text-neutral-800 mt-0.5 leading-none truncate">
              {formatNaira(metrics.totalCustomerFees)}
            </div>
          </div>
        </div>

        {/* Metric 4: Total Provider Charges */}
        <div className="bg-neutral-50/50 border border-neutral-200/60 p-2 rounded-xl flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-orange-50 text-orange-600 flex items-center justify-center shrink-0 border border-orange-100">
            <CreditCard className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <span className="text-[9px] font-mono font-black text-neutral-400 uppercase tracking-wider block leading-none">
              Provider Charges
            </span>
            <div className="text-[11px] font-mono font-black text-neutral-800 mt-0.5 leading-none truncate">
              {formatNaira(metrics.totalProviderCharges)}
            </div>
          </div>
        </div>

        {/* Metric 5: Total CBN Charges */}
        <div className="bg-neutral-50/50 border border-neutral-200/60 p-2 rounded-xl flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-red-50 text-red-600 flex items-center justify-center shrink-0 border border-red-100">
            <AlertTriangle className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <span className="text-[9px] font-mono font-black text-neutral-400 uppercase tracking-wider block leading-none">
              CBN Charges
            </span>
            <div className="text-[11px] font-mono font-black text-neutral-800 mt-0.5 leading-none truncate">
              {formatNaira(metrics.totalCbnCharges)}
            </div>
          </div>
        </div>

        {/* Metric 6: Total Profit */}
        <div className="bg-emerald-50 border border-emerald-200 p-2 rounded-xl flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 border border-emerald-200">
            <DollarSign className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <span className="text-[9px] font-mono font-black text-emerald-600 uppercase tracking-wider block leading-none">
              Total Profit
            </span>
            <div className="text-[11px] font-mono font-black text-emerald-900 mt-0.5 leading-none truncate">
              {formatNaira(metrics.totalProfit)}
            </div>
          </div>
        </div>
      </div>

      {/* General Permission Badge Warning for Managers */}
      {currentUser.role === 'Manager' && (
        <div className="bg-[#00B87A]/5 border border-[#00B87A]/20 p-3.5 rounded-2xl flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="p-1 px-2 bg-[#00B87A]/15 text-[#00B87A] rounded-lg font-mono text-[9px] font-black uppercase tracking-wider shrink-0">
              GENERAL AUDITOR VIEW
            </span>
            <p className="text-neutral-600 font-bold leading-normal">
              Manager permissions have bypassed terminal path restrictions to allow viewing and auditing all employee transaction channels. Deleting/voiding or employee modifications are disabled.
            </p>
          </div>
        </div>
      )}

      {/* Intermittent category quick filters */}
      <div className="space-y-4">
        <div className="space-y-1.5">
          <span className="text-[10px] font-mono font-bold tracking-widest text-neutral-450 uppercase block">Category Operation Filters:</span>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            {[
              { id: 'ALL', label: 'Every Transaction 🌐', count: stats.allCount, vol: stats.allVol, color: 'border-neutral-200 text-neutral-600 bg-neutral-50/50', activeColor: 'bg-[#00B87A] border-[#00B87A] text-white' },
              { id: 'Withdrawal', label: '📥 Withdraw', count: stats.withdrawCount, vol: stats.withdrawVol, color: 'border-orange-100 text-orange-700 bg-orange-50/30', activeColor: 'bg-orange-600 border-orange-600 text-white' },
              { id: 'Transfer', label: '💸 Bank Transfers', count: stats.transferCount, vol: stats.transferVol, color: 'border-indigo-100 text-indigo-700 bg-indigo-50/30', activeColor: 'bg-indigo-600 border-indigo-600 text-white' },
              { id: 'Deposit', label: '📤 Money Receive', count: stats.depositCount, vol: stats.depositVol, color: 'border-blue-100 text-blue-700 bg-blue-50/30', activeColor: 'bg-blue-600 border-blue-600 text-white' },
              { id: 'Airtime', label: '📱 Airtime Sale', count: stats.airtimeCount, vol: stats.airtimeVol, color: 'border-purple-100 text-purple-700 bg-purple-50/30', activeColor: 'bg-purple-600 border-purple-600 text-white' }
            ].map((tab) => {
              const isActive = typeFilter === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setTypeFilter(tab.id)}
                  className={`flex flex-col justify-between p-3 rounded-2xl border text-left transition-all duration-155 cursor-pointer active:scale-98 ${
                    isActive 
                      ? `${tab.activeColor} shadow-md font-bold scale-[1.01]` 
                      : `${tab.color} hover:bg-neutral-50 hover:border-neutral-300`
                  }`}
                >
                  <div className="flex items-center justify-between w-full gap-1">
                    <span className="text-[11px] font-extrabold tracking-tight truncate">{tab.label}</span>
                    <span className={`text-[9px] font-mono font-black px-1.5 py-0.5 rounded-full ${
                      isActive ? 'bg-white/20 text-white' : 'bg-neutral-200 text-neutral-700'
                    }`}>
                      {tab.count}
                    </span>
                  </div>
                  <div className="mt-2 flex items-baseline justify-between w-full">
                    <span className={`text-[8px] font-mono uppercase tracking-wider ${isActive ? 'text-white/60' : 'text-neutral-450'}`}>Vol:</span>
                    <span className="text-xs font-black font-mono">
                      {formatNaira(tab.vol)}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Separated host network history quick-tabs bar */}
        <div className="space-y-2 border-t border-neutral-50 pt-4">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono font-black tracking-[0.15em] text-emerald-600 uppercase block">
              Network Distribution Ledger:
            </span>
            {providerFilter !== 'ALL' && (
              <button
                type="button"
                onClick={() => setProviderFilter('ALL')}
                className="text-[9px] font-black text-rose-500 uppercase tracking-widest hover:underline cursor-pointer font-mono"
              >
                Clear Filters
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { id: 'ALL', label: 'All Networks 🌐', count: stats.allCount, vol: stats.allVol, color: 'border-neutral-100 text-neutral-600 bg-neutral-50/50', activeColor: 'bg-neutral-900 border-neutral-900 text-white shadow-lg shadow-neutral-900/10' },
              { id: 'OPay', label: 'OPay Logs 🟢', count: stats.opayCount, vol: stats.opayVol, color: 'border-emerald-100/50 text-emerald-600 bg-emerald-50/10', activeColor: 'bg-emerald-600 border-emerald-600 text-white shadow-lg shadow-emerald-500/20' },
              { id: 'Moniepoint', label: 'Moniepoint 🔵', count: stats.moniepointCount, vol: stats.moniepointVol, color: 'border-blue-100/50 text-blue-600 bg-blue-50/10', activeColor: 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-500/20' },
              { id: 'PalmPay', label: 'PalmPay Logs 🟠', count: stats.palmpayCount, vol: stats.palmpayVol, color: 'border-orange-100/50 text-orange-600 bg-orange-50/10', activeColor: 'bg-orange-600 border-orange-600 text-white shadow-lg shadow-orange-500/20' }
            ].map((tab) => {
              const isActive = providerFilter === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setProviderFilter(tab.id)}
                  className={`flex flex-col justify-between p-3 rounded-2xl border text-left transition-all duration-200 cursor-pointer active:scale-95 text-xs ${
                    isActive 
                      ? `${tab.activeColor} font-black scale-[1.02]` 
                      : `${tab.color} hover:bg-white hover:border-neutral-200`
                  }`}
                >
                  <div className="flex items-center justify-between w-full gap-2">
                    <span className="text-[10px] font-black tracking-tight truncate uppercase font-mono">{tab.label}</span>
                    <span className={`text-[8px] font-mono font-black px-2 py-0.5 rounded-lg ${
                      isActive ? 'bg-white/20 text-white' : 'bg-neutral-100 text-neutral-500'
                    }`}>
                      {tab.count}
                    </span>
                  </div>
                  <div className="mt-2.5 flex items-baseline justify-between w-full">
                    <span className={`text-[7px] font-black uppercase tracking-widest font-mono ${isActive ? 'text-white/50' : 'text-neutral-400'}`}>Vol:</span>
                    <span className="text-[10px] font-black font-mono tracking-tighter">
                      {formatNaira(tab.vol)}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Advanced Combined search information guide */}
      <div className="bg-[#00B87A]/5 border border-[#00B87A]/15 p-3.5 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
        <div className="space-y-0.5">
          <span className="text-[10px] font-extrabold text-[#00B87A] tracking-wider uppercase flex items-center gap-1.5 font-mono">
            <Search className="w-3.5 h-3.5 animate-pulse" /> SMART COMBINED NATSEARCH ENGINE
          </span>
          <p className="text-neutral-600 font-medium">
            Type natural multi-parameters in the search fields! E.g. <strong className="text-neutral-800 font-bold bg-[#00B87A]/10 px-1 rounded">"opay withdrawal 5000"</strong> or <strong className="text-neutral-800 font-bold bg-[#00B87A]/10 px-1 rounded">"moniepoint transfer"</strong>.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[9px] text-neutral-450 uppercase font-mono font-bold mr-1">Tweak Demo:</span>
          {[
            { label: 'OPay Withdraw', query: 'OPay Withdrawal' },
            { label: 'Moniepoint Transfer', query: 'Moniepoint Transfer' },
            { label: 'PalmPay Samebank', query: 'PalmPay Samebank' }
          ].map((item, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => {
                setSearchQuery(item.query);
                setTypeFilter('ALL');
                setProviderFilter('ALL');
              }}
              className="px-2.5 py-1 text-[10px] font-bold bg-white text-neutral-700 hover:text-[#00B87A] border border-neutral-200 hover:border-[#00B87A] rounded-lg cursor-pointer transition active:scale-95 shadow-xs"
            >
              🚀 {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* Multi Filtering Input Matrix */}
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Search Input bar */}
          <div className="relative group">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400 w-4 h-4 transition-colors group-focus-within:text-[#00B87A]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white border border-neutral-100 focus:border-[#00B87A]/50 focus:ring-4 focus:ring-[#00B87A]/5 focus:outline-none rounded-[1.25rem] pl-10 pr-4 py-3 text-xs text-neutral-900 transition font-black placeholder:text-neutral-400 placeholder:font-bold shadow-sm"
              placeholder="Search anything..."
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[10px] font-black font-mono text-red-500 hover:text-red-700 bg-red-50 px-2 py-1 rounded-lg"
              >
                CLEAR
              </button>
            )}
          </div>

          {/* Categories selector */}
          <div className="relative group">
            <Filter className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400 w-3.5 h-3.5 pointer-events-none group-focus-within:text-[#00B87A]" />
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="w-full appearance-none bg-white border border-neutral-100 focus:border-[#00B87A]/50 focus:ring-4 focus:ring-[#00B87A]/5 focus:outline-none rounded-[1.25rem] pl-10 pr-4 py-3 text-xs text-neutral-700 font-black shadow-sm cursor-pointer"
            >
              <option value="ALL">Every Category</option>
              <option value="Withdrawal">📥 Cash Out</option>
              <option value="Deposit">📤 Cash In</option>
              <option value="Transfer">💸 Bank Transfer</option>
            </select>
          </div>

          {/* POS Provider selector */}
          <div className="relative group">
            <ArrowRightLeft className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400 w-3.5 h-3.5 pointer-events-none group-focus-within:text-[#00B87A]" />
            <select
              value={providerFilter}
              onChange={(e) => setProviderFilter(e.target.value)}
              className="w-full appearance-none bg-[#00B87A]/5 border border-[#00B87A]/10 focus:border-[#00B87A]/50 focus:ring-4 focus:ring-[#00B87A]/5 focus:outline-none rounded-[1.25rem] pl-10 pr-4 py-3 text-xs text-[#00B87A] font-black shadow-sm cursor-pointer"
            >
              <option value="ALL">All Networks</option>
              <option value="OPay">OPay Ledger</option>
              <option value="Moniepoint">Moniepoint Ledger</option>
              <option value="PalmPay">PalmPay Ledger</option>
            </select>
          </div>
        </div>

        {/* Unified Transaction History Date Search Panel */}
        <div className="bg-white border border-neutral-50 p-4 rounded-3xl shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-[#00B87A]/5 text-[#00B87A] flex items-center justify-center border border-emerald-100/30 shrink-0">
                <Calendar className="w-4.5 h-4.5 stroke-[2.5]" />
              </div>
              <div>
                <span className="text-[9px] font-mono font-black text-emerald-600 uppercase tracking-[0.2em] block leading-none mb-0.5">
                  Time-frame Filters
                </span>
                <span className="text-sm font-black text-neutral-900 tracking-tight">
                  Transaction Audit Logs
                </span>
              </div>
            </div>

            {/* Custom Date Range Picker Toggle */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsCustomDateOpen(!isCustomDateOpen)}
                className={`px-3 py-1.5 rounded-xl border text-[10px] font-black uppercase tracking-widest transition flex items-center gap-2 font-mono ${
                  isCustomDateOpen || historyFilter.type === 'CUSTOM'
                    ? 'bg-[#00B87A] border-[#00B87A] text-white shadow-lg shadow-emerald-500/10'
                    : 'bg-neutral-50 border-neutral-100 text-neutral-500 hover:bg-neutral-100'
                }`}
              >
                <Calendar className="w-3 h-3" />
                Custom Range
              </button>
            </div>
          </div>

          {/* Custom Date Inputs Panel */}
          <AnimatePresence>
            {(isCustomDateOpen || historyFilter.type === 'CUSTOM') && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="flex flex-wrap items-end gap-3 p-3 bg-white border border-neutral-200 rounded-xl mb-2">
                  <div className="flex-1 min-w-[120px] space-y-1">
                    <label className="text-[10px] font-mono font-bold text-neutral-400 uppercase">Start Date:</label>
                    <input
                      type="date"
                      value={customStart}
                      onChange={(e) => setCustomStart(e.target.value)}
                      className="w-full text-xs font-bold text-neutral-700 bg-neutral-50 border border-neutral-200 rounded-lg px-2 py-1.5 outline-none focus:border-[#00B87A]"
                    />
                  </div>
                  <div className="flex-1 min-w-[120px] space-y-1">
                    <label className="text-[10px] font-mono font-bold text-neutral-400 uppercase">End Date:</label>
                    <input
                      type="date"
                      value={customEnd}
                      onChange={(e) => setCustomEnd(e.target.value)}
                      className="w-full text-xs font-bold text-neutral-700 bg-neutral-50 border border-neutral-200 rounded-lg px-2 py-1.5 outline-none focus:border-[#00B87A]"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      onSetHistoryFilter({
                        type: 'CUSTOM',
                        customStart: new Date(customStart).toISOString(),
                        customEnd: new Date(customEnd).toISOString()
                      });
                      setIsCustomDateOpen(false);
                    }}
                    className="bg-[#00B87A] text-white px-4 py-1.5 rounded-lg text-xs font-bold hover:bg-[#009664] transition active:scale-95"
                  >
                    Apply Range
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Preset Buttons Grid/Scrollbar */}
          <div className="flex flex-wrap gap-1.5 pt-1">
            {[
              { id: 'DAY_1', label: 'Today' },
              { id: 'DAY_2', label: 'Yesterday' },
              { id: 'DAY_3', label: 'Last 3 Days' },
              { id: 'DAY_4', label: 'Last 4 Days' },
              { id: 'DAY_5', label: 'Last 5 Days' },
              { id: 'DAY_6', label: 'Last 6 Days' },
              { id: 'DAY_7', label: 'Last 7 Days' },
              { id: 'THIS_WEEK', label: 'This Week' },
              { id: 'THIS_MONTH', label: 'This Month' },
              { id: 'THIS_YEAR', label: 'This Year' },
              { id: 'LIFETIME', label: 'Lifetime' }
            ].map((preset) => {
              const isActive = historyFilter.type === preset.id;
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => {
                    onSetHistoryFilter({ type: preset.id as HistoryFilterType });
                    if (preset.id !== 'CUSTOM') setIsCustomDateOpen(false);
                  }}
                  className={`px-3 py-1.5 text-[9px] font-black uppercase tracking-widest rounded-lg border transition-all cursor-pointer active:scale-95 font-mono ${
                    isActive
                      ? 'bg-neutral-900 border-neutral-900 text-white shadow-md shadow-neutral-900/10'
                      : 'bg-white border-neutral-50 text-neutral-400 hover:bg-neutral-50 hover:text-neutral-700'
                  }`}
                >
                  {preset.label}
                </button>
              );
            })}
          </div>

          <div className="text-[9px] text-neutral-400 flex items-center justify-between bg-neutral-50/30 px-3 py-1.5 rounded-lg border border-neutral-100 font-mono font-black uppercase tracking-wider">
            <span className="flex items-center gap-1.5">
              <div className="w-1 h-1 rounded-full bg-[#00B87A] animate-pulse" />
              Audit Scope: <span className="text-[#00B87A]">{(historyFilter?.type || 'Day 1').replace('_', ' ')}</span>
            </span>
            <span>
              {transactions?.length || 0} RECORDS
            </span>
          </div>

          {/* Financial Summary Dashboard */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 pt-2">
            <div className="bg-white border border-neutral-100 p-4 rounded-[1.5rem] shadow-sm group hover:border-[#00B87A]/30 transition-all">
              <span className="text-[9px] text-neutral-400 font-mono uppercase font-black tracking-widest block mb-2">Transactions</span>
              <div className="flex items-end gap-1.5">
                <span className="text-base font-black text-neutral-900 font-mono leading-none tracking-tighter">{financialSummary.totalTransactions}</span>
                <span className="text-[9px] text-[#00B87A] font-black leading-none mb-0.5 font-mono">REC</span>
              </div>
              <div className="flex gap-2 mt-3 pt-3 border-t border-neutral-50">
                <div className="flex flex-col">
                  <span className="text-[8px] text-emerald-500 font-black font-mono">SUCC</span>
                  <span className="text-[10px] font-black text-emerald-600 font-mono">{financialSummary.totalSuccessful}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[8px] text-rose-400 font-black font-mono">FAIL</span>
                  <span className="text-[10px] font-black text-rose-500 font-mono">{financialSummary.totalFailed}</span>
                </div>
              </div>
            </div>

            <div className="bg-white border border-neutral-100 p-4 rounded-[1.5rem] shadow-sm group hover:border-emerald-200 transition-all">
              <span className="text-[9px] text-neutral-400 font-mono uppercase font-black tracking-widest block mb-2 text-emerald-600">Volume (Succ)</span>
              <div className="flex flex-col">
                <span className="text-base font-black text-emerald-600 font-mono leading-none tracking-tighter mb-1.5">{formatNaira(financialSummary.totalVolume)}</span>
                <div className="flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-[9px] text-emerald-500 font-black font-mono uppercase">Settled Volume</span>
                </div>
              </div>
            </div>

            <div className="bg-white border border-neutral-100 p-4 rounded-[1.5rem] shadow-sm group hover:border-neutral-200 transition-all">
              <span className="text-[9px] text-neutral-400 font-mono uppercase font-black tracking-widest block mb-2">Gross Fees</span>
              <div className="flex flex-col">
                <span className="text-base font-black text-neutral-900 font-mono leading-none tracking-tighter mb-1.5">{formatNaira(financialSummary.totalCustomerFees)}</span>
                <div className="flex items-center justify-between">
                  <span className="text-[9px] text-neutral-400 font-black font-mono uppercase">Provider</span>
                  <span className="text-[9px] text-rose-500 font-black font-mono">-{formatNaira(financialSummary.totalProviderCharges)}</span>
                </div>
              </div>
            </div>

            <div className="bg-white border border-neutral-100 p-4 rounded-[1.5rem] shadow-sm group hover:border-neutral-200 transition-all">
              <span className="text-[9px] text-neutral-400 font-mono uppercase font-black tracking-widest block mb-2">CBN & Cashback</span>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-[8px] text-neutral-300 font-black font-mono uppercase block">CBN</span>
                  <span className="text-[10px] font-black text-neutral-800 font-mono">{formatNaira(financialSummary.totalCBNCharges)}</span>
                </div>
                <div>
                  <span className="text-[8px] text-neutral-300 font-black font-mono uppercase block">CBK</span>
                  <span className="text-[10px] font-black text-neutral-800 font-mono">{formatNaira(financialSummary.totalCashback)}</span>
                </div>
              </div>
            </div>

            <div className="bg-neutral-900 p-4 rounded-[1.5rem] shadow-xl shadow-neutral-900/10 col-span-2 md:col-span-1 ring-1 ring-neutral-800">
              <span className="text-[9px] text-emerald-500 font-mono uppercase font-black tracking-widest block mb-2">Realized Agent Profit</span>
              <div className="flex flex-col">
                <span className="text-lg font-black text-white font-mono leading-none tracking-tighter mb-1.5">{formatNaira(financialSummary.totalProfit)}</span>
                <span className="text-[8px] text-neutral-500 font-black font-mono uppercase tracking-widest">Realistic Gain After Costs</span>
              </div>
            </div>
          </div>
        </div>


        {/* Diagnostic decoded representation layout of active queried parameters */}
        {queryAnalysis.hasQuery && (
          <div className="flex flex-wrap items-center gap-2 bg-neutral-50 border border-neutral-200/60 p-2.5 rounded-2xl text-xs font-mono font-bold text-neutral-600">
            <span className="text-[9px] text-neutral-400 uppercase tracking-widest leading-none mr-1 flex items-center gap-1 font-black">
              🔍 Active Queries:
            </span>
            {queryAnalysis.extractedProviders.map((p) => (
              <span key={p} className="bg-emerald-50 border border-emerald-250 text-emerald-800 px-2 py-0.5 rounded-lg text-[10px] flex items-center gap-1 capitalize font-sans font-bold shadow-xs">
                POS: {p}
                <button 
                  type="button"
                  onClick={() => {
                    const regex = new RegExp(`\\b${p}\\b`, 'gi');
                    setSearchQuery(searchQuery.replace(regex, '').trim().replace(/\s+/g, ' '));
                  }} 
                  className="hover:text-red-500 font-sans font-black leading-none ml-1 text-[11px] cursor-pointer"
                >
                  ×
                </button>
              </span>
            ))}
            {queryAnalysis.extractedTypes.map((t) => (
              <span key={t} className="bg-blue-50 border border-blue-200 text-blue-800 px-2 py-0.5 rounded-lg text-[10px] flex items-center gap-1 capitalize font-sans font-bold shadow-xs">
                Type: {t}
                <button 
                  type="button"
                  onClick={() => {
                    const regex = new RegExp(`\\b${t}\\b`, 'gi');
                    setSearchQuery(searchQuery.replace(regex, '').trim().replace(/\s+/g, ' '));
                  }} 
                  className="hover:text-red-500 font-sans font-black leading-none ml-1 text-[11px] cursor-pointer"
                >
                  ×
                </button>
              </span>
            ))}
            {queryAnalysis.textKeywords.map((k) => (
              <span key={k} className="bg-neutral-100 border border-neutral-250 text-neutral-700 px-2 py-0.5 rounded-lg text-[10px] flex items-center gap-1 font-sans font-bold shadow-xs">
                Match: "{k === 'samebank' ? 'Same Bank' : k === 'otherbank' ? 'Interbank' : k}"
                <button 
                  type="button"
                  onClick={() => {
                    const regex = new RegExp(`\\b${k}\\b`, 'gi');
                    setSearchQuery(searchQuery.replace(regex, '').trim().replace(/\s+/g, ' '));
                  }} 
                  className="hover:text-red-500 font-sans font-black leading-none ml-1 text-[11px] cursor-pointer"
                >
                  ×
                </button>
              </span>
            ))}
            <button 
              type="button"
              onClick={() => setSearchQuery('')}
              className="text-[10px] text-red-500 hover:text-red-700 font-sans font-black ml-auto cursor-pointer flex items-center"
            >
              Reset Combined Search
            </button>
          </div>
        )}
      </div>

      {/* Bulk actions manager panel */}
      {currentUser.role === 'Manager' && selectedIds.length > 0 && (
        <div className="bg-neutral-900 border border-neutral-800 text-white p-4 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-lg animate-in slide-in-from-top-4 duration-200">
          <div className="flex items-center gap-3">
            <div className="bg-[#00B87A] text-white w-7 h-7 rounded-full flex items-center justify-center font-black text-xs font-mono">
              {selectedIds.length}
            </div>
            <div>
              <h4 className="text-xs font-black uppercase tracking-wider text-white">Bulk Operations Active</h4>
              <p className="text-[10px] text-neutral-400 mt-0.5">Selected {selectedIds.length} of {filteredList.length} transactions.</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Dropdown for bulk status update */}
            <div className="flex items-center gap-1.5 bg-neutral-800 px-2.5 py-1.5 rounded-xl border border-neutral-750">
              <span className="text-[10px] text-neutral-400 font-bold uppercase font-mono">Status:</span>
              <select
                onChange={(e) => {
                  const val = e.target.value;
                  if (val) {
                    handleBulkStatusUpdate(val as any);
                    e.target.value = '';
                  }
                }}
                className="bg-transparent border-none text-xs text-[#00B87A] font-black focus:outline-none cursor-pointer outline-none"
              >
                <option value="" className="text-neutral-800">Change...</option>
                <option value="Success" className="text-neutral-800 font-bold">🟢 Success</option>
                <option value="Pending" className="text-neutral-800 font-bold">🟡 Pending</option>
                <option value="Failed" className="text-neutral-800 font-bold">🔴 Failed</option>
              </select>
            </div>

            {/* Dropdown for bulk debt update */}
            <div className="flex items-center gap-1.5 bg-neutral-800 px-2.5 py-1.5 rounded-xl border border-neutral-750">
              <span className="text-[10px] text-neutral-400 font-bold uppercase font-mono">Debt:</span>
              <select
                onChange={(e) => {
                  const val = e.target.value;
                  if (val) {
                    handleBulkDebtUpdate(val as any);
                    e.target.value = '';
                  }
                }}
                className="bg-transparent border-none text-xs text-amber-400 font-black focus:outline-none cursor-pointer outline-none"
              >
                <option value="" className="text-neutral-800">Change...</option>
                <option value="Paid" className="text-neutral-800 font-bold">🟢 Paid (Settle)</option>
                <option value="Unpaid" className="text-neutral-800 font-bold">🔴 Unpaid (Debt)</option>
              </select>
            </div>

            {/* Bulk Delete Button */}
            <button
              type="button"
              onClick={handleBulkDelete}
              className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-black transition flex items-center gap-1 active:scale-[0.98] cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Void {selectedIds.length} Records
            </button>

            {/* Cancel selection */}
            <button
              type="button"
              onClick={() => setSelectedIds([])}
              className="p-1.5 text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-800 transition cursor-pointer"
              title="Deselect All"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Transaction History log header */}
      <div className="flex items-center justify-between mb-3 px-1">
         <h3 className="text-sm font-black text-neutral-800 flex items-center gap-2">
           <Receipt className="w-4 h-4 text-[#00B87A]" />
           Transaction History
         </h3>
         <div className="flex items-center gap-1 bg-neutral-50 p-1 rounded-xl border border-neutral-100 shadow-sm">
           {(['small', 'medium', 'large'] as const).map((size) => (
             <button
               key={size}
               onClick={() => setCardSize(size)}
               className={`px-3 py-1 rounded-lg text-[9px] font-bold uppercase transition-all duration-300 ${
                 cardSize === size 
                   ? 'bg-white text-neutral-900 shadow-md shadow-neutral-200/50 scale-[1.05]' 
                   : 'text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100/50'
               }`}
             >
               {size}
             </button>
           ))}
         </div>
      </div>

      {/* Transaction History log table */}
      <div className="overflow-x-auto w-full">
        {filteredList.length === 0 ? (
          <div className="text-center py-10 bg-neutral-50 border border-dashed border-neutral-200 rounded-3xl">
            <p className="text-xs text-neutral-500 font-medium">No transactions match your visual filter query.</p>
            <p className="text-[10px] text-neutral-400 mt-1 font-mono">Try adjusting categories or recording a new receipt.</p>
          </div>
        ) : viewMode === 'easy' ? (
          <div className="space-y-2.5">
            {currentUser.role === 'Manager' && filteredList.length > 0 && (
              <div className="flex items-center justify-between bg-neutral-50 border border-neutral-200/50 p-2.5 rounded-xl text-xs text-neutral-600 font-bold mb-1 animate-in fade-in duration-100">
                <div className="flex items-center gap-2">
                  <input
                    id="selectAllCards"
                    type="checkbox"
                    checked={isAllSelected}
                    onChange={(e) => handleSelectAllToggle(e.target.checked)}
                    className="w-4 h-4 rounded border-neutral-300 text-[#00B87A] focus:ring-[#00B87A] cursor-pointer"
                  />
                  <label htmlFor="selectAllCards" className="cursor-pointer select-none">
                    Select All {filteredList.length} Visible Receipts
                  </label>
                </div>
                <span className="text-[10px] text-neutral-400 font-mono font-medium">
                  {selectedIds.length} of {filteredList.length} selected
                </span>
              </div>
            )}
            <div className={cardSize === 'small' ? 'space-y-2' : cardSize === 'medium' ? 'space-y-2.5' : 'space-y-3'}>
              <AnimatePresence mode="popLayout">
                {paginatedList.map((tx) => {
                  const serialNumber = transactions.length - transactions.indexOf(tx);
                  const providerTxs = transactions.filter(t => t.provider === tx.provider);
                  const providerIndex = providerTxs.indexOf(tx);
                  const providerSerialNumber = providerTxs.length - providerIndex;
                  const providerTxId = getProviderTransactionNumber(tx);
                  const destBank = tx.destinationBank;
                  const isSameBank = tx.subType === 'SameBank' || (tx.provider && destBank && tx.provider.toLowerCase() === destBank.toLowerCase());
                  const hasBankDetail = tx.type === 'Withdrawal' || tx.type === 'Transfer' || tx.type === 'Deposit' || tx.type === 'Cash Out (Transfer)' || tx.type === 'Airtime';
   
                  // Setup colors and friendly status / label descriptions
                  const cardBorderColor = 
                    tx.provider === 'Moniepoint' 
                      ? 'border-l-blue-500' 
                      : tx.provider === 'OPay' 
                      ? 'border-l-[#00B87A]' 
                      : 'border-l-orange-500';
   
                  // Friendly Operation Header & Colors
                  let easyCategoryTitle = '';
                  let easyCategoryDesc = '';
                  let easyIconBg = '';
                  let easyIconColor = '';
   
                  if (tx.type === 'Withdrawal') {
                    easyCategoryTitle = 'Withdraw';
                    easyIconBg = 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/10';
                    easyIconColor = 'text-emerald-600';
                  } else if (tx.type === 'Transfer') {
                    easyCategoryTitle = 'Transfer';
                    easyIconBg = 'bg-indigo-500/10 text-indigo-600 border border-indigo-500/10';
                    easyIconColor = 'text-indigo-600';
                  } else { // Deposit
                    easyCategoryTitle = 'Money Receive';
                    easyIconBg = 'bg-blue-500/10 text-blue-600 border border-blue-500/10';
                    easyIconColor = 'text-blue-600';
                  }
   
                  // Friendly relative time calculation
                  const friendlyTime = (timestamp: string) => {
                    const d = new Date(timestamp);
                    const now = new Date();
                    const isToday = d.getDate() === now.getDate() && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
                    
                    const timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                    if (isToday) return `Today at ${timeStr}`;
                    return `${d.toLocaleDateString([], { month: 'short', day: 'numeric' })} at ${timeStr}`;
                  };
   
                  const isExpanded = expandedTxId === tx.id;

                  // Debts and Waived charge status flags
                  const isUnpaidDebt = tx.chargesStatus === 'Unpaid' || tx.chargesStatus === 'PartiallyPaid' || ((tx.unpaidFeeAmount || 0) > 0);
                  const isWaivedCharge = 
                    tx.chargesStatus === 'Waived' || 
                    tx.chargesStatus === 'Waive' || 
                    tx.isFeeWaived === true || 
                    ((tx.customerFee === 0 || tx.customerFee === undefined) && ((tx.originalFeeAmount || 0) > 0 || (tx.notes && tx.notes.toLowerCase().includes('waiv'))));
  
                  // Dynamic Density Layout Spacing Configurations - Reduced size for better efficiency
                  const cardPadding = 
                    cardSize === 'small' 
                      ? 'p-2 sm:p-2.5 rounded-xl border-l-[3px]' 
                      : cardSize === 'medium'
                      ? 'p-3 sm:p-3.5 rounded-2xl border-l-[4px]'
                      : 'p-4 sm:p-5 rounded-3xl border-l-[5px]';
  
                  const iconSizeClass = 
                    cardSize === 'small' 
                      ? 'w-7 h-7 rounded-lg' 
                      : cardSize === 'medium'
                      ? 'w-8.5 h-8.5 rounded-xl'
                      : 'w-10 h-10 rounded-xl';
  
                  const arrowSizeClass = 
                    cardSize === 'small' 
                      ? 'w-3 h-3 stroke-[2.5]' 
                      : cardSize === 'medium'
                      ? 'w-4 h-4 stroke-[2.5]'
                      : 'w-5 h-5 stroke-[2.5]';
  
                  const titleTextSize = 
                    cardSize === 'small' 
                      ? 'text-[12.5px] font-black leading-none' 
                      : cardSize === 'medium'
                      ? 'text-[14px] font-black leading-none'
                      : 'text-[16px] font-black leading-none';
  
                  const amountTextSize = 
                    cardSize === 'small' 
                      ? 'text-[16px] font-black font-mono tracking-tighter' 
                      : cardSize === 'medium'
                      ? 'text-[18px] font-black font-mono tracking-tighter'
                      : 'text-[22px] font-black font-mono tracking-tighter';
  
                  const statusBadgeStyle = 
                    cardSize === 'small' 
                      ? 'text-[7px] px-1.2 py-0.1 rounded-full' 
                      : cardSize === 'medium'
                      ? 'text-[8px] px-1.8 py-0.3 rounded-full'
                      : 'text-[9px] px-2.2 py-0.8 rounded-full';
  
                  const gapSpacing = 
                    cardSize === 'small' 
                      ? 'gap-2' 
                      : cardSize === 'medium'
                      ? 'gap-3'
                      : 'gap-4';
   
                  return (
                    <motion.div
                      key={tx.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.98 }}
                      onClick={() => setExpandedTxId(isExpanded ? null : tx.id)}
                      className={`bg-white border border-neutral-200 ${cardPadding} ${cardBorderColor} hover:shadow-[0_20px_50px_rgba(0,0,0,0.06)] hover:border-neutral-300 transition-all duration-300 cursor-pointer relative overflow-hidden select-none group active:scale-[0.998]`}
                    >
                      {/* Selection Checkbox for Managers */}
                      {currentUser.role === 'Manager' && (
                        <div className={`absolute ${cardSize === 'small' ? 'top-1.5 right-1.5' : 'top-2 right-2'} z-20`} onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={selectedIds.includes(tx.id)}
                            onChange={(e) => toggleSelect(tx.id, e.target.checked)}
                            className={`${cardSize === 'small' ? 'w-2.5 h-2.5' : 'w-3 h-3'} rounded-full border-neutral-300 text-neutral-900 focus:ring-neutral-900 cursor-pointer transition-transform active:scale-90`}
                          />
                        </div>
                      )}
  
                      <div className={`flex justify-between items-center ${gapSpacing}`}>
                        <div className={`flex ${gapSpacing} min-w-0 items-start flex-[1.5]`}>
                          {/* Transaction Type Icon - Centered Vertically relative to header area */}
                          <div className="pt-0.5">
                            <div className={`${iconSizeClass} shrink-0 flex items-center justify-center shadow-xs border border-white/40 ${easyIconBg}`}>
                              {tx.type === 'Withdrawal' ? (
                                <ArrowDownLeft className={arrowSizeClass} />
                              ) : tx.type === 'Deposit' ? (
                                <ArrowUpRight className={arrowSizeClass} />
                              ) : (
                                <ArrowRightLeft className={arrowSizeClass} />
                              )}
                            </div>
                          </div>
  
                          <div className="min-w-0 space-y-1.5 flex-1">
                            {/* Title & Icon Area */}
                            <div className="flex items-center gap-1.5">
                              <h4 className={`${titleTextSize} text-neutral-900 tracking-tight font-black uppercase`}>
                                {easyCategoryTitle}
                              </h4>
                              <span className="text-neutral-100 text-[10px]">•</span>
                            </div>

                            {/* Badge Cluster Row */}
                            <div className="flex flex-wrap items-center gap-1.5">
                              <div className="flex items-center gap-1">
                                <span className={`${cardSize === 'small' ? 'text-[7.5px] px-1.5' : 'text-[8.5px] px-2'} font-bold py-0.2 rounded-full border ${
                                  tx.provider === 'OPay' 
                                    ? 'bg-[#00B87A]/5 text-[#00B87A] border-[#00B87A]/20' 
                                    : 'bg-blue-500/5 text-blue-600 border-blue-500/20'
                                } uppercase tracking-wider`}>
                                  {tx.provider}
                                </span>
                                {destBank && (
                                  <>
                                    <ArrowRight className={`${cardSize === 'small' ? 'w-1.5 h-1.5' : 'w-2 h-2'} text-neutral-300`} />
                                    <span className={`${cardSize === 'small' ? 'text-[7.5px] px-1.5' : 'text-[8.5px] px-2'} font-bold py-0.2 rounded-full border ${getBankBadgeStyle(destBank)} uppercase tracking-wider`}>
                                      {destBank}
                                    </span>
                                  </>
                                )}
                              </div>

                              {isWaivedCharge && !isUnpaidDebt && (
                                <span className={`${cardSize === 'small' ? 'text-[7px] px-1.5' : 'text-[8px] px-2'} font-black py-0.2 rounded-full bg-purple-600 text-white border border-purple-700 uppercase tracking-wider flex items-center gap-1 shadow-xs`}>
                                  <Sparkles className="w-2 h-2 shrink-0" />
                                  WAIVED CHARGE
                                </span>
                              )}

                              {isUnpaidDebt && (
                                <span className={`${cardSize === 'small' ? 'text-[7px] px-1.5' : 'text-[8px] px-2'} font-black py-0.2 rounded-full bg-rose-600 text-white border border-rose-700 uppercase tracking-wider flex items-center gap-1 shadow-xs animate-pulse`}>
                                  <AlertTriangle className="w-2.5 h-2.5 shrink-0" />
                                  UNPAID
                                </span>
                              )}

                              {hasBankDetail && (
                                <span className={`${cardSize === 'small' ? 'text-[7px] px-1.5 py-0.2' : 'text-[8px] px-2 py-0.5'} font-black rounded-full border border-emerald-200 bg-emerald-50 text-emerald-600 flex items-center gap-0.5 shadow-xs uppercase tracking-widest`}>
                                  {isSameBank ? <RefreshCcw className="w-2 h-2" /> : <Globe className="w-2 h-2" />}
                                  {isSameBank ? 'Same Bank' : 'Interbank'}
                                </span>
                              )}
                            </div>

                            {/* Meta Info Row */}
                            <div className={`${cardSize === 'small' ? 'text-[8.5px]' : 'text-[9.5px]'} font-bold text-neutral-400 font-mono uppercase tracking-tight flex items-center gap-x-1.5 gap-y-0 flex-wrap`}>
                              <span className="text-neutral-500 font-black">#{serialNumber}</span>
                              <span className="text-neutral-200 opacity-50">•</span>
                              <span>{new Date(tx.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                              <span className="text-neutral-200 opacity-50">•</span>
                              <span className="text-neutral-500 font-black truncate max-w-[80px]">By {tx.employeeName.split(' ')[0]}</span>
                            </div>

                            {/* Financial Summary Boxes */}
                            <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                              <div className={`${cardSize === 'small' ? 'px-1.5 py-0.2 text-[8px]' : 'px-2 py-0.5 text-[9px]'} rounded-md font-black flex items-center gap-1 shadow-xs ${
                                isUnpaidDebt
                                  ? 'bg-rose-50 border border-rose-200 text-rose-800'
                                  : isWaivedCharge
                                  ? 'bg-purple-50 border border-purple-200 text-purple-800'
                                  : 'bg-white border border-neutral-200 text-neutral-900'
                              }`}>
                                <span className={isUnpaidDebt ? 'text-rose-500' : isWaivedCharge ? 'text-purple-500' : 'text-neutral-400'}>Fee:</span>
                                <span>{formatNaira(tx.customerFee || 0)}</span>
                                {isWaivedCharge && <span className="text-[7.5px] uppercase tracking-wider text-purple-700 bg-purple-100 px-1 rounded font-black">(WAIVED)</span>}
                              </div>
                              <div className={`${cardSize === 'small' ? 'px-1.5 py-0.2 text-[8px]' : 'px-2 py-0.5 text-[9px]'} rounded-md bg-white border border-rose-100 font-black flex items-center gap-1 shadow-xs`}>
                                <span className="text-rose-400">Cost:</span>
                                <span className="text-rose-500">-{formatNaira(tx.terminalFee || 0)}</span>
                              </div>
                              <div className={`${cardSize === 'small' ? 'px-1.5 py-0.2 text-[8px]' : 'px-2 py-0.5 text-[9px]'} rounded-md bg-white border border-emerald-100 font-black flex items-center gap-1 shadow-xs`}>
                                <span className="text-emerald-400">Realistic Profit:</span>
                                <span className="text-emerald-600">{formatNaira(tx.profit || 0)}</span>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Right side: Amount + Status */}
                        <div className={`flex flex-col items-end ${cardSize === 'small' ? 'gap-1.5' : 'gap-2'} text-right shrink-0`}>
                          <div className={`${amountTextSize} leading-none text-neutral-900 font-bold`}>
                            {formatNaira(tx.amount)}
                          </div>
                          
                          <div className="flex items-center gap-1.5">
                             {(tx.status || 'Success') === 'Success' && (
                                <span className={`${statusBadgeStyle} font-black bg-emerald-50 text-emerald-700 border border-emerald-200 uppercase tracking-[0.08em] flex items-center gap-1 shadow-xs`}>
                                  <span className={`${cardSize === 'small' ? 'w-1.2 h-1.2' : 'w-1.5 h-1.5'} rounded-full bg-emerald-500`}></span>
                                  APPROVED / SUCCESSFUL
                                </span>
                             )}
                             {(tx.status || 'Success') === 'Pending' && (
                                <span className={`${statusBadgeStyle} font-black bg-amber-50 text-amber-700 border border-amber-200 uppercase tracking-[0.08em] flex items-center gap-1 shadow-xs`}>
                                  <span className={`${cardSize === 'small' ? 'w-1.2 h-1.2' : 'w-1.5 h-1.5'} rounded-full bg-amber-500 animate-pulse`}></span>
                                  PENDING
                                </span>
                             )}
                             {(tx.status || 'Success') === 'Failed' && (
                                <span className={`${statusBadgeStyle} font-black bg-rose-50 text-rose-700 border border-rose-200 uppercase tracking-[0.08em] flex items-center gap-1 shadow-xs`}>
                                  <span className={`${cardSize === 'small' ? 'w-1.2 h-1.2' : 'w-1.5 h-1.5'} rounded-full bg-rose-500`}></span>
                                  FAILED
                                </span>
                             )}
                             <div className={`${cardSize === 'small' ? 'p-0.5 rounded-md' : 'p-0.8 rounded-lg'} transition-all duration-300 ${isExpanded ? 'bg-neutral-900 text-white shadow-lg' : 'bg-neutral-50 text-neutral-400'}`}>
                                {isExpanded ? <ChevronUp className={cardSize === 'small' ? 'w-2.5 h-2.5' : 'w-3 h-3'} /> : <ChevronDown className={cardSize === 'small' ? 'w-2.5 h-2.5' : 'w-3 h-3'} />}
                             </div>
                          </div>
                        </div>
                      </div>
 
                       {/* Smooth Expandable Content Panel */}
                       <AnimatePresence>
                        {isExpanded && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.2, ease: "easeInOut" }}
                            className={`border-t border-neutral-100/80 ${cardSize === 'small' ? 'pt-2 mt-2 space-y-2' : 'pt-3 mt-2.5 space-y-3'} text-xs overflow-hidden`}
                            onClick={(e) => e.stopPropagation()}
                          >
                        {/* Detailed Stats Grid */}
                        <div className={`grid grid-cols-2 sm:grid-cols-4 gap-1.5 bg-neutral-50/80 border border-neutral-100 p-2.5 rounded-lg ${cardSize === 'small' ? 'text-[9px]' : 'text-[10.5px]'}`}>
                          {/* Box 1: Customer Pays */}
                          <div className="px-1">
                            <span className="text-[8px] font-mono font-black text-neutral-400 tracking-wider uppercase block">
                              💰 Cust. Pays
                            </span>
                            <div className={`font-bold text-neutral-800 font-mono mt-0.5 ${cardSize === 'small' ? 'text-xs' : 'text-xs sm:text-sm'}`}>
                              {formatNaira(tx.totalCustomerCharged || tx.amount)}
                            </div>
                          </div>
 
                          {/* Box 2: Provider Cost */}
                          <div className="border-l border-neutral-200/50 px-2">
                            <span className="text-[8px] font-mono font-black text-neutral-400 tracking-wider uppercase block">
                              🏢 Prov. Cost
                            </span>
                            <div className={`font-bold text-red-600 font-mono mt-0.5 ${cardSize === 'small' ? 'text-xs' : 'text-xs sm:text-sm'}`}>
                              {formatNaira((tx.providerCharge || tx.terminalFee || 0) + (tx.vatAmount || 0))}
                            </div>
                            <span className="text-[7.5px] text-neutral-400 font-medium block leading-none">
                              Incl. {formatNaira(tx.vatAmount || 0)} VAT
                            </span>
                          </div>

                          {/* Box 3: Cashback */}
                          <div className="border-l border-neutral-200/50 px-2">
                            <span className="text-[8px] font-mono font-black text-neutral-400 tracking-wider uppercase block">
                              🎁 Cashback
                            </span>
                            <div className={`font-bold text-blue-600 font-mono mt-0.5 ${cardSize === 'small' ? 'text-xs' : 'text-xs sm:text-sm'}`}>
                              {formatNaira(tx.cashback || 0)}
                            </div>
                          </div>

                          {/* Box 4: Net Profit */}
                          <div className="border-l border-neutral-200/50 px-2">
                            <span className="text-[8px] font-mono font-black text-neutral-400 tracking-wider uppercase block">
                              📈 Realistic Agent Profit
                            </span>
                            <div className={`font-black text-emerald-600 font-mono mt-0.5 ${cardSize === 'small' ? 'text-xs' : 'text-xs sm:text-sm'}`}>
                              {formatNaira(tx.profit)}
                            </div>
                          </div>
                        </div>

                        {/* Supplementary metadata & instructions */}
                        <div className={`bg-neutral-50/60 border border-neutral-100 ${cardSize === 'small' ? 'p-1.5 rounded-lg space-y-1' : 'p-2.5 rounded-xl space-y-2'}`}>
                          {/* PENDING SETTLEMENT APPROVAL SECTION */}
                          {tx.pendingSettlement && (
                            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 space-y-2.5 mb-2">
                              <div className="flex items-center gap-2">
                                <div className="bg-amber-500 p-1.5 rounded-lg shadow-sm">
                                  <Clock className="w-4 h-4 text-white" />
                                </div>
                                <div>
                                  <span className="text-[10px] font-black text-amber-500 uppercase tracking-widest block leading-none mb-0.5">Settlement Approval Needed</span>
                                  <span className="text-xs font-bold text-neutral-800">
                                    {tx.pendingSettlement.requestedBy} proposed ₦{tx.pendingSettlement.paidAmount.toLocaleString()} payment
                                  </span>
                                </div>
                              </div>
                              
                              {currentUser.role === 'Manager' ? (
                                <div className="flex items-center gap-2 pt-1 border-t border-amber-200/50">
                                  <button
                                    type="button"
                                    onClick={() => handleApproveSettlement(tx)}
                                    className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-black py-2 rounded-lg text-[10px] uppercase tracking-widest shadow-sm active:scale-95 transition-all cursor-pointer"
                                  >
                                    Approve Settlement
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleRejectSettlement(tx)}
                                    className="px-3 bg-white border border-amber-300 text-amber-700 font-bold py-2 rounded-lg text-[10px] uppercase tracking-widest hover:bg-amber-100 active:scale-95 transition-all cursor-pointer"
                                  >
                                    Reject
                                  </button>
                                </div>
                              ) : (
                                <div className="bg-amber-100/50 p-2 rounded-lg border border-amber-200/30">
                                  <span className="text-[10px] font-bold text-amber-800 flex items-center gap-1.5 justify-center">
                                    <ShieldAlert className="w-3.5 h-3.5" />
                                    WAITING FOR MANAGER TO APPROVE THIS DEBT SETTLEMENT
                                  </span>
                                </div>
                              )}
                            </div>
                          )}

                          {/* DEBT ALERT - If Unpaid */}
                          {tx.chargesStatus === 'Unpaid' && (
                            <div className="bg-red-50 border border-red-200 rounded-lg p-2 flex items-center gap-2 animate-pulse">
                              <AlertTriangle className="w-4 h-4 text-red-600" />
                              <span className="text-[11px] font-black text-red-700">
                                ACTION REQUIRED: Customer has NOT paid charges of {formatNaira(tx.unpaidFeeAmount || tx.customerFee)}.
                              </span>
                            </div>
                          )}
                          <div className={`grid grid-cols-2 gap-x-4 gap-y-2 ${cardSize === 'small' ? 'text-[9.5px]' : 'text-[11px]'} text-left`}>
                            <div>
                              <span className="text-[8.5px] font-mono font-black text-neutral-400 uppercase tracking-wider block">
                                Operator Name
                              </span>
                              <span className="font-bold text-neutral-700 capitalize">{tx.employeeName}</span>
                            </div>
                            <div>
                              <span className="text-[8.5px] font-mono font-black text-neutral-400 uppercase tracking-wider block">
                                POS Station Used
                              </span>
                              <span className="font-bold text-neutral-700">{tx.provider} Station</span>
                            </div>
                            <div>
                              <span className="text-[8.5px] font-mono font-black text-neutral-400 uppercase tracking-wider block">
                                Action Instruction
                              </span>
                              <span className="font-black text-neutral-700">
                                {tx.type === 'Withdrawal' || tx.type === 'Cash Out (Transfer)' ? (
                                  <span className="text-emerald-700">🟢 Hand CASH bills to Customer</span>
                                ) : tx.type === 'Deposit' ? (
                                  <span className="text-blue-700">📥 Collect CASH bills from Customer</span>
                                ) : (
                                  <span className="text-indigo-700">💸 Sent Bank Transfer</span>
                                )}
                              </span>
                            </div>
                            <div>
                              <span className="text-[8.5px] font-mono font-black text-neutral-400 uppercase tracking-wider block">
                                System Reference ID
                              </span>
                              <div 
                                className="flex items-center gap-1 text-neutral-600 font-mono font-bold select-all cursor-pointer hover:text-neutral-900 transition"
                                onClick={() => handleCopy(providerTxId)}
                                title="Click to copy full reference ID"
                              >
                                <span>...{providerTxId.slice(-8)}</span>
                                {copiedId === providerTxId ? (
                                  <Check className="w-2.5 h-2.5 text-emerald-600 stroke-[3.5]" />
                                ) : (
                                  <Copy className="w-2.5 h-2.5 text-neutral-400" />
                                )}
                              </div>
                            </div>
                          </div>
 
                          {/* Customer Details & Remarks */}
                          {(tx.customerName || tx.customerPhone || tx.notes || tx.audioNote) && (
                            <div className="border-t border-neutral-100 pt-2 flex flex-col gap-2 text-[11px] text-left">
                              {(tx.customerName || tx.customerPhone || tx.notes) && (
                                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                  {(tx.customerName || tx.customerPhone || tx.accountName || tx.accountNumber) && (
                                    <div className="flex flex-col gap-1 bg-amber-50/50 border border-amber-100/50 p-2 rounded-xl">
                                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                        <span className="text-neutral-700 px-1.5 py-0.5 rounded-md font-bold flex items-center gap-1.5">
                                          👤 <strong className="text-neutral-900 font-black">{tx.customerName || tx.accountName || 'Customer'}</strong> 
                                          {tx.customerPhone && <span className="text-neutral-500 font-mono">({tx.customerPhone})</span>}
                                        </span>
                                      </div>
                                      {(tx.accountName || tx.accountNumber) && (
                                        <div className="flex flex-wrap items-center gap-3 px-1.5 text-[9px] font-bold text-neutral-600">
                                          {tx.accountName && <span>NAME: <span className="text-neutral-900 font-black uppercase">{tx.accountName}</span></span>}
                                          {tx.accountNumber && <span>ACCT: <span className="text-neutral-900 font-black font-mono">{tx.accountNumber}</span></span>}
                                        </div>
                                      )}
                                    </div>
                                  )}
                                  {tx.notes && (
                                    <span className="text-neutral-500 italic">
                                      • "{tx.notes}"
                                    </span>
                                  )}
                                </div>
                              )}
                              
                              {tx.mode === 'SplitWithdrawal' && tx.subTransfers && tx.subTransfers.length > 0 && (
                                <div className="mt-2 bg-emerald-50/50 border border-emerald-100 rounded-xl p-3 space-y-2">
                                  <div className="flex items-center justify-between border-b border-emerald-100 pb-1.5 mb-1.5">
                                    <span className="text-[10px] font-black text-emerald-800 uppercase tracking-widest font-mono flex items-center gap-1.5">
                                      <ArrowRightLeft className="w-3 h-3" /> Distribution Breakdown
                                    </span>
                                    <span className="text-[9px] font-bold text-emerald-600 bg-emerald-100 px-1.5 py-0.5 rounded uppercase">
                                      {tx.subTransfers.length} Accounts
                                    </span>
                                  </div>
                                  <div className="space-y-2">
                                    {tx.subTransfers.map((st, i) => (
                                      <div key={i} className="flex justify-between items-start text-[10px]">
                                        <div className="flex flex-col">
                                          <span className="font-black text-neutral-800">{st.recipientName}</span>
                                          <span className="text-[9px] text-neutral-500 font-mono">{st.accountNumber}</span>
                                        </div>
                                        <span className="font-bold text-emerald-700 font-mono">{formatNaira(st.amount)}</span>
                                      </div>
                                    ))}
                                    <div className="pt-1.5 border-t border-emerald-100 flex justify-between items-center">
                                      <span className="text-[9px] font-bold text-emerald-600 uppercase">Total Sent to Bank</span>
                                      <span className="text-xs font-black text-emerald-800 font-mono">
                                        {formatNaira(tx.subTransfers.reduce((sum, st) => sum + st.amount, 0))}
                                      </span>
                                    </div>
                                    {tx.remainingBalance !== undefined && tx.remainingBalance > 0 && (
                                      <div className="flex justify-between items-center text-neutral-500">
                                        <span className="text-[9px] font-bold uppercase">Cash Balance Handed to Cust.</span>
                                        <span className="text-[10px] font-bold font-mono">{formatNaira(tx.remainingBalance)}</span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )}

                              {tx.audioNote && (
                                <div className="mt-0.5" onClick={(e) => e.stopPropagation()}>
                                  <div className="flex items-center gap-2.5 p-2 bg-emerald-50/75 border border-emerald-100/80 rounded-xl max-w-sm shadow-sm hover:bg-emerald-50 transition-all">
                                    <button
                                      type="button"
                                      onClick={() => playAudioNote(tx.id, tx.audioNote!)}
                                      className="w-8 h-8 rounded-full bg-[#00B87A] hover:bg-emerald-600 flex items-center justify-center text-white cursor-pointer shadow transition active:scale-95 shrink-0"
                                      title={playingAudioId === tx.id ? "Pause voice note" : "Play voice note"}
                                    >
                                      {playingAudioId === tx.id ? (
                                        <Pause className="w-3.5 h-3.5 fill-white stroke-[2.5]" />
                                      ) : (
                                        <Play className="w-3.5 h-3.5 fill-white stroke-[2.5] ml-0.5" />
                                      )}
                                    </button>
                                    <div className="min-w-0 flex-1">
                                      <div className="flex items-center gap-1.5">
                                        <span className="text-[10px] font-black text-emerald-800 uppercase tracking-wide font-mono leading-none">Voice Record Note</span>
                                        {playingAudioId === tx.id && (
                                          <span className="flex items-center gap-0.5">
                                            <span className="w-0.5 h-2 bg-emerald-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                            <span className="w-0.5 h-3 bg-emerald-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                            <span className="w-0.5 h-1.5 bg-emerald-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                                          </span>
                                        )}
                                      </div>
                                      <p className="text-[9.5px] text-emerald-600 mt-0.5 font-bold leading-none">
                                        {playingAudioId === tx.id ? 'Playing broadcast...' : 'Play cashier audio record'}
                                      </p>
                                    </div>
                                    <div className="shrink-0 text-emerald-450 pr-1">
                                      <Mic className={`w-3.5 h-3.5 ${playingAudioId === tx.id ? 'animate-pulse text-emerald-600' : ''}`} />
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
 
                        {/* Interactive Settle / View / Edit Buttons */}
                        <div className="flex items-center justify-end gap-1.5 pt-1 border-t border-neutral-100/80">
                          {tx.chargesStatus === 'Unpaid' && onUpdateTransaction && (
                            <button
                              type="button"
                              onClick={() => setSettlingTx(tx)}
                              className="px-2.5 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded text-[11px] font-black transition cursor-pointer flex items-center gap-0.5 shadow-sm active:scale-95 animate-pulse"
                            >
                              ✓ Collect Fee
                            </button>
                          )}
 
                          {currentUser.role === 'Manager' ? (
                            <>
                              <button
                                type="button"
                                onClick={() => onEditTransaction(tx)}
                                className="px-2.5 py-1.5 bg-neutral-50 hover:bg-neutral-100 border border-neutral-200 text-neutral-700 rounded transition font-bold text-[11px] flex items-center gap-0.5 cursor-pointer"
                              >
                                <Pencil className="w-2.5 h-2.5" />
                                Edit Receipt
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  onDeleteTransaction(tx.id);
                                }}
                                className="p-1.5 bg-red-50 hover:bg-red-100 border border-red-100 text-red-600 rounded transition cursor-pointer"
                                title="Delete Transaction"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </>
                          ) : (
                            <button
                              type="button"
                              onClick={() => onViewReceipt?.(tx)}
                              className="px-3 py-1.5 bg-[#00B87A] hover:bg-[#00b87a]/90 text-white rounded transition font-black text-[11px] flex items-center gap-1 cursor-pointer shadow-sm"
                            >
                              <FileCheck className="w-3.5 h-3.5 stroke-[2.5]" />
                              View Receipt
                            </button>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          </div>
        ) : (
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-neutral-200 text-neutral-400 text-[10px] font-mono uppercase tracking-wider">
                {currentUser.role === 'Manager' && (
                  <th className="py-3 px-2 w-10 text-center">
                    <input
                      type="checkbox"
                      checked={isAllSelected}
                      onChange={(e) => handleSelectAllToggle(e.target.checked)}
                      className="w-4 h-4 rounded border-neutral-300 text-[#00B87A] focus:ring-[#00B87A] cursor-pointer animate-in fade-in"
                    />
                  </th>
                )}
                <th className="py-3 px-2 font-black">TXID / Timestamp</th>
                <th className="py-3 px-2 font-black hidden md:table-cell">Shift Staff</th>
                <th className="py-3 px-2 font-black text-center w-20">Status</th>
                <th className="py-3 px-2 font-black">Category & POS Channel</th>
                <th className="py-3 px-2 text-center font-black">Amount</th>
                <th className="py-3 px-2 text-right font-black hidden sm:table-cell">Customer Fee</th>
                <th className="py-3 px-2 text-right font-black hidden lg:table-cell">POS Cost</th>
                <th className="py-3 px-2 text-right font-black hidden sm:table-cell">Net Profit</th>
                <th className="py-3 px-2 font-black hidden md:table-cell">Customer / Notes</th>
                <th className="py-3 px-2 font-black text-center w-24 pr-4">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 text-xs">
              <AnimatePresence mode="popLayout">
              {paginatedList.map((tx) => {
                const isDebit = tx.type === 'Withdrawal';
                
                // Colors representing true providers inside list
                const providerColor = 
                  tx.provider === 'Moniepoint' 
                    ? 'text-blue-600 bg-blue-50 border-blue-100' 
                    : tx.provider === 'OPay' 
                    ? 'text-[#00B87A] bg-emerald-50 border-emerald-100' 
                    : tx.provider === 'PalmPay'
                    ? 'text-orange-600 bg-orange-50 border-orange-100'
                    : 'text-neutral-600 bg-neutral-50 border-neutral-200';

                const serialNumber = transactions.length - transactions.indexOf(tx);

                // Count how many transactions of the same provider were done before or equal to this transaction.
                const providerTxs = transactions.filter(t => t.provider === tx.provider);
                const providerIndex = providerTxs.indexOf(tx);
                const providerSerialNumber = providerTxs.length - providerIndex;
                const providerTxId = getProviderTransactionNumber(tx);
                const destBank = tx.destinationBank;
                const isSameBank = tx.subType === 'SameBank' || (tx.provider && destBank && tx.provider.toLowerCase() === destBank.toLowerCase());
                const hasBankDetail = tx.type === 'Withdrawal' || tx.type === 'Transfer' || tx.type === 'Deposit' || tx.type === 'Cash Out (Transfer)' || tx.type === 'Airtime';

                // Styling for provider serial badges
                const providerBadgeStyle = 
                  tx.provider === 'Moniepoint'
                    ? 'bg-blue-50 text-blue-700 border-blue-200'
                    : tx.provider === 'OPay'
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-250'
                    : 'bg-orange-50 text-orange-700 border-orange-200';

                return (
                  <motion.tr
                    key={tx.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    layout
                    className="hover:bg-neutral-50 transition-all group"
                  >
                    {currentUser.role === 'Manager' && (
                      <td className="py-3 px-2 text-center" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(tx.id)}
                          onChange={(e) => toggleSelect(tx.id, e.target.checked)}
                          className="w-4 h-4 rounded border-neutral-300 text-[#00B87A] focus:ring-[#00B87A] cursor-pointer"
                        />
                      </td>
                    )}
                    {/* ID & Time */}
                    <td className={rowPadding}>
                      <div className="space-y-1">
                        <div className="font-mono text-neutral-700 font-black flex flex-wrap items-center gap-1.5">
                          <span className="inline-flex items-center justify-center bg-neutral-100 text-neutral-600 border border-neutral-200 rounded-md px-1.5 py-0.5 text-[9px] font-black" title="Global System Receipt No.">
                            #{serialNumber}
                          </span>
                          <span className={`inline-flex items-center justify-center border rounded-md px-1.5 py-0.5 text-[9px] font-black ${providerBadgeStyle}`} title={`${tx.provider} Specific Receipt No.`}>
                            {tx.provider === 'OPay' ? 'OP' : tx.provider === 'Moniepoint' ? 'MP' : 'PP'}-{providerSerialNumber}
                          </span>
                          <span className="font-black text-neutral-800 tracking-tight break-all select-all flex items-center gap-1" title="Differentiated Provider Transaction reference / Session ID">
                            <span className="inline md:hidden">ID: ...{providerTxId.slice(-6)}</span>
                            <span className="hidden md:inline">{providerTxId}</span>
                            <button
                              type="button"
                              onClick={() => handleCopy(providerTxId)}
                              className="text-neutral-400 hover:text-[#00B87A] p-0.5 rounded cursor-pointer transition ml-1 shrink-0"
                            >
                              {copiedId === providerTxId ? (
                                <Check className="w-3 h-3 text-emerald-600 stroke-[3.5]" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                            </button>
                          </span>
                        </div>
                        <div className="text-[10px] text-neutral-400 flex items-center gap-1 font-medium pt-0.5">
                          <Calendar className="w-3.5 h-3.5 text-neutral-400" />
                          {new Date(tx.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}{' '}
                          {new Date(tx.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                        </div>
                      </div>
                    </td>

                    {/* Employee Operator */}
                    <td className={`${rowPadding} hidden md:table-cell`}>
                      <span className="font-bold text-neutral-700">{tx.employeeName}</span>
                    </td>

                    {/* Status Badge */}
                    <td className={`${rowPadding} text-center`}>
                      <div className="flex flex-col items-center gap-1">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-black border uppercase tracking-wider font-mono select-none ${
                          (tx.status || 'Success') === 'Success'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : (tx.status || 'Success') === 'Pending'
                            ? 'bg-amber-50 text-amber-700 border-amber-200'
                            : 'bg-red-50 text-red-700 border-red-200'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${
                            (tx.status || 'Success') === 'Success'
                              ? 'bg-emerald-500'
                              : (tx.status || 'Success') === 'Pending'
                              ? 'bg-amber-500'
                              : 'bg-red-500'
                          }`} />
                          {(tx.status || 'Success') === 'Success' ? 'APPROVED / SUCCESSFUL' : (tx.status || 'Success') === 'Pending' ? 'PENDING' : 'FAILED'}
                        </span>

                        {(tx.chargesStatus === 'Unpaid' || tx.chargesStatus === 'PartiallyPaid' || ((tx.unpaidFeeAmount || 0) > 0)) && (
                          <span className="px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wider bg-rose-600 text-white border border-rose-700 flex items-center gap-1 shadow-xs animate-pulse">
                            <AlertTriangle className="w-2.5 h-2.5 shrink-0" />
                            DEBT (UNPAID)
                          </span>
                        )}

                        {(tx.chargesStatus === 'Waived' || tx.chargesStatus === 'Waive' || tx.isFeeWaived || (tx.customerFee === 0 && ((tx.originalFeeAmount || 0) > 0 || (tx.notes && tx.notes.toLowerCase().includes('waiv'))))) && !(tx.chargesStatus === 'Unpaid' || tx.chargesStatus === 'PartiallyPaid' || ((tx.unpaidFeeAmount || 0) > 0)) && (
                          <span className="px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wider bg-purple-600 text-white border border-purple-700 flex items-center gap-1 shadow-xs">
                            🎉 WAIVED CHARGE
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Category & Provider Badges */}
                    <td className={`${rowPadding} font-medium`}>
                      <div className="flex flex-wrap gap-1.5 items-center">
                        <span className={`px-2 py-0.5 rounded-full text-[9px] uppercase font-bold flex items-center gap-1 ${
                          (tx.type === 'Withdrawal' || tx.type === 'Cash Out (Transfer)')
                            ? 'bg-orange-100 text-orange-750' 
                            : tx.type === 'Deposit' 
                            ? 'bg-blue-100 text-blue-750' 
                            : 'bg-indigo-100 text-indigo-750'
                        }`}>
                          {tx.type === 'Withdrawal' ? '📥 Withdraw (ATM)' : tx.type === 'Cash Out (Transfer)' ? '📲 Money Receive' : tx.type === 'Deposit' ? '📤 Money Receive' : '💸 Send'}
                        </span>
                        
                        <span className={`px-2 py-0.5 rounded-full text-[9px] uppercase font-black border ${providerColor}`}>
                          {tx.provider}
                        </span>

                        {destBank && (
                          <>
                            <span className="text-neutral-400 text-[10px]">➔</span>
                            <span className={`px-2 py-0.5 rounded-full text-[9px] uppercase font-black border ${getBankBadgeStyle(destBank)}`}>
                              {destBank}
                            </span>
                          </>
                        )}

                        {hasBankDetail && (
                          <span className={`px-1.5 py-0.5 rounded-full text-[8px] font-mono uppercase font-extrabold border ${
                            isSameBank
                              ? 'bg-emerald-100/75 text-emerald-800 border-emerald-250'
                              : 'bg-neutral-100/70 text-neutral-500 border-neutral-200'
                          }`}>
                            {isSameBank ? '🔄 Same Bank' : '🌐 Other Bank'}
                          </span>
                        )}

                        {tx.feeMethod && (
                          <span className={`px-1.5 py-0.5 rounded-full text-[8px] font-mono uppercase font-black border hidden sm:inline ${
                            tx.feeMethod === 'CardDebit'
                              ? 'bg-amber-100/75 text-amber-800 border-amber-300'
                              : 'bg-emerald-50 text-emerald-705 border-emerald-150'
                          }`}>
                            {tx.feeMethod === 'CardDebit' ? '💳 Card' : '💵 Cash'}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Amount */}
                    <td className={`${rowPadding} text-center font-mono font-extrabold text-neutral-900 text-sm`}>
                      <div>{formatNaira(tx.amount)}</div>
                      {tx.totalCustomerCharged && tx.totalCustomerCharged !== tx.amount && (
                        <div className="text-[9px] text-amber-600 font-sans font-bold mt-0.5 tracking-tight" title="Total customer card swipe/account debit (base + fee)">
                          Charged: {formatNaira(tx.totalCustomerCharged)}
                        </div>
                      )}
                    </td>

                    {/* Client fee */}
                    <td className={`${rowPadding} text-right font-mono text-neutral-600 font-medium hidden sm:table-cell`}>
                      <div>{formatNaira(tx.customerFee)}</div>
                      {tx.chargesStatus === 'Unpaid' && (
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[9px] font-bold bg-amber-50 text-amber-750 border border-amber-200 mt-1">
                          ⏳ Debt: {formatNaira(tx.unpaidFeeAmount ?? tx.customerFee)}
                        </span>
                      )}
                    </td>

                    {/* Cashout cost */}
                    <td className={`${rowPadding} text-right font-mono font-medium hidden lg:table-cell`}>
                      <div className="text-red-500">-{formatNaira(tx.terminalFee)}</div>
                      {tx.cbnCharge && tx.cbnCharge > 0 ? (
                        <div className="text-[9px] text-red-400 font-sans font-bold mt-0.5 tracking-tight" title="CBN EMTL Charge">
                          CBN: -{formatNaira(tx.cbnCharge)}
                        </div>
                      ) : null}
                    </td>

                    {/* Final profit */}
                    <td className={`${rowPadding} text-right font-mono font-black text-emerald-600 hidden sm:table-cell`}>
                      <div>{formatNaira(tx.profit)}</div>
                    </td>

                    {/* Customer Info & Notes */}
                    <td className={`${rowPadding} max-w-[150px] text-neutral-400 font-medium hidden md:table-cell`} title={`${tx.customerName ? 'Debtor: ' + tx.customerName + '\n' : ''}${tx.customerPhone ? 'Phone: ' + tx.customerPhone + '\n' : ''}${tx.notes || ''}`}>
                      {(tx.customerName || tx.accountName) && (
                        <div className="text-[10px] text-amber-700 font-black mb-0.5 flex flex-col gap-0.5 bg-amber-50 border border-amber-200/50 px-1.5 py-0.5 rounded-lg w-max shrink-0">
                          <div className="flex items-center gap-1">👤 {tx.customerName || tx.accountName}</div>
                          {tx.accountNumber && <div className="text-[8px] opacity-70 font-mono">#{tx.accountNumber}</div>}
                        </div>
                      )}
                      {tx.customerPhone && (
                        <div className="text-[10px] text-neutral-600 font-bold mb-0.5">📞 {tx.customerPhone}</div>
                      )}
                      {tx.notes && (
                        <div className="truncate text-xs font-bold text-neutral-500 mb-1">
                          "{tx.notes}"
                        </div>
                      )}
                      {!tx.customerName && !tx.customerPhone && !tx.notes && !tx.audioNote && (
                        <span className="italic text-neutral-300">No notes</span>
                      )}
                      {tx.audioNote && (
                        <div className="mt-1" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={() => playAudioNote(tx.id, tx.audioNote!)}
                            className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[9px] font-mono font-black border transition-all cursor-pointer shadow-sm ${
                              playingAudioId === tx.id
                                ? 'bg-[#00B87A] text-white border-emerald-600 animate-pulse'
                                : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                            }`}
                          >
                            {playingAudioId === tx.id ? (
                              <>
                                <Pause className="w-2.5 h-2.5 fill-white stroke-[2.5]" />
                                <span>Playing</span>
                              </>
                            ) : (
                              <>
                                <Mic className="w-2.5 h-2.5 text-[#00B87A] animate-pulse" />
                                <span>Play Voice</span>
                              </>
                            )}
                          </button>
                        </div>
                      )}
                    </td>

                    {/* Action controls */}
                    <td className={`${rowPadding} text-right pr-4 shrink-0 font-mono`}>
                      <div className="flex justify-end items-center gap-1.5">
                        {tx.pendingSettlement && currentUser.role === 'Manager' && (
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleApproveSettlement(tx)}
                              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[10px] font-black transition cursor-pointer shadow-sm active:scale-95"
                              title="Approve proposed settlement"
                            >
                              Approve
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRejectSettlement(tx)}
                              className="px-2.5 py-1 bg-white border border-amber-300 text-amber-700 rounded-lg text-[10px] font-bold transition cursor-pointer hover:bg-amber-50 active:scale-95"
                              title="Reject settlement proposal"
                            >
                              Reject
                            </button>
                          </div>
                        )}

                        {tx.pendingSettlement && currentUser.role === 'Employee' && (
                          <span className="px-2 py-1 bg-amber-50 text-amber-600 border border-amber-200 rounded-lg text-[8px] font-black uppercase tracking-tighter animate-pulse">
                            Wait Approval
                          </span>
                        )}

                        {tx.chargesStatus === 'Unpaid' && !tx.pendingSettlement && onUpdateTransaction && (
                          <button
                            type="button"
                            onClick={() => setSettlingTx(tx)}
                            className="px-2.5 py-1 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-[10px] font-black transition cursor-pointer flex items-center gap-1 shadow-sm active:scale-95 animate-pulse"
                            title="Mark outstanding charges as fully paid"
                          >
                            ✓ Settle Fee
                          </button>
                        )}

                        {currentUser.role === 'Manager' ? (
                          <>
                            <button
                              type="button"
                              onClick={() => onEditTransaction(tx)}
                              className="p-1 px-2.5 bg-neutral-100 hover:bg-[#00B87A]/10 text-neutral-650 hover:text-[#00B87A] rounded-xl transition duration-100 border border-neutral-200 hover:border-[#00B87A]/30 text-[10px] font-extrabold flex items-center gap-1 cursor-pointer"
                              title="Edit transaction parameters (amount or charges)"
                            >
                              <Pencil className="w-3 h-3" />
                              <span>Edit</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                onDeleteTransaction(tx.id);
                              }}
                              className="p-1 text-neutral-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition cursor-pointer"
                              title="Void / Delete Transaction"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            onClick={() => onViewReceipt?.(tx)}
                            className="px-3 py-1.5 border border-[#00B87A]/20 hover:border-emerald-500 bg-[#00B87A]/10 hover:bg-[#00B87A] text-[#00B87A] hover:text-white rounded-xl transition duration-110 text-[10px] font-extrabold flex items-center gap-1 cursor-pointer shadow-xs"
                            title="View receipt slip details"
                          >
                            <FileCheck className="w-3.5 h-3.5" />
                            <span>Slip Receipt</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </motion.tr>
                );
              })}
              </AnimatePresence>
            </tbody>
          </table>
        )}

        {/* Pagination Bar */}
        {totalPages > 1 && (
          <div className="bg-neutral-50 px-4 py-3 border-t border-neutral-100 flex items-center justify-between mt-3 select-none rounded-2xl">
            <div className="text-[10px] text-neutral-500 font-mono">
              Showing <span className="font-bold text-neutral-800">{Math.min(totalItems, (currentPage - 1) * pageSize + 1)}</span> to{' '}
              <span className="font-bold text-neutral-800">{Math.min(totalItems, currentPage * pageSize)}</span> of{' '}
              <span className="font-bold text-neutral-800">{totalItems}</span> transactions
            </div>
            <div className="flex gap-1.5">
              <button
                type="button"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                className="py-1 px-3 border border-neutral-200 hover:border-neutral-300 text-[10px] font-bold text-neutral-600 rounded-lg cursor-pointer transition bg-white select-none disabled:opacity-40 disabled:cursor-not-allowed text-center"
              >
                Prev
              </button>
              {Array.from({ length: totalPages }).map((_, idx) => {
                const pageNum = idx + 1;
                const isCurrent = currentPage === pageNum;
                return (
                  <button
                    key={pageNum}
                    type="button"
                    onClick={() => setCurrentPage(pageNum)}
                    className={`py-1 px-2.5 text-[10px] font-mono font-bold rounded-lg transition cursor-pointer select-none ${
                      isCurrent
                        ? 'bg-[#00B87A] text-white border border-[#00B87A]'
                        : 'border border-neutral-200 hover:bg-neutral-100 text-neutral-600'
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}
              <button
                type="button"
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                className="py-1 px-3 border border-neutral-200 hover:border-neutral-300 text-[10px] font-bold text-neutral-600 rounded-lg cursor-pointer transition bg-white select-none disabled:opacity-40 disabled:cursor-not-allowed text-center"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Employee Settle Charges Overlay Modal */}
      {settlingTx && (
        <div className="fixed inset-0 bg-black/65 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-in fade-in duration-200 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-md w-full max-h-[90vh] overflow-y-auto p-6 shadow-2xl space-y-5 relative border border-neutral-100 text-left animate-in slide-in-from-bottom-4 duration-250">
            {/* Close Button */}
            <button
              type="button"
              onClick={() => setSettlingTx(null)}
              className="absolute right-4.5 top-4.5 p-1.5 rounded-full bg-neutral-100 text-neutral-500 hover:text-neutral-800 transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Header */}
            <div className="space-y-1 pr-6">
              <span className="text-[10px] bg-emerald-100 text-emerald-800 font-mono font-black uppercase tracking-wider px-2 py-0.5 rounded-full">
                Employee Terminal Settle
              </span>
              <h3 className="text-lg font-extrabold text-neutral-800 tracking-tight flex items-center gap-1.5 mt-1">
                Settle Deferred Charges
              </h3>
              <p className="text-xs text-neutral-500">
                Edit and add the exact charges before marking the transaction commission as successful.
              </p>
            </div>

            {/* Debtor Snapshot Panel */}
            <div className="bg-neutral-50 border border-neutral-200/60 p-3.5 rounded-2xl space-y-2.5 text-xs text-neutral-700 font-medium">
              <div className="flex justify-between items-center border-b border-neutral-200/50 pb-2">
                <span className="text-neutral-400 uppercase font-mono text-[9px] font-bold">Client / Debtor</span>
                <span className="font-extrabold text-neutral-800">{settlingTx.customerName || 'Walk-in Client'}</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div>
                  <span className="text-neutral-400 uppercase font-mono text-[8px] block font-bold">Transaction Type</span>
                  <span className="font-bold text-neutral-850">{settlingTx.type} ({settlingTx.provider})</span>
                </div>
                <div>
                  <span className="text-neutral-400 uppercase font-mono text-[8px] block font-bold">Transaction Amount</span>
                  <span className="font-bold text-neutral-850 font-mono">{formatNaira(settlingTx.amount)}</span>
                </div>
              </div>
              <div className="text-[10px] text-neutral-400 font-mono pt-1">
                Originally processed by employee <strong>{settlingTx.employeeName}</strong>
              </div>
            </div>

            {/* Edit Settle Fee Field */}
            <div className="space-y-3">
              <div className="space-y-1.5">
                <label htmlFor="settle-fee-input" className="block text-xs font-bold uppercase tracking-wider text-neutral-500 font-mono">
                  Employee Adjusted Charge Amount (₦)
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400 font-mono text-sm">₦</span>
                  <input
                    id="settle-fee-input"
                    type="number"
                    value={settleFeeInput}
                    onChange={(e) => setSettleFeeInput(e.target.value)}
                    className="w-full bg-neutral-50 border border-neutral-200 rounded-xl pl-8 pr-3 py-2.5 text-neutral-850 font-mono text-sm font-black focus:outline-none focus:border-emerald-500 focus:bg-white"
                    placeholder="0"
                  />
                </div>
              </div>

              {/* Fee Method Toggle option */}
              <div className="space-y-1.5">
                <span className="block text-[10px] font-bold uppercase tracking-wider text-neutral-400 font-mono">
                  Collection Method
                </span>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setSettleFeeMethod('Cash')}
                    className={`py-2 px-1 rounded-xl text-[10px] font-bold border transition cursor-pointer text-center uppercase font-mono ${
                      settleFeeMethod === 'Cash'
                        ? 'bg-neutral-800 border-neutral-800 text-white font-black'
                        : 'bg-white border-neutral-200 text-neutral-500 hover:text-neutral-700'
                    }`}
                  >
                    💵 Cash Collection
                  </button>
                  <button
                    type="button"
                    onClick={() => setSettleFeeMethod('CardDebit')}
                    className={`py-2 px-1 rounded-xl text-[10px] font-bold border transition cursor-pointer text-center uppercase font-mono ${
                      settleFeeMethod === 'CardDebit'
                        ? 'bg-neutral-800 border-neutral-800 text-white font-black'
                        : 'bg-white border-neutral-200 text-neutral-500 hover:text-neutral-700'
                    }`}
                  >
                    💳 Card Add-on (Bill Fee)
                  </button>
                </div>
              </div>
            </div>

            {/* Calculations and Profits Preview */}
            <div className="bg-emerald-50/50 border border-emerald-100 p-4 rounded-2xl space-y-2.5">
              <span className="text-[9px] text-emerald-800 font-mono font-black uppercase tracking-wider block">
                🔴 Live Settle Impact Summary
              </span>
              <div className="space-y-1.5 text-xs text-neutral-600 font-medium text-left">
                <div className="flex justify-between">
                  <span>Manager Settle Fee Amount:</span>
                  <span className="font-mono font-bold text-neutral-800">{formatNaira(parseFloat(settleFeeInput) || 0)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Terminal Base Commission:</span>
                  <span className="font-mono text-neutral-500">-{formatNaira(settlingTx.terminalFee)}</span>
                </div>
                {settlingTx.cbnCharge ? (
                  <div className="flex justify-between">
                    <span>CBN Duty:</span>
                    <span className="font-mono text-neutral-500">-{formatNaira(settlingTx.cbnCharge)}</span>
                  </div>
                ) : null}
                <div className="flex justify-between border-t border-neutral-200/50 pt-2 text-sm font-black">
                  <span className="text-emerald-850">Net Commission Profit:</span>
                  <span className="font-mono text-emerald-700">
                    {formatNaira((parseFloat(settleFeeInput) || 0) - settlingTx.terminalFee - (settlingTx.cbnCharge || 0))}
                  </span>
                </div>
              </div>
            </div>

            {/* Confirm Actions */}
            <div className="grid grid-cols-2 gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => setSettlingTx(null)}
                className="w-full py-2.5 px-4 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-bold rounded-xl text-xs transition cursor-pointer font-mono uppercase"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!onUpdateTransaction) return;
                  const feeToSettle = parseFloat(settleFeeInput) || 0;
                  const totalPaidSoFar = (settlingTx.chargesPaidAmount || 0) + feeToSettle;
                  const updatedProfit = totalPaidSoFar - settlingTx.terminalFee - (settlingTx.cbnCharge || 0) + (settlingTx.cashback || 0);
                  const updatedTotalCustomerCharged = settleFeeMethod === 'CardDebit' ? (settlingTx.amount + feeToSettle) : settlingTx.amount;
                  const originalFee = (settlingTx.originalFeeAmount !== undefined && settlingTx.originalFeeAmount > 0) ? settlingTx.originalFeeAmount : (settlingTx.unpaidFeeAmount !== undefined && settlingTx.unpaidFeeAmount > 0 ? settlingTx.unpaidFeeAmount : settlingTx.customerFee || 200);

                  const isFullyPaid = totalPaidSoFar >= originalFee;
                  const proposedStatus = isFullyPaid ? 'Paid' : 'PartiallyPaid';
                  const remainingUnpaid = Math.max(0, originalFee - totalPaidSoFar);

                  const newPaymentRecord = {
                    id: String(Date.now()),
                    date: new Date().toISOString(),
                    amount: feeToSettle,
                    collectorName: currentUser?.name || 'Cashier',
                    note: 'Settlement from Transaction Journal'
                  };

                  if (currentUser?.role === 'Employee') {
                    onUpdateTransaction({
                      ...settlingTx,
                      originalFeeAmount: originalFee,
                      pendingSettlement: {
                        requestedBy: currentUser.name,
                        requestedById: currentUser.id,
                        requestedAt: new Date().toISOString(),
                        feeMethod: settleFeeMethod,
                        paidAmount: feeToSettle,
                        note: 'Journal Settle by Cashier',
                        proposedChargesStatus: proposedStatus,
                        proposedTotalPaidSoFar: totalPaidSoFar,
                        proposedUnpaidAmount: remainingUnpaid,
                        proposedPaymentRecord: newPaymentRecord
                      }
                    });
                    alert(`📢 Settlement request of ${formatNaira(feeToSettle)} submitted for ${settlingTx.customerName || 'Customer'}! Pending Manager approval.`);
                    setSettlingTx(null);
                    return;
                  }

                  onUpdateTransaction({
                    ...settlingTx,
                    customerFee: totalPaidSoFar + remainingUnpaid, // Keep original fee as base
                    profit: updatedProfit,
                    agentProfit: updatedProfit,
                    netProfit: updatedProfit,
                    totalCustomerCharged: updatedTotalCustomerCharged,
                    feeMethod: settleFeeMethod,
                    chargesStatus: proposedStatus,
                    unpaidFeeAmount: remainingUnpaid,
                    pendingSettlement: null,
                    chargesPaidAmount: totalPaidSoFar,
                    chargePayments: [...(settlingTx.chargePayments || []), newPaymentRecord]
                  });

                  // Simple Web Audio API feedback
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

                  setSettlingTx(null);
                }}
                className="w-full py-2.5 px-4 bg-[#00B87A] hover:bg-emerald-600 text-white font-black rounded-xl text-xs transition cursor-pointer flex items-center justify-center gap-1 font-mono uppercase shadow-md active:scale-95"
              >
                ✓ Save & Settle
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});
