import React, { useState, useMemo } from 'react';
import { User, CapitalAllocation } from '../types';
import { Plus, Trash2, MapPin, Calendar, Check, Save, Users, Coins } from 'lucide-react';
import { formatNaira, generateId } from '../utils';

interface CapitalManagerProps {
  currentUser: User;
  teamUsers: User[];
  capitalAllocations: CapitalAllocation[];
  onAddAllocation: (allocation: CapitalAllocation) => void;
  onDeleteAllocation: (id: string) => void;
}

export function CapitalManager({ currentUser, teamUsers, capitalAllocations, onAddAllocation, onDeleteAllocation }: CapitalManagerProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [selectedCashier, setSelectedCashier] = useState('');
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [area, setArea] = useState('');

  const cashiers = teamUsers.filter(u => u.role === 'Employee');

  const totalCapital = useMemo(() => {
    return capitalAllocations.reduce((sum, item) => sum + (item.amount || 0), 0);
  }, [capitalAllocations]);

  const uniqueCashiersCount = useMemo(() => {
    const set = new Set(capitalAllocations.map(a => a.cashierId || a.cashierName));
    return set.size;
  }, [capitalAllocations]);

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

    onAddAllocation(allocation);
    setIsAdding(false);
    setSelectedCashier('');
    setAmount('');
    setNotes('');
    setArea('');
  };

  return (
    <div className="space-y-6">
      {/* Top Banner showing Total Capital Given */}
      <div className="bg-gradient-to-r from-emerald-600 to-teal-700 rounded-3xl p-6 md:p-8 text-white shadow-lg relative overflow-hidden flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="absolute -bottom-10 -right-10 w-48 h-48 bg-white/10 rounded-full blur-2xl pointer-events-none" />
        
        <div>
          <span className="text-emerald-100 text-xs font-mono font-bold uppercase tracking-widest block mb-1">
            Total Cashiers' Capital Given
          </span>
          <h2 className="text-3xl md:text-5xl font-black font-mono tracking-tight flex items-center gap-3">
            <Coins className="w-8 h-8 md:w-10 md:h-10 opacity-90" />
            {formatNaira(totalCapital)}
          </h2>
          <p className="text-sm text-emerald-100 mt-2 flex items-center gap-2 font-medium">
            <Users className="w-4 h-4" /> {uniqueCashiersCount} Cashier{uniqueCashiersCount === 1 ? '' : 's'} • {capitalAllocations.length} Allocation Record{capitalAllocations.length === 1 ? '' : 's'}
          </p>
        </div>

        <button
          onClick={() => setIsAdding(!isAdding)}
          className="bg-white text-emerald-800 hover:bg-emerald-50 px-6 py-3.5 rounded-2xl font-extrabold shadow-md hover:shadow-lg transition-all active:scale-95 flex items-center gap-2 self-stretch md:self-auto justify-center"
        >
          {isAdding ? <Check className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
          <span>{isAdding ? 'Cancel' : 'Add Capital'}</span>
        </button>
      </div>

      {isAdding && (
        <div className="bg-white rounded-3xl p-6 md:p-8 shadow-md border border-emerald-100 animate-in slide-in-from-top-4 fade-in duration-300">
          <h3 className="text-lg font-bold text-neutral-800 mb-6">Record New Capital Given</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-bold text-neutral-700">Select Cashier (Full Name)</label>
              <select
                value={selectedCashier}
                onChange={(e) => handleCashierSelect(e.target.value)}
                className="w-full bg-neutral-50 border border-neutral-200 rounded-2xl px-4 py-3 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 transition-all font-medium"
              >
                <option value="">-- Choose a Cashier --</option>
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
                  placeholder="e.g. Ikeja, Lagos"
                  className="w-full bg-neutral-50 border border-neutral-200 rounded-2xl pl-12 pr-4 py-3 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 transition-all font-medium"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-bold text-neutral-700">Amount (₦)</label>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="w-full bg-neutral-50 border border-neutral-200 rounded-2xl px-4 py-3 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 transition-all font-medium text-lg"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-bold text-neutral-700">Notes (Optional)</label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="E.g. Morning shift float"
                className="w-full bg-neutral-50 border border-neutral-200 rounded-2xl px-4 py-3 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 transition-all font-medium"
              />
            </div>
          </div>
          
          <div className="mt-8 flex justify-end">
            <button
              onClick={handleSave}
              disabled={!selectedCashier || !amount || isNaN(Number(amount))}
              className="bg-neutral-900 hover:bg-black text-white px-8 py-3 rounded-2xl font-bold shadow-md hover:shadow-lg transition-all active:scale-95 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
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
                <th className="p-4 whitespace-nowrap">Amount Given</th>
                <th className="p-4 whitespace-nowrap">Notes</th>
                <th className="p-4 whitespace-nowrap text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {capitalAllocations.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-neutral-400 font-medium">
                    No capital records found. Click "Add Capital" to record.
                  </td>
                </tr>
              ) : (
                capitalAllocations.map(alloc => (
                  <tr key={alloc.id} className="border-b border-neutral-50 hover:bg-neutral-50/50 transition-colors">
                    <td className="p-4 text-sm font-medium text-neutral-600 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-neutral-400" />
                        {new Date(alloc.timestamp).toLocaleDateString()}
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="font-bold text-neutral-800">{alloc.cashierName}</div>
                    </td>
                    <td className="p-4">
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-neutral-100 text-neutral-600 text-xs font-bold">
                        <MapPin className="w-3 h-3" />
                        {alloc.areaOfWorking}
                      </div>
                    </td>
                    <td className="p-4 font-black text-emerald-600">
                      {formatNaira(alloc.amount)}
                    </td>
                    <td className="p-4 text-sm text-neutral-500">
                      {alloc.notes || '-'}
                    </td>
                    <td className="p-4 text-right">
                      <button
                        onClick={() => onDeleteAllocation(alloc.id)}
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
            {capitalAllocations.length > 0 && (
              <tfoot>
                <tr className="bg-emerald-50/50 border-t-2 border-emerald-100 font-bold text-neutral-800">
                  <td colSpan={3} className="p-4 text-right uppercase text-xs tracking-wider text-neutral-500 font-mono">
                    Total Capital Given:
                  </td>
                  <td className="p-4 font-black text-emerald-700 text-lg">
                    {formatNaira(totalCapital)}
                  </td>
                  <td colSpan={2}></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}

