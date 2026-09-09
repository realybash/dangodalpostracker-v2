import React, { useState, useMemo } from 'react';
import { User, BranchCashTransfer, CashReceiveLog } from '../types';
import { 
  Plus, 
  Trash2, 
  MapPin, 
  ArrowRightLeft, 
  Send, 
  CheckCircle2, 
  Clock, 
  XCircle, 
  User as UserIcon, 
  Search, 
  ShieldCheck, 
  Coins, 
  Building2,
  X,
  Truck,
  PieChart,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  Receipt,
  Eye,
  Calendar,
  UserCheck,
  Layers,
  Calculator,
  FileText,
  AlertTriangle,
  History,
  Download,
  FileSpreadsheet,
  Edit3
} from 'lucide-react';
import { formatNaira, generateId } from '../utils';
import { SubscriptionWarningBanner } from './SubscriptionWarningBanner';

interface CashTransferManagerProps {
  currentUser: User;
  teamUsers: User[];
  cashTransfers: BranchCashTransfer[];
  onAddTransfer: (transfer: BranchCashTransfer) => void;
  onUpdateTransfer: (transfer: BranchCashTransfer) => void;
  onDeleteTransfer: (id: string) => void;
  subscriptionDaysRemaining?: number | null;
  onOpenBillingModal?: () => void;
}

function formatFullDateAndTime(isoString?: string): string {
  if (!isoString) return 'N/A';
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString;
    return d.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    }) + ' at ' + d.toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    });
  } catch {
    return isoString;
  }
}

