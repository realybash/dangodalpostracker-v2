import React, { useState } from 'react';
import { User, CapitalAllocation } from '../types';
import { X, MapPin, Banknote, Save, User as UserIcon, TrendingUp, TrendingDown } from 'lucide-react';
import { generateId } from '../utils';

interface CapitalAllocationModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User;
  teamUsers: User[];
  onSave: (allocation: CapitalAllocation) => void;
}

export function CapitalAllocationModal({ isOpen, onClose, currentUser, teamUsers, onSave }: CapitalAllocationModalProps) {
  const [allocationType, setAllocationType] = useState<'Increase' | 'Decrease'>('Increase');
  const [cashierNameInput, setCashierNameInput] = useState('');
  const [amount, setAmount] = useState('');
  const [area, setArea] = useState('');

  if (!isOpen) return null;

  const cashiers = teamUsers.filter(u => u.role === 'Employee');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = cashierNameInput.trim();
    const parsedAmount = Number(amount);
    if (!trimmedName || !amount || isNaN(parsedAmount) || parsedAmount <= 0) return;

    const matchedCashier = cashiers.find(c => c.name.toLowerCase() === trimmedName.toLowerCase());

    const allocation: CapitalAllocation = {
      id: generateId(),
      cashierId: matchedCashier ? matchedCashier.id : generateId(),
      cashierName: trimmedName,
      areaOfWorking: area.trim() || 'Unspecified',
      amount: parsedAmount,
      type: allocationType,
      managerId: currentUser.id,
      timestamp: new Date().toISOString()
    };

    onSave(allocation);
    setCashierNameInput('');
    setAmount('');
    setArea('');
    setAllocationType('Increase');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-neutral-900/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md relative z-10 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="p-6 border-b border-neutral-100 flex justify-between items-center bg-gradient-to-r from-emerald-50 to-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
              <Banknote className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-black text-neutral-800">Adjust Cashier Capital</h2>
              <p className="text-xs text-neutral-500 font-medium">Increase or decrease cashier working capital</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-neutral-100 hover:bg-neutral-200 text-neutral-500 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Action Type Selector */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-neutral-600 uppercase tracking-wider">Action Type</label>
            <div className="flex items-center gap-2 bg-neutral-100 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setAllocationType('Increase')}
                className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                  allocationType === 'Increase'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-neutral-600 hover:text-neutral-900'
                }`}
              >
                <TrendingUp className="w-4 h-4" />
                Increase Capital (+)
              </button>
              <button
                type="button"
                onClick={() => setAllocationType('Decrease')}
                className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                  allocationType === 'Decrease'
                    ? 'bg-rose-600 text-white shadow-sm'
                    : 'text-neutral-600 hover:text-neutral-900'
                }`}
              >
                <TrendingDown className="w-4 h-4" />
                Decrease Capital (-)
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-neutral-600 uppercase tracking-wider">Full Name</label>
            <div className="relative">
              <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
              <input
                required
                type="text"
                value={cashierNameInput}
                onChange={(e) => setCashierNameInput(e.target.value)}
                placeholder="Type Cashier Full Name"
                className="w-full bg-neutral-50 border border-neutral-200 rounded-xl pl-11 pr-4 py-3 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 transition-all font-medium text-neutral-800"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-neutral-600 uppercase tracking-wider">Area</label>
            <div className="relative">
              <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
              <input
                required
                type="text"
                value={area}
                onChange={(e) => setArea(e.target.value)}
                placeholder="e.g. Ikeja, Lagos"
                className="w-full bg-neutral-50 border border-neutral-200 rounded-xl pl-11 pr-4 py-3 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 transition-all font-medium text-neutral-800"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-neutral-600 uppercase tracking-wider">Amount (₦)</label>
            <input
              required
              type="number"
              min="0"
              step="any"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className={`w-full bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-3 outline-none focus:ring-2 transition-all font-bold text-xl ${
                allocationType === 'Decrease'
                  ? 'focus:border-rose-500 focus:ring-rose-200 text-rose-600'
                  : 'focus:border-emerald-500 focus:ring-emerald-200 text-emerald-600'
              }`}
            />
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={!cashierNameInput.trim() || !amount || isNaN(Number(amount)) || Number(amount) <= 0}
              className={`w-full py-3.5 rounded-xl font-bold text-white shadow-md hover:shadow-lg transition-all active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed ${
                allocationType === 'Decrease'
                  ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-200'
                  : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-200'
              }`}
            >
              <Save className="w-5 h-5" />
              <span>{allocationType === 'Decrease' ? 'Save Reduction (-)' : 'Save Increase (+)'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
