/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { formatNaira } from '../utils';
import { motion } from 'motion/react';
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Calendar, 
  Activity, 
  Sparkles,
  ChevronRight,
  Plus,
  Coins,
  FileCheck
} from 'lucide-react';
import { t } from '../i18n';

interface MetricCardsProps {
  profit: number;
  volume: number;
  totalExpenses: number;
  count: number;
  averageTxSize: number;
  timeframe: 'Daily' | 'Weekly' | 'Monthly' | 'Yearly';
  dailyTarget: number;
  onSetDailyTarget: (newTarget: number) => void;
  onOpenAddModal: () => void;
  isManager?: boolean;
  language: 'en' | 'ha';
}

export const MetricCards = React.memo(({
  profit,
  volume,
  totalExpenses,
  count,
  averageTxSize,
  timeframe,
  dailyTarget,
  onSetDailyTarget,
  onOpenAddModal,
  isManager = true,
  language
}: MetricCardsProps) => {
  const [editingTarget, setEditingTarget] = useState(false);
  const [targetInputValue, setTargetInputValue] = useState(dailyTarget.toString());

  const handleSaveTarget = () => {
    const val = parseFloat(targetInputValue);
    if (!isNaN(val) && val >= 0) {
      onSetDailyTarget(val);
      setEditingTarget(false);
    }
  };

  const isDaily = timeframe === 'Daily';
  // Net profit is Gross Profit - Expenses
  const netProfit = profit - totalExpenses;
  const progressPercent = dailyTarget > 0 ? Math.min((netProfit / dailyTarget) * 100, 100) : 0;
  
  return (
    <div className="space-y-4">
      {/* Dynamic Segment Header Call-out */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white border border-neutral-100 p-3 rounded-2xl gap-3 shadow-sm">
        <div>
          <span className="text-[8px] font-black text-[#00B87A] uppercase tracking-[0.2em] flex items-center gap-1 font-mono">
            <Sparkles className="w-2.5 h-2.5 animate-pulse" /> {isManager ? 'Analytics' : 'Performance'}
          </span>
          <h2 className="text-base font-black text-neutral-900 tracking-tight">
            {isManager ? `${timeframe} Ledger` : 'My Tracker'}
          </h2>
          <p className="text-[9px] text-neutral-400 mt-0.5 font-bold font-mono uppercase tracking-wider">
            {count} RECEIPTS
          </p>
        </div>
        <button
          onClick={onOpenAddModal}
          className="w-full sm:w-auto bg-[#00B87A] hover:bg-emerald-600 text-white font-black px-4 py-2 rounded-lg flex items-center justify-center gap-1.5 text-[10px] uppercase tracking-widest shadow-lg shadow-emerald-500/5 active:scale-95 transition-all cursor-pointer font-mono"
        >
          <Plus className="w-3 h-3 stroke-[4]" />
          Record Receipt
        </button>
      </div>

      {/* Grid of Financial Metrics */}
      {isManager ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          
          {/* Net Profit Core Block (Vibrant Light Emerald) */}
          <div className="relative overflow-hidden bg-white border border-neutral-100 p-3 rounded-xl shadow-sm transition-all hover:border-emerald-200 group">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[7px] font-black text-neutral-400 uppercase tracking-widest font-mono">
                {t('Net Profit', language)}
              </span>
              <div className="p-1.5 bg-emerald-50 text-emerald-600 rounded-md transition-colors group-hover:bg-emerald-100">
                <DollarSign className="w-3 h-3 stroke-[2.5]" />
              </div>
            </div>
            <h3 className="text-base font-black font-mono text-emerald-600 tracking-tighter">
              {formatNaira(netProfit)}
            </h3>
            <div className="flex items-center gap-1 mt-1 text-[7px] text-emerald-500 font-black uppercase tracking-wider font-mono">
              <TrendingUp className="w-2.5 h-2.5" />
              <span>Net Gains</span>
            </div>
          </div>

          {/* Volume Metric Card */}
          <div className="bg-white border border-neutral-100 p-3 rounded-xl shadow-sm hover:border-blue-100 transition-all group">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[7px] font-black text-neutral-400 uppercase tracking-widest font-mono">
                Aggr. Volume
              </span>
              <div className="p-1.5 bg-blue-50 text-blue-600 rounded-md transition-colors group-hover:bg-blue-100">
                <Activity className="w-3 h-3" />
              </div>
            </div>
            <h3 className="text-base font-black font-mono text-neutral-900 tracking-tighter">
              {formatNaira(volume)}
            </h3>
            <div className="flex items-center gap-1 mt-1 text-[7px] text-blue-500 font-black uppercase tracking-wider font-mono">
              <span>Dynamic Inflow</span>
            </div>
          </div>

          {/* Operating POS Expenses Card */}
          <div className="bg-white border border-neutral-100 p-3 rounded-xl shadow-sm hover:border-orange-100 transition-all group">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[7px] font-black text-neutral-400 uppercase tracking-widest font-mono">
                Expenses
              </span>
              <div className="p-1.5 bg-orange-50 text-orange-600 rounded-md transition-colors group-hover:bg-orange-100">
                <TrendingDown className="w-3 h-3" />
              </div>
            </div>
            <h3 className="text-base font-black font-mono text-orange-600 tracking-tighter">
              {formatNaira(totalExpenses)}
            </h3>
            <div className="flex items-center gap-1 mt-1 text-[7px] text-orange-500 font-black uppercase tracking-wider font-mono">
              <span>Baseline Cut</span>
            </div>
          </div>

          {/* Avg Receipt Size Card */}
          <div className="bg-white border border-neutral-100 p-3 rounded-xl shadow-sm hover:border-purple-100 transition-all group">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[7px] font-black text-neutral-400 uppercase tracking-widest font-mono">
                Avg. Ticket
              </span>
              <div className="p-1.5 bg-purple-50 text-purple-600 rounded-md transition-colors group-hover:bg-purple-100">
                <Coins className="w-3 h-3" />
              </div>
            </div>
            <h3 className="text-base font-black font-mono text-neutral-900 tracking-tighter">
              {formatNaira(averageTxSize)}
            </h3>
            <div className="flex items-center gap-1 mt-1 text-[7px] text-purple-500 font-black uppercase tracking-wider font-mono">
              <span>{count} records</span>
            </div>
          </div>

        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Shift Volume Card for Employee */}
          <div className="bg-white border-2 border-emerald-500 p-5 rounded-3xl shadow-sm relative overflow-hidden">
            <div className="absolute -right-6 -bottom-6 w-24 h-24 bg-emerald-50 rounded-full pointer-events-none" />
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold text-neutral-400 uppercase tracking-wider font-mono">
                My Shift Transacted Volume
              </span>
              <span className="p-2.5 bg-[#00B87A] text-white rounded-2xl shadow-sm shadow-emerald-500/10">
                <Activity className="w-5 h-5 stroke-[2.5]" />
              </span>
            </div>
            <div className="mt-5 relative z-10">
              <h3 className="text-2xl md:text-3xl font-black font-mono text-[#00B87A] tracking-tight">
                {formatNaira(volume)}
              </h3>
              <div className="text-[11px] text-neutral-500 font-medium mt-1">
                Total aggregate successful and pending transfers processed on your account.
              </div>
            </div>
          </div>

          {/* Receipt Volume/Count Card */}
          <div className="bg-white border border-neutral-100 p-5 rounded-3xl shadow-sm hover:border-neutral-350 transition-all border-neutral-200">
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold text-neutral-400 uppercase tracking-wider font-mono">
                My Printed Receipts
              </span>
              <span className="p-2.5 bg-neutral-100 text-[#00B87A] rounded-2xl">
                <FileCheck className="w-5 h-5" />
              </span>
            </div>
            <div className="mt-5">
              <h3 className="text-2xl md:text-3xl font-black font-mono text-neutral-800 tracking-tight">
                {count} Slips
              </h3>
              <div className="text-[11px] text-neutral-500 font-medium mt-1">
                Your transaction count recorded securely under your employee profile.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Daily Profit Target Ring Progress & Dashboard Sliders */}
      {isManager && (
        <div className="bg-white border border-neutral-100 p-6 rounded-[2rem] shadow-sm space-y-5">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="space-y-1">
              <h4 className="text-sm font-black text-neutral-900 flex items-center gap-2 font-mono uppercase tracking-tight">
                <span>🎯 Employee Performance Goal</span>
                {isDaily && (
                  <span className="bg-emerald-50 text-emerald-600 text-[9px] px-2.5 py-1 rounded-lg font-black uppercase tracking-wider border border-emerald-100/50">
                    Active
                  </span>
                )}
              </h4>
              <p className="text-[11px] text-neutral-400 font-black uppercase tracking-widest font-mono">
                Operational Benchmark: <span className="text-[#00B87A]">{formatNaira(dailyTarget)}</span>
              </p>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
              {editingTarget ? (
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 text-xs font-black font-mono">₦</span>
                    <input
                      type="number"
                      value={targetInputValue}
                      onChange={(e) => setTargetInputValue(e.target.value)}
                      className="bg-neutral-50 border border-neutral-200 text-neutral-900 font-mono text-xs rounded-xl pl-7 pr-3 py-2.5 w-32 focus:outline-none focus:border-[#00B87A] font-black"
                      placeholder="2000"
                      autoFocus
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleSaveTarget}
                    className="bg-[#00B87A] hover:bg-emerald-600 text-white font-black px-4 py-2.5 rounded-xl text-xs cursor-pointer shadow-md shadow-emerald-500/10 font-mono uppercase tracking-wider"
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setTargetInputValue(dailyTarget.toString());
                      setEditingTarget(false);
                    }}
                    className="bg-neutral-50 hover:bg-neutral-100 text-neutral-500 border border-neutral-100 px-4 py-2.5 rounded-xl text-xs cursor-pointer font-black font-mono uppercase tracking-wider"
                  >
                    ×
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setEditingTarget(true)}
                  className="w-full sm:w-auto text-[10px] text-neutral-500 hover:text-neutral-900 bg-neutral-50 hover:bg-neutral-100 border border-neutral-100 px-4 py-2.5 rounded-xl font-black transition cursor-pointer uppercase tracking-widest font-mono"
                >
                  Set New Benchmark
                </button>
              )}
            </div>
          </div>

          {/* Progress Bar Container */}
          <div className="space-y-3">
            <div className="flex justify-between text-[10px] font-mono font-black uppercase tracking-[0.1em]">
              <span className="text-neutral-400">Current Progress: <strong className="text-neutral-900">{progressPercent.toFixed(1)}%</strong></span>
              <span className="text-[#00B87A]">{formatNaira(profit)} / {formatNaira(dailyTarget)}</span>
            </div>
            
            <div className="relative h-2 bg-neutral-50 rounded-full overflow-hidden border border-neutral-100 shadow-inner">
              <div 
                style={{ width: `${progressPercent}%` }}
                className="h-full bg-gradient-to-r from-[#00B87A] via-emerald-400 to-teal-400 rounded-full transition-all duration-700 ease-out shadow-sm shadow-emerald-500/20"
              />
            </div>

            <div className="flex justify-between items-center">
              <span className="text-[9px] text-neutral-300 font-black font-mono uppercase tracking-widest">Baseline: ₦0.00</span>
              {progressPercent >= 100 ? (
                <motion.span 
                  className="text-[10px] text-emerald-600 font-black flex items-center gap-2 font-mono uppercase tracking-widest"
                  animate={{
                    opacity: [0.7, 1, 0.7],
                  }}
                  transition={{
                    duration: 3,
                    repeat: Infinity,
                    ease: "easeInOut"
                  }}
                >
                  <Sparkles className="w-3 h-3" /> Target Achieved
                </motion.span>
              ) : (
                <span className="text-[10px] text-neutral-400 font-black font-mono uppercase tracking-widest italic">
                  Need <strong className="text-neutral-700 font-black">{formatNaira(Math.max(dailyTarget - profit, 0))}</strong> remaining
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
});
