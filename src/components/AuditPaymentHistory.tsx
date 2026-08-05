import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Search, 
  Calendar, 
  Filter, 
  Check, 
  X, 
  Eye, 
  Download, 
  CreditCard, 
  ArrowLeft, 
  Printer, 
  CheckCircle2, 
  Clock, 
  XCircle, 
  FileText, 
  ChevronRight, 
  AlertCircle,
  RefreshCw,
  TrendingUp,
  FileSpreadsheet
} from 'lucide-react';
import { collection, query, onSnapshot, doc, setDoc, getDoc, getDocs, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { User } from '../types';
import { WhatsAppSupportButton } from './WhatsAppSupportButton';

interface AuditPaymentHistoryProps {
  currentUser: User;
  onBack?: () => void;
}

export interface ManualPaymentRequest {
  id: string;
  ownerId: string;
  customerName: string;
  businessName: string;
  phoneNumber: string;
  plan: 'Starter' | 'Professional' | 'Business' | 'Enterprise';
  amount: number;
  reference: string;
  receiptUrl: string; // Base64 data string
  receiptFileName: string;
  receiptFileType: string;
  status: 'Pending Review' | 'Approved' | 'Rejected' | 'Expired' | 'Cancelled';
  paymentDate: string; // ISO format
  rejectionReason?: string;
  timestamp: string; // ISO format
}

const PLAN_DETAILS = {
  Starter: { name: 'Starter Plan', price: 2000 },
  Professional: { name: 'Professional Plan', price: 5000 },
  Business: { name: 'Business Plan', price: 10000 },
  Enterprise: { name: 'Enterprise Plan', price: 25000 }
};

export function AuditPaymentHistory({ currentUser, onBack }: AuditPaymentHistoryProps) {
  const [payments, setPayments] = useState<ManualPaymentRequest[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  
  // Filtering and searching states
  const [search, setSearch] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Pending Review' | 'Approved' | 'Rejected' | 'Expired' | 'Cancelled'>('All');
  
  // Detail overlays
  const [selectedReceiptUrl, setSelectedReceiptUrl] = useState<string | null>(null);
  const [selectedInvoice, setSelectedInvoice] = useState<ManualPaymentRequest | null>(null);
  
  // Rejection input controls
  const [rejectionInputId, setRejectionInputId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [isSubmittingRejection, setIsSubmittingRejection] = useState(false);
  const [isSubmittingApproval, setIsSubmittingApproval] = useState<string | null>(null);

  // Real-time lookup for the Super Administrator (the very first Manager account created)
  const [superAdminId, setSuperAdminId] = useState<string | null>(null);

  useEffect(() => {
    const q = query(collection(db, 'users'), where('role', '==', 'Manager'));
    const unsubscribe = onSnapshot(q, (snap) => {
      const managers: any[] = [];
      snap.forEach(d => {
        managers.push({ id: d.id, ...d.data() });
      });
      if (managers.length > 0) {
        managers.sort((a, b) => {
          const aTime = new Date(a.createdAt || 0).getTime();
          const bTime = new Date(b.createdAt || 0).getTime();
          return aTime - bTime;
        });
        const firstManagerId = managers[0].id;
        setSuperAdminId(firstManagerId);
      }
    }, (error) => {
      console.warn("Error fetching managers in AuditPaymentHistory:", error);
    });
    return () => unsubscribe();
  }, []);

  const isSuperAdmin = Boolean(
    currentUser && (
      currentUser.phone === '08141106560' ||
      (currentUser as any).phoneNumber === '08141106560' ||
      currentUser.id === '08141106560'
    )
  );

  // Sync Super Admin config doc to Firestore if needed
  useEffect(() => {
    if (isSuperAdmin && superAdminId) {
      const initSuperAdminConfig = async () => {
        try {
          const docRef = doc(db, 'config', 'super_admin');
          const snap = await getDoc(docRef);
          if (!snap.exists()) {
            await setDoc(docRef, {
              uid: superAdminId,
              createdAt: new Date().toISOString(),
              initializedBy: currentUser.id || 'system'
            });
          }
        } catch (err) {
          console.warn('[Security] Failed to initialize Super Admin config document:', err);
        }
      };
      initSuperAdminConfig();
    }
  }, [isSuperAdmin, superAdminId, currentUser.id]);

  // Real-time firestore listener
  useEffect(() => {
    setLoading(true);
    let q;
    
    // If not super admin, strictly filter by ownerId or userId or phone
    if (!isSuperAdmin) {
      const myId = currentUser.id || '';
      const myPhone = currentUser.phone || (currentUser as any).phoneNumber || '';
      q = query(
        collection(db, 'subscription_payments'),
        where('ownerId', '==', myId)
      );
    } else {
      q = query(collection(db, 'subscription_payments'));
    }
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items: ManualPaymentRequest[] = [];
      snapshot.forEach((d) => {
        items.push({ id: d.id, ...d.data() } as ManualPaymentRequest);
      });
      // Sort client-side by paymentDate desc
      items.sort((a, b) => new Date(b.paymentDate).getTime() - new Date(a.paymentDate).getTime());
      setPayments(items);
      setLoading(false);
    }, (error) => {
      console.error("Firestore Loading Error in AuditPaymentHistory:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [isSuperAdmin, currentUser.id, currentUser.phone]);

  // Preset Date range picker helpers
  const setPresetRange = (range: 'today' | 'week' | 'month' | 'all') => {
    const today = new Date();
    if (range === 'all') {
      setStartDate('');
      setEndDate('');
      return;
    }
    
    const format = (d: Date) => d.toISOString().slice(0, 10);
    setEndDate(format(today));

    if (range === 'today') {
      setStartDate(format(today));
    } else if (range === 'week') {
      const weekAgo = new Date();
      weekAgo.setDate(today.getDate() - 7);
      setStartDate(format(weekAgo));
    } else if (range === 'month') {
      const monthAgo = new Date();
      monthAgo.setDate(today.getDate() - 30);
      setStartDate(format(monthAgo));
    }
  };

  // Filtered Payments list
  const filteredPayments = useMemo(() => {
    return payments.filter((p) => {
      // 1. Search filter matching customer name, business, reference, plan or phone
      const searchLower = search.toLowerCase();
      const matchesSearch = 
        !search ||
        (p.customerName?.toLowerCase() || '').includes(searchLower) ||
        (p.businessName?.toLowerCase() || '').includes(searchLower) ||
        (p.reference?.toLowerCase() || '').includes(searchLower) ||
        (p.phoneNumber?.toLowerCase() || '').includes(searchLower) ||
        (p.plan?.toLowerCase() || '').includes(searchLower);

      // 2. Status filter
      const matchesStatus = statusFilter === 'All' || p.status === statusFilter;

      // 3. Date filters
      let matchesDate = true;
      if (startDate) {
        const pDate = new Date(p.paymentDate);
        const sDate = new Date(startDate);
        sDate.setHours(0, 0, 0, 0);
        matchesDate = matchesDate && pDate >= sDate;
      }
      if (endDate) {
        const pDate = new Date(p.paymentDate);
        const eDate = new Date(endDate);
        eDate.setHours(23, 59, 59, 999);
        matchesDate = matchesDate && pDate <= eDate;
      }

      return matchesSearch && matchesStatus && matchesDate;
    });
  }, [payments, search, statusFilter, startDate, endDate]);

  // Aggregate stats from filtered set
  const stats = useMemo(() => {
    let totalCollected = 0;
    let pendingCount = 0;
    let approvedCount = 0;
    let rejectedCount = 0;

    filteredPayments.forEach(p => {
      if (p.status === 'Approved') {
        totalCollected += p.amount;
        approvedCount++;
      } else if (p.status === 'Pending Review') {
        pendingCount++;
      } else if (p.status === 'Rejected') {
        rejectedCount++;
      }
    });

    return { totalCollected, pendingCount, approvedCount, rejectedCount };
  }, [filteredPayments]);

  // Approve action copy logic from BillingModal
  const handleApprovePayment = async (payment: ManualPaymentRequest) => {
    if (!isSuperAdmin) {
      alert("Access Denied\nOnly the Super Administrator can approve subscription payments or manage subscriptions.");
      return;
    }
    setIsSubmittingApproval(payment.id);
    try {
      const nowStr = new Date().toISOString();
      const expiryDateStr = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

      // 1. Update subscription_payments status to Approved
      await setDoc(doc(db, 'subscription_payments', payment.id), {
        status: 'Approved',
        updatedAt: nowStr
      }, { merge: true });

      // 2. Activate subscription
      const subRef = doc(db, 'subscriptions', payment.ownerId);
      await setDoc(subRef, {
        plan: payment.plan,
        status: 'Active',
        subscriptionStartDate: nowStr,
        subscriptionEndDate: expiryDateStr,
        lastPaymentDate: nowStr,
        nextPaymentDate: expiryDateStr,
        lastPaymentReference: payment.reference,
        lastReceiptUrl: payment.receiptUrl,
        updatedAt: nowStr
      }, { merge: true });

      if (currentUser?.id) {
        await setDoc(doc(db, 'subscriptions', currentUser.id), {
          plan: payment.plan,
          status: 'Active',
          subscriptionStartDate: nowStr,
          subscriptionEndDate: expiryDateStr,
          lastPaymentDate: nowStr,
          nextPaymentDate: expiryDateStr,
          lastPaymentReference: payment.reference,
          lastReceiptUrl: payment.receiptUrl,
          updatedAt: nowStr
        }, { merge: true }).catch(() => {});
      }

      if (payment.ownerId) {
        await setDoc(doc(db, 'users', payment.ownerId), {
          subscriptionStatus: 'Active',
          plan: payment.plan,
          updatedAt: nowStr
        }, { merge: true }).catch(() => {});
      }

      // 3. Record in payment_history for logs
      const histId = `pay_hist_${Math.random().toString(36).substring(2, 11)}`;
      await setDoc(doc(db, 'payment_history', histId), {
        id: histId,
        ownerId: payment.ownerId,
        amount: payment.amount,
        plan: payment.plan,
        status: 'Success',
        timestamp: nowStr,
        reference: payment.reference,
        receiptUrl: payment.receiptUrl,
        expiryDate: expiryDateStr
      });

      // 4. Save Invoice Log
      const invoiceId = `inv_${Math.random().toString(36).substring(2, 11)}`;
      await setDoc(doc(db, 'invoices', invoiceId), {
        id: invoiceId,
        paymentId: payment.id,
        ownerId: payment.ownerId,
        amount: payment.amount,
        plan: payment.plan,
        customerName: payment.customerName,
        businessName: payment.businessName,
        reference: payment.reference,
        paymentDate: payment.paymentDate,
        expiryDate: expiryDateStr,
        timestamp: nowStr
      });

      // 5. Save System Notification
      const notId = `notif_${Math.random().toString(36).substring(2, 11)}`;
      await setDoc(doc(db, 'subscription_notifications', notId), {
        id: notId,
        ownerId: payment.ownerId,
        title: 'Subscription Activated! 🎉',
        message: `Your manual payment verification for the ${payment.plan} Plan was approved. Thank you for your support!`,
        type: 'success',
        read: false,
        timestamp: nowStr
      });

      // 6. Handle Affiliates/Referrals if referredBy is configured
      const subDoc = await getDoc(subRef);
      if (subDoc.exists()) {
        const subData = subDoc.data();
        if (subData.referredBy) {
          const usersRef = collection(db, 'users');
          const qReferrer = query(usersRef, where('referralCode', '==', subData.referredBy.toUpperCase()));
          const snapRef = await getDocs(qReferrer);

          if (!snapRef.empty) {
            const referrerUser = snapRef.docs[0].data();
            const commissionRates = { Starter: 500, Professional: 1000, Business: 2000, Enterprise: 5000 };
            const commAmt = commissionRates[payment.plan] || 1000;

            const referralId = `${referrerUser.uid || referrerUser.id}_${payment.ownerId}`;
            await setDoc(doc(db, 'referrals', referralId), {
              status: 'Active',
              plan: payment.plan,
              commissionAmount: commAmt,
              updatedAt: nowStr
            }, { merge: true });

            // Save Commission Record
            const commId = `comm_${Math.random().toString(36).substring(2, 11)}`;
            await setDoc(doc(db, 'referral_commissions', commId), {
              id: commId,
              referrerId: referrerUser.uid || referrerUser.id,
              referredId: payment.ownerId,
              referredName: payment.customerName,
              amount: commAmt,
              status: 'Approved',
              plan: payment.plan,
              timestamp: nowStr
            });

            // Credit referrer's payoutBalance
            const referrerSubRef = doc(db, 'subscriptions', referrerUser.uid || referrerUser.id);
            const refSnap = await getDoc(referrerSubRef);
            if (refSnap.exists()) {
              const refData = refSnap.data();
              const oldBal = refData.payoutBalance || 0;
              const oldLifetime = refData.payoutLifetime || 0;
              await setDoc(referrerSubRef, {
                payoutBalance: oldBal + commAmt,
                payoutLifetime: oldLifetime + commAmt
              }, { merge: true });
            }
          }
        }
      }

      // Create Audit Log
      const auditLogId = `audit_${Math.random().toString(36).substring(2, 11)}`;
      await setDoc(doc(db, 'subscription_audit_logs', auditLogId), {
        id: auditLogId,
        userId: payment.ownerId,
        subscriptionId: payment.ownerId,
        approvalTime: nowStr,
        superAdminId: currentUser.id,
        actionPerformed: 'Approve Payment & Activate Subscription',
        reference: payment.reference,
        plan: payment.plan,
        amount: payment.amount,
        timestamp: nowStr
      });

      alert(`Payment Reference ${payment.reference} approved successfully!`);
    } catch (err) {
      console.error('Payment approval error:', err);
      alert('Error approving payment.');
    } finally {
      setIsSubmittingApproval(null);
    }
  };

  // Reject action copy logic from BillingModal
  const handleRejectPayment = async () => {
    if (!isSuperAdmin) {
      alert("Access Denied\nOnly the Super Administrator can approve subscription payments or manage subscriptions.");
      return;
    }
    if (!rejectionInputId) return;
    if (!rejectionReason.trim()) {
      alert('Please enter a rejection reason.');
      return;
    }

    setIsSubmittingRejection(true);
    try {
      const nowStr = new Date().toISOString();
      const payment = payments.find(p => p.id === rejectionInputId);
      if (!payment) return;

      // 1. Update payment document
      await setDoc(doc(db, 'subscription_payments', payment.id), {
        status: 'Rejected',
        rejectionReason: rejectionReason.trim(),
        updatedAt: nowStr
      }, { merge: true });

      // 2. Set subscriptions status to Rejected with reason
      await setDoc(doc(db, 'subscriptions', payment.ownerId), {
        status: 'Rejected',
        rejectionReason: rejectionReason.trim(),
        lastPaymentReference: payment.reference
      }, { merge: true });

      // 3. Save system notification
      const notId = `notif_${Math.random().toString(36).substring(2, 11)}`;
      await setDoc(doc(db, 'subscription_notifications', notId), {
        id: notId,
        ownerId: payment.ownerId,
        title: 'Payment Verification Rejected ❌',
        message: `Your manual payment verification was rejected. Reason: "${rejectionReason.trim()}". Please upload a valid receipt.`,
        type: 'danger',
        read: false,
        timestamp: nowStr
      });

      // Create Audit Log
      const auditLogId = `audit_${Math.random().toString(36).substring(2, 11)}`;
      await setDoc(doc(db, 'subscription_audit_logs', auditLogId), {
        id: auditLogId,
        userId: payment.ownerId,
        subscriptionId: payment.ownerId,
        approvalTime: nowStr,
        superAdminId: currentUser.id,
        actionPerformed: 'Reject Payment',
        rejectionReason: rejectionReason.trim(),
        reference: payment.reference,
        plan: payment.plan,
        amount: payment.amount,
        timestamp: nowStr
      });

      alert(`Payment Reference ${payment.reference} has been rejected.`);
      setRejectionInputId(null);
      setRejectionReason('');
    } catch (err) {
      console.error('Payment rejection error:', err);
      alert('Error rejecting payment.');
    } finally {
      setIsSubmittingRejection(false);
    }
  };

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-300">
      
      {/* Header Panel */}
      <div className="bg-neutral-900 text-white p-6 sm:p-8 rounded-3xl shadow-xl border border-neutral-800 relative overflow-hidden flex flex-col md:flex-row md:items-center md:justify-between gap-6">
        <div className="relative z-10 space-y-2">
          <div className="flex items-center gap-3">
            {onBack && (
              <button 
                onClick={onBack}
                className="p-1.5 bg-neutral-800 hover:bg-neutral-700 rounded-xl transition text-neutral-300 hover:text-white cursor-pointer active:scale-95"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            )}
            <div className="p-2 bg-emerald-500 text-neutral-900 rounded-xl">
              <CreditCard className="w-6 h-6" />
            </div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight">Audit Payment History</h1>
          </div>
          <p className="text-neutral-400 text-xs sm:text-sm max-w-2xl leading-relaxed font-medium">
            Review and audit historical manual subscription bank transfers across all merchant accounts. 
            Filter by specific dates, search transactions, view receipts, and confirm pending subscriptions.
          </p>
        </div>
        <div className="relative z-10 flex flex-wrap gap-2 self-start md:self-center">
          <WhatsAppSupportButton
            context="Payment Audit Page"
            userName={currentUser.name}
            businessName={currentUser.businessName || currentUser.areaOfWorking}
            phone={currentUser.phoneNumber || currentUser.phone}
            role={currentUser.role}
            buttonText="Contact Support on WhatsApp"
            variant="outline"
          />
          <button
            onClick={() => setPresetRange('all')}
            className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 hover:text-white text-xs font-bold rounded-xl transition cursor-pointer active:scale-95 flex items-center gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Reset Filters
          </button>
        </div>
      </div>

      {!isSuperAdmin && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 p-4 rounded-2xl flex items-start gap-3 shadow-xs">
          <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
          <div>
            <h4 className="font-extrabold text-sm">Access Denied / View Only Mode</h4>
            <p className="text-xs text-amber-600 leading-relaxed">
              Only the Super Administrator has authority to approve payments, reject payments, activate subscriptions, extend subscriptions, or manage referral commissions. Other managers may only view subscription status and payment history.
            </p>
          </div>
        </div>
      )}

      {/* Aggregate Scoreboard */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        
        <div className="bg-white border border-neutral-200 p-4 sm:p-5 rounded-2xl shadow-sm flex flex-col justify-between">
          <span className="text-[10px] font-black text-neutral-400 uppercase tracking-widest font-mono">Total Approved Revenue</span>
          <div className="pt-2 flex items-baseline gap-1">
            <span className="text-xl sm:text-2xl font-black font-mono text-[#00B87A]">₦{stats.totalCollected.toLocaleString()}</span>
          </div>
          <span className="text-[10px] text-neutral-400 font-bold block pt-1">From approved activations</span>
        </div>

        <div className="bg-white border border-neutral-200 p-4 sm:p-5 rounded-2xl shadow-sm flex flex-col justify-between border-l-4 border-l-amber-500">
          <span className="text-[10px] font-black text-neutral-400 uppercase tracking-widest font-mono">Pending Review</span>
          <div className="pt-2 flex items-center gap-2">
            <span className="text-xl sm:text-2xl font-black font-mono text-amber-500">{stats.pendingCount}</span>
            {stats.pendingCount > 0 && (
              <span className="w-2 h-2 bg-amber-500 rounded-full animate-ping" />
            )}
          </div>
          <span className="text-[10px] text-neutral-400 font-bold block pt-1">Awaiting verification</span>
        </div>

        <div className="bg-white border border-neutral-200 p-4 sm:p-5 rounded-2xl shadow-sm flex flex-col justify-between border-l-4 border-l-emerald-500">
          <span className="text-[10px] font-black text-neutral-400 uppercase tracking-widest font-mono">Approved Plans</span>
          <div className="pt-2">
            <span className="text-xl sm:text-2xl font-black font-mono text-emerald-600">{stats.approvedCount}</span>
          </div>
          <span className="text-[10px] text-neutral-400 font-bold block pt-1">Active subscriptions</span>
        </div>

        <div className="bg-white border border-neutral-200 p-4 sm:p-5 rounded-2xl shadow-sm flex flex-col justify-between border-l-4 border-l-rose-500">
          <span className="text-[10px] font-black text-neutral-400 uppercase tracking-widest font-mono">Rejected Transfers</span>
          <div className="pt-2">
            <span className="text-xl sm:text-2xl font-black font-mono text-rose-600">{stats.rejectedCount}</span>
          </div>
          <span className="text-[10px] text-neutral-400 font-bold block pt-1">Cancelled or rejected receipts</span>
        </div>

      </div>

      {/* Control Filters & Search Panel */}
      <div className="bg-white border border-neutral-200 p-5 rounded-3xl shadow-sm space-y-4">
        
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          
          {/* Quick Search Field */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by customer, business name, reference, phone or plan..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-neutral-50 hover:bg-neutral-100/50 focus:bg-white border border-neutral-200 rounded-xl focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition text-xs font-bold text-neutral-800"
            />
          </div>

          {/* Status Filter Dropdown */}
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-neutral-400 shrink-0" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="px-3 py-2.5 bg-neutral-50 hover:bg-neutral-100/50 border border-neutral-200 rounded-xl text-xs font-bold focus:outline-none focus:border-emerald-500 text-neutral-800 transition"
            >
              <option value="All">All Statuses</option>
              <option value="Pending Review">Pending Review</option>
              <option value="Approved">Approved</option>
              <option value="Rejected">Rejected</option>
              <option value="Expired">Expired</option>
              <option value="Cancelled">Cancelled</option>
            </select>
          </div>

        </div>

        {/* Date Filters Row */}
        <div className="border-t border-neutral-100 pt-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
          
          {/* Date Picker Range Inputs */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-mono font-black text-neutral-400 uppercase">From:</span>
              <div className="relative">
                <Calendar className="w-3.5 h-3.5 text-neutral-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="pl-8 pr-3 py-1.5 bg-neutral-50 hover:bg-neutral-100/50 border border-neutral-200 rounded-lg text-xs font-bold text-neutral-700 focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-mono font-black text-neutral-400 uppercase">To:</span>
              <div className="relative">
                <Calendar className="w-3.5 h-3.5 text-neutral-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="pl-8 pr-3 py-1.5 bg-neutral-50 hover:bg-neutral-100/50 border border-neutral-200 rounded-lg text-xs font-bold text-neutral-700 focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>
          </div>

          {/* Quick Preset Ranges */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono font-black text-neutral-400 uppercase">Presets:</span>
            <button
              onClick={() => setPresetRange('today')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                startDate === endDate && startDate !== ''
                  ? 'bg-emerald-500 text-white shadow-xs'
                  : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
              }`}
            >
              Today
            </button>
            <button
              onClick={() => setPresetRange('week')}
              className="px-3 py-1.5 rounded-lg text-xs font-bold bg-neutral-100 text-neutral-600 hover:bg-neutral-200 transition cursor-pointer"
            >
              Last 7 Days
            </button>
            <button
              onClick={() => setPresetRange('month')}
              className="px-3 py-1.5 rounded-lg text-xs font-bold bg-neutral-100 text-neutral-600 hover:bg-neutral-200 transition cursor-pointer"
            >
              Last 30 Days
            </button>
            <button
              onClick={() => setPresetRange('all')}
              className="px-3 py-1.5 rounded-lg text-xs font-bold bg-neutral-100 text-neutral-600 hover:bg-neutral-200 transition cursor-pointer"
            >
              All Time
            </button>
          </div>

        </div>

      </div>

      {/* Main Table View */}
      <div className="bg-white border border-neutral-200 rounded-3xl overflow-hidden shadow-sm">
        
        <div className="px-6 py-4 border-b border-neutral-200 bg-neutral-50/50 flex items-center justify-between">
          <span className="text-xs font-mono font-black text-neutral-400 uppercase tracking-widest">
            Showing {filteredPayments.length} of {payments.length} Payments
          </span>
          {filteredPayments.length > 0 && (
            <button
              onClick={() => {
                const header = 'ID,Customer,Business,Phone,Plan,Amount,Reference,Date,Status\n';
                const csv = filteredPayments.map(p => 
                  `"${p.id}","${p.customerName}","${p.businessName}","${p.phoneNumber}","${p.plan}",${p.amount},"${p.reference}","${p.paymentDate}","${p.status}"`
                ).join('\n');
                const blob = new Blob([header + csv], { type: 'text/csv' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `subscription_payments_audit_${new Date().toISOString().slice(0, 10)}.csv`;
                a.click();
              }}
              className="px-3 py-1.5 bg-neutral-100 hover:bg-neutral-200 rounded-lg text-[10px] font-black tracking-wide uppercase transition inline-flex items-center gap-1.5 cursor-pointer active:scale-95 border border-neutral-200"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-[#00B87A]" />
              Export CSV
            </button>
          )}
        </div>

        <div className="overflow-x-auto">
          {loading ? (
            <div className="p-12 text-center text-neutral-400 font-bold space-y-2">
              <RefreshCw className="w-8 h-8 text-[#00B87A] animate-spin mx-auto" />
              <p className="text-xs">Loading historical payment audits...</p>
            </div>
          ) : filteredPayments.length === 0 ? (
            <div className="p-12 text-center text-neutral-400 space-y-2">
              <AlertCircle className="w-10 h-10 text-neutral-300 mx-auto" />
              <p className="text-sm font-bold">No historical payments match the selected criteria.</p>
              <p className="text-xs font-medium text-neutral-400">Try adjusting your filters or search keywords.</p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-neutral-50/50 border-b border-neutral-250 text-[10px] font-bold text-neutral-400 uppercase tracking-wider font-mono">
                  <th className="p-4 pl-6">Customer & Business Details</th>
                  <th className="p-4">Plan</th>
                  <th className="p-4">Amount</th>
                  <th className="p-4">Reference No.</th>
                  <th className="p-4">Payment Date</th>
                  <th className="p-4">Status</th>
                  <th className="p-4 pr-6 text-right">Verification Controls</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-150 text-xs text-neutral-700">
                {filteredPayments.map((p) => (
                  <tr key={p.id} className="hover:bg-neutral-50/40 transition">
                    
                    {/* Customer Info */}
                    <td className="p-4 pl-6 space-y-0.5">
                      <span className="font-extrabold text-neutral-800 block text-sm">{p.customerName || 'N/A'}</span>
                      <span className="text-[10px] text-neutral-400 block font-mono">
                        {p.businessName || 'OPay Merchant'} • {p.phoneNumber || 'N/A'}
                      </span>
                    </td>

                    {/* Plan */}
                    <td className="p-4">
                      <span className="font-extrabold text-neutral-800 bg-neutral-100 py-1 px-2.5 rounded-lg border border-neutral-200">
                        {p.plan}
                      </span>
                    </td>

                    {/* Amount */}
                    <td className="p-4">
                      <span className="font-mono font-black text-neutral-800 text-sm">₦{p.amount.toLocaleString()}</span>
                    </td>

                    {/* Reference */}
                    <td className="p-4">
                      <span className="font-mono font-bold text-neutral-500 select-all">{p.reference}</span>
                    </td>

                    {/* Date */}
                    <td className="p-4 font-medium text-neutral-500">
                      {new Date(p.paymentDate).toLocaleDateString()}
                      <span className="block text-[9px] font-mono font-normal text-neutral-400">
                        {new Date(p.paymentDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </td>

                    {/* Status Badge */}
                    <td className="p-4">
                      <StatusBadge status={p.status} />
                    </td>

                    {/* Verification Action Buttons */}
                    <td className="p-4 pr-6 text-right whitespace-nowrap space-x-2">
                      <button
                        onClick={() => setSelectedReceiptUrl(p.receiptUrl)}
                        className="px-2.5 py-1.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-600 rounded-lg font-bold text-[10px] cursor-pointer transition inline-flex items-center gap-1 border border-neutral-200"
                        title="View the uploaded payment receipt attachment"
                      >
                        <Eye className="w-3.5 h-3.5" /> View Receipt
                      </button>

                      {p.status === 'Approved' && (
                        <button
                          onClick={() => setSelectedInvoice(p)}
                          className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-[#00B87A] border border-emerald-100 rounded-lg font-bold text-[10px] cursor-pointer transition inline-flex items-center gap-1.5"
                          title="View and print tax invoice receipt"
                        >
                          <FileText className="w-3.5 h-3.5" /> Invoice
                        </button>
                      )}

                      {p.status === 'Pending Review' && (
                        <>
                          {isSuperAdmin ? (
                            <>
                              <button
                                onClick={() => handleApprovePayment(p)}
                                disabled={isSubmittingApproval !== null}
                                className="px-2.5 py-1.5 bg-[#00B87A] hover:bg-[#00a36c] text-white rounded-lg font-black text-[10px] cursor-pointer transition inline-flex items-center gap-1 shadow-2xs disabled:bg-neutral-300"
                              >
                                {isSubmittingApproval === p.id ? (
                                  <RefreshCw className="w-3 h-3 animate-spin" />
                                ) : (
                                  <Check className="w-3.5 h-3.5" />
                                )}
                                Approve
                              </button>
                              <button
                                onClick={() => setRejectionInputId(p.id)}
                                className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-red-600 border border-rose-100 rounded-lg font-bold text-[10px] cursor-pointer transition inline-flex items-center gap-1"
                              >
                                <X className="w-3.5 h-3.5" /> Reject
                              </button>
                            </>
                          ) : (
                            <span className="text-[10px] font-mono font-bold text-amber-600 bg-amber-50 px-2 py-1.5 rounded-lg border border-amber-100 select-none">
                              Pending Review
                            </span>
                          )}
                        </>
                      )}
                    </td>

                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

      </div>

      {/* LIGHTBOX: Receipt Attachment View Overlay */}
      <AnimatePresence>
        {selectedReceiptUrl && (
          <div className="fixed inset-0 bg-black/85 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl max-w-lg w-full overflow-hidden flex flex-col border border-neutral-100 max-h-[85vh] shadow-2xl"
            >
              <div className="px-5 py-3 border-b border-neutral-200 flex justify-between items-center bg-white shrink-0">
                <span className="text-xs font-mono font-bold text-neutral-500 uppercase tracking-wider">Manual Payment Receipt View</span>
                <button 
                  onClick={() => setSelectedReceiptUrl(null)}
                  className="p-1.5 hover:bg-neutral-100 rounded-full text-neutral-400 hover:text-neutral-600 cursor-pointer transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="flex-1 overflow-auto bg-neutral-100 flex items-center justify-center p-4 min-h-[300px]">
                {selectedReceiptUrl.startsWith('data:application/pdf') ? (
                  <div className="text-center p-8 space-y-4 bg-white rounded-2xl border border-neutral-200">
                    <FileText className="w-16 h-16 text-red-500 mx-auto" />
                    <p className="text-sm font-bold text-neutral-800">PDF Document Payment Receipt</p>
                    <a 
                      href={selectedReceiptUrl} 
                      download="payment-receipt.pdf"
                      className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold transition cursor-pointer active:scale-95 shadow-sm"
                    >
                      <Download className="w-4 h-4" /> Download PDF Receipt
                    </a>
                  </div>
                ) : (
                  <img 
                    src={selectedReceiptUrl} 
                    alt="Uploaded Bank Transfer Receipt" 
                    className="max-h-[60vh] object-contain rounded-xl shadow-xs" 
                    referrerPolicy="no-referrer"
                  />
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL: Invoice Details Overlay */}
      <AnimatePresence>
        {selectedInvoice && (
          <div className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 15 }}
              className="bg-white rounded-3xl max-w-xl w-full p-8 shadow-2xl border border-neutral-200 text-neutral-800 flex flex-col gap-6 relative"
            >
              <button 
                onClick={() => setSelectedInvoice(null)}
                className="absolute top-5 right-5 p-1.5 hover:bg-neutral-100 rounded-full text-neutral-400 hover:text-neutral-600 cursor-pointer transition"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="text-center space-y-1 pb-4 border-b border-neutral-200">
                <h1 className="text-xl font-black tracking-tight text-neutral-900 uppercase font-mono">POSTrack Official Invoice Receipt</h1>
                <p className="text-[10px] text-neutral-400 font-mono font-bold">Billed to: {selectedInvoice.businessName || 'Valued Partner'}</p>
                <p className="text-[10px] text-[#00B87A] font-bold">Transaction Reference: {selectedInvoice.reference}</p>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div>
                    <span className="text-neutral-400 font-mono text-[10px] uppercase block tracking-wider font-bold">Customer Details</span>
                    <p className="font-extrabold text-neutral-800 pt-0.5">{selectedInvoice.customerName}</p>
                    <p className="text-[11px] text-neutral-500 font-medium">{selectedInvoice.phoneNumber}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-neutral-400 font-mono text-[10px] uppercase block tracking-wider font-bold">Invoice Details</span>
                    <p className="font-bold text-neutral-800 pt-0.5">Plan: {selectedInvoice.plan}</p>
                    <p className="text-neutral-500 font-mono text-[10px]">Date: {new Date(selectedInvoice.paymentDate).toLocaleDateString()}</p>
                  </div>
                </div>

                <div className="border border-neutral-200 rounded-2xl bg-neutral-50/50 p-4 space-y-3 mt-4">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold text-neutral-700">{selectedInvoice.plan} Plan Subscription (1 Month)</span>
                    <span className="font-mono font-bold text-neutral-800">₦{selectedInvoice.amount.toLocaleString()}</span>
                  </div>
                  <div className="border-t border-dashed border-neutral-200 pt-3 flex justify-between items-center text-sm">
                    <span className="font-extrabold text-neutral-800">Total Paid:</span>
                    <span className="font-mono font-black text-[#00B87A]">₦{selectedInvoice.amount.toLocaleString()}</span>
                  </div>
                </div>
              </div>

              <div className="p-3 bg-emerald-50/40 border border-emerald-100 rounded-2xl text-[11px] text-emerald-800 leading-relaxed text-center">
                <p className="font-extrabold flex items-center justify-center gap-1">
                  <CheckCircle2 className="w-4 h-4 text-[#00B87A]" /> Payment Status: PAID & APPROVED
                </p>
                <p className="text-[10px] text-emerald-600 font-medium">This document acts as valid, tax-compliant booking receipt for POS Track SaaS license.</p>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => window.print()}
                  className="flex-1 py-2.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 rounded-xl font-bold text-xs cursor-pointer transition active:scale-98"
                >
                  <Printer className="w-3.5 h-3.5 inline mr-1" /> Print Invoice
                </button>
                <button
                  onClick={() => setSelectedInvoice(null)}
                  className="flex-1 py-2.5 bg-[#00B87A] hover:bg-[#00a36c] text-white rounded-xl font-bold text-xs cursor-pointer transition active:scale-98"
                >
                  Done
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL: Reject Reason Input */}
      <AnimatePresence>
        {rejectionInputId && (
          <div className="fixed inset-0 bg-black/75 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-neutral-200 text-neutral-800 flex flex-col gap-4"
            >
              <div className="space-y-1">
                <h3 className="font-black text-sm text-neutral-800">Reject Transfer Verification</h3>
                <p className="text-[10px] text-neutral-500 font-medium">Please provide a constructive rejection reason explaining what went wrong to the customer.</p>
              </div>
              <textarea
                placeholder="e.g., Transfer memo is missing unique reference, receipt file image corrupted, or payment was not received."
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                rows={3}
                className="w-full p-3 bg-neutral-50 border border-neutral-200 rounded-xl text-xs font-medium focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 font-sans"
              />
              <div className="flex gap-2.5 pt-2">
                <button
                  onClick={() => { setRejectionInputId(null); setRejectionReason(''); }}
                  disabled={isSubmittingRejection}
                  className="flex-1 py-2 bg-neutral-100 hover:bg-neutral-200 rounded-xl text-xs font-bold transition text-neutral-700 cursor-pointer disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleRejectPayment}
                  disabled={isSubmittingRejection}
                  className="flex-1 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold transition cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1"
                >
                  {isSubmittingRejection && <RefreshCw className="w-3 h-3 animate-spin" />}
                  Reject Receipt
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}

// Compact Status Badge Component
function StatusBadge({ status }: { status: string }) {
  let styles = 'bg-neutral-100 text-neutral-600 border-neutral-200';
  if (status === 'Approved' || status === 'Active' || status === 'Success') {
    styles = 'bg-emerald-50 text-emerald-700 border-emerald-100';
  } else if (status === 'Pending Review' || status === 'Pending') {
    styles = 'bg-amber-50 text-amber-700 border-amber-100 animate-pulse';
  } else if (status === 'Rejected' || status === 'Failed') {
    styles = 'bg-rose-50 text-rose-700 border-rose-100';
  } else if (status === 'Expired') {
    styles = 'bg-red-50 text-red-700 border-red-100';
  } else if (status === 'Cancelled') {
    styles = 'bg-neutral-100 text-neutral-500 border-neutral-200';
  }

  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-black font-mono tracking-wider uppercase px-2 py-0.5 rounded-full border ${styles}`}>
      {status === 'Approved' || status === 'Active' || status === 'Success' ? <CheckCircle2 className="w-2.5 h-2.5" /> : null}
      {status === 'Pending Review' || status === 'Pending' ? <Clock className="w-2.5 h-2.5" /> : null}
      {status === 'Rejected' || status === 'Failed' ? <XCircle className="w-2.5 h-2.5" /> : null}
      {status}
    </span>
  );
}
