import React, { useState } from 'react';
import { User, WeeklyProfit } from '../types';
import { Plus, Trash2, MapPin, Calendar, Check, Save, TrendingUp, Edit3, User as UserIcon } from 'lucide-react';
import { formatNaira, generateId } from '../utils';

interface WeeklyProfitManagerProps {
  currentUser: User;
  teamUsers: User[];
  weeklyProfits: WeeklyProfit[];
  onAddProfit: (profit: WeeklyProfit) => void;
  onUpdateProfit?: (profit: WeeklyProfit) => void;
  onDeleteProfit: (id: string) => void;
}

export function WeeklyProfitManager({ currentUser, teamUsers, weeklyProfits, onAddProfit, onUpdateProfit, onDeleteProfit }: WeeklyProfitManagerProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [editingRecord, setEditingRecord] = useState<WeeklyProfit | null>(null);
  const [cashierNameInput, setCashierNameInput] = useState('');
  const [amount, setAmount] = useState('');
  const [area, setArea] = useState('');

  const cashiers = teamUsers.filter(u => u.role === 'Employee');

  const handleStartEdit = (profitRecord: WeeklyProfit) => {
    setEditingRecord(profitRecord);
    setCashierNameInput(profitRecord.cashierName);
    setArea(profitRecord.areaOfWorking);
    setAmount(profitRecord.amount.toString());
    setIsAdding(true);
  };

  const handleCancel = () => {
    setIsAdding(false);
    setEditingRecord(null);
    setCashierNameInput('');
    setAmount('');
    setArea('');
  };

  const handleSave = () => {
    const trimmedName = cashierNameInput.trim();
    const parsedAmount = Number(amount);
    if (!trimmedName || !amount || isNaN(parsedAmount) || parsedAmount <= 0) return;

    const matchedCashier = cashiers.find(c => c.name.toLowerCase() === trimmedName.toLowerCase());

    if (editingRecord) {
      const updated: WeeklyProfit = {
        ...editingRecord,
        cashierName: trimmedName,
        cashierId: matchedCashier ? matchedCashier.id : editingRecord.cashierId,
        areaOfWorking: area.trim() || 'Unspecified',
        amount: parsedAmount,
      };
      if (onUpdateProfit) {
        onUpdateProfit(updated);
      } else {
        onAddProfit(updated);
      }
    } else {
      const profit: WeeklyProfit = {
        id: generateId(),
        cashierId: matchedCashier ? matchedCashier.id : generateId(),
        cashierName: trimmedName,
        areaOfWorking: area.trim() || (matchedCashier?.areaOfWorking) || 'Unspecified',
        amount: parsedAmount,
        managerId: currentUser.id,
        timestamp: new Date().toISOString()
      };
      onAddProfit(profit);
    }

    handleCancel();
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
          onClick={() => {
            if (isAdding) {
              handleCancel();
            } else {
              setIsAdding(true);
            }
          }}
          className="bg-white text-indigo-700 hover:bg-indigo-50 px-6 py-3.5 rounded-2xl font-extrabold shadow-lg transition-all active:scale-95 flex items-center gap-2 relative z-10 whitespace-nowrap"
        >
          {isAdding ? <Check className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
          <span>{isAdding ? 'Cancel Entry' : 'Record Profit'}</span>
        </button>
      </div>

      {isAdding && (
        <div className="bg-white rounded-3xl p-6 md:p-8 shadow-md border border-indigo-100 animate-in slide-in-from-top-4 fade-in duration-300">
          <h3 className="text-lg font-bold text-neutral-800 mb-6">
            {editingRecord ? 'Edit Weekly Profit Record' : 'Record New Weekly Profit'}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-bold text-neutral-700">Full Name</label>
              <div className="relative">
                <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400" />
                <input
                  type="text"
                  value={cashierNameInput}
                  onChange={(e) => setCashierNameInput(e.target.value)}
                  placeholder="Enter Cashier Full Name"
                  className="w-full bg-neutral-50 border border-neutral-200 rounded-2xl pl-12 pr-4 py-3 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all font-medium text-neutral-800"
                />
              </div>
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
                  className="w-full bg-neutral-50 border border-neutral-200 rounded-2xl pl-12 pr-4 py-3 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all font-medium text-neutral-800"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-bold text-neutral-700">Profit Amount (₦)</label>
              <input
                type="number"
                min="0"
                step="any"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="w-full bg-neutral-50 border border-neutral-200 rounded-2xl px-4 py-3 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all font-bold text-lg text-indigo-600"
              />
            </div>
          </div>
          
          <div className="mt-8 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={handleCancel}
              className="px-6 py-3 rounded-2xl font-bold text-neutral-600 hover:bg-neutral-100 transition-all"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!cashierNameInput.trim() || !amount || isNaN(Number(amount)) || Number(amount) <= 0}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-3 rounded-2xl font-bold shadow-md hover:shadow-lg transition-all active:scale-95 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save className="w-5 h-5" />
              <span>{editingRecord ? 'Update Record' : 'Save Record'}</span>
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
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => handleStartEdit(profit)}
                          className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-xl transition-colors inline-flex"
                          title="Edit Record"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => onDeleteProfit(profit.id)}
                          className="p-2 text-rose-500 hover:bg-rose-50 rounded-xl transition-colors inline-flex"
                          title="Delete Record"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
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
