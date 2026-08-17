import React from 'react';
import { Sparkles, Clock, Calendar, CheckCircle2, AlertTriangle, RotateCw, ChevronRight, ShieldAlert, FileSpreadsheet } from 'lucide-react';
import { WhatsAppSupportButton } from './WhatsAppSupportButton';

interface SubscriptionStatusWidgetProps {
  activeSubscription: any;
  onUpgradeClick: () => void;
  onRefreshClick: () => void;
  onViewDetailsClick?: () => void;
  isRefreshing: boolean;
  isPremiumLocked: boolean;
}

export function SubscriptionStatusWidget({
  activeSubscription,
  onUpgradeClick,
  onRefreshClick,
  onViewDetailsClick,
  isRefreshing,
  isPremiumLocked
}: SubscriptionStatusWidgetProps) {
  if (!activeSubscription) {
    return (
      <div className="bg-white border border-neutral-200 p-4 rounded-3xl shadow-xs animate-pulse flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-4 w-32 bg-neutral-200 rounded-sm" />
          <div className="h-3 w-48 bg-neutral-200 rounded-sm" />
        </div>
        <div className="h-8 w-24 bg-neutral-200 rounded-xl" />
      </div>
    );
  }

  const { status, plan, trialStartDate, trialEndDate, subscriptionEndDate } = activeSubscription;

  // Calculate trial days remaining
  const getTrialDaysRemaining = () => {
    if (status !== 'Trial' || !trialEndDate) return 0;
    const trialEnd = new Date(trialEndDate).getTime();
    const diffTime = trialEnd - Date.now();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return Math.max(0, diffDays);
  };

  const trialDaysRemaining = getTrialDaysRemaining();
  const trialPercent = Math.round((trialDaysRemaining / 14) * 100);

  // Status-specific badges and descriptions
  let statusBadge = (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-neutral-100 text-neutral-600 border border-neutral-200">
      <Clock className="w-3 h-3" />
      Unknown
    </span>
  );
  let planLabel = plan || 'No Active Plan';
  let statusDesc = 'Check your subscription status or upgrade to unlock full POS capabilities.';
  let showProgress = false;
  let statusColorClass = 'text-neutral-700';

  if (status === 'Trial') {
    const isExpired = trialDaysRemaining <= 0;
    showProgress = !isExpired;
    statusColorClass = isExpired ? 'text-red-600 font-bold animate-pulse' : 'text-neutral-700';
    statusBadge = isExpired ? (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-rose-50 text-rose-700 border border-rose-250 animate-pulse">
        <ShieldAlert className="w-3 h-3" />
        Expired
      </span>
    ) : (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-50 text-amber-700 border border-amber-250">
        <Clock className="w-3 h-3" />
        {trialDaysRemaining} {trialDaysRemaining === 1 ? 'day' : 'days'} left
      </span>
    );
    planLabel = '14-Day Free Trial';
    statusDesc = isExpired 
      ? 'Your free trial has ended. Access is limited. Please subscribe to standard plans to continue logging new transactions.'
      : `You are on the trial period. Enjoy full premium POSTRACK features until trial ends.`;
  } else if (status === 'Active') {
    statusBadge = (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-250 font-mono">
        <CheckCircle2 className="w-3 h-3" />
        Active
      </span>
    );
    planLabel = `${plan} Plan`;
    const expiryStr = subscriptionEndDate ? new Date(subscriptionEndDate).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) : '';
    statusDesc = expiryStr ? `Premium plan is active. Auto-renew or valid until ${expiryStr}.` : 'Your premium subscription plan is active.';
  } else if (status === 'Pending Review' || status === 'Pending') {
    statusBadge = (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-50 text-amber-600 border border-amber-200 animate-pulse font-mono">
        <Clock className="w-3 h-3" />
        Awaiting Verification
      </span>
    );
    planLabel = `${plan} Plan (Pending)`;
    statusDesc = 'Your payment receipt is being reviewed by POSTRACK Admins. We will activate your premium features immediately after validation.';
  } else if (status === 'Rejected') {
    statusBadge = (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-red-50 text-red-600 border border-red-200 font-mono">
        <AlertTriangle className="w-3 h-3" />
        Verification Failed
      </span>
    );
    planLabel = `${plan} (Rejected)`;
    statusDesc = 'Your uploaded payment receipt was rejected. Please upload a valid bank transfer invoice receipt to activate your subscription.';
  } else if (status === 'Expired') {
    statusBadge = (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-rose-50 text-rose-700 border border-rose-250 animate-pulse font-mono">
        <ShieldAlert className="w-3 h-3" />
        Subscription Expired
      </span>
    );
    planLabel = `${plan} (Expired)`;
    statusDesc = 'Your subscription plan has expired. To continue logging new transactions, please activate a plan.';
  }

  return (
    <div className="bg-white border border-neutral-200 rounded-3xl p-5 shadow-sm space-y-4">
      {/* Header Info */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-neutral-100">
        <div className="space-y-1">
          <span className="text-[10px] uppercase font-mono font-bold tracking-widest text-neutral-400 block">
            POSTrack Subscription Account Details
          </span>
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="text-base font-extrabold text-neutral-800 tracking-tight">
              {planLabel}
            </h4>
            {statusBadge}
          </div>
        </div>

        {/* Buttons Action Group */}
        <div className="flex items-center gap-2 shrink-0">
          {onViewDetailsClick && (
            <button
              type="button"
              onClick={onViewDetailsClick}
              className="px-3 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-xl text-xs font-bold transition cursor-pointer active:scale-95 flex items-center gap-1.5 border border-neutral-200/60"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-[#00B87A]" />
              <span className="hidden sm:inline">Details</span>
            </button>
          )}

          <button
            type="button"
            onClick={onRefreshClick}
            disabled={isRefreshing}
            className="p-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-600 rounded-xl transition cursor-pointer active:scale-95 border border-neutral-200/60 disabled:opacity-50"
            title="Refresh Subscription Status"
          >
            <RotateCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-[#00B87A]' : ''}`} />
          </button>
          
          <button
            type="button"
            onClick={onUpgradeClick}
            className="px-3.5 py-2 bg-[#00B87A] hover:bg-[#009E66] text-white rounded-xl text-xs font-black transition cursor-pointer active:scale-95 flex items-center gap-1.5 shadow-xs hover:shadow-md"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Manage</span>
          </button>
        </div>
      </div>

      {/* Description */}
      <p className="text-[12px] text-neutral-500 leading-relaxed font-medium">
        {statusDesc}
      </p>

      {/* Expiry Bar (if Trial) */}
      {showProgress && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-[11px] font-semibold text-neutral-500 font-mono">
            <span>Trial Timeline Status</span>
            <span className={statusColorClass}>{trialDaysRemaining} / 14 Days Remaining</span>
          </div>
          <div className="w-full h-2.5 bg-neutral-100 rounded-full overflow-hidden border border-neutral-200/50">
            <div 
              className={`h-full rounded-full transition-all duration-500 ${
                trialDaysRemaining > 7 
                  ? 'bg-emerald-500' 
                  : trialDaysRemaining > 3 
                    ? 'bg-amber-500' 
                    : 'bg-rose-500 animate-pulse'
              }`}
              style={{ width: `${trialPercent}%` }}
            />
          </div>
        </div>
      )}

      {/* Access Restriction Notice if Expired */}
      {isPremiumLocked && (
        <div className="flex items-start gap-3 bg-red-50/50 border border-red-150 p-4 rounded-2xl">
          <ShieldAlert className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h5 className="text-[12px] font-extrabold text-red-800 uppercase tracking-tight">
              Transaction Creation Suspended
            </h5>
            <p className="text-[11px] text-red-600/80 leading-relaxed font-medium">
              You can still view transaction histories, cashiers, and daily records, but creating new transactions is disabled. Activate a subscription plan to unlock full POS operational capabilities immediately.
            </p>
          </div>
        </div>
      )}

      {/* WhatsApp Support Assistance Footer */}
      <div className="pt-2 border-t border-neutral-100 flex flex-col sm:flex-row items-center justify-between gap-2.5">
        <span className="text-[11px] font-semibold text-neutral-500">
          Need help with your subscription or payment?
        </span>
        <WhatsAppSupportButton
          context="Subscription Help"
          buttonText="Chat on WhatsApp"
          variant="compact"
        />
      </div>
    </div>
  );
}
