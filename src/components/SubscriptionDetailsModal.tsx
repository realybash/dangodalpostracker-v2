import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ShieldCheck, 
  Clock, 
  Calendar, 
  CheckCircle2, 
  AlertTriangle, 
  RotateCw, 
  X, 
  CreditCard, 
  Sparkles, 
  Users, 
  Smartphone, 
  TrendingUp, 
  ShieldAlert, 
  Copy, 
  Check, 
  Headphones, 
  Award, 
  Layers,
  FileText
} from 'lucide-react';
import { User } from '../types';
import { WhatsAppSupportButton } from './WhatsAppSupportButton';
import { db } from '../lib/firebase';
import { doc, setDoc, collection, query, where, getDocs } from 'firebase/firestore';

interface SubscriptionDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeSubscription: any;
  currentUser: User;
  usageStats?: {
    totalTransactions: number;
    totalCashiers: number;
    totalTerminals: number;
    totalRealizedGain: number;
  };
  onOpenBillingModal?: () => void;
  onOpenUploadReceiptModal?: () => void;
  onRefreshSubscription?: () => void;
  isRefreshingSubscription?: boolean;
  onApproveSubscription?: () => void;
}

const PLAN_PRICES = {
  Starter: 2000,
  Professional: 5000,
  Business: 10000,
  Enterprise: 25000,
  'Free Trial': 0
};

