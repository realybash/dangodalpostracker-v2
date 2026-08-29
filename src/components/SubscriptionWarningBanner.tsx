import React from 'react';
import { AlertTriangle, Clock, Sparkles } from 'lucide-react';
import { User } from '../types';

interface SubscriptionWarningBannerProps {
  daysRemaining: number | null;
  currentUser: User;
  onOpenBillingModal?: () => void;
}

export function SubscriptionWarningBanner({
  daysRemaining,
  currentUser,
  onOpenBillingModal
}: SubscriptionWarningBannerProps) {
  if (daysRemaining === null || daysRemaining > 7 || daysRemaining <= 0) {
    return null;
  }

  const isManager = currentUser?.role === 'Manager';

  return (
    <div className="bg-gradient-to-r from-amber-500 via-amber-600 to-orange-600 text-white p-3.5 px-4 rounded-2xl shadow-md border border-amber-400 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs font-mono animate-fade-in mb-4">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center shrink-0">
          <AlertTriangle className="w-5 h-5 text-amber-100 animate-bounce" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="font-black uppercase tracking-wider text-amber-100 text-[11px]">
              ⚠️ SUBSCRIPTION WARNING:
            </span>
            <span className="bg-white/20 text-white px-2 py-0.5 rounded-full text-[10px] font-black">
              {daysRemaining} {daysRemaining === 1 ? 'DAY' : 'DAYS'} REMAINING
            </span>
          </div>
          <p className="text-[11px] text-white/95 font-sans font-medium mt-0.5">
            {isManager 
              ? `Your subscription payment plan expires in ${daysRemaining} day(s). Renew now to prevent account blockage.`
              : `Store subscription expires in ${daysRemaining} day(s). Please remind your Manager to renew.`
            }
          </p>
        </div>
      </div>

      {isManager && onOpenBillingModal && (
        <button
          onClick={onOpenBillingModal}
          className="shrink-0 bg-white hover:bg-amber-50 text-amber-900 font-extrabold px-3.5 py-1.5 rounded-xl text-[11px] uppercase tracking-wider shadow-sm transition active:scale-95 cursor-pointer flex items-center gap-1.5"
        >
          <Sparkles className="w-3.5 h-3.5 text-amber-600" />
          <span>Renew Now</span>
        </button>
      )}
    </div>
  );
}