export function CashTransferManager({
  currentUser,
  teamUsers,
  cashTransfers,
  onAddTransfer,
  onUpdateTransfer,
  onDeleteTransfer,
  subscriptionDaysRemaining,
  onOpenBillingModal
}: CashTransferManagerProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTransfer, setEditingTransfer] = useState<BranchCashTransfer | null>(null);
  const [receiveModalTransfer, setReceiveModalTransfer] = useState<BranchCashTransfer | null>(null);
  const [filterTab, setFilterTab] = useState<'all' | 'pending' | 'partial' | 'confirmed' | 'sent' | 'unwitnessed' | 'history'>('all');
  const [eventTypeFilter, setEventTypeFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedLogs, setExpandedLogs] = useState<Record<string, boolean>>({});

  // New Transfer Form state
  const [receiverCashierId, setReceiverCashierId] = useState('');
  const [customReceiverName, setCustomReceiverName] = useState('');
  const [targetBranch, setTargetBranch] = useState('');
  const [bearerName, setBearerName] = useState('');
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');

  // Partial Receive Modal state
  const [receiveAmountNow, setReceiveAmountNow] = useState('');
  const [receiveBearerNow, setReceiveBearerNow] = useState('');
  const [receiveNotesNow, setReceiveNotesNow] = useState('');

  const availableCashiers = teamUsers.filter(u => u.id !== currentUser.id);

  // Totals calculations
  const totalExpectedAmount = useMemo(() => {
    return cashTransfers.reduce((sum, t) => sum + (t.amount || 0), 0);
  }, [cashTransfers]);

  const totalReceivedAmount = useMemo(() => {
    return cashTransfers.reduce((sum, t) => {
      if (t.status === 'Confirmed') return sum + (t.amount || 0);
      return sum + (t.receivedAmount || 0);
    }, 0);
  }, [cashTransfers]);

  const totalOutstandingBalance = useMemo(() => {
    return Math.max(0, totalExpectedAmount - totalReceivedAmount);
  }, [totalExpectedAmount, totalReceivedAmount]);

  const unwitnessedCount = useMemo(() => {
    return cashTransfers.filter(t => !t.witnessedByManagerId).length;
  }, [cashTransfers]);

  // Pending / Partial count for current user
  const actionRequiredCount = useMemo(() => {
    return cashTransfers.filter(t => {
      if (t.status === 'Confirmed' || t.status === 'Rejected') return false;
      const isDirectTarget = Boolean(currentUser?.id && t.receiverUserId === currentUser.id);
      const isTargetBranchMatch = Boolean(
        t.receiverBranch &&
        currentUser?.areaOfWorking &&
        t.receiverBranch.toLowerCase().trim() === currentUser.areaOfWorking.toLowerCase().trim()
      );
      const currentUserName = (currentUser?.name || currentUser?.fullName || '').toLowerCase().trim();
      const isCustomNameMatch = Boolean(currentUserName && (t.receiverName || '').toLowerCase().trim() === currentUserName);
      return isDirectTarget || isTargetBranchMatch || isCustomNameMatch || currentUser?.role === 'Manager';
    }).length;
  }, [cashTransfers, currentUser]);

  // Multi-Handoff Running Ledger Calculations (Groups active transfers by cashier/branch pair)
  const activePairLedgers = useMemo(() => {
    const map = new Map<string, {
      pairKey: string;
      senderName: string;
      senderBranch: string;
      receiverName: string;
      receiverBranch: string;
      activeTransfers: BranchCashTransfer[];
      totalSent: number;
      totalReceived: number;
      netBalanceOwed: number;
    }>();

    // Only active (Pending or Partially Received) transfers
    const activeTransfers = cashTransfers.filter(t => t.status === 'Pending' || t.status === 'Partially Received');

    activeTransfers.forEach(t => {
      const sKey = (t.senderName || 'Cashier').trim().toLowerCase();
      const rKey = (t.receiverName || 'Cashier').trim().toLowerCase();
      const pairKey = `${sKey}::${rKey}`;

      if (!map.has(pairKey)) {
        map.set(pairKey, {
          pairKey,
          senderName: t.senderName || 'Cashier',
          senderBranch: t.senderBranch || 'Main Branch',
          receiverName: t.receiverName || 'Cashier',
          receiverBranch: t.receiverBranch || 'Branch',
          activeTransfers: [],
          totalSent: 0,
          totalReceived: 0,
          netBalanceOwed: 0
        });
      }

      const item = map.get(pairKey)!;
      item.activeTransfers.push(t);
      const rec = t.receivedAmount || 0;
      item.totalSent += t.amount || 0;
      item.totalReceived += rec;
      item.netBalanceOwed += Math.max(0, (t.amount || 0) - rec);
    });

    // Sort activeTransfers inside each group by timestamp ascending
    map.forEach(item => {
      item.activeTransfers.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    });

    return Array.from(map.values());
  }, [cashTransfers]);

  // Map to quickly lookup multi-handoff info for a specific transfer ID
  const transferMultiHandoffInfoMap = useMemo(() => {
    const infoMap = new Map<string, {
      totalInSeries: number;
      indexInSeries: number;
      seriesNetBalanceOwed: number;
      seriesTotalSent: number;
      seriesTotalReceived: number;
      isMultiSeries: boolean;
      pairSenderName: string;
      pairReceiverName: string;
    }>();

    activePairLedgers.forEach(ledger => {
      const totalInSeries = ledger.activeTransfers.length;
      const isMultiSeries = totalInSeries > 1;

      ledger.activeTransfers.forEach((t, idx) => {
        infoMap.set(t.id, {
          totalInSeries,
          indexInSeries: idx + 1,
          seriesNetBalanceOwed: ledger.netBalanceOwed,
          seriesTotalSent: ledger.totalSent,
          seriesTotalReceived: ledger.totalReceived,
          isMultiSeries,
          pairSenderName: ledger.senderName,
          pairReceiverName: ledger.receiverName
        });
      });
    });

    return infoMap;
  }, [activePairLedgers]);

  // Check active ledger for receiver selected in New Transfer form
  const activeLedgerForNewForm = useMemo(() => {
    let targetName = customReceiverName.trim().toLowerCase();
    if (receiverCashierId && !targetName) {
      const selected = availableCashiers.find(c => c.id === receiverCashierId);
      if (selected) targetName = (selected.name || selected.fullName || '').trim().toLowerCase();
    }
    if (!targetName) return null;

    return activePairLedgers.find(l => 
      l.receiverName.trim().toLowerCase().includes(targetName) ||
      targetName.includes(l.receiverName.trim().toLowerCase())
    ) || null;
  }, [customReceiverName, receiverCashierId, availableCashiers, activePairLedgers]);

  // Comprehensive Event Timeline History across all transactions
  const allHistoryEvents = useMemo(() => {
    const events: Array<{
      id: string;
      transferId: string;
      eventType: 'TRANSFER_CREATED' | 'CASH_RECEIVED' | 'MANAGER_WITNESSED' | 'TRANSFER_CONFIRMED' | 'TRANSFER_REJECTED';
      eventTitle: string;
      timestamp: string;
      actor: string;
      senderName: string;
      senderBranch: string;
      receiverName: string;
      receiverBranch: string;
      bearerName: string;
      amount: number;
      totalExpectedAmount: number;
      notes?: string;
      status: string;
    }> = [];

    cashTransfers.forEach(t => {
      // 1. Created Event
      events.push({
        id: `${t.id}-created`,
        transferId: t.id,
        eventType: 'TRANSFER_CREATED',
        eventTitle: 'Transfer Handoff Initiated',
        timestamp: t.timestamp,
        actor: t.senderName,
        senderName: t.senderName,
        senderBranch: t.senderBranch,
        receiverName: t.receiverName,
        receiverBranch: t.receiverBranch || 'Branch',
        bearerName: t.bearerName,
        amount: t.amount,
        totalExpectedAmount: t.amount,
        notes: t.notes,
        status: t.status
      });

      // 2. Installment Log Events
      if (t.receiveLogs && t.receiveLogs.length > 0) {
        t.receiveLogs.forEach((log, index) => {
          events.push({
            id: log.id || `${t.id}-log-${index}`,
            transferId: t.id,
            eventType: 'CASH_RECEIVED',
            eventTitle: `Installment #${index + 1} Received`,
            timestamp: log.timestamp,
            actor: log.receivedByName,
            senderName: t.senderName,
            senderBranch: t.senderBranch,
            receiverName: t.receiverName,
            receiverBranch: t.receiverBranch || 'Branch',
            bearerName: log.bearerName || t.bearerName,
            amount: log.receivedAmount,
            totalExpectedAmount: t.amount,
            notes: log.notes,
            status: t.status
          });
        });
      }

      // 3. Manager Witness Event
      if (t.witnessedByManagerId && t.witnessedAt) {
        events.push({
          id: `${t.id}-witnessed`,
          transferId: t.id,
          eventType: 'MANAGER_WITNESSED',
          eventTitle: 'Manager Witness Sign-Off',
          timestamp: t.witnessedAt,
          actor: t.witnessedByManagerName || 'Manager',
          senderName: t.senderName,
          senderBranch: t.senderBranch,
          receiverName: t.receiverName,
          receiverBranch: t.receiverBranch || 'Branch',
          bearerName: t.bearerName,
          amount: t.amount,
          totalExpectedAmount: t.amount,
          notes: 'Manager verified and witnessed physical cash handoff',
          status: t.status
        });
      }

      // 4. Confirmed / Fully Received Event
      if (t.status === 'Confirmed' && t.confirmedAt) {
        events.push({
          id: `${t.id}-confirmed`,
          transferId: t.id,
          eventType: 'TRANSFER_CONFIRMED',
          eventTitle: 'Full Settlement Confirmed',
          timestamp: t.confirmedAt,
          actor: t.confirmedByName || t.receiverName,
          senderName: t.senderName,
          senderBranch: t.senderBranch,
          receiverName: t.receiverName,
          receiverBranch: t.receiverBranch || 'Branch',
          bearerName: t.bearerName,
          amount: t.amount,
          totalExpectedAmount: t.amount,
          notes: 'Final settlement confirmed and transfer closed',
          status: t.status
        });
      }

      // 5. Rejected Event
      if (t.status === 'Rejected' && t.confirmedAt) {
        events.push({
          id: `${t.id}-rejected`,
          transferId: t.id,
          eventType: 'TRANSFER_REJECTED',
          eventTitle: 'Transfer Handoff Rejected',
          timestamp: t.confirmedAt,
          actor: t.confirmedByName || t.receiverName,
          senderName: t.senderName,
          senderBranch: t.senderBranch,
          receiverName: t.receiverName,
          receiverBranch: t.receiverBranch || 'Branch',
          bearerName: t.bearerName,
          amount: t.amount,
          totalExpectedAmount: t.amount,
          notes: 'Transfer rejected by receiving cashier',
          status: t.status
        });
      }
    });

    events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    return events;
  }, [cashTransfers]);

  const filteredHistoryEvents = useMemo(() => {
    return allHistoryEvents.filter(ev => {
      if (eventTypeFilter !== 'ALL' && ev.eventType !== eventTypeFilter) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchActor = (ev.actor || '').toLowerCase().includes(q);
        const matchSender = (ev.senderName || '').toLowerCase().includes(q);
        const matchReceiver = (ev.receiverName || '').toLowerCase().includes(q);
        const matchBearer = (ev.bearerName || '').toLowerCase().includes(q);
        const matchTitle = (ev.eventTitle || '').toLowerCase().includes(q);
        const matchNotes = (ev.notes || '').toLowerCase().includes(q);
        const matchBranch = ((ev.senderBranch || '') + ' ' + (ev.receiverBranch || '')).toLowerCase().includes(q);
        return matchActor || matchSender || matchReceiver || matchBearer || matchTitle || matchNotes || matchBranch;
      }

      return true;
    });
  }, [allHistoryEvents, eventTypeFilter, searchQuery]);

  const handleDownloadCSV = () => {
    const headers = [
      'Timestamp',
      'Event Type',
      'Event Description',
      'Transfer ID',
      'Sending Cashier',
      'Sending Branch',
      'Receiving Cashier',
      'Receiving Branch',
      'Bearer / Delivery',
      'Event Amount (NGN)',
      'Total Transfer Amount (NGN)',
      'Overall Status',
      'Actor / Performed By',
      'Notes / Remarks'
    ];

    const rows = filteredHistoryEvents.map(e => [
      `"${formatFullDateAndTime(e.timestamp)}"`,
      `"${e.eventType}"`,
      `"${e.eventTitle}"`,
      `"${e.transferId}"`,
      `"${e.senderName}"`,
      `"${e.senderBranch}"`,
      `"${e.receiverName}"`,
      `"${e.receiverBranch}"`,
      `"${e.bearerName}"`,
      e.amount,
      e.totalExpectedAmount,
      `"${e.status}"`,
      `"${e.actor}"`,
      `"${(e.notes || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Cash_Transfers_Audit_History_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const toggleLogsExpand = (id: string) => {
    setExpandedLogs(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleStartEdit = (transfer: BranchCashTransfer) => {
    setEditingTransfer(transfer);
    setCustomReceiverName(transfer.receiverName);
    setTargetBranch(transfer.receiverBranch || '');
    setAmount(transfer.amount.toString());
    setBearerName(transfer.bearerName || transfer.receiverName || '');
    setNotes(transfer.notes || '');
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingTransfer(null);
    setReceiverCashierId('');
    setCustomReceiverName('');
    setTargetBranch('');
    setBearerName('');
    setAmount('');
    setNotes('');
  };

  const handleCreateTransfer = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAmount = parseFloat(amount);
    if (!parsedAmount || parsedAmount <= 0) return;

    const finalReceiverName = customReceiverName.trim();
    if (!finalReceiverName) return;

    const isManagerActor = currentUser.role === 'Manager';
    const finalBearer = bearerName.trim() || finalReceiverName;

    if (editingTransfer) {
      const updatedTransfer: BranchCashTransfer = {
        ...editingTransfer,
        receiverName: finalReceiverName,
        receiverBranch: targetBranch.trim() || 'Branch',
        bearerName: finalBearer,
        amount: parsedAmount,
        notes: notes.trim() || undefined,
      };
      onUpdateTransfer(updatedTransfer);
    } else {
      const newTransfer: BranchCashTransfer = {
        id: generateId(),
        senderUserId: currentUser.id,
        senderName: currentUser.name || currentUser.fullName || 'Cashier',
        senderBranch: currentUser.areaOfWorking || currentUser.businessName || 'Main Branch',
        receiverUserId: receiverCashierId || undefined,
        receiverName: finalReceiverName,
        receiverBranch: targetBranch.trim() || 'Branch',
        bearerName: finalBearer,
        amount: parsedAmount,
        receivedAmount: 0,
        status: 'Pending',
        managerId: currentUser.role === 'Manager' ? currentUser.id : (currentUser.parentManagerId || currentUser.ownerId || currentUser.id),
        timestamp: new Date().toISOString(),
        notes: notes.trim() || undefined,
        witnessedByManagerId: isManagerActor ? currentUser.id : undefined,
        witnessedByManagerName: isManagerActor ? (currentUser.name || currentUser.fullName) : undefined,
        witnessedAt: isManagerActor ? new Date().toISOString() : undefined,
        receiveLogs: []
      };

      onAddTransfer(newTransfer);
    }

    handleCloseModal();
  };

  const openReceiveModal = (transfer: BranchCashTransfer) => {
    const currentReceived = transfer.receivedAmount || (transfer.status === 'Confirmed' ? transfer.amount : 0);
    const remaining = Math.max(0, transfer.amount - currentReceived);
    
    setReceiveModalTransfer(transfer);
    setReceiveAmountNow(remaining > 0 ? remaining.toString() : '');
    setReceiveBearerNow(transfer.bearerName || '');
    setReceiveNotesNow('');
  };

  const handleConfirmReceiveSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!receiveModalTransfer) return;

    const parsedNow = parseFloat(receiveAmountNow);
    if (isNaN(parsedNow) || parsedNow <= 0) return;

    const prevReceived = receiveModalTransfer.receivedAmount || 0;
    const newTotalReceived = prevReceived + parsedNow;
    const isFullyPaid = newTotalReceived >= receiveModalTransfer.amount;

    const isManagerActor = currentUser.role === 'Manager';

    const newLog: CashReceiveLog = {
      id: generateId(),
      receivedAmount: parsedNow,
      receivedByName: currentUser.name || currentUser.fullName || 'Cashier',
      receivedByUserId: currentUser.id,
      bearerName: receiveBearerNow.trim() || receiveModalTransfer.bearerName,
      timestamp: new Date().toISOString(),
      notes: receiveNotesNow.trim() || undefined
    };

    const updatedTransfer: BranchCashTransfer = {
      ...receiveModalTransfer,
      receivedAmount: newTotalReceived,
      status: isFullyPaid ? 'Confirmed' : 'Partially Received',
      confirmedByUserId: currentUser.id,
      confirmedByName: currentUser.name || currentUser.fullName || 'Cashier',
      confirmedAt: new Date().toISOString(),
      bearerName: receiveBearerNow.trim() || receiveModalTransfer.bearerName,
      witnessedByManagerId: receiveModalTransfer.witnessedByManagerId || (isManagerActor ? currentUser.id : undefined),
      witnessedByManagerName: receiveModalTransfer.witnessedByManagerName || (isManagerActor ? (currentUser.name || currentUser.fullName) : undefined),
      witnessedAt: receiveModalTransfer.witnessedAt || (isManagerActor ? new Date().toISOString() : undefined),
      receiveLogs: [...(receiveModalTransfer.receiveLogs || []), newLog]
    };

    onUpdateTransfer(updatedTransfer);
    setReceiveModalTransfer(null);
  };

  const handleWitnessByManager = (transfer: BranchCashTransfer) => {
    const updatedTransfer: BranchCashTransfer = {
      ...transfer,
      witnessedByManagerId: currentUser.id,
      witnessedByManagerName: currentUser.name || currentUser.fullName || 'Manager',
      witnessedAt: new Date().toISOString()
    };
    onUpdateTransfer(updatedTransfer);
  };

  const handleRejectTransfer = (transfer: BranchCashTransfer) => {
    const updated: BranchCashTransfer = {
      ...transfer,
      status: 'Rejected',
      confirmedByUserId: currentUser.id,
      confirmedByName: currentUser.name || currentUser.fullName || 'Cashier',
      confirmedAt: new Date().toISOString()
    };
    onUpdateTransfer(updated);
  };

  // Filter transfers list
  const filteredTransfers = useMemo(() => {
    return cashTransfers.filter(t => {
      // Tab filter
      if (filterTab === 'pending' && t.status !== 'Pending') return false;
      if (filterTab === 'partial' && t.status !== 'Partially Received') return false;
      if (filterTab === 'confirmed' && t.status !== 'Confirmed') return false;
      if (filterTab === 'sent' && t.senderUserId !== currentUser.id) return false;
      if (filterTab === 'unwitnessed' && !!t.witnessedByManagerId) return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesSender = (t.senderName || '').toLowerCase().includes(q);
        const matchesReceiver = (t.receiverName || '').toLowerCase().includes(q);
        const matchesBearer = (t.bearerName || '').toLowerCase().includes(q);
        const matchesBranch = ((t.senderBranch || '') + ' ' + (t.receiverBranch || '')).toLowerCase().includes(q);
        return matchesSender || matchesReceiver || matchesBearer || matchesBranch;
      }

      return true;
    });
  }, [cashTransfers, filterTab, searchQuery, currentUser.id]);

  return (
    <div className="space-y-6">
      <SubscriptionWarningBanner
        daysRemaining={subscriptionDaysRemaining ?? null}
        currentUser={currentUser}
        onOpenBillingModal={onOpenBillingModal}
      />

      {/* Manager Oversight & Witness Bar (for Managers) */}
      {currentUser.role === 'Manager' && (
        <div className="bg-slate-900 text-white rounded-3xl p-5 border border-slate-800 shadow-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 rounded-2xl flex items-center justify-center shrink-0">
              <Eye className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-extrabold text-indigo-400 uppercase tracking-widest bg-indigo-500/20 px-2.5 py-0.5 rounded-md border border-indigo-500/30">
                  Manager Witness & Audit Control
                </span>
                <span className="text-[10px] text-slate-400 font-mono">Real-Time Surveillance</span>
              </div>
              <h3 className="text-base font-black text-white mt-0.5">
                Monitoring Cashier-to-Cashier Handoffs Across Branches
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                You are in the middle of all cashier cash movements. Witness and verify dates, times, & amounts.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 self-stretch md:self-auto">
            {unwitnessedCount > 0 ? (
              <button
                onClick={() => setFilterTab('unwitnessed')}
                className="bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 transition-all w-full md:w-auto justify-center"
              >
                <AlertCircle className="w-4 h-4 text-amber-400" />
                <span>{unwitnessedCount} Unwitnessed Cashier Transfers</span>
              </button>
            ) : (
              <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-3.5 py-2 rounded-xl flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                All Transfers Witnessed by Manager
              </span>
            )}
          </div>
        </div>
      )}

      {/* Top Banner Overview */}
      <div className="bg-gradient-to-r from-blue-700 via-indigo-800 to-purple-900 rounded-3xl p-6 md:p-8 text-white shadow-xl relative overflow-hidden flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="absolute -bottom-10 -right-10 w-48 h-48 bg-white/10 rounded-full blur-2xl pointer-events-none" />
        
        <div>
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span className="bg-white/20 text-white text-xs px-3 py-1 rounded-full font-mono font-bold uppercase tracking-widest flex items-center gap-1.5 backdrop-blur-md">
              <ArrowRightLeft className="w-3.5 h-3.5" />
              Cashier-to-Cashier Branch Transfer Engine
            </span>
            {actionRequiredCount > 0 && (
              <span className="bg-amber-400 text-neutral-900 text-xs px-2.5 py-0.5 rounded-full font-bold animate-pulse">
                {actionRequiredCount} Action Required
              </span>
            )}
          </div>

          <div className="flex items-baseline gap-3">
            <h2 className="text-3xl md:text-5xl font-black font-mono tracking-tight">
              {formatNaira(totalReceivedAmount)}
            </h2>
            <span className="text-xs md:text-sm text-blue-200 font-medium">
              received of {formatNaira(totalExpectedAmount)}
            </span>
          </div>

          <p className="text-xs md:text-sm text-blue-100 mt-3 flex items-center gap-4 font-medium flex-wrap">
            <span className="flex items-center gap-1.5 bg-amber-400/20 px-3 py-1 rounded-full border border-amber-300/30">
              <Clock className="w-4 h-4 text-amber-300" />
              Outstanding Balance: <strong className="text-amber-300">{formatNaira(totalOutstandingBalance)}</strong>
            </span>
            <span className="flex items-center gap-1.5 bg-emerald-400/20 px-3 py-1 rounded-full border border-emerald-300/30">
              <CheckCircle2 className="w-4 h-4 text-emerald-300" />
              Confirmed Received: <strong className="text-emerald-300">{formatNaira(totalReceivedAmount)}</strong>
            </span>
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="bg-white text-indigo-900 hover:bg-blue-50 px-6 py-3.5 rounded-2xl font-extrabold shadow-lg hover:shadow-xl transition-all active:scale-95 flex items-center gap-2 self-stretch md:self-auto justify-center group shrink-0"
        >
          <Send className="w-5 h-5 text-indigo-600 group-hover:translate-x-0.5 transition-transform" />
          <span>Transfer Cash to Cashier</span>
        </button>
      </div>

      {/* Active Multi-Transfer Running Account Ledgers Section */}
      {activePairLedgers.length > 0 && (
        <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-neutral-900 rounded-3xl p-5 md:p-6 text-white border border-indigo-900/60 shadow-xl space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-3 border-b border-indigo-800/50">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-2xl flex items-center justify-center shrink-0">
                <Calculator className="w-5 h-5 animate-pulse" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono font-extrabold text-amber-400 uppercase tracking-widest bg-amber-500/20 px-2 py-0.5 rounded border border-amber-500/30">
                    Running Account Ledger
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">Consolidated Multi-Handoff Calculations</span>
                </div>
                <h3 className="text-base font-black text-white mt-0.5">
                  Active Cashier-to-Cashier Outstanding Accounts
                </h3>
              </div>
            </div>
            <span className="text-xs font-mono text-slate-300 bg-slate-800/80 px-3 py-1 rounded-xl border border-slate-700">
              {activePairLedgers.length} Active Account Pair(s)
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {activePairLedgers.map((ledger) => {
              const hasMulti = ledger.activeTransfers.length > 1;

              return (
                <div 
                  key={ledger.pairKey}
                  className={`rounded-2xl p-4 border transition-all ${
                    hasMulti 
                      ? 'bg-indigo-950/70 border-amber-500/50 ring-1 ring-amber-500/30' 
                      : 'bg-slate-800/50 border-slate-700/60'
                  }`}
                >
                  {/* Pair Header */}
                  <div className="flex items-center justify-between gap-2 mb-2 pb-2 border-b border-indigo-800/40">
                    <div className="flex items-center gap-2 font-bold text-xs text-indigo-200">
                      <span className="text-white font-extrabold">{ledger.senderName}</span>
                      <ArrowRightLeft className="w-3.5 h-3.5 text-amber-400" />
                      <span className="text-white font-extrabold">{ledger.receiverName} ({ledger.receiverBranch})</span>
                    </div>

                    {hasMulti ? (
                      <span className="text-[10px] font-extrabold text-amber-300 bg-amber-500/20 px-2.5 py-1 rounded-full border border-amber-500/40 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3 text-amber-400" />
                        {ledger.activeTransfers.length} Active Handoffs (Unfinished + Added)
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold text-slate-400 bg-slate-800 px-2 py-0.5 rounded-md">
                        1 Active Handoff
                      </span>
                    )}
                  </div>

                  {/* Net Summary Box */}
                  <div className="bg-slate-900/90 rounded-xl p-3 border border-slate-800 flex items-center justify-between my-2">
                    <div>
                      <div className="text-[10px] uppercase font-mono font-bold text-slate-400">
                        Consolidated Running Balance Owed
                      </div>
                      <div className="text-xs text-slate-300 mt-0.5 font-medium">
                        Sent {formatNaira(ledger.totalSent)} | Received {formatNaira(ledger.totalReceived)}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-black font-mono text-amber-400">
                        {formatNaira(ledger.netBalanceOwed)}
                      </div>
                      <div className="text-[10px] text-amber-300/80 font-mono">
                        Net Outstanding
                      </div>
                    </div>
                  </div>

                  {/* Breakdown List of Handoffs */}
                  <div className="space-y-1.5 pt-1 text-[11px]">
                    <div className="text-[10px] font-mono text-slate-400 uppercase tracking-wider font-bold">
                      Handoff Calculations Breakdown:
                    </div>
                    {ledger.activeTransfers.map((t, index) => {
                      const rec = t.receivedAmount || 0;
                      const rem = Math.max(0, t.amount - rec);
                      return (
                        <div 
                          key={t.id}
                          className="flex items-center justify-between p-2 rounded-lg bg-slate-900/60 border border-slate-800/60 text-slate-200"
                        >
                          <div className="flex items-center gap-2">
                            <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-300 font-mono font-bold text-[10px] flex items-center justify-center shrink-0 border border-amber-500/30">
                              #{index + 1}
                            </span>
                            <div>
                              <span className="font-bold text-white">Sent {formatNaira(t.amount)}</span>
                              <span className="text-[10px] text-slate-400 block font-mono">
                                Bearer: {t.bearerName} ({formatFullDateAndTime(t.timestamp)})
                              </span>
                            </div>
                          </div>
                          <div className="text-right">
                            <span className="font-mono font-bold text-amber-300">
                              {rem > 0 ? `${formatNaira(rem)} remaining` : 'Settled'}
                            </span>
                            <span className="text-[9px] text-slate-400 block uppercase font-bold">
                              {t.status}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {hasMulti && (
                    <div className="mt-2.5 p-2.5 bg-amber-500/10 rounded-xl border border-amber-500/20 text-[11px] text-amber-300/90 leading-relaxed flex items-start gap-1.5">
                      <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                      <span>
                        Notice: Handoff #{ledger.activeTransfers.length} was added before Handoff #1 finished. The total active running balance owed by {ledger.receiverName} is <strong>{formatNaira(ledger.netBalanceOwed)}</strong> across both transfers.
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Tabs & Search Filter */}
      <div className="bg-white rounded-3xl p-4 md:p-6 shadow-sm border border-neutral-100 flex flex-col md:flex-row justify-between items-stretch md:items-center gap-4">
        <div className="flex items-center gap-2 overflow-x-auto pb-2 md:pb-0 scrollbar-none">
          <button
            onClick={() => setFilterTab('all')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
              filterTab === 'all'
                ? 'bg-neutral-900 text-white shadow-md'
                : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
            }`}
          >
            All Cashier Transfers ({cashTransfers.length})
          </button>

          <button
            onClick={() => setFilterTab('pending')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${
              filterTab === 'pending'
                ? 'bg-amber-500 text-white shadow-md'
                : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            Unconfirmed ({cashTransfers.filter(t => t.status === 'Pending').length})
          </button>

          <button
            onClick={() => setFilterTab('partial')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${
              filterTab === 'partial'
                ? 'bg-blue-600 text-white shadow-md'
                : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
            }`}
          >
            <PieChart className="w-3.5 h-3.5" />
            Partially Received ({cashTransfers.filter(t => t.status === 'Partially Received').length})
          </button>

          <button
            onClick={() => setFilterTab('confirmed')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${
              filterTab === 'confirmed'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            Fully Received ({cashTransfers.filter(t => t.status === 'Confirmed').length})
          </button>

          {currentUser.role === 'Manager' && (
            <button
              onClick={() => setFilterTab('unwitnessed')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${
                filterTab === 'unwitnessed'
                  ? 'bg-purple-600 text-white shadow-md'
                  : 'bg-purple-50 text-purple-700 hover:bg-purple-100'
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              Unwitnessed ({unwitnessedCount})
            </button>
          )}

          <button
            onClick={() => setFilterTab('sent')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${
              filterTab === 'sent'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100'
            }`}
          >
            <Send className="w-3.5 h-3.5" />
            Sent By Me
          </button>

          <button
            onClick={() => setFilterTab('history')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${
              filterTab === 'history'
                ? 'bg-slate-900 text-amber-400 border border-slate-700 shadow-md'
                : 'bg-slate-100 text-slate-800 hover:bg-slate-200'
            }`}
          >
            <History className="w-3.5 h-3.5 text-amber-500" />
            Full Audit History ({allHistoryEvents.length})
          </button>
        </div>

        <div className="relative min-w-[240px]">
          <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search bearer, cashier, branch, date..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-neutral-50 border border-neutral-200 rounded-xl pl-9 pr-4 py-2 text-xs font-medium outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all"
          />
        </div>
      </div>

      {/* Main Content Area: Master Audit Trail OR Cards Grid */}
      {filterTab === 'history' ? (
        <div className="bg-white rounded-3xl p-5 md:p-6 shadow-sm border border-neutral-200/80 space-y-5">
          {/* Header & Export Controls */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-neutral-100">
            <div>
              <div className="flex items-center gap-2">
                <span className="bg-amber-100 text-amber-800 text-[10px] font-mono font-bold px-2 py-0.5 rounded-md uppercase">
                  Audit Log Trail
                </span>
                <span className="text-xs text-neutral-500 font-mono">
                  {filteredHistoryEvents.length} Recorded Transaction Event(s)
                </span>
              </div>
              <h3 className="text-lg font-extrabold text-neutral-900 mt-0.5 flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-indigo-600" />
                Complete Cash Transfer Transaction Audit History
              </h3>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <select
                value={eventTypeFilter}
                onChange={(e) => setEventTypeFilter(e.target.value)}
                className="bg-neutral-50 border border-neutral-200 text-neutral-800 rounded-xl px-3 py-2 text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-100"
              >
                <option value="ALL">All Event Types ({allHistoryEvents.length})</option>
                <option value="TRANSFER_CREATED">Transfer Initiated</option>
                <option value="CASH_RECEIVED">Installments Received</option>
                <option value="MANAGER_WITNESSED">Manager Witness Sign-Offs</option>
                <option value="TRANSFER_CONFIRMED">Full Settlement Confirmations</option>
                <option value="TRANSFER_REJECTED">Rejections</option>
              </select>

              <button
                onClick={handleDownloadCSV}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-4 py-2 rounded-xl flex items-center gap-1.5 shadow-sm transition-all"
              >
                <Download className="w-4 h-4" />
                <span>Export CSV Audit Log</span>
              </button>
            </div>
          </div>

          {/* Table View */}
          {filteredHistoryEvents.length === 0 ? (
            <div className="py-12 text-center text-neutral-500">
              <History className="w-10 h-10 text-neutral-300 mx-auto mb-2" />
              <p className="font-bold">No historical transaction events found matching filters.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-neutral-50 text-neutral-500 uppercase font-mono font-extrabold text-[10px] tracking-wider border-b border-neutral-200">
                    <th className="py-3 px-4">Date & Time</th>
                    <th className="py-3 px-4">Event Type</th>
                    <th className="py-3 px-4">Transfer Route</th>
                    <th className="py-3 px-4">Bearer</th>
                    <th className="py-3 px-4 text-right">Event Amount</th>
                    <th className="py-3 px-4">Performed By</th>
                    <th className="py-3 px-4">Status & Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {filteredHistoryEvents.map((ev) => {
                    let badgeBg = 'bg-blue-50 text-blue-700 border-blue-200';
                    let icon = <Send className="w-3.5 h-3.5" />;

                    if (ev.eventType === 'CASH_RECEIVED') {
                      badgeBg = 'bg-emerald-50 text-emerald-800 border-emerald-200';
                      icon = <Coins className="w-3.5 h-3.5" />;
                    } else if (ev.eventType === 'MANAGER_WITNESSED') {
                      badgeBg = 'bg-purple-50 text-purple-800 border-purple-200';
                      icon = <ShieldCheck className="w-3.5 h-3.5" />;
                    } else if (ev.eventType === 'TRANSFER_CONFIRMED') {
                      badgeBg = 'bg-emerald-100 text-emerald-900 border-emerald-300';
                      icon = <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />;
                    } else if (ev.eventType === 'TRANSFER_REJECTED') {
                      badgeBg = 'bg-rose-50 text-rose-700 border-rose-200';
                      icon = <XCircle className="w-3.5 h-3.5" />;
                    }

                    return (
                      <tr key={ev.id} className="hover:bg-neutral-50/80 transition-colors">
                        <td className="py-3.5 px-4 font-mono text-neutral-600 whitespace-nowrap">
                          {formatFullDateAndTime(ev.timestamp)}
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg font-bold text-[11px] border ${badgeBg}`}>
                            {icon}
                            {ev.eventTitle}
                          </span>
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-neutral-800">
                            {ev.senderName} <span className="text-neutral-400">({ev.senderBranch})</span>
                          </div>
                          <div className="text-[10px] text-neutral-500 font-medium flex items-center gap-1">
                            <span>➔ {ev.receiverName} ({ev.receiverBranch})</span>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 font-medium text-neutral-700">
                          {ev.bearerName}
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono font-bold text-neutral-900 text-sm">
                          {formatNaira(ev.amount)}
                          {ev.amount !== ev.totalExpectedAmount && (
                            <span className="block text-[10px] text-neutral-400 font-normal">
                              Total: {formatNaira(ev.totalExpectedAmount)}
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 font-bold text-indigo-900">
                          {ev.actor}
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="text-[10px] uppercase font-bold font-mono text-neutral-500 bg-neutral-100 px-2 py-0.5 rounded mr-2">
                            {ev.status}
                          </span>
                          {ev.notes && (
                            <span className="text-neutral-600 italic block text-[11px] mt-0.5">
                              "{ev.notes}"
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        /* Transfers Cards Grid */
        filteredTransfers.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-neutral-100 shadow-sm">
          <div className="w-16 h-16 bg-neutral-100 text-neutral-400 rounded-full flex items-center justify-center mx-auto mb-4">
            <ArrowRightLeft className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-bold text-neutral-800">No Cash Transfers Found</h3>
          <p className="text-sm text-neutral-500 max-w-md mx-auto mt-1">
            {searchQuery
              ? 'No matching transfers match your search query.'
              : 'Start by clicking "Transfer Cash to Cashier" to record cash sent to another branch or cashier.'}
          </p>
          <button
            onClick={() => setIsModalOpen(true)}
            className="mt-5 inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl font-bold text-sm transition-all shadow-md"
          >
            <Plus className="w-4 h-4" />
            <span>Create New Handoff</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredTransfers.map((transfer) => {
            const isPending = transfer.status === 'Pending';
            const isPartial = transfer.status === 'Partially Received';
            const isConfirmed = transfer.status === 'Confirmed';
            const isRejected = transfer.status === 'Rejected';

            const receivedSoFar = transfer.receivedAmount || (isConfirmed ? transfer.amount : 0);
            const remainingBalance = Math.max(0, transfer.amount - receivedSoFar);
            const percentReceived = Math.min(100, Math.round((receivedSoFar / (transfer.amount || 1)) * 100));

            const isSender = transfer.senderUserId === currentUser.id;
            const canConfirmOrReceive = !isConfirmed && !isRejected && (!isSender || currentUser.role === 'Manager');

            const isWitnessed = !!transfer.witnessedByManagerId;

            const hasLogs = transfer.receiveLogs && transfer.receiveLogs.length > 0;
            const isLogsOpen = !!expandedLogs[transfer.id];

            const multiInfo = transferMultiHandoffInfoMap.get(transfer.id);

            return (
              <div
                key={transfer.id}
                className={`bg-white rounded-3xl p-5 border shadow-sm transition-all relative flex flex-col justify-between ${
                  isPending
                    ? 'border-amber-200 ring-2 ring-amber-500/10'
                    : isPartial
                    ? 'border-blue-300 ring-2 ring-blue-500/10'
                    : isConfirmed
                    ? 'border-emerald-200 bg-emerald-50/10'
                    : 'border-rose-200 bg-rose-50/10'
                }`}
              >
                <div>
                  {/* Multi-Handoff Series Indicator Badge */}
                  {multiInfo?.isMultiSeries && (
                    <div className="bg-amber-50 border border-amber-300/80 rounded-2xl p-2.5 mb-3 text-xs text-amber-950 flex items-center justify-between gap-2">
                      <span className="font-extrabold flex items-center gap-1.5 text-amber-900">
                        <Layers className="w-4 h-4 text-amber-600 shrink-0" />
                        Handoff #{multiInfo.indexInSeries} of {multiInfo.totalInSeries} Active
                      </span>
                      <span className="font-mono text-[11px] font-black text-amber-900 bg-amber-200/90 px-2 py-0.5 rounded-lg">
                        Pair Net Owed: {formatNaira(multiInfo.seriesNetBalanceOwed)}
                      </span>
                    </div>
                  )}

                  {/* Status Badge & Full Date/Time Header */}
                  <div className="mb-3 space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`text-[11px] font-bold uppercase tracking-wider px-3 py-1 rounded-full flex items-center gap-1.5 ${
                          isPending
                            ? 'bg-amber-100 text-amber-800'
                            : isPartial
                            ? 'bg-blue-100 text-blue-900'
                            : isConfirmed
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {isPending && <Clock className="w-3.5 h-3.5 text-amber-600 animate-spin" />}
                        {isPartial && <PieChart className="w-3.5 h-3.5 text-blue-600" />}
                        {isConfirmed && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />}
                        {isRejected && <XCircle className="w-3.5 h-3.5 text-rose-600" />}
                        {isPending ? 'Unconfirmed / In Transit' : isPartial ? `Partial (${percentReceived}%)` : isConfirmed ? 'Fully Received & Confirmed' : 'Rejected'}
                      </span>

                      {/* Manager Witness Indicator */}
                      {isWitnessed ? (
                        <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-md flex items-center gap-1">
                          <Eye className="w-3 h-3 text-indigo-600" />
                          Witnessed
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                          Awaiting Manager Witness
                        </span>
                      )}
                    </div>

                    {/* Exact Creation Date & Time */}
                    <div className="flex items-center gap-1 text-[11px] font-mono text-neutral-500 pt-0.5">
                      <Calendar className="w-3 h-3 text-neutral-400" />
                      <span>{formatFullDateAndTime(transfer.timestamp)}</span>
                    </div>
                  </div>

                  {/* Financial Overview Card */}
                  <div className="mb-4 bg-neutral-50 rounded-2xl p-3.5 border border-neutral-100">
                    <div className="flex justify-between items-baseline mb-1">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">
                        Total Transfer Expected
                      </span>
                      <span className="text-xl font-black font-mono text-neutral-900">
                        {formatNaira(transfer.amount)}
                      </span>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full h-2.5 bg-neutral-200 rounded-full overflow-hidden my-2">
                      <div
                        className={`h-full transition-all duration-500 ${
                          isConfirmed ? 'bg-emerald-500' : isPartial ? 'bg-blue-500' : 'bg-amber-400'
                        }`}
                        style={{ width: `${percentReceived}%` }}
                      />
                    </div>

                    {/* Breakdown Received vs Remaining */}
                    <div className="flex items-center justify-between text-xs pt-1 border-t border-neutral-200/60 font-medium">
                      <span className="text-emerald-700 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        Received: <strong>{formatNaira(receivedSoFar)}</strong>
                      </span>

                      {remainingBalance > 0 ? (
                        <span className="text-amber-700 font-extrabold flex items-center gap-1 bg-amber-100/70 px-2 py-0.5 rounded-lg">
                          <AlertCircle className="w-3 h-3 text-amber-600" />
                          Balance: {formatNaira(remainingBalance)}
                        </span>
                      ) : (
                        <span className="text-emerald-800 font-bold bg-emerald-100 px-2 py-0.5 rounded-lg text-[10px]">
                          Fully Settled
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Cashier-to-Cashier Route & Bearer Details */}
                  <div className="space-y-2 text-xs">
                    {/* Sending Cashier */}
                    <div className="flex items-start justify-between gap-2 p-2.5 rounded-xl bg-indigo-50/40 border border-indigo-100">
                      <span className="text-indigo-900 font-extrabold flex items-center gap-1.5 shrink-0">
                        <UserCheck className="w-3.5 h-3.5 text-indigo-600" />
                        Sending Cashier:
                      </span>
                      <span className="font-extrabold text-indigo-950 text-right">
                        {transfer.senderName}
                        <span className="block text-[10px] text-indigo-600 font-semibold">
                          {transfer.senderBranch}
                        </span>
                      </span>
                    </div>

                    {/* Bearer Transport */}
                    <div className="flex items-start justify-between gap-2 p-2 rounded-xl bg-amber-50/60 border border-amber-100">
                      <span className="text-amber-800 font-bold flex items-center gap-1.5 shrink-0">
                        <Truck className="w-3.5 h-3.5 text-amber-600" />
                        Bearer / Delivery:
                      </span>
                      <span className="font-extrabold text-amber-900 text-right">
                        {transfer.bearerName}
                      </span>
                    </div>

                    {/* Receiving Cashier */}
                    <div className="flex items-start justify-between gap-2 p-2.5 rounded-xl bg-purple-50/40 border border-purple-100">
                      <span className="text-purple-900 font-extrabold flex items-center gap-1.5 shrink-0">
                        <Building2 className="w-3.5 h-3.5 text-purple-600" />
                        Receiving Cashier:
                      </span>
                      <span className="font-extrabold text-purple-950 text-right">
                        {transfer.receiverName}
                        <span className="block text-[10px] text-purple-600 font-semibold">
                          {transfer.receiverBranch}
                        </span>
                      </span>
                    </div>

                    {/* Manager Witness Box */}
                    {isWitnessed ? (
                      <div className="bg-slate-900 text-white p-2.5 rounded-xl text-[11px] border border-slate-800 space-y-0.5">
                        <div className="flex items-center justify-between font-bold text-indigo-300">
                          <span className="flex items-center gap-1">
                            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                            Manager Witnessed:
                          </span>
                          <span className="text-white">{transfer.witnessedByManagerName}</span>
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono text-right">
                          {formatFullDateAndTime(transfer.witnessedAt)}
                        </div>
                      </div>
                    ) : (
                      currentUser.role === 'Manager' && (
                        <button
                          type="button"
                          onClick={() => handleWitnessByManager(transfer)}
                          className="w-full bg-slate-900 hover:bg-slate-800 text-indigo-300 hover:text-white p-2 rounded-xl text-xs font-bold transition-all border border-slate-700 flex items-center justify-center gap-1.5 shadow-sm"
                        >
                          <Eye className="w-3.5 h-3.5 text-indigo-400" />
                          <span>Witness & Verify Transfer as Manager</span>
                        </button>
                      )
                    )}

                    {transfer.notes && (
                      <div className="text-[11px] text-neutral-600 bg-neutral-100/70 p-2 rounded-xl italic">
                        "{transfer.notes}"
                      </div>
                    )}

                    {/* Installments History Logs Drawer with Exact Date & Time */}
                    {hasLogs && (
                      <div className="pt-2">
                        <button
                          type="button"
                          onClick={() => toggleLogsExpand(transfer.id)}
                          className="w-full flex items-center justify-between text-[11px] font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50/50 p-2 rounded-xl transition-colors"
                        >
                          <span className="flex items-center gap-1.5">
                            <Receipt className="w-3.5 h-3.5" />
                            Receipt Installments & Timestamps ({transfer.receiveLogs?.length})
                          </span>
                          {isLogsOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                        </button>

                        {isLogsOpen && (
                          <div className="mt-2 space-y-2 border-l-2 border-indigo-200 pl-3 py-1">
                            {transfer.receiveLogs?.map((log, index) => (
                              <div key={log.id || index} className="text-[11px] bg-neutral-50 p-2 rounded-lg border border-neutral-100">
                                <div className="flex justify-between items-center font-bold text-neutral-800">
                                  <span className="text-emerald-600 font-mono">{formatNaira(log.receivedAmount)}</span>
                                  <span className="text-[10px] text-neutral-400 font-mono">
                                    {formatFullDateAndTime(log.timestamp)}
                                  </span>
                                </div>
                                <div className="text-neutral-600 text-[10px] mt-0.5">
                                  Received by <strong>{log.receivedByName}</strong>
                                  {log.bearerName && <span> (Delivered by {log.bearerName})</span>}
                                </div>
                                {log.notes && (
                                  <div className="text-[10px] text-neutral-500 italic mt-0.5">"{log.notes}"</div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Actions Footer */}
                <div className="mt-5 pt-3 border-t border-neutral-100 flex flex-col gap-2">
                  {canConfirmOrReceive && (
                    <div className="flex items-center gap-2 w-full">
                      <button
                        onClick={() => openReceiveModal(transfer)}
                        className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 px-3 rounded-xl font-bold text-xs shadow-md transition-all active:scale-95 flex items-center justify-center gap-1.5"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>
                          {isPartial ? `Receive Remaining (${formatNaira(remainingBalance)})` : 'Confirm / Receive Cash'}
                        </span>
                      </button>
                      {isPending && (
                        <button
                          onClick={() => handleRejectTransfer(transfer)}
                          className="bg-rose-50 hover:bg-rose-100 text-rose-600 py-2.5 px-3 rounded-xl font-bold text-xs transition-all"
                          title="Reject Handoff"
                        >
                          <XCircle className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  )}

                  <div className="flex items-center justify-between text-[11px] text-neutral-500 font-medium">
                    {isConfirmed ? (
                      <span className="text-emerald-700 font-bold flex items-center gap-1">
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                        Confirmed by {transfer.confirmedByName} on {formatFullDateAndTime(transfer.confirmedAt)}
                      </span>
                    ) : (
                      <span className="text-neutral-400">Status: {transfer.status}</span>
                    )}

                    {(currentUser.role === 'Manager' || isSender) && (
                      <div className="flex items-center gap-1 ml-auto">
                        <button
                          onClick={() => handleStartEdit(transfer)}
                          className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                          title="Edit transfer record"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => onDeleteTransfer(transfer.id)}
                          className="p-1.5 text-neutral-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"
                          title="Delete record"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ))}

      {/* NEW / EDIT CASH TRANSFER MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-neutral-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 md:p-8 shadow-2xl border border-neutral-100 my-8 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-4 border-b border-neutral-100 mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-indigo-100 text-indigo-600 rounded-2xl flex items-center justify-center">
                  <ArrowRightLeft className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-extrabold text-neutral-800">
                    {editingTransfer ? 'Edit Branch Cash Transfer' : 'Transfer Cash Branch'}
                  </h3>
                  <p className="text-xs text-neutral-500">
                    {editingTransfer ? 'Update existing transfer details' : 'Enter cash transfer details manually'}
                  </p>
                </div>
              </div>
              <button
                onClick={handleCloseModal}
                className="p-2 text-neutral-400 hover:text-neutral-600 rounded-full hover:bg-neutral-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateTransfer} className="space-y-4">
              {/* Full Name (Manual Entry) */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-neutral-800 flex items-center justify-between">
                  <span>Full Name *</span>
                  <span className="text-[10px] text-neutral-400 font-normal">Manual Entry</span>
                </label>
                <div className="relative">
                  <UserIcon className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Enter Cashier Full Name"
                    value={customReceiverName}
                    onChange={(e) => setCustomReceiverName(e.target.value)}
                    className="w-full bg-neutral-50 border border-neutral-200 rounded-xl pl-9 pr-3.5 py-2.5 text-xs font-semibold text-neutral-800 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all"
                    required
                  />
                </div>
              </div>

              {/* Area */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-neutral-700">Area</label>
                <div className="relative">
                  <MapPin className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="e.g. MARABA Branch"
                    value={targetBranch}
                    onChange={(e) => setTargetBranch(e.target.value)}
                    className="w-full bg-neutral-50 border border-neutral-200 rounded-xl pl-9 pr-3.5 py-2.5 text-xs font-medium text-neutral-800 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all"
                  />
                </div>
              </div>

              {/* Amount */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-neutral-700">Amount (₦) *</label>
                <div className="relative">
                  <Coins className="w-4 h-4 text-indigo-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="number"
                    step="any"
                    min="0"
                    placeholder="0.00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full bg-neutral-50 border border-neutral-200 rounded-xl pl-9 pr-3.5 py-2.5 text-sm font-black font-mono text-indigo-700 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all"
                    required
                  />
                </div>
              </div>

              {/* Action Submit */}
              <div className="pt-4 flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="flex-1 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 py-3 rounded-2xl font-bold text-xs transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0 || !customReceiverName.trim()}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white py-3 rounded-2xl font-extrabold text-xs shadow-md transition-all active:scale-95 flex items-center justify-center gap-2"
                >
                  <Send className="w-4 h-4" />
                  <span>{editingTransfer ? 'Update Transfer' : 'Save Transfer'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CONFIRM / PARTIAL RECEIVE MODAL */}
      {receiveModalTransfer && (
        <div className="fixed inset-0 bg-neutral-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 md:p-8 shadow-2xl border border-neutral-100 my-8 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-4 border-b border-neutral-100 mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-extrabold text-neutral-800">
                    Confirm Cash Received by Cashier
                  </h3>
                  <p className="text-xs text-neutral-500">Record cash delivered by bearer (Full or Partial)</p>
                </div>
              </div>
              <button
                onClick={() => setReceiveModalTransfer(null)}
                className="p-2 text-neutral-400 hover:text-neutral-600 rounded-full hover:bg-neutral-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmReceiveSubmit} className="space-y-4">
              {/* Transfer Overview Card */}
              <div className="bg-neutral-50 rounded-2xl p-4 border border-neutral-200/80 space-y-2 text-xs">
                <div className="flex justify-between items-center font-bold text-neutral-800">
                  <span>Total Transfer Expected:</span>
                  <span className="font-mono text-base font-black text-neutral-900">
                    {formatNaira(receiveModalTransfer.amount)}
                  </span>
                </div>
                <div className="flex justify-between items-center text-emerald-700 font-medium">
                  <span>Previously Confirmed Received:</span>
                  <span className="font-mono">{formatNaira(receiveModalTransfer.receivedAmount || 0)}</span>
                </div>
                <div className="flex justify-between items-center text-amber-800 font-extrabold pt-2 border-t border-neutral-200">
                  <span>Current Outstanding Balance:</span>
                  <span className="font-mono text-sm bg-amber-100 px-2 py-0.5 rounded-md">
                    {formatNaira(Math.max(0, receiveModalTransfer.amount - (receiveModalTransfer.receivedAmount || 0)))}
                  </span>
                </div>
              </div>

              {/* Multi-Handoff Account Notice if applicable */}
              {transferMultiHandoffInfoMap.get(receiveModalTransfer.id)?.isMultiSeries && (
                <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-3 text-xs text-indigo-950 space-y-1.5">
                  <div className="flex items-center justify-between font-bold text-indigo-900">
                    <span className="flex items-center gap-1.5">
                      <Layers className="w-4 h-4 text-indigo-600" />
                      Multi-Handoff Running Account Context
                    </span>
                    <span className="text-[10px] bg-indigo-200/90 text-indigo-900 px-2.5 py-0.5 rounded-full font-mono font-extrabold">
                      Handoff #{transferMultiHandoffInfoMap.get(receiveModalTransfer.id)?.indexInSeries} of {transferMultiHandoffInfoMap.get(receiveModalTransfer.id)?.totalInSeries}
                    </span>
                  </div>
                  <p className="text-[11px] text-indigo-800 leading-relaxed">
                    Receiving cash here applies directly to <strong>Handoff #{transferMultiHandoffInfoMap.get(receiveModalTransfer.id)?.indexInSeries}</strong>.
                    The consolidated combined running balance owed across all active handoffs for {receiveModalTransfer.receiverName} is <strong>{formatNaira(transferMultiHandoffInfoMap.get(receiveModalTransfer.id)?.seriesNetBalanceOwed || 0)}</strong>.
                  </p>
                </div>
              )}

              {/* Amount Received Now */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-neutral-800 flex justify-between items-center">
                  <span>Cash Amount Received NOW (₦) *</span>
                  <span className="text-[10px] text-indigo-600 font-normal">Can be partial or full</span>
                </label>
                <div className="relative">
                  <Coins className="w-4 h-4 text-emerald-600 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="number"
                    step="any"
                    placeholder="e.g. 500000"
                    value={receiveAmountNow}
                    onChange={(e) => setReceiveAmountNow(e.target.value)}
                    className="w-full bg-emerald-50/50 border border-emerald-300 rounded-xl pl-9 pr-3.5 py-2.5 text-base font-black font-mono text-emerald-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 transition-all"
                    required
                  />
                </div>
                <p className="text-[10px] text-neutral-500">
                  Enter how much physical cash you received today (e.g. ₦500,000). Remaining balance will stay pending.
                </p>
              </div>

              {/* Person Who Delivered Cash */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-neutral-700 flex items-center gap-1">
                  <Truck className="w-3.5 h-3.5 text-amber-600" />
                  Person Who Delivered This Cash (Bearer) *
                </label>
                <input
                  type="text"
                  placeholder="e.g. MIKA'ILU"
                  value={receiveBearerNow}
                  onChange={(e) => setReceiveBearerNow(e.target.value)}
                  className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-3.5 py-2.5 text-xs font-bold text-neutral-800 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all"
                  required
                />
              </div>

              {/* Receipt Timestamp */}
              <div className="bg-slate-900 text-slate-300 p-3 rounded-2xl text-[11px] font-mono flex items-center justify-between">
                <span className="flex items-center gap-1.5 font-bold text-emerald-400">
                  <Clock className="w-3.5 h-3.5" />
                  Receipt Timestamp:
                </span>
                <span>{formatFullDateAndTime(new Date().toISOString())}</span>
              </div>

              {/* Notes */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-neutral-700">Receipt Notes / Remarks</label>
                <input
                  type="text"
                  placeholder="e.g. First installment of 500k brought by Mika'ilu"
                  value={receiveNotesNow}
                  onChange={(e) => setReceiveNotesNow(e.target.value)}
                  className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-3.5 py-2.5 text-xs font-medium outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all"
                />
              </div>

              {/* Actions Submit */}
              <div className="pt-4 flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setReceiveModalTransfer(null)}
                  className="flex-1 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 py-3 rounded-2xl font-bold text-xs transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!receiveAmountNow || parseFloat(receiveAmountNow) <= 0}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white py-3 rounded-2xl font-extrabold text-xs shadow-md transition-all active:scale-95 flex items-center justify-center gap-2"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Confirm Cash Receipt</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