export function SubscriptionDetailsModal({
  isOpen,
  onClose,
  activeSubscription,
  currentUser,
  usageStats = { totalTransactions: 0, totalCashiers: 0, totalTerminals: 0, totalRealizedGain: 0 },
  onOpenBillingModal,
  onOpenUploadReceiptModal,
  onRefreshSubscription,
  isRefreshingSubscription = false,
  onApproveSubscription
}: SubscriptionDetailsModalProps) {
  const [copiedId, setCopiedId] = useState(false);
  const [localSubscription, setLocalSubscription] = useState<any>(activeSubscription);
  const [isApproving, setIsApproving] = useState(false);

  useEffect(() => {
    setLocalSubscription(activeSubscription);
  }, [activeSubscription]);

  if (!isOpen) return null;

  // Super Admin Recognition: ID or Phone "08141106560" exclusively
  const isSuperAdmin = Boolean(
    currentUser && (
      currentUser.phone === '08141106560' ||
      (currentUser as any).phoneNumber === '08141106560' ||
      currentUser.id === '08141106560'
    )
  );

  const displaySub = localSubscription || activeSubscription;
  const planName = displaySub?.plan || 'Free Trial';
  const status = displaySub?.status || 'Trial';
  const trialStartDate = displaySub?.trialStartDate;
  const trialEndDate = displaySub?.trialEndDate;
  const subscriptionStartDate = displaySub?.subscriptionStartDate;
  const subscriptionEndDate = displaySub?.subscriptionEndDate;
  const ownerId = displaySub?.ownerId || currentUser?.id || 'mgr_1';
  const referredBy = displaySub?.referredBy;
  const payoutBalance = displaySub?.payoutBalance || 0;

  // Amount Validation Logic
  const subAmount = displaySub?.amount || 0;
  const planToApprove = (displaySub?.plan && displaySub.plan !== 'Free Trial') ? displaySub.plan : 'Professional';
  const expectedPrice = PLAN_PRICES[planToApprove as keyof typeof PLAN_PRICES] || 0;
  const isAmountMismatched = subAmount !== expectedPrice;
  const isApprovalBlocked = isAmountMismatched && currentUser?.phone !== '08141106560';

  // Approval Logic
  const handleApproveSubscription = async () => {
    if (!isSuperAdmin && currentUser?.phone !== '08141106560') {
      alert("Access Denied: Only Super Admin can approve subscriptions.");
      return;
    }

    // STRICT SAFEGUARD: Block approval if amount doesn't match plan price
    if (isApprovalBlocked) {
      alert(`Approval Denied: Exact Payment Required. Payment amount (₦${subAmount.toLocaleString()}) does not match ${planToApprove} price (₦${expectedPrice.toLocaleString()}).`);
      return;
    }

    setIsApproving(true);
    try {
      const nowStr = new Date().toISOString();
      // Extend subscription expiry by 30 days
      const expiryDateStr = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
      const targetOwnerId = ownerId || currentUser?.id || 'mgr_1';

      const approvedSubData = {
        ...displaySub,
        id: targetOwnerId,
        ownerId: targetOwnerId,
        plan: planToApprove,
        status: 'Active',
        subscriptionStartDate: nowStr,
        subscriptionEndDate: expiryDateStr,
        lastPaymentDate: nowStr,
        nextPaymentDate: expiryDateStr,
        updatedAt: nowStr,
        approvedBy: currentUser?.id || '08141106560',
        approvedAt: nowStr
      };

      // 1. Immediately update local state so "PAYMENT VERIFICATION PENDING" clears instantly
      setLocalSubscription(approvedSubData);

      // 2. Persist in Firestore
      try {
        const subRef = doc(db, 'subscriptions', targetOwnerId);
        await setDoc(subRef, approvedSubData, { merge: true });

        // Update user document
        await setDoc(doc(db, 'users', targetOwnerId), {
          subscriptionStatus: 'Active',
          plan: planToApprove,
          subscriptionEndDate: expiryDateStr,
          updatedAt: nowStr
        }, { merge: true }).catch(() => {});

        // Mark any pending manual payments for this owner as Approved
        const paymentsRef = collection(db, 'subscription_payments');
        const qPay = query(paymentsRef, where('ownerId', '==', targetOwnerId), where('status', '==', 'Pending Review'));
        const paySnap = await getDocs(qPay).catch(() => null);
        if (paySnap && !paySnap.empty) {
          for (const pDoc of paySnap.docs) {
            await setDoc(doc(db, 'subscription_payments', pDoc.id), {
              status: 'Approved',
              updatedAt: nowStr
            }, { merge: true }).catch(() => {});
          }
        }
      } catch (fsErr) {
        console.warn('[Subscription Approval] Firestore sync note:', fsErr);
      }

      // 3. LocalStorage persistence for instant offline reflection
      try {
        localStorage.setItem(`POSTrack_Subscription_${targetOwnerId}`, JSON.stringify(approvedSubData));
        localStorage.setItem('POSTrack_Active_Subscription', JSON.stringify(approvedSubData));
      } catch (lsErr) {
        console.warn('[Subscription Approval] LocalStorage error:', lsErr);
      }

      if (onRefreshSubscription) {
        onRefreshSubscription();
      }
      if (onApproveSubscription) {
        onApproveSubscription();
      }
    } catch (err) {
      console.error('[Subscription Approval] Error approving subscription:', err);
    } finally {
      setIsApproving(false);
    }
  };

  // Calculate days remaining
  const getDaysRemaining = () => {
    let targetDate = subscriptionEndDate;
    if (status === 'Trial') {
      targetDate = trialEndDate;
    }
    if (!targetDate) return null;
    const diffMs = new Date(targetDate).getTime() - Date.now();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const daysRemaining = getDaysRemaining();
  const isExpired = daysRemaining !== null && daysRemaining <= 0;

  const handleCopyOwnerId = () => {
    navigator.clipboard.writeText(ownerId);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  const formatNaira = (val: number) => {
    return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(val);
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ type: 'spring', damping: 25 }}
          className="bg-neutral-50 border border-neutral-200 shadow-2xl rounded-3xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden text-neutral-800"
        >
          {/* Header */}
          <div className="px-6 py-4 border-b border-neutral-200 bg-white flex justify-between items-center shrink-0">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-emerald-50 rounded-2xl text-[#00B87A] border border-emerald-100">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-black tracking-tight text-neutral-800">Subscription Details</h2>
                  {isSuperAdmin ? (
                    <span className="text-[10px] bg-emerald-100 font-mono font-extrabold text-emerald-800 px-2.5 py-0.5 rounded-full border border-emerald-300">
                      Super Admin Mode
                    </span>
                  ) : (
                    <span className="text-[10px] bg-neutral-100 font-mono font-bold text-neutral-500 px-2 py-0.5 rounded-full border border-neutral-200">
                      Read-Only
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-neutral-500 font-medium">
                  Detailed status, plan metrics, and company usage statistics
                </p>
              </div>
            </div>
            <button 
              onClick={onClose}
              className="p-1.5 hover:bg-neutral-100 rounded-full transition text-neutral-400 hover:text-neutral-600 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content Body */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            
            {/* Status Banner */}
            {isExpired ? (
              <div className="bg-red-50 border border-red-200/80 p-4 rounded-2xl flex items-start gap-3">
                <ShieldAlert className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h4 className="text-xs font-extrabold text-red-900 uppercase tracking-tight">Subscription Expired</h4>
                  <p className="text-[11px] text-red-700 leading-relaxed font-medium">
                    Your trial or subscription period has ended. All existing transactions and data are preserved.
                  </p>
                </div>
              </div>
            ) : status === 'Active' ? (
              <div className="bg-emerald-50/80 border border-emerald-200/80 p-4 rounded-2xl flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h4 className="text-xs font-extrabold text-emerald-900 uppercase tracking-tight">Active Plan</h4>
                  <p className="text-[11px] text-emerald-800 leading-relaxed font-medium">
                    Your {planName} is fully active with full access to terminal management, cashier creation, and transaction logging.
                  </p>
                </div>
              </div>
            ) : status === 'Pending Review' ? (
              <div className="bg-amber-50 border border-amber-200/80 p-4 rounded-2xl flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <Clock className="w-5 h-5 text-amber-600 shrink-0 mt-0.5 animate-spin" />
                  <div className="space-y-1">
                    <h4 className="text-xs font-extrabold text-amber-900 uppercase tracking-tight">Payment Verification Pending</h4>
                    <p className="text-[11px] text-amber-800 leading-relaxed font-medium">
                      Your uploaded payment receipt is currently being verified by POSTRACK Super Administrator.
                    </p>
                  </div>
                </div>
                {isSuperAdmin && (
                  <div className="flex flex-col items-end gap-1">
                    <button
                      type="button"
                      onClick={handleApproveSubscription}
                      disabled={isApproving || isApprovalBlocked}
                      className={`shrink-0 px-3.5 py-2 rounded-xl font-extrabold text-xs transition cursor-pointer flex items-center gap-1.5 shadow-md ${
                        isApprovalBlocked 
                          ? 'bg-neutral-300 text-neutral-500 cursor-not-allowed opacity-70' 
                          : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                      }`}
                    >
                      {isApproving ? <RotateCw className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                      <span>Approve Now</span>
                    </button>
                    {isAmountMismatched && (
                      <span className="text-[9px] text-red-600 font-black uppercase tracking-tight bg-red-100 px-2 py-0.5 rounded border border-red-200">
                        Exact Payment Required: ₦{subAmount.toLocaleString()} vs ₦{expectedPrice.toLocaleString()}
                      </span>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-amber-50/60 border border-amber-200/80 p-4 rounded-2xl flex items-start gap-3">
                <Clock className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h4 className="text-xs font-extrabold text-amber-900 uppercase tracking-tight">Free Trial Period</h4>
                  <p className="text-[11px] text-amber-800 leading-relaxed font-medium">
                    You are enjoying a 14-day free trial. {daysRemaining !== null && daysRemaining > 0 ? `${daysRemaining} days remaining.` : ''}
                  </p>
                </div>
              </div>
            )}

            {/* Plan Summary Card */}
            <div className="bg-white border border-neutral-200/80 rounded-2xl p-5 space-y-4 shadow-xs">
              <div className="flex items-center justify-between pb-3 border-b border-neutral-100">
                <div className="flex items-center gap-2.5">
                  <Award className="w-5 h-5 text-[#00B87A]" />
                  <span className="text-xs font-extrabold uppercase tracking-wider text-neutral-500 font-mono">Plan & Account Summary</span>
                </div>
                <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase font-mono ${
                  status === 'Active' 
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : isExpired 
                      ? 'bg-red-50 text-red-700 border border-red-200'
                      : 'bg-amber-50 text-amber-700 border border-amber-200'
                }`}>
                  {status}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-neutral-50/70 p-3.5 rounded-xl border border-neutral-200/60 space-y-1">
                  <span className="text-[10px] font-bold text-neutral-400 uppercase font-mono block">Current Plan</span>
                  <span className="text-sm font-black text-neutral-800 font-mono">{planName}</span>
                </div>

                <div className="bg-neutral-50/70 p-3.5 rounded-xl border border-neutral-200/60 space-y-1">
                  <span className="text-[10px] font-bold text-neutral-400 uppercase font-mono block">Account ID (Owner)</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-neutral-700 font-mono truncate">{ownerId}</span>
                    <button 
                      onClick={handleCopyOwnerId} 
                      className="p-1 hover:bg-neutral-200 rounded text-neutral-500 cursor-pointer transition shrink-0"
                      title="Copy Owner ID"
                    >
                      {copiedId ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                {trialStartDate && (
                  <div className="bg-neutral-50/70 p-3.5 rounded-xl border border-neutral-200/60 space-y-1">
                    <span className="text-[10px] font-bold text-neutral-400 uppercase font-mono block">Trial Start Date</span>
                    <span className="text-xs font-bold text-neutral-700 font-mono">
                      {new Date(trialStartDate).toLocaleDateString(undefined, { dateStyle: 'medium' })}
                    </span>
                  </div>
                )}

                {trialEndDate && (
                  <div className="bg-neutral-50/70 p-3.5 rounded-xl border border-neutral-200/60 space-y-1">
                    <span className="text-[10px] font-bold text-neutral-400 uppercase font-mono block">Trial Expiry Date</span>
                    <span className="text-xs font-bold text-neutral-700 font-mono">
                      {new Date(trialEndDate).toLocaleDateString(undefined, { dateStyle: 'medium' })}
                    </span>
                  </div>
                )}

                {subscriptionStartDate && (
                  <div className="bg-neutral-50/70 p-3.5 rounded-xl border border-neutral-200/60 space-y-1">
                    <span className="text-[10px] font-bold text-neutral-400 uppercase font-mono block">Subscription Start Date</span>
                    <span className="text-xs font-bold text-neutral-700 font-mono">
                      {new Date(subscriptionStartDate).toLocaleDateString(undefined, { dateStyle: 'medium' })}
                    </span>
                  </div>
                )}

                {subscriptionEndDate && (
                  <div className="bg-neutral-50/70 p-3.5 rounded-xl border border-neutral-200/60 space-y-1">
                    <span className="text-[10px] font-bold text-neutral-400 uppercase font-mono block">Subscription Expiry Date</span>
                    <span className="text-xs font-bold text-neutral-700 font-mono">
                      {new Date(subscriptionEndDate).toLocaleDateString(undefined, { dateStyle: 'medium' })}
                    </span>
                  </div>
                )}

                {referredBy && (
                  <div className="bg-neutral-50/70 p-3.5 rounded-xl border border-neutral-200/60 space-y-1 sm:col-span-2">
                    <span className="text-[10px] font-bold text-neutral-400 uppercase font-mono block">Referred By Partner</span>
                    <span className="text-xs font-bold text-emerald-800 font-mono">{referredBy}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Usage Statistics Box */}
            <div className="bg-white border border-neutral-200/80 rounded-2xl p-5 space-y-4 shadow-xs">
              <div className="flex items-center gap-2.5 pb-3 border-b border-neutral-100">
                <Layers className="w-5 h-5 text-[#00B87A]" />
                <span className="text-xs font-extrabold uppercase tracking-wider text-neutral-500 font-mono">Account Usage Statistics</span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-emerald-50/50 border border-emerald-100 p-3 rounded-xl text-center">
                  <FileText className="w-4 h-4 text-[#00B87A] mx-auto mb-1" />
                  <span className="text-base font-black text-neutral-800 font-mono">{usageStats.totalTransactions}</span>
                  <span className="text-[10px] text-neutral-500 block font-medium">Transactions</span>
                </div>

                <div className="bg-emerald-50/50 border border-emerald-100 p-3 rounded-xl text-center">
                  <Users className="w-4 h-4 text-[#00B87A] mx-auto mb-1" />
                  <span className="text-base font-black text-neutral-800 font-mono">{usageStats.totalCashiers}</span>
                  <span className="text-[10px] text-neutral-500 block font-medium">Cashiers / Staff</span>
                </div>

                <div className="bg-emerald-50/50 border border-emerald-100 p-3 rounded-xl text-center">
                  <Smartphone className="w-4 h-4 text-[#00B87A] mx-auto mb-1" />
                  <span className="text-base font-black text-neutral-800 font-mono">{usageStats.totalTerminals}</span>
                  <span className="text-[10px] text-neutral-500 block font-medium">POS Terminals</span>
                </div>

                <div className="bg-emerald-50/50 border border-emerald-100 p-3 rounded-xl text-center">
                  <TrendingUp className="w-4 h-4 text-[#00B87A] mx-auto mb-1" />
                  <span className="text-base font-black text-neutral-800 font-mono text-[11px] sm:text-xs">
                    {formatNaira(usageStats.totalRealizedGain)}
                  </span>
                  <span className="text-[10px] text-neutral-500 block font-medium">Realized Gain</span>
                </div>
              </div>
            </div>

            {/* Support section */}
            <div className="pt-2 border-t border-neutral-100 flex flex-col sm:flex-row items-center justify-between gap-3">
              <span className="text-xs font-medium text-neutral-500">
                Need to extend your trial or verify payment?
              </span>
              <WhatsAppSupportButton 
                context="Subscription Details Inquiry" 
                buttonText="Contact Support" 
                variant="compact"
              />
            </div>
          </div>

          {/* Footer Actions */}
          <div className="px-6 py-4 bg-white border-t border-neutral-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-2">
              {onRefreshSubscription && (
                <button
                  type="button"
                  onClick={onRefreshSubscription}
                  disabled={isRefreshingSubscription}
                  className="px-3.5 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-xl font-bold text-xs transition cursor-pointer flex items-center gap-1.5 border border-neutral-200 disabled:opacity-50"
                >
                  <RotateCw className={`w-3.5 h-3.5 ${isRefreshingSubscription ? 'animate-spin text-[#00B87A]' : ''}`} />
                  <span>Refresh Status</span>
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 flex-wrap justify-end">
              {isSuperAdmin && (
                <div className="flex flex-col items-end gap-1">
                  <button
                    type="button"
                    onClick={handleApproveSubscription}
                    disabled={isApproving || isApprovalBlocked}
                    className={`px-4 py-2 rounded-xl font-extrabold text-xs transition cursor-pointer flex items-center gap-1.5 shadow-md hover:shadow-lg transform active:scale-95 ${
                      isApprovalBlocked 
                        ? 'bg-neutral-300 text-neutral-500 cursor-not-allowed opacity-70' 
                        : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                    }`}
                  >
                    {isApproving ? <RotateCw className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                    <span>APPROVE SUBSCRIPTION</span>
                  </button>
                  {isAmountMismatched && (
                    <span className="text-[8px] text-red-600 font-black uppercase font-mono">
                      Exact Payment Required: ₦{subAmount.toLocaleString()} vs Required ₦{expectedPrice.toLocaleString()}
                    </span>
                  )}
                </div>
              )}

              {currentUser?.role === 'Manager' && onOpenUploadReceiptModal && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenUploadReceiptModal();
                  }}
                  className="px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200/80 rounded-xl font-extrabold text-xs transition cursor-pointer flex items-center gap-1.5"
                >
                  <CreditCard className="w-3.5 h-3.5 text-[#00B87A]" />
                  <span>Upload Receipt</span>
                </button>
              )}

              {currentUser?.role === 'Manager' && onOpenBillingModal && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenBillingModal();
                  }}
                  className="px-4 py-2 bg-[#00B87A] hover:bg-[#009E66] text-white rounded-xl font-extrabold text-xs transition cursor-pointer flex items-center gap-1.5 shadow-xs"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Manage Plans & Billing</span>
                </button>
              )}

              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-neutral-200 hover:bg-neutral-300 text-neutral-800 rounded-xl font-bold text-xs transition cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

export default SubscriptionDetailsModal;
