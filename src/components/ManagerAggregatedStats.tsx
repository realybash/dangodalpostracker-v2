import React, { useMemo } from 'react';
import { motion } from 'motion/react';
import { formatNaira } from '../utils';
import { Sparkles, Users, Award, TrendingUp, DollarSign, Activity, Calendar } from 'lucide-react';
import { Transaction, User } from '../types';

interface ManagerAggregatedStatsProps {
  transactions: Transaction[];
  registeredUsers: User[];
}

export function ManagerAggregatedStats({ transactions, registeredUsers }: ManagerAggregatedStatsProps) {
  const isToday = (timestamp: string) => {
    const d = new Date(timestamp);
    const today = new Date();
    return (
      d.getDate() === today.getDate() &&
      d.getMonth() === today.getMonth() &&
      d.getFullYear() === today.getFullYear()
    );
  };

  // Compute daily cashier-by-cashier breakdown
  const cashierStats = useMemo(() => {
    // We only care about transactions performed today
    const todayTxs = transactions.filter(tx => isToday(tx.timestamp));

    // Calculate aggregated metrics for each registered cashier / employee
    const statsMap = registeredUsers.map(user => {
      const userTxs = todayTxs.filter(tx => tx.employeeId === user.id);
      const volume = userTxs.reduce((sum, tx) => sum + tx.amount, 0);
      const profit = userTxs.reduce((sum, tx) => sum + tx.profit, 0);
      const count = userTxs.length;

      return {
        id: user.id,
        name: user.name,
        role: user.role,
        phone: user.phone || 'No phone',
        volume,
        profit,
        count,
        hasActivity: count > 0,
      };
    });

    // Sort active users to the top, then by profit desc
    return statsMap.sort((a, b) => b.profit - a.profit);
  }, [transactions, registeredUsers]);

  // Compute overall totals for today
  const grandTotals = useMemo(() => {
    const todayTxs = transactions.filter(tx => isToday(tx.timestamp));
    const volume = todayTxs.reduce((sum, tx) => sum + (tx.amount || 0), 0);
    const profit = todayTxs.reduce((sum, tx) => sum + (tx.profit || 0), 0);
    const count = todayTxs.length;
    
    const customerCharges = todayTxs.reduce((sum, tx) => sum + (tx.customerCharge || tx.customerFee || 0), 0);
    const providerCharges = todayTxs.reduce((sum, tx) => sum + (tx.providerCharge || tx.terminalFee || 0), 0);
    const regulatoryFees = todayTxs.reduce((sum, tx) => sum + (tx.cbnCharge || 0), 0);
    const totalFees = providerCharges + regulatoryFees;
    const vat = todayTxs.reduce((sum, tx) => sum + (tx.vatAmount || 0), 0);
    const cashback = todayTxs.reduce((sum, tx) => sum + (tx.cashback || 0), 0);
    
    const typeBreakdown = todayTxs.reduce((acc, tx) => {
      if (!acc[tx.type]) acc[tx.type] = { profit: 0, count: 0 };
      acc[tx.type].profit += tx.netProfit || tx.agentProfit || tx.profit || 0;
      acc[tx.type].count += 1;
      return acc;
    }, {} as Record<string, { profit: number, count: number }>);

    return { volume, profit, count, customerCharges, providerCharges, regulatoryFees, totalFees, vat, cashback, typeBreakdown };
  }, [transactions]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      id="manager-cashier-overview-card"
      className="bg-white border border-neutral-50 p-4 rounded-3xl shadow-sm space-y-4"
    >
      {/* Card Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-neutral-50 pb-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-[#00B87A]/5 flex items-center justify-center">
            <Users className="w-4.5 h-4.5 text-[#00B87A]" />
          </div>
          <div>
            <h3 className="text-[9px] font-black text-emerald-600 uppercase tracking-[0.2em] flex items-center gap-1.5 font-mono">
              <Sparkles className="w-2.5 h-2.5 animate-pulse" /> Moniepoint Hub
            </h3>
            <h2 className="text-base font-black text-neutral-900 tracking-tight mt-0.5">
              Ledger Distribution Center
            </h2>
          </div>
        </div>
        <div className="text-right">
          <span className="text-[9px] font-mono font-black bg-neutral-50 text-neutral-400 border border-neutral-100 px-2.5 py-1 rounded-lg uppercase tracking-wider">
            {new Date().toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
          </span>
        </div>
      </div>

      {/* Financial Overview Matrix */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-neutral-50/50 p-3 rounded-xl border border-neutral-100">
          <p className="text-[8px] font-black text-neutral-400 uppercase tracking-widest font-mono mb-1">Total Charges</p>
          <p className="text-sm font-black text-neutral-900 font-mono">{formatNaira(grandTotals.customerCharges)}</p>
        </div>
        <div className="bg-red-50/50 p-3 rounded-xl border border-red-100/50">
          <p className="text-[8px] font-black text-red-400 uppercase tracking-widest font-mono mb-1">Provider Fees</p>
          <p className="text-sm font-black text-red-800 font-mono">{formatNaira(grandTotals.totalFees)}</p>
        </div>
        <div className="bg-blue-50/50 p-3 rounded-xl border border-blue-100/50">
          <p className="text-[8px] font-black text-blue-400 uppercase tracking-widest font-mono mb-1">Cashback earned</p>
          <p className="text-sm font-black text-blue-800 font-mono">{formatNaira(grandTotals.cashback)}</p>
        </div>
        <div className="bg-emerald-50/50 p-3 rounded-xl border border-emerald-100/50">
          <p className="text-[8px] font-black text-emerald-500 uppercase tracking-widest font-mono mb-1">Net Agent Profit</p>
          <p className="text-sm font-black text-emerald-800 font-mono">{formatNaira(grandTotals.profit)}</p>
        </div>
      </div>

      {/* Transaction Type Profits */}
      <div className="flex flex-wrap gap-1.5 pt-1">
        {(Object.entries(grandTotals.typeBreakdown) as [string, { profit: number; count: number }][]).map(([type, data]) => (
          <div key={type} className="flex items-center gap-1.5 bg-neutral-50/50 px-2.5 py-1.5 rounded-xl border border-neutral-100">
            <span className="text-[9px] font-black text-neutral-400 uppercase tracking-wider font-mono">{type}</span>
            <span className="text-[10px] font-black text-neutral-900 font-mono">{formatNaira(data.profit)}</span>
            <span className="text-[8px] font-mono font-bold text-[#00B87A] bg-[#00B87A]/5 px-1 py-0.5 rounded-md">{data.count}</span>
          </div>
        ))}
      </div>

      {/* Cashier List Details Table / Cards */}
      <div className="space-y-3 pt-2">
        <span className="text-[10px] font-mono font-bold tracking-widest text-neutral-450 uppercase block">
          Cashier Performance:
        </span>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {cashierStats.map((cashier) => {
            const contributionPercent =
              grandTotals.profit > 0 ? (cashier.profit / grandTotals.profit) * 100 : 0;

            return (
              <div
                key={cashier.id}
                className={`p-3 rounded-2xl border transition-all ${
                  cashier.hasActivity
                    ? 'bg-white border-neutral-100 shadow-sm hover:border-emerald-200'
                    : 'bg-neutral-50/70 border-neutral-100 opacity-75'
                }`}
              >
                <div className="flex items-center justify-between gap-2.5">
                  <div className="flex items-center gap-3 min-w-0">
                    {/* Rounded Initial */}
                    <div
                      className={`w-8 h-8 rounded-xl flex items-center justify-center font-black text-xs select-none shrink-0 ${
                        cashier.hasActivity
                          ? 'bg-[#00B87A] text-white shadow-md shadow-emerald-500/10'
                          : 'bg-neutral-100 text-neutral-400'
                      }`}
                    >
                      {cashier.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <h4 className="text-[11px] font-black text-neutral-900 truncate leading-tight">
                          {cashier.name}
                        </h4>
                        <span
                          className={`text-[7px] font-mono font-black px-1.5 py-0.5 rounded-md uppercase tracking-wider ${
                            cashier.role === 'Manager'
                              ? 'bg-neutral-900 text-white shadow-sm'
                              : 'bg-neutral-100 text-neutral-500 border border-neutral-200/30'
                          }`}
                        >
                          {cashier.role}
                        </span>
                      </div>
                      <span className="text-[8px] text-neutral-400 font-bold font-mono leading-none mt-0.5 block">
                        ID: {cashier.id.slice(0, 6)}...
                      </span>
                    </div>
                  </div>

                  {/* Status Pulse */}
                  <div className="flex items-center gap-1.5 font-mono select-none shrink-0">
                    <span
                      className={`w-1 h-1 rounded-full ${
                        cashier.hasActivity ? 'bg-[#00B87A] animate-pulse' : 'bg-neutral-300'
                      }`}
                    />
                    <span className="text-[9px] font-black text-neutral-600">
                      {cashier.count} tx{cashier.count === 1 ? '' : 's'}
                    </span>
                  </div>
                </div>

                {/* Performance Figures Row */}
                <div className="grid grid-cols-2 gap-2 mt-3 border-t border-neutral-50 pt-3 text-[11px]">
                  <div>
                    <span className="text-[7px] text-neutral-400 uppercase font-black tracking-widest block mb-0.5 font-mono">Volume</span>
                    <span className="font-mono font-black text-neutral-900">
                      {formatNaira(cashier.volume)}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-[7px] text-neutral-400 uppercase font-black tracking-widest block mb-0.5 font-mono">Profit</span>
                    <span className="font-mono font-black text-[#00B87A]">
                      {formatNaira(cashier.profit)}
                    </span>
                  </div>
                </div>

                {/* Mini Progress Contribution Bar */}
                {cashier.hasActivity && (
                  <div className="mt-3 space-y-1.5">
                    <div className="flex justify-between text-[8px] font-mono font-black uppercase tracking-wider text-neutral-400">
                      <span>CTR</span>
                      <span className="text-emerald-600">{contributionPercent.toFixed(0)}%</span>
                    </div>
                    <div className="w-full h-1 bg-neutral-50 rounded-full overflow-hidden border border-neutral-100">
                      <div
                        style={{ width: `${contributionPercent}%` }}
                        className="h-full bg-gradient-to-r from-[#00B87A] to-emerald-400 rounded-full shadow-sm shadow-emerald-500/20"
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}
