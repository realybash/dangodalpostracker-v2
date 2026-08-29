import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AlertTriangle, Clock, Calendar, Sparkles, FileSpreadsheet, Headphones, X, ShieldAlert } from 'lucide-react';
import { User } from '../types';
import { WhatsAppSupportButton } from './WhatsAppSupportButton';

interface SubscriptionWarningModalProps {
  isOpen: boolean;
  onClose: () => void;
  daysRemaining: number;
  expiryDate: string | null;
  planName: string;
  currentUser: User;
  businessName?: string;
  onOpenBillingModal?: () => void;
  onOpenUploadReceiptModal?: () => void;
}

export function SubscriptionWarningModal({
  isOpen,
  onClose,
  daysRemaining,
  expiryDate,
  planName,
  currentUser,
  businessName = 'Your Store',
  onOpenBillingModal,
  onOpenUploadReceiptModal
}: SubscriptionWarningModalProps) {
  if (!isOpen) return null;

  const isManager = currentUser?.role === 'Manager';
  const formattedExpiry = expiryDate && !isNaN(new Date(expiryDate).getTime())
    ? new Date(expiryDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
    : 'Soon';

  return (
    <AnimatePresence>
      <div className="fixed inset-0 bg-neutral-900/70 backdrop-blur-sm z-[150] flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.92, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.92, y: 15 }}
          className="bg-white border-2 border-amber-300 rounded-3xl max-w-lg w-full shadow-2xl overflow-hidden relative"
        >
          {/* Header Warning Bar */}
          <div className="bg-gradient-to-r from-amber-500 via-amber-600 to-orange-600 text-white px-6 py-4 flex items-center justify-between shadow-md">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center text-white shrink-0">
                <AlertTriangle className="w-6 h-6 text-amber-100 animate-bounce" />
              </div>
              <div>
                <h3 className="text-base font-black tracking-tight uppercase font-mono">
                  Subscription Expiration Warning
                </h3>
                <p className="text-[11px] text-amber-100 font-medium">
                  Action Required • App Re-check Timer Active
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 rounded-full hover:bg-white/20 text-amber-100 hover:text-white transition cursor-pointer"
              title="Dismiss warning for 30 minutes"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body Content */}
          <div className="p-6 space-y-5">
            {/* Days Remaining Banner */}
            <div className="bg-amber-50 border-2 border-amber-200 rounded-2xl p-4 flex items-center justify-between gap-3 shadow-xs">
              <div className="space-y-1">
                <span className="text-[10px] uppercase font-mono font-bold tracking-widest text-amber-700 block">
                  Subscription Countdown
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-black font-mono text-amber-900">
                    {daysRemaining} {daysRemaining === 1 ? 'Day' : 'Days'} Remaining
                  </span>
                </div>
                <p className="text-xs font-semibold text-amber-800">
                  Current Plan: <span className="font-extrabold">{planName}</span> (Expires {formattedExpiry})
                </p>
              </div>
              <div className="w-14 h-14 rounded-2xl bg-amber-100 border border-amber-300 flex flex-col items-center justify-center text-amber-800 shrink-0 shadow-inner">
                <Clock className="w-6 h-6 text-amber-600" />
                <span className="text-[9px] font-black uppercase font-mono mt-0.5">{daysRemaining}d left</span>
              </div>
            </div>

            {/* Role-specific Notice Message */}
            <div className="text-xs text-neutral-700 space-y-2.5 leading-relaxed bg-neutral-50 p-4 rounded-2xl border border-neutral-200/80">
              {isManager ? (
                <>
                  <p className="font-bold text-neutral-900">
                    ⚠️ Attention Manager ({currentUser?.name || 'Store Manager'}):
                  </p>
                  <p>
                    Your <span className="font-bold text-amber-700">{businessName}</span> subscription plan will expire in{' '}
                    <span className="font-extrabold text-amber-800 font-mono">{daysRemaining} day(s)</span> on{' '}
                    <span className="font-bold">{formattedExpiry}</span>.
                  </p>
                  <p className="text-neutral-600 font-medium">
                    When expired, <span className="font-bold text-red-600">all manager and cashier functions will be completely blocked</span> until a new subscription payment plan is activated.
                  </p>
                </>
              ) : (
                <>
                  <p className="font-bold text-neutral-900">
                    ⚠️ Attention Cashier ({currentUser?.name || 'Cashier'}):
                  </p>
                  <p>
                    Your store's subscription payment plan has only{' '}
                    <span className="font-extrabold text-amber-800 font-mono">{daysRemaining} day(s) remaining</span> (Expires {formattedExpiry}).
                  </p>
                  <p className="text-neutral-600 font-medium">
                    Please inform your Store Manager to renew the subscription plan now to avoid terminal service disruption.
                  </p>
                </>
              )}
            </div>

            {/* 30-Minute Timer Sign Notice */}
            <div className="flex items-center gap-2 bg-amber-100/60 border border-amber-200 px-3.5 py-2 rounded-xl text-[11px] text-amber-900 font-bold font-mono">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping shrink-0" />
              <span>Recurring Warning Sign: This notice will auto-appear every 30 minutes until renewed.</span>
            </div>

            {/* Action Buttons */}
            <div className="space-y-2.5 pt-1">
              {isManager && onOpenBillingModal && (
                <button
                  onClick={() => {
                    onClose();
                    onOpenBillingModal();
                  }}
                  className="w-full bg-[#00B87A] hover:bg-[#009E66] text-white py-3 rounded-2xl font-black text-xs uppercase font-mono shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-98"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Renew Subscription Plan Now</span>
                </button>
              )}

              {isManager && onOpenUploadReceiptModal && (
                <button
                  onClick={() => {
                    onClose();
                    onOpenUploadReceiptModal();
                  }}
                  className="w-full bg-white border border-neutral-300 hover:border-neutral-400 text-neutral-800 py-2.5 rounded-2xl font-bold text-xs uppercase font-mono shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
                >
                  <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                  <span>Upload Payment Receipt</span>
                </button>
              )}

              <WhatsAppSupportButton
                variant="full"
                userName={currentUser?.name}
                businessName={businessName}
                phone={currentUser?.phone}
                role={currentUser?.role}
                buttonText="Contact Support on WhatsApp"
              />

              <button
                onClick={onClose}
                className="w-full bg-neutral-100 hover:bg-neutral-200 text-neutral-700 py-2.5 rounded-2xl font-extrabold text-xs uppercase font-mono transition-colors cursor-pointer"
              >
                Dismiss Warning (Re-appears in 30 minutes)
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
