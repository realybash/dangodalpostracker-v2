import React, { useState, useMemo } from 'react';
import { User, BranchLoan } from '../types';
import { Plus, Trash2, MapPin, Calendar, Landmark, Users, ArrowLeft, Save, Search, CheckCircle, RotateCcw } from 'lucide-react';
import { formatNaira, generateId } from '../utils';

interface LoanGroup {
  giverName: string;
  giverArea: string;
  loans: BranchLoan[];
  total: number;
}

interface BranchLoanManagerProps {
  currentUser: User;
  teamUsers: User[];
  branchLoans: BranchLoan[];
  onAddLoan: (loan: BranchLoan) => void;
  onUpdateLoan?: (loan: BranchLoan) => void;
  onDeleteLoan: (id: string) => void;
}

export function BranchLoanManager({ currentUser, teamUsers, branchLoans, onAddLoan, onUpdateLoan, onDeleteLoan }: BranchLoanManagerProps) {
  const [selectedGiverId, setSelectedGiverId] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  
  // Giver selection state for top-level Add (Manual Entry)
  const [addGiverName, setAddGiverName] = useState('');
  const [addGiverArea, setAddGiverArea] = useState('');
  
  // Receivers form state (Array for multiple)
  const [receivers, setReceivers] = useState([{ id: generateId(), name: '', area: '', amount: '' }]);
  const [searchQuery, setSearchQuery] = useState('');

  // Group loans by Giver Name
  const groupedLoans = useMemo(() => {
    const groups: Record<string, LoanGroup> = {};
    
    branchLoans.forEach(loan => {
      // Group by normalized name
      const key = loan.giverName.trim().toLowerCase();
      if (!groups[key]) {
        groups[key] = {
          giverName: loan.giverName, // preserve original casing
          giverArea: loan.giverArea,
          loans: [],
          total: 0
        };
      }
      groups[key].loans.push(loan);
      if (!loan.isPaid) {
        groups[key].total += loan.amount;
      }
    });
    
    return groups;
  }, [branchLoans]);

  const handleAddReceiverRow = () => {
    setReceivers([...receivers, { id: generateId(), name: '', area: '', amount: '' }]);
  };

  const handleRemoveReceiverRow = (id: string) => {
    if (receivers.length > 1) {
      setReceivers(receivers.filter(r => r.id !== id));
    }
  };

  const handleReceiverChange = (id: string, field: 'name' | 'area' | 'amount', value: string) => {
    setReceivers(receivers.map(r => r.id === id ? { ...r, [field]: value } : r));
  };

  const handleSave = () => {
    // Determine the giver's name and area depending on context (adding new giver vs adding to existing giver)
    let finalGiverName = '';
    let finalGiverArea = '';
    
    if (selectedGiverId && groupedLoans[selectedGiverId]) {
      // We are adding to an existing giver
      finalGiverName = groupedLoans[selectedGiverId].giverName;
      finalGiverArea = groupedLoans[selectedGiverId].giverArea;
    } else {
      // We are creating a new giver
      finalGiverName = addGiverName.trim();
      finalGiverArea = addGiverArea.trim();
    }

    if (!finalGiverName) return;

    // Filter out empty rows
    const validReceivers = receivers.filter(r => r.name.trim() && r.amount && !isNaN(Number(r.amount)));
    if (validReceivers.length === 0) return;

    // Create a loan for each valid receiver
    validReceivers.forEach(r => {
      const loan: BranchLoan = {
        id: generateId(),
        giverId: finalGiverName.toLowerCase(), // Use name as ID for grouping
        giverName: finalGiverName,
        giverArea: finalGiverArea || 'Unspecified',
        receiverName: r.name.trim(),
        receiverArea: r.area.trim() || 'Unspecified',
        amount: Number(r.amount),
        managerId: currentUser.id,
        timestamp: new Date().toISOString()
      };
      onAddLoan(loan);
    });

    // Reset Form
    setIsAdding(false);
    setReceivers([{ id: generateId(), name: '', area: '', amount: '' }]);
    setAddGiverName('');
    setAddGiverArea('');
  };

  const handleCancelAdding = () => {
    setIsAdding(false);
    setReceivers([{ id: generateId(), name: '', area: '', amount: '' }]);
    setAddGiverName('');
    setAddGiverArea('');
  };

  const currentGiverGroup = selectedGiverId ? groupedLoans[selectedGiverId] : null;

  const grandTotalLoans = useMemo(() => {
    return branchLoans.reduce((sum, loan) => sum + (loan.isPaid ? 0 : (loan.amount || 0)), 0);
  }, [branchLoans]);

  return (
    <div className="space-y-6">
      {!selectedGiverId ? (
        <>
          {/* Main Givers Overview */}
          <div className="bg-gradient-to-br from-amber-500 via-amber-600 to-amber-700 text-white rounded-3xl p-6 md:p-8 shadow-xl relative overflow-hidden flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
            <div className="absolute -bottom-10 -right-10 w-48 h-48 bg-white/10 rounded-full blur-2xl pointer-events-none" />
            
            <div>
              <span className="text-amber-100 text-xs font-mono font-bold uppercase tracking-widest block mb-1">Total Outstanding Branch Loans</span>
              <h2 className="text-3xl md:text-5xl font-black font-mono tracking-tight flex items-center gap-3">
                {formatNaira(grandTotalLoans)}
              </h2>
              <p className="text-sm text-amber-100 mt-2 flex items-center gap-2">
                <Users className="w-4 h-4" /> {Object.keys(groupedLoans).length} Active Givers Recorded
              </p>
            </div>
            
            <button
              onClick={() => {
                if (isAdding) {
                  handleCancelAdding();
                } else {
                  setIsAdding(true);
                }
              }}
              className="bg-white text-amber-700 hover:bg-amber-50 px-6 py-3 rounded-full font-bold shadow-lg transition-all active:scale-95 flex items-center gap-2 relative z-10 whitespace-nowrap"
            >
              {isAdding ? <ArrowLeft className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
              <span>{isAdding ? 'Cancel Entry' : 'Record New Loan'}</span>
            </button>
          </div>

          {isAdding && (
            <div className="bg-white rounded-3xl p-6 md:p-8 shadow-md border border-amber-100 animate-in slide-in-from-top-4 fade-in duration-300">
              <h3 className="text-lg font-bold text-neutral-800 mb-6">Record New Branch Loan</h3>
              
              <div className="space-y-8">
                {/* 1. Giver Details */}
                <div className="bg-amber-50/50 p-5 rounded-2xl border border-amber-100/50 space-y-4">
                  <label className="text-sm font-bold text-neutral-700 block border-b border-amber-200/60 pb-2 mb-2 flex items-center gap-2">
                    <span className="bg-amber-200 text-amber-800 w-6 h-6 rounded-full flex items-center justify-center text-xs">1</span> 
                    Giver Details (Manual Entry)
                  </label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-neutral-500">Giver Full Name</label>
                      <input
                        type="text"
                        value={addGiverName}
                        onChange={(e) => setAddGiverName(e.target.value)}
                        placeholder="Enter full name..."
                        className="w-full bg-white border border-neutral-200 rounded-2xl px-4 py-3 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200 transition-all font-medium"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-neutral-500">Giver Area (Optional)</label>
                      <div className="relative">
                        <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                        <input
                          type="text"
                          value={addGiverArea}
                          onChange={(e) => setAddGiverArea(e.target.value)}
                          placeholder="e.g. Lagos"
                          className="w-full bg-white border border-neutral-200 rounded-2xl pl-11 pr-4 py-3 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200 transition-all font-medium"
                        />
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* 2. Receiver Details */}
                <div className="space-y-4">
                  <label className="text-sm font-bold text-neutral-700 block border-b pb-2 mb-2 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="bg-neutral-200 text-neutral-700 w-6 h-6 rounded-full flex items-center justify-center text-xs">2</span>
                      Receivers List
                    </div>
                    <button
                      onClick={handleAddReceiverRow}
                      className="text-xs text-amber-600 font-bold hover:text-amber-700 flex items-center gap-1 bg-amber-50 px-3 py-1.5 rounded-lg"
                    >
                      <Plus className="w-3.5 h-3.5" /> Add Another Receiver
                    </button>
                  </label>
                  
                  <div className="space-y-4">
                    {receivers.map((receiver, index) => (
                      <div key={receiver.id} className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start relative bg-neutral-50/50 p-4 rounded-2xl border border-neutral-100">
                        {/* Remove button for multiple receivers */}
                        {receivers.length > 1 && (
                          <button 
                            onClick={() => handleRemoveReceiverRow(receiver.id)}
                            className="absolute -top-2 -right-2 bg-white text-rose-500 p-1.5 rounded-full shadow-sm border border-neutral-200 hover:bg-rose-50 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <div className="space-y-2 md:col-span-5">
                          <label className="text-xs font-bold text-neutral-500">Receiver Full Name</label>
                          <input
                            type="text"
                            value={receiver.name}
                            onChange={(e) => handleReceiverChange(receiver.id, 'name', e.target.value)}
                            placeholder="John Doe"
                            className="w-full bg-white border border-neutral-200 rounded-xl px-4 py-3 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200 transition-all font-medium"
                          />
                        </div>
                        
                        <div className="space-y-2 md:col-span-4">
                          <label className="text-xs font-bold text-neutral-500">Receiver Area</label>
                          <div className="relative">
                            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                            <input
                              type="text"
                              value={receiver.area}
                              onChange={(e) => handleReceiverChange(receiver.id, 'area', e.target.value)}
                              placeholder="e.g. Surulere"
                              className="w-full bg-white border border-neutral-200 rounded-xl pl-9 pr-4 py-3 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200 transition-all font-medium"
                            />
                          </div>
                        </div>

                        <div className="space-y-2 md:col-span-3">
                          <label className="text-xs font-bold text-neutral-500">Loan Amount (₦)</label>
                          <input
                            type="number"
                            value={receiver.amount}
                            onChange={(e) => handleReceiverChange(receiver.id, 'amount', e.target.value)}
                            placeholder="0.00"
                            className="w-full bg-white border border-neutral-200 rounded-xl px-4 py-3 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200 transition-all font-medium text-amber-600 font-bold"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                
                <div className="pt-4 flex justify-end">
                  <button
                    onClick={handleSave}
                    disabled={!addGiverName.trim() || receivers.every(r => !r.name.trim() || !r.amount)}
                    className="bg-amber-600 hover:bg-amber-700 text-white px-8 py-3.5 rounded-2xl font-bold shadow-md hover:shadow-lg transition-all active:scale-95 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed w-full sm:w-auto justify-center"
                  >
                    <Save className="w-5 h-5" />
                    <span>Save All Loan Records</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* List of Givers */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Object.keys(groupedLoans).length === 0 ? (
              <div className="col-span-full py-12 text-center bg-white rounded-3xl border border-dashed border-neutral-300">
                <Landmark className="w-12 h-12 text-neutral-300 mx-auto mb-3" />
                <p className="text-neutral-500 font-medium">No branch loans recorded yet.</p>
                <p className="text-sm text-neutral-400 mt-1">Click "Record New Loan" to start.</p>
              </div>
            ) : (
              (Object.entries(groupedLoans) as [string, LoanGroup][]).map(([giverKey, data]) => (
                <button
                  key={giverKey}
                  onClick={() => setSelectedGiverId(giverKey)}
                  className="bg-white rounded-3xl p-6 text-left shadow-sm border border-neutral-100 hover:shadow-md hover:border-amber-200 transition-all active:scale-[0.98] group flex flex-col justify-between"
                >
                  <div>
                    <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center mb-4 group-hover:bg-amber-100 transition-colors">
                      <Users className="w-6 h-6" />
                    </div>
                    <h3 className="font-bold text-lg text-neutral-800 line-clamp-1">{data.giverName}</h3>
                    <p className="text-sm text-neutral-500 flex items-center gap-1.5 mt-1">
                      <MapPin className="w-3.5 h-3.5" />
                      {data.giverArea}
                    </p>
                  </div>
                  
                  <div className="mt-6 pt-4 border-t border-neutral-100 flex items-end justify-between">
                    <div>
                      <p className="text-xs font-bold text-neutral-400 uppercase tracking-wider">Outstanding</p>
                      <p className="text-xl font-black text-amber-600 mt-0.5">{formatNaira(data.total)}</p>
                    </div>
                    <div className="text-xs font-bold text-neutral-400 bg-neutral-100 px-2 py-1 rounded-lg">
                      {data.loans.length} {data.loans.length === 1 ? 'Record' : 'Records'}
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </>
      ) : (
        <>
          {/* Detailed Giver View */}
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={() => {
                setSelectedGiverId(null);
                handleCancelAdding();
              }}
              className="flex items-center gap-2 text-neutral-500 hover:text-neutral-800 font-bold transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
              <span>Back to Portfolios</span>
            </button>
            <button
              onClick={() => {
                if (isAdding) {
                  handleCancelAdding();
                } else {
                  setIsAdding(true);
                }
              }}
              className="bg-amber-100 hover:bg-amber-200 text-amber-700 px-4 py-2 rounded-xl font-bold transition-all active:scale-95 flex items-center gap-2"
            >
              {isAdding ? <ArrowLeft className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
              <span>{isAdding ? 'Cancel' : 'Add Receivers'}</span>
            </button>
          </div>

          {currentGiverGroup && (
            <div className="bg-gradient-to-br from-neutral-800 to-neutral-900 text-white rounded-3xl p-6 md:p-8 shadow-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
              <div>
                <span className="text-neutral-400 text-xs font-mono font-bold uppercase tracking-widest block mb-1">Giver Portfolio</span>
                <h2 className="text-2xl md:text-3xl font-black">{currentGiverGroup.giverName}</h2>
                <p className="text-sm text-neutral-300 mt-2 flex items-center gap-2">
                  <MapPin className="w-4 h-4" /> {currentGiverGroup.giverArea}
                </p>
              </div>
              <div className="text-left md:text-right">
                <span className="text-neutral-400 text-xs font-bold uppercase tracking-wider block mb-1">Outstanding</span>
                <p className="text-3xl font-black text-amber-400 font-mono tracking-tight">
                  {formatNaira(currentGiverGroup.total)}
                </p>
              </div>
            </div>
          )}

          {isAdding && currentGiverGroup && (
            <div className="bg-white rounded-3xl p-6 md:p-8 shadow-md border border-amber-100 animate-in slide-in-from-top-4 fade-in duration-300">
              <h3 className="text-lg font-bold text-neutral-800 mb-6 flex items-center justify-between">
                <span>Add Receivers to {currentGiverGroup.giverName}'s Portfolio</span>
                <button
                  onClick={handleAddReceiverRow}
                  className="text-xs text-amber-600 font-bold hover:text-amber-700 flex items-center gap-1 bg-amber-50 px-3 py-1.5 rounded-lg"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Another Receiver
                </button>
              </h3>
              
              <div className="space-y-4">
                {receivers.map((receiver) => (
                  <div key={receiver.id} className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start relative bg-neutral-50/50 p-4 rounded-2xl border border-neutral-100">
                    {receivers.length > 1 && (
                      <button 
                        onClick={() => handleRemoveReceiverRow(receiver.id)}
                        className="absolute -top-2 -right-2 bg-white text-rose-500 p-1.5 rounded-full shadow-sm border border-neutral-200 hover:bg-rose-50 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <div className="space-y-2 md:col-span-5">
                      <label className="text-xs font-bold text-neutral-500">Receiver Full Name</label>
                      <input
                        type="text"
                        value={receiver.name}
                        onChange={(e) => handleReceiverChange(receiver.id, 'name', e.target.value)}
                        placeholder="Jane Doe"
                        className="w-full bg-white border border-neutral-200 rounded-xl px-4 py-3 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200 transition-all font-medium"
                      />
                    </div>
                    
                    <div className="space-y-2 md:col-span-4">
                      <label className="text-xs font-bold text-neutral-500">Receiver Area</label>
                      <div className="relative">
                        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                        <input
                          type="text"
                          value={receiver.area}
                          onChange={(e) => handleReceiverChange(receiver.id, 'area', e.target.value)}
                          placeholder="e.g. Surulere"
                          className="w-full bg-white border border-neutral-200 rounded-xl pl-9 pr-4 py-3 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200 transition-all font-medium"
                        />
                      </div>
                    </div>

                    <div className="space-y-2 md:col-span-3">
                      <label className="text-xs font-bold text-neutral-500">Loan Amount (₦)</label>
                      <input
                        type="number"
                        value={receiver.amount}
                        onChange={(e) => handleReceiverChange(receiver.id, 'amount', e.target.value)}
                        placeholder="0.00"
                        className="w-full bg-white border border-neutral-200 rounded-xl px-4 py-3 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200 transition-all font-medium text-amber-600 font-bold"
                      />
                    </div>
                  </div>
                ))}
              </div>
              
              <div className="mt-8 flex justify-end">
                <button
                  onClick={handleSave}
                  disabled={receivers.every(r => !r.name.trim() || !r.amount)}
                  className="bg-amber-600 hover:bg-amber-700 text-white px-8 py-3.5 rounded-2xl font-bold shadow-md hover:shadow-lg transition-all active:scale-95 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed w-full sm:w-auto justify-center"
                >
                  <Save className="w-5 h-5" />
                  <span>Save All Records</span>
                </button>
              </div>
            </div>
          )}

          {/* Receivers Table */}
          {currentGiverGroup && (
            <div className="bg-white rounded-3xl overflow-hidden shadow-sm border border-neutral-100">
              <div className="p-4 border-b border-neutral-100 flex items-center gap-2 bg-neutral-50/50">
                <Search className="w-4 h-4 text-neutral-400" />
                <input
                  type="text"
                  placeholder="Search receivers..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-transparent border-none outline-none text-sm font-medium w-full"
                />
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-neutral-50 border-b border-neutral-100 text-xs font-bold text-neutral-500 tracking-wider uppercase">
                      <th className="p-4 whitespace-nowrap">Date</th>
                      <th className="p-4 whitespace-nowrap">Receiver Name</th>
                      <th className="p-4 whitespace-nowrap">Receiver Area</th>
                      <th className="p-4 whitespace-nowrap">Amount</th>
                      <th className="p-4 whitespace-nowrap text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentGiverGroup.loans
                      .filter(l => l.receiverName.toLowerCase().includes(searchQuery.toLowerCase()))
                      .map(loan => (
                      <tr key={loan.id} className={`border-b border-neutral-50 transition-colors ${loan.isPaid ? 'bg-emerald-50/30 hover:bg-emerald-50/50 opacity-70' : 'hover:bg-neutral-50/50'}`}>
                        <td className="p-4 text-sm font-medium text-neutral-500 whitespace-nowrap">
                          {new Date(loan.timestamp).toLocaleDateString()}
                          {loan.isPaid && <span className="ml-2 text-xs font-bold text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded-md">PAID</span>}
                        </td>
                        <td className="p-4">
                          <div className={`font-bold ${loan.isPaid ? 'text-neutral-500 line-through' : 'text-neutral-800'}`}>{loan.receiverName}</div>
                        </td>
                        <td className="p-4">
                          <div className={`text-sm font-medium flex items-center gap-1 ${loan.isPaid ? 'text-neutral-400' : 'text-neutral-600'}`}>
                            <MapPin className="w-3 h-3 text-neutral-400" />
                            {loan.receiverArea}
                          </div>
                        </td>
                        <td className={`p-4 font-black ${loan.isPaid ? 'text-emerald-600' : 'text-amber-600'}`}>
                          {formatNaira(loan.amount)}
                        </td>
                        <td className="p-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => {
                                if (onUpdateLoan) {
                                  onUpdateLoan({ ...loan, isPaid: !loan.isPaid, paidAt: !loan.isPaid ? new Date().toISOString() : undefined });
                                }
                              }}
                              className={`p-2 rounded-xl transition-colors inline-flex ${loan.isPaid ? 'text-neutral-500 hover:bg-neutral-100' : 'text-emerald-600 hover:bg-emerald-50'}`}
                              title={loan.isPaid ? 'Undo Payback' : 'Mark as Paid'}
                            >
                              {loan.isPaid ? <RotateCcw className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
                            </button>
                            <button
                              onClick={() => onDeleteLoan(loan.id)}
                              className="p-2 text-rose-500 hover:bg-rose-50 rounded-xl transition-colors inline-flex"
                              title="Delete Record"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {currentGiverGroup.loans.length === 0 && (
                      <tr>
                        <td colSpan={5} className="p-8 text-center text-neutral-400 font-medium">
                          No loans found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
