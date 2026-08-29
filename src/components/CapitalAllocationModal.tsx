import React, { useState } from 'react';
import { User, CapitalAllocation } from '../types';
import { X, MapPin, Banknote, Save } from 'lucide-react';
import { generateId } from '../utils';

interface CapitalAllocationModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User;
  teamUsers: User[];
  onSave: (allocation: CapitalAllocation) => void;
}

export function CapitalAllocationModal({ isOpen, onClose, currentUser, teamUsers, onSave }: CapitalAllocationModalProps) {
  const [selectedCashier, setSelectedCashier] = useState('');
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [area, setArea] = useState('');

  if (!isOpen) return null;

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCashier || !amount || isNaN(Number(amount))) return;
    const cashier = cashiers.find(c => c.id === selectedCashier);
    if (!cashier) return;

    const allocation: CapitalAllocation = {
      id: generateId(),
      cashierId: cashier.id,
      cashierName: cashier.name,
      areaOfWorking: area || cashier.areaOfWorking || 'Unspecified',
      amount: Number(amount),
      managerId: currentUser.id,
      timestamp: new Date().toISOString(),
      notes
    };

    onSave(allocation);
    setSelectedCashier('');
    setAmount('');
    setNotes('');
    setArea('');
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
              <h2 className="text-lg font-black text-neutral-800">Record Capital</h2>
              <p className="text-xs text-neutral-500 font-medium">Allocate working capital to a cashier</p>
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
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-neutral-600 uppercase tracking-wider">Full Name</label>
            <select
              required
              value={selectedCashier}
              onChange={(e) => handleCashierSelect(e.target.value)}
              className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-3 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 transition-all font-medium text-neutral-800"
            >
              <option value="">-- Select Cashier --</option>
              {cashiers.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
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
              className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-3 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 transition-all font-bold text-xl text-emerald-600"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-neutral-600 uppercase tracking-wider">Notes (Optional)</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Morning shift float..."
              className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-3 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 transition-all font-medium text-neutral-800"
            />
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={!selectedCashier || !amount || isNaN(Number(amount))}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-3.5 rounded-xl font-bold shadow-md shadow-emerald-200 hover:shadow-lg transition-all active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save className="w-5 h-5" />
              <span>Save Allocation</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
