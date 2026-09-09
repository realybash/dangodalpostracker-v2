import React, { useState, useMemo } from 'react';
import { User, CapitalAllocation } from '../types';
import { Plus, Trash2, MapPin, Calendar, Check, Save, Users, Coins, User as UserIcon, TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight, Edit3 } from 'lucide-react';
import { formatNaira, generateId } from '../utils';

interface CapitalManagerProps {
  currentUser: User;
  teamUsers: User[];
  capitalAllocations: CapitalAllocation[];
  onAddAllocation: (allocation: CapitalAllocation) => void;
  onUpdateAllocation?: (allocation: CapitalAllocation) => void;
  onDeleteAllocation: (id: string) => void;
}

export function CapitalManager({ currentUser, teamUsers, capitalAllocations, onAddAllocation, onUpdateAllocation, onDeleteAllocation }: CapitalManagerProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [editingRecord, setEditingRecord] = useState<CapitalAllocation | null>(null);
  const [allocationType, setAllocationType] = useState<'Increase' | 'Decrease'>('Increase');
  const [cashierNameInput, setCashierNameInput] = useState('');
  const [amount, setAmount] = useState('');
  const [area, setArea] = useState('');

  const cashiers = teamUsers.filter(u => u.role === 'Employee');

  const totalCapital = useMemo(() => {
    return capitalAllocations.reduce((sum, item) => {
      const isDecrease = item.type === 'Decrease';
      const val = Math.abs(item.amount || 0);
      return sum + (isDecrease ? -val : val);
    }, 0);
  }, [capitalAllocations]);

  const uniqueCashiersCount = useMemo(() => {
    const set = new Set(capitalAllocations.map(a => a.cashierId || a.cashierName));
    return set.size;
  }, [capitalAllocations]);

  const handleStartEdit = (alloc: CapitalAllocation) => {
    setEditingRecord(alloc);
    setCashierNameInput(alloc.cashierName);
    setArea(alloc.areaOfWorking);
    setAmount(alloc.amount.toString());
    setAllocationType(alloc.type || 'Increase');
    setIsAdding(true);
  };

  const handleCancel = () => {
    setIsAdding(false);
    setEditingRecord(null);
    setCashierNameInput('');
    setAmount('');
    setArea('');
    setAllocationType('Increase');
  };

  const handleSave = () => {
    const trimmedName = cashierNameInput.trim();
    const parsedAmount = Number(amount);
    if (!trimmedName || !amount || isNaN(parsedAmount) || parsedAmount <= 0) return;

    const matchedCashier = cashiers.find(c => c.name.toLowerCase() === trimmedName.toLowerCase());

    if (editingRecord) {
      const updated: CapitalAllocation = {
        ...editingRecord,
        cashierName: trimmedName,
        cashierId: matchedCashier ? matchedCashier.id : editingRecord.cashierId,
        areaOfWorking: area.trim() || 'Unspecified',
        amount: parsedAmount,
        type: allocationType,
      };
      if (onUpdateAllocation) {
        onUpdateAllocation(updated);
      } else {
        onAddAllocation(updated);
      }
    } else {
      const allocation: CapitalAllocation = {
        id: generateId(),
        cashierId: matchedCashier ? matchedCashier.id : generateId(),
        cashierName: trimmedName,
        areaOfWorking: area.trim() || (matchedCashier?.areaOfWorking) || 'Unspecified',
        amount: parsedAmount,
        type: allocationType,
        managerId: currentUser.id,
        timestamp: new Date().toISOString()
      };
      onAddAllocation(allocation);
    }

    handleCancel();
  };

  return (
    <div className="space-y-6">
      {/* Top Banner showing Total Capital Given */}
      <div className="bg-gradient-to-r from-emerald-600 to-teal-700 rounded-3xl p-6 md:p-8 text-white shadow-lg relative overflow-hidden flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="absolute -bottom-10 -right-10 w-48 h-48 bg-white/10 rounded-full blur-2xl pointer-events-none" />
        
        <div>
          <span className="text-emerald-100 text-xs font-mono font-bold uppercase tracking-widest block mb-1">
            Total Cashiers Net Capital Balance
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
          onClick={() => {
            if (isAdding) {
              handleCancel();
            } else {
              setIsAdding(true);
            }
          }}
          className="bg-white text-emerald-800 hover:bg-emerald-50 px-6 py-3.5 rounded-2xl font-extrabold shadow-md hover:shadow-lg transition-all active:scale-95 flex items-center gap-2 self-stretch md:self-auto justify-center"
        >
          {isAdding ? <Check className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
          <span>{isAdding ? 'Cancel' : 'Manage Capital'}</span>
        </button>
      </div>

      {isAdding && (
        <div className="bg-white rounded-3xl p-6 md:p-8 shadow-md border border-emerald-100 animate-in slide-in-from-top-4 fade-in duration-300">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 pb-4 border-b border-neutral-100">
            <div>
              <h3 className="text-lg font-bold text-neutral-800">
                {editingRecord ? 'Edit Capital Record' : 'Record Cashier Capital'}
              </h3>
              <p className="text-xs text-neutral-500 font-medium">
                {editingRecord ? 'Update capital allocation details' : 'Enter capital details manually and choose to increase or decrease'}
              </p>
            </div>

            {/* Type Selector: Increase vs Decrease */}
            <div className="flex items-center gap-2 bg-neutral-100 p-1 rounded-2xl w-full sm:w-auto">
              <button
                type="button"
                onClick={() => setAllocationType('Increase')}
                className={`flex-1 sm:flex-none px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
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
                className={`flex-1 sm:flex-none px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
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
                  className="w-full bg-neutral-50 border border-neutral-200 rounded-2xl pl-12 pr-4 py-3 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 transition-all font-medium text-neutral-800"
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
                  placeholder="e.g. Ikeja, Lagos"
                  className="w-full bg-neutral-50 border border-neutral-200 rounded-2xl pl-12 pr-4 py-3 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 transition-all font-medium text-neutral-800"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-bold text-neutral-700">Amount (₦)</label>
              <input
                type="number"
                min="0"
                step="any"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className={`w-full bg-neutral-50 border border-neutral-200 rounded-2xl px-4 py-3 outline-none focus:ring-2 transition-all font-bold text-lg ${
                  allocationType === 'Decrease'
                    ? 'focus:border-rose-500 focus:ring-rose-200 text-rose-600'
                    : 'focus:border-emerald-500 focus:ring-emerald-200 text-emerald-600'
                }`}
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
              className={`px-8 py-3 rounded-2xl font-bold text-white shadow-md hover:shadow-lg transition-all active:scale-95 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed ${
                allocationType === 'Decrease'
                  ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-200'
                  : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-200'
              }`}
            >
              <Save className="w-5 h-5" />
              <span>
                {editingRecord
                  ? 'Update Capital Record'
                  : allocationType === 'Decrease'
                  ? 'Save Capital Reduction (-)'
                  : 'Save Capital Increase (+)'}
              </span>
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
                <th className="p-4 whitespace-nowrap">Action Type</th>
                <th className="p-4 whitespace-nowrap">Area</th>
                <th className="p-4 whitespace-nowrap">Amount</th>
                <th className="p-4 whitespace-nowrap text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {capitalAllocations.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-neutral-400 font-medium">
                    No capital records found. Click "Manage Capital" to record.
                  </td>
                </tr>
              ) : (
                capitalAllocations.map(alloc => {
                  const isDecrease = alloc.type === 'Decrease';
                  return (
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
                        {isDecrease ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-200">
                            <ArrowDownRight className="w-3.5 h-3.5" />
                            Decrease
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                            <ArrowUpRight className="w-3.5 h-3.5" />
                            Increase
                          </span>
                        )}
                      </td>
                      <td className="p-4">
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-neutral-100 text-neutral-600 text-xs font-bold">
                          <MapPin className="w-3 h-3" />
                          {alloc.areaOfWorking}
                        </div>
                      </td>
                      <td className={`p-4 font-black ${isDecrease ? 'text-rose-600' : 'text-emerald-600'}`}>
                        {isDecrease ? `- ${formatNaira(alloc.amount)}` : `+ ${formatNaira(alloc.amount)}`}
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => handleStartEdit(alloc)}
                            className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-xl transition-colors inline-flex"
                            title="Edit Record"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => onDeleteAllocation(alloc.id)}
                            className="p-2 text-rose-500 hover:bg-rose-50 rounded-xl transition-colors inline-flex"
                            title="Delete Record"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
            {capitalAllocations.length > 0 && (
              <tfoot>
                <tr className="bg-emerald-50/50 border-t-2 border-emerald-100 font-bold text-neutral-800">
                  <td colSpan={4} className="p-4 text-right uppercase text-xs tracking-wider text-neutral-500 font-mono">
                    Total Net Capital Balance:
                  </td>
                  <td className={`p-4 font-black text-lg ${totalCapital < 0 ? 'text-rose-700' : 'text-emerald-700'}`}>
                    {formatNaira(totalCapital)}
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}

