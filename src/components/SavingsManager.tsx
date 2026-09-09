import React, { useState, useMemo } from 'react';
import { User, ManagerSavings } from '../types';
import { 
  PiggyBank, 
  Plus, 
  Trash2, 
  MapPin, 
  Search, 
  Edit3, 
  X, 
  Save, 
  Coins, 
  User as UserIcon, 
  PlusCircle, 
  MinusCircle, 
  TrendingUp, 
  Wallet,
  Check
} from 'lucide-react';
import { formatNaira, generateId } from '../utils';

interface SavingsManagerProps {
  currentUser: User;
  managerSavings: ManagerSavings[];
  onAddSavings: (savings: ManagerSavings) => void;
  onUpdateSavings: (savings: ManagerSavings) => void;
  onDeleteSavings: (id: string) => void;
}

export function SavingsManager({
  currentUser,
  managerSavings,
  onAddSavings,
  onUpdateSavings,
  onDeleteSavings
}: SavingsManagerProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSavings, setEditingSavings] = useState<ManagerSavings | null>(null);
  
  // Form State - strictly ONLY Full Name, Area, Amount
  const [fullName, setFullName] = useState('');
  const [area, setArea] = useState('');
  const [amount, setAmount] = useState('');
  
  // Quick Adjustment Step State inside modal
  const [adjustmentStep, setAdjustmentStep] = useState<number>(1000);

  // Search Query State
  const [searchQuery, setSearchQuery] = useState('');

  // Open Modal for New Record
  const handleOpenAddModal = () => {
    setEditingSavings(null);
    setFullName('');
    setArea('');
    setAmount('');
    setIsModalOpen(true);
  };

  // Open Modal for Edit Record
  const handleOpenEditModal = (savings: ManagerSavings) => {
    setEditingSavings(savings);
    setFullName(savings.fullName);
    setArea(savings.area);
    setAmount(savings.amount.toString());
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingSavings(null);
    setFullName('');
    setArea('');
    setAmount('');
  };

  // Handle Amount Quick Increase / Decrease
  const handleAdjustAmount = (delta: number) => {
    const currentNum = parseFloat(amount) || 0;
    const newNum = Math.max(0, currentNum + delta);
    setAmount(newNum.toString());
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAmount = parseFloat(amount);
    if (!fullName.trim() || !area.trim() || isNaN(parsedAmount) || parsedAmount < 0) return;

    if (editingSavings) {
      const updated: ManagerSavings = {
        ...editingSavings,
        fullName: fullName.trim(),
        area: area.trim(),
        amount: parsedAmount,
        updatedAt: new Date().toISOString()
      };
      onUpdateSavings(updated);
    } else {
      const newRecord: ManagerSavings = {
        id: generateId(),
        fullName: fullName.trim(),
        area: area.trim(),
        amount: parsedAmount,
        managerId: currentUser.id,
        timestamp: new Date().toISOString()
      };
      onAddSavings(newRecord);
    }

    handleCloseModal();
  };

  // Quick Direct Increase / Decrease on Card
  const handleCardQuickAdjust = (savings: ManagerSavings, delta: number) => {
    const newAmount = Math.max(0, savings.amount + delta);
    onUpdateSavings({
      ...savings,
      amount: newAmount,
      updatedAt: new Date().toISOString()
    });
  };

  // Filtered List
  const filteredSavings = useMemo(() => {
    if (!searchQuery.trim()) return managerSavings;
    const q = searchQuery.toLowerCase();
    return managerSavings.filter(
      s => s.fullName.toLowerCase().includes(q) || s.area.toLowerCase().includes(q)
    );
  }, [managerSavings, searchQuery]);

  // Statistics
  const totalAmountSaved = useMemo(() => {
    return managerSavings.reduce((sum, s) => sum + (s.amount || 0), 0);
  }, [managerSavings]);

  const totalRecords = managerSavings.length;

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* HEADER SECTION */}
      <div className="bg-gradient-to-r from-emerald-900 via-teal-900 to-slate-900 text-white rounded-3xl p-6 md:p-8 shadow-xl border border-emerald-800/30">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 text-xs font-bold">
              <PiggyBank className="w-4 h-4 text-emerald-400" />
              <span>Manager Savings Vault</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-black tracking-tight">Savings Records</h1>
            <p className="text-emerald-200/80 text-xs md:text-sm max-w-xl">
              Record and manage manual savings allocations by Full Name and Area. Easily adjust or update amounts.
            </p>
          </div>

          <button
            onClick={handleOpenAddModal}
            className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black px-5 py-3.5 rounded-2xl shadow-lg hover:shadow-emerald-500/20 transition-all active:scale-95 flex items-center justify-center gap-2 text-sm shrink-0"
          >
            <Plus className="w-5 h-5 stroke-[3]" />
            <span>Record Savings</span>
          </button>
        </div>

        {/* METRICS SUMMARY */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-8 pt-6 border-t border-emerald-800/40">
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/10">
            <div className="flex items-center justify-between text-emerald-200 text-xs font-medium mb-1">
              <span>Total Recorded Savings</span>
              <Wallet className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-2xl font-black font-mono text-white tracking-tight">
              {formatNaira(totalAmountSaved)}
            </div>
          </div>

          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/10">
            <div className="flex items-center justify-between text-emerald-200 text-xs font-medium mb-1">
              <span>Total Savings Records</span>
              <PiggyBank className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-2xl font-black text-white tracking-tight">
              {totalRecords} {totalRecords === 1 ? 'Record' : 'Records'}
            </div>
          </div>

          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/10 sm:col-span-2 lg:col-span-1">
            <div className="flex items-center justify-between text-emerald-200 text-xs font-medium mb-1">
              <span>Manager Authority</span>
              <TrendingUp className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-sm font-bold text-emerald-100 truncate">
              {currentUser.name || currentUser.fullName || 'Manager'}
            </div>
            <div className="text-[10px] text-emerald-300/80">Direct Manual Entry</div>
          </div>
        </div>
      </div>

      {/* SEARCH AND CONTROL BAR */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-neutral-200 shadow-sm">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by Full Name or Area..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-neutral-50 border border-neutral-200 rounded-xl pl-10 pr-4 py-2 text-xs font-medium outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 transition-all"
          />
        </div>
        <div className="text-xs text-neutral-500 font-semibold self-end sm:self-center">
          Showing {filteredSavings.length} of {totalRecords} records
        </div>
      </div>

      {/* SAVINGS LIST */}
      {filteredSavings.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-dashed border-neutral-300 space-y-4">
          <div className="w-16 h-16 bg-emerald-50 rounded-2xl flex items-center justify-center mx-auto text-emerald-600">
            <PiggyBank className="w-8 h-8" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold text-neutral-800">No Savings Records Found</h3>
            <p className="text-xs text-neutral-500 max-w-sm mx-auto">
              {searchQuery ? 'No records matched your search query.' : 'Click "Record Savings" to add your first manual savings entry.'}
            </p>
          </div>
          {!searchQuery && (
            <button
              onClick={handleOpenAddModal}
              className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-2.5 rounded-xl text-xs transition-all shadow-md"
            >
              <Plus className="w-4 h-4" />
              <span>Record Savings Now</span>
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredSavings.map((savings) => (
            <div
              key={savings.id}
              className="bg-white rounded-2xl p-5 border border-neutral-200 shadow-sm hover:shadow-md transition-all space-y-4 flex flex-col justify-between"
            >
              <div className="space-y-3">
                {/* Header: Full Name & Area */}
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <UserIcon className="w-4 h-4 text-emerald-600 shrink-0" />
                      <h3 className="font-extrabold text-neutral-900 text-sm truncate">
                        {savings.fullName}
                      </h3>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-neutral-500">
                      <MapPin className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                      <span className="font-medium truncate">{savings.area}</span>
                    </div>
                  </div>

                  <span className="shrink-0 px-2.5 py-1 bg-emerald-50 text-emerald-700 font-bold text-[10px] rounded-full border border-emerald-200">
                    Savings
                  </span>
                </div>

                {/* Amount Display */}
                <div className="bg-neutral-50 rounded-xl p-3 border border-neutral-100 flex items-center justify-between">
                  <div>
                    <div className="text-[10px] text-neutral-400 uppercase font-black tracking-wider">Amount Saved</div>
                    <div className="text-lg font-black font-mono text-emerald-700">
                      {formatNaira(savings.amount)}
                    </div>
                  </div>

                  {/* Quick Adjust Buttons (+1,000 / -1,000) */}
                  <div className="flex items-center gap-1 bg-white p-1 rounded-lg border border-neutral-200 shadow-2xs">
                    <button
                      onClick={() => handleCardQuickAdjust(savings, -1000)}
                      className="p-1 text-rose-600 hover:bg-rose-50 rounded transition-colors"
                      title="Decrease ₦1,000"
                    >
                      <MinusCircle className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleCardQuickAdjust(savings, 1000)}
                      className="p-1 text-emerald-600 hover:bg-emerald-50 rounded transition-colors"
                      title="Increase ₦1,000"
                    >
                      <PlusCircle className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Timestamp */}
                <div className="text-[10px] text-neutral-400 font-mono">
                  Recorded: {new Date(savings.timestamp).toLocaleDateString()} {new Date(savings.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>

              {/* Actions Footer */}
              <div className="pt-3 border-t border-neutral-100 flex items-center justify-between gap-2">
                <button
                  onClick={() => handleOpenEditModal(savings)}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 px-3 bg-neutral-100 hover:bg-emerald-50 hover:text-emerald-700 text-neutral-700 rounded-xl font-bold text-xs transition-colors"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>Edit / Adjust</span>
                </button>

                <button
                  onClick={() => onDeleteSavings(savings.id)}
                  className="p-2 text-neutral-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors"
                  title="Delete Record"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* RECORD / EDIT SAVINGS MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-neutral-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 md:p-8 shadow-2xl border border-neutral-100 my-8 animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 mb-5 border-b border-neutral-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold">
                  <PiggyBank className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-neutral-900">
                    {editingSavings ? 'Edit Savings Record' : 'Record Savings'}
                  </h3>
                  <p className="text-xs text-neutral-500">
                    {editingSavings ? 'Update details or increase/decrease amount' : 'Enter details manually for new savings'}
                  </p>
                </div>
              </div>
              <button
                onClick={handleCloseModal}
                className="p-2 text-neutral-400 hover:text-neutral-600 rounded-full hover:bg-neutral-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form - STRICTLY FULL NAME, AREA, AMOUNT ONLY */}
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* 1. Full Name */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-neutral-800 flex items-center justify-between">
                  <span>Full Name *</span>
                  <span className="text-[10px] text-neutral-400 font-normal">Manual Entry</span>
                </label>
                <div className="relative">
                  <UserIcon className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Enter Full Name"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full bg-neutral-50 border border-neutral-200 rounded-xl pl-10 pr-3.5 py-2.5 text-xs font-semibold text-neutral-800 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 transition-all"
                    required
                  />
                </div>
              </div>

              {/* 2. Area */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-neutral-800 flex items-center justify-between">
                  <span>Area *</span>
                  <span className="text-[10px] text-neutral-400 font-normal">Location / Branch</span>
                </label>
                <div className="relative">
                  <MapPin className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="e.g. Maraba, Wuse, Kabusa"
                    value={area}
                    onChange={(e) => setArea(e.target.value)}
                    className="w-full bg-neutral-50 border border-neutral-200 rounded-xl pl-10 pr-3.5 py-2.5 text-xs font-semibold text-neutral-800 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 transition-all"
                    required
                  />
                </div>
              </div>

              {/* 3. Amount & Increase/Decrease Controls */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-neutral-800 flex items-center justify-between">
                  <span>Amount (₦) *</span>
                  <span className="text-[10px] text-emerald-600 font-bold">Editable / Increase or Decrease</span>
                </label>
                <div className="relative">
                  <Coins className="w-4 h-4 text-emerald-600 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="number"
                    step="any"
                    min="0"
                    placeholder="0.00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full bg-neutral-50 border border-neutral-200 rounded-xl pl-10 pr-3.5 py-2.5 text-sm font-black font-mono text-emerald-800 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 transition-all"
                    required
                  />
                </div>

                {/* Quick Increase / Decrease Preset Buttons */}
                <div className="bg-emerald-50/60 rounded-xl p-3 border border-emerald-100/80 space-y-2 mt-2">
                  <div className="text-[10px] font-extrabold text-emerald-900 uppercase tracking-wider">
                    Quick Amount Adjustment
                  </div>
                  <div className="grid grid-cols-4 gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleAdjustAmount(-5000)}
                      className="py-1.5 px-1 bg-white hover:bg-rose-50 text-rose-700 border border-neutral-200 rounded-lg text-[10px] font-bold transition-all"
                    >
                      -5,000
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAdjustAmount(-1000)}
                      className="py-1.5 px-1 bg-white hover:bg-rose-50 text-rose-700 border border-neutral-200 rounded-lg text-[10px] font-bold transition-all"
                    >
                      -1,000
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAdjustAmount(1000)}
                      className="py-1.5 px-1 bg-white hover:bg-emerald-100 text-emerald-800 border border-neutral-200 rounded-lg text-[10px] font-bold transition-all"
                    >
                      +1,000
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAdjustAmount(5000)}
                      className="py-1.5 px-1 bg-white hover:bg-emerald-100 text-emerald-800 border border-neutral-200 rounded-lg text-[10px] font-bold transition-all"
                    >
                      +5,000
                    </button>
                  </div>
                </div>
              </div>

              {/* Form Action Buttons */}
              <div className="pt-4 flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="flex-1 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 py-3 rounded-2xl font-bold text-xs transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!fullName.trim() || !area.trim() || !amount || isNaN(parseFloat(amount))}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white py-3 rounded-2xl font-extrabold text-xs shadow-md transition-all active:scale-95 flex items-center justify-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  <span>{editingSavings ? 'Update Savings' : 'Save Record'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
