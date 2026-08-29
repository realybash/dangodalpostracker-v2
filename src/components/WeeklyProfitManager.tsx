import React, { useState } from 'react';
import { User, WeeklyProfit } from '../types';
import { Plus, Trash2, MapPin, Calendar, Check, Save, TrendingUp } from 'lucide-react';
import { formatNaira, generateId } from '../utils';

interface WeeklyProfitManagerProps {
  currentUser: User;
  teamUsers: User[];
  weeklyProfits: WeeklyProfit[];
  onAddProfit: (profit: WeeklyProfit) => void;
  onDeleteProfit: (id: string) => void;
}

export function WeeklyProfitManager({ currentUser, teamUsers, weeklyProfits, onAddProfit, onDeleteProfit }: WeeklyProfitManagerProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [selectedCashier, setSelectedCashier] = useState('');
  const [amount, setAmount] = useState('');
  const [area, setArea] = useState('');

  const cashiers = teamUsers.filter(u => u.role === 'Employee');

  const handleCashierSelect = (id: string) => {
    setSelectedCashier(id);
    const cashier = cashiers.find(c => c.id === id);
    if (cashier) {
      setArea(cashier.areaOfWorking || '');
    } else {
      setArea('');
    }
  };

  const handleSave = () => {
    if (!selectedCashier || !amount || isNaN(Number(amount))) return;
    const cashier = cashiers.find(c => c.id === selectedCashier);
    if (!cashier) return;

    const profit: WeeklyProfit = {
      id: generateId(),
      cashierId: cashier.id,
      cashierName: cashier.name,
      areaOfWorking: area || cashier.areaOfWorking || 'Unspecified',
      amount: Number(amount),
      managerId: currentUser.id,
      timestamp: new Date().toISOString()
    };

    onAddProfit(profit);
    setIsAdding(false);
    setSelectedCashier('');
    setAmount('');
    setArea('');
  };

  // Calculate total profit
  const totalProfit = weeklyProfits.reduce((sum, record) => sum + record.amount, 0);

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-br from-indigo-500 via-indigo-600 to-indigo-800 text-white rounded-3xl p-6 md:p-8 shadow-xl relative overflow-hidden flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="absolute -bottom-10 -right-10 w-48 h-48 bg-white/10 rounded-full blur-2xl pointer-events-none" />
        
        <div>
          <span className="text-indigo-100 text-xs font-mono font-bold uppercase tracking-widest block mb-1">Total Accumulated Profit</span>
          <h2 className="text-4xl md:text-5xl font-black font-mono tracking-tight">{formatNaira(totalProfit)}</h2>
          <p className="text-sm text-indigo-200 mt-2 flex items-center gap-2">
            <TrendingUp className="w-4 h-4" /> Based on {weeklyProfits.length} recorded entries
          </p>
        </div>
        
        <button
          onClick={() => setIsAdding(!isAdding)}
          className="bg-white text-indigo-700 hover:bg-indigo-50 px-6 py-3 rounded-full font-bold shadow-lg transition-all active:scale-95 flex items-center gap-2 relative z-10 whitespace-nowrap"
        >
          {isAdding ? <Check className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
          <span>{isAdding ? 'Cancel Entry' : 'Record Profit'}</span>
        </button>
      </div>

      {isAdding && (
        <div className="bg-white rounded-3xl p-6 md:p-8 shadow-md border border-indigo-100 animate-in slide-in-from-top-4 fade-in duration-300">
          <h3 className="text-lg font-bold text-neutral-800 mb-6">Record New Weekly Profit</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-bold text-neutral-700">Full Name</label>
              <select
                value={selectedCashier}
                onChange={(e) => handleCashierSelect(e.target.value)}
                className="w-full bg-neutral-50 border border-neutral-200 rounded-2xl px-4 py-3 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all font-medium"
              >
                <option value="">-- Choose Cashier --</option>
                {cashiers.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-bold text-neutral-700">Area</label>
              <div className="relative">
                <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400" />
                <input
                  type="text"
                  value={area}
                  onChange={(e) => setArea(e.target.value)}
                  placeholder="e.g. Ikeja"
                  className="w-full bg-neutral-50 border border-neutral-200 rounded-2xl pl-12 pr-4 py-3 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all font-medium"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-bold text-neutral-700">Profit Amount (₦)</label>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="w-full bg-neutral-50 border border-neutral-200 rounded-2xl px-4 py-3 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all font-medium text-lg"
              />
            </div>
          </div>
          
          <div className="mt-8 flex justify-end">
            <button
              onClick={handleSave}
              disabled={!selectedCashier || !amount || isNaN(Number(amount))}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-3 rounded-2xl font-bold shadow-md hover:shadow-lg transition-all active:scale-95 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save className="w-5 h-5" />
              <span>Save Record</span>
            </button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-3xl overflow-hidden shadow-sm border border-neutral-100">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-neutral-50 border-b border-neutral-100 text-sm font-bold text-neutral-500 tracking-wider">
                <th className="p-4 whitespace-nowrap">Date</th>
                <th className="p-4 whitespace-nowrap">Full Name</th>
                <th className="p-4 whitespace-nowrap">Area</th>
                <th className="p-4 whitespace-nowrap">Profit Amount</th>
                <th className="p-4 whitespace-nowrap text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {weeklyProfits.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-neutral-400 font-medium">
                    No profit records found. Click "Record Profit" to start.
                  </td>
                </tr>
              ) : (
                weeklyProfits.map(profit => (
                  <tr key={profit.id} className="border-b border-neutral-50 hover:bg-neutral-50/50 transition-colors">
                    <td className="p-4 text-sm font-medium text-neutral-600 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-neutral-400" />
                        {new Date(profit.timestamp).toLocaleDateString()}
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="font-bold text-neutral-800">{profit.cashierName}</div>
                    </td>
                    <td className="p-4">
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-neutral-100 text-neutral-600 text-xs font-bold">
                        <MapPin className="w-3 h-3" />
                        {profit.areaOfWorking}
                      </div>
                    </td>
                    <td className="p-4 font-black text-indigo-600 text-lg">
                      {formatNaira(profit.amount)}
                    </td>
                    <td className="p-4 text-right">
                      <button
                        onClick={() => onDeleteProfit(profit.id)}
                        className="p-2 text-rose-500 hover:bg-rose-50 rounded-xl transition-colors inline-flex"
                        title="Delete Record"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
