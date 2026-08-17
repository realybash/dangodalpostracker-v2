import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Upload, 
  Camera, 
  FileText, 
  X, 
  CheckCircle2, 
  Clock, 
  ShieldCheck, 
  Sparkles, 
  AlertCircle, 
  Trash2, 
  RotateCw, 
  CreditCard,
  Building2,
  Phone,
  User as UserIcon,
  Check
} from 'lucide-react';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { User } from '../types';

interface UploadReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User;
  showAppNotification?: (msg: string, type?: 'success' | 'error' | 'info') => void;
  onSuccess?: () => void;
  initialPlan?: 'Starter' | 'Professional' | 'Business' | 'Enterprise';
}

const PLANS = [
  { name: 'Starter' as const, price: 2000, desc: 'Ideal for single cashier kiosk. Daily reports and cloud backup included.' },
  { name: 'Professional' as const, price: 5000, desc: 'Up to 5 cashiers, full audit ledger, detailed metrics & automatic reconciliations.' },
  { name: 'Business' as const, price: 10000, desc: 'Unlimited cashiers & terminals, voice guidance system, and priority live chat support.' },
  { name: 'Enterprise' as const, price: 25000, desc: 'Full custom bank channels, dedicated support, and multi-branch audit logs' }
];

export function UploadReceiptModal({
  isOpen,
  onClose,
  currentUser,
  showAppNotification,
  onSuccess,
  initialPlan = 'Professional'
}: UploadReceiptModalProps) {
  const [selectedPlan, setSelectedPlan] = useState<'Starter' | 'Professional' | 'Business' | 'Enterprise'>(initialPlan);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptBase64, setReceiptBase64] = useState<string>('');
  const [submittedAmount, setSubmittedAmount] = useState<string>('');
  const [paymentMemo, setPaymentMemo] = useState<string>('');
  const [customRef, setCustomRef] = useState<string>(`TRX-${Math.random().toString(36).substring(2, 8).toUpperCase()}`);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const currentPlanObj = PLANS.find(p => p.name === selectedPlan) || PLANS[1];

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 8 * 1024 * 1024) {
      setErrorMsg('File size exceeds 8MB. Please select a smaller receipt image.');
      return;
    }

    setErrorMsg('');
    setReceiptFile(file);

    const reader = new FileReader();
    reader.onloadend = () => {
      setReceiptBase64(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleClearFile = () => {
    setReceiptFile(null);
    setReceiptBase64('');
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (cameraInputRef.current) cameraInputRef.current.value = '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!receiptBase64) {
      setErrorMsg('Please attach or capture a payment receipt proof before submitting.');
      return;
    }

    const ownerId = currentUser?.role === 'Manager' ? currentUser.id : currentUser?.ownerId;
    if (!ownerId) {
      setErrorMsg('Owner identity missing. Please re-login.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');

    try {
      const actualAmount = parseFloat(submittedAmount);
      if (isNaN(actualAmount) || actualAmount !== currentPlanObj.price) {
        const error = `Exact Payment Required: You uploaded ₦${submittedAmount || '0'}, but the ${currentPlanObj.name} plan costs ₦${currentPlanObj.price.toLocaleString()}. Please upload the exact payment receipt.`;
        setErrorMsg(error);
        setIsSubmitting(false);
        if (showAppNotification) showAppNotification(error, 'error');
        return;
      }

      const payId = `pay_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const finalRef = customRef.trim() || `REF-${Date.now()}`;

      const newPayment = {
        id: payId,
        ownerId: ownerId,
        customerName: currentUser.name || currentUser.fullName || 'POS Merchant',
        businessName: currentUser.fullName || 'OPay Merchant Shop',
        phoneNumber: currentUser.phone || currentUser.phoneNumber || 'N/A',
        plan: selectedPlan,
        amount: currentPlanObj.price,
        reference: finalRef,
        notes: paymentMemo.trim() || 'Direct bank transfer receipt proof uploaded.',
        receiptUrl: receiptBase64,
        receiptFileName: receiptFile?.name || 'payment_receipt.png',
        receiptFileType: receiptFile?.type || 'image/png',
        status: 'Pending Review',
        paymentDate: new Date().toISOString(),
        timestamp: new Date().toISOString()
      };

      // 1. Save to subscription_payments
      await setDoc(doc(db, 'subscription_payments', payId), newPayment);

      // 2. Save document attachment details to payment_receipts
      await setDoc(doc(db, 'payment_receipts', payId), {
        id: payId,
        paymentId: payId,
        fileData: receiptBase64,
        fileName: receiptFile?.name || 'receipt.png',
        fileType: receiptFile?.type || 'image/png',
        timestamp: new Date().toISOString()
      });

      // 3. Set subscription status to 'Pending Review'
      await setDoc(doc(db, 'subscriptions', ownerId), {
        plan: selectedPlan || 'Starter',
        status: 'Pending Review',
        lastPaymentReference: finalRef,
        lastReceiptUrl: receiptBase64,
        updatedAt: new Date().toISOString()
      }, { merge: true });

      if (showAppNotification) {
        showAppNotification('Payment proof uploaded successfully! Submitted for Administrator review.', 'success');
      }

      if (onSuccess) {
        onSuccess();
      }

      onClose();
    } catch (err: any) {
      console.error('Failed to upload payment receipt:', err);
      setErrorMsg(err?.message || 'Failed to submit payment receipt. Please check network connection.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatNaira = (val: number) => {
    return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(val);
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ type: 'spring', damping: 25 }}
          className="bg-neutral-50 border border-neutral-200 shadow-2xl rounded-3xl w-full max-w-xl max-h-[90vh] flex flex-col overflow-hidden text-neutral-800"
        >
          {/* Header */}
          <div className="px-6 py-4 bg-white border-b border-neutral-200 flex justify-between items-center shrink-0">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-emerald-50 rounded-2xl text-[#00B87A] border border-emerald-100">
                <Upload className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-black tracking-tight text-neutral-800">Upload Payment Proof</h3>
                <p className="text-[11px] text-neutral-500 font-medium">
                  Submit bank transfer receipt for manual verification
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-neutral-100 rounded-full transition text-neutral-400 hover:text-neutral-600 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Form Body */}
          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
            {errorMsg && (
              <div className="p-3 bg-red-50 border border-red-200/80 rounded-2xl text-xs text-red-700 font-semibold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Plan Selector */}
            <div className="space-y-2">
              <label className="text-xs font-extrabold uppercase tracking-wider text-neutral-500 font-mono block">
                1. Select Subscription Plan
              </label>
              <div className="grid grid-cols-2 gap-2">
                {PLANS.map(plan => (
                  <button
                    key={plan.name}
                    type="button"
                    onClick={() => setSelectedPlan(plan.name)}
                    className={`p-3 rounded-2xl border text-left transition cursor-pointer relative ${
                      selectedPlan === plan.name
                        ? 'bg-emerald-50/80 border-[#00B87A] shadow-xs'
                        : 'bg-white border-neutral-200/80 hover:border-neutral-300'
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <span className="text-xs font-black text-neutral-800 font-mono">{plan.name}</span>
                      {selectedPlan === plan.name && (
                        <CheckCircle2 className="w-4 h-4 text-[#00B87A]" />
                      )}
                    </div>
                    <span className="text-sm font-black text-[#00B87A] block font-mono mt-1">
                      {formatNaira(plan.price)} <span className="text-[10px] text-neutral-400 font-normal">/ mo</span>
                    </span>
                    <span className="text-[10px] text-neutral-500 block truncate mt-0.5">
                      {plan.desc}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Receipt Media Upload Box */}
            <div className="space-y-2">
              <label className="text-xs font-extrabold uppercase tracking-wider text-neutral-500 font-mono block">
                2. Attach Payment Receipt Image / File
              </label>

              {/* Hidden Inputs */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,application/pdf"
                onChange={handleFileSelect}
                className="hidden"
              />
              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleFileSelect}
                className="hidden"
              />

              {receiptBase64 ? (
                <div className="bg-white border-2 border-emerald-500/40 rounded-2xl p-4 flex flex-col items-center justify-center relative group">
                  {receiptFile?.type.startsWith('image/') || receiptBase64.startsWith('data:image/') ? (
                    <div className="relative max-h-48 overflow-hidden rounded-xl border border-neutral-200/80 w-full flex items-center justify-center bg-neutral-900/5">
                      <img
                        src={receiptBase64}
                        alt="Receipt preview"
                        className="max-h-48 object-contain rounded-xl"
                      />
                    </div>
                  ) : (
                    <div className="flex items-center gap-3 p-4 bg-emerald-50 rounded-xl border border-emerald-100 w-full">
                      <FileText className="w-8 h-8 text-[#00B87A]" />
                      <div className="overflow-hidden">
                        <p className="text-xs font-bold text-neutral-800 truncate">{receiptFile?.name || 'receipt.pdf'}</p>
                        <p className="text-[10px] text-neutral-400 font-mono">Document Attachment</p>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-between w-full mt-3 pt-3 border-t border-neutral-100 text-xs font-medium text-neutral-500">
                    <span className="truncate max-w-[220px] font-mono text-[11px] text-neutral-600">
                      {receiptFile?.name || 'receipt.png'}
                    </span>
                    <button
                      type="button"
                      onClick={handleClearFile}
                      className="px-2.5 py-1 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg font-bold transition cursor-pointer flex items-center gap-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Remove</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => cameraInputRef.current?.click()}
                    className="p-4 bg-white hover:bg-emerald-50/50 border-2 border-dashed border-neutral-300 hover:border-[#00B87A] rounded-2xl flex flex-col items-center justify-center gap-2 transition cursor-pointer text-center group"
                  >
                    <div className="p-3 bg-emerald-50 text-[#00B87A] rounded-2xl group-hover:scale-110 transition-transform">
                      <Camera className="w-6 h-6" />
                    </div>
                    <span className="text-xs font-bold text-neutral-700">Take Photo</span>
                    <span className="text-[10px] text-neutral-400">Use device camera</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="p-4 bg-white hover:bg-emerald-50/50 border-2 border-dashed border-neutral-300 hover:border-[#00B87A] rounded-2xl flex flex-col items-center justify-center gap-2 transition cursor-pointer text-center group"
                  >
                    <div className="p-3 bg-neutral-100 text-neutral-600 group-hover:scale-110 transition-transform">
                      <Upload className="w-6 h-6" />
                    </div>
                    <span className="text-xs font-bold text-neutral-700">Browse File</span>
                    <span className="text-[10px] text-neutral-400">PNG, JPG, or PDF</span>
                  </button>
                </div>
              )}
            </div>

            {/* Reference & Memo Fields */}
            <div className="space-y-3">
              <label className="text-xs font-extrabold uppercase tracking-wider text-neutral-500 font-mono block">
                3. Payment Details & Reference
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-neutral-500 uppercase font-mono block mb-1">
                    Transaction Reference
                  </label>
                  <input
                    type="text"
                    value={customRef}
                    onChange={(e) => setCustomRef(e.target.value)}
                    placeholder="e.g. TRX-123456"
                    className="w-full px-3 py-2 bg-white border border-neutral-200/80 rounded-xl text-xs font-mono font-bold text-neutral-800 focus:outline-none focus:border-[#00B87A]"
                    required
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-neutral-500 uppercase font-mono block mb-1">
                    Amount Paid (Must Match Receipt)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 font-bold text-xs">₦</span>
                    <input
                      type="number"
                      value={submittedAmount}
                      onChange={(e) => setSubmittedAmount(e.target.value)}
                      placeholder={currentPlanObj.price.toString()}
                      className="w-full pl-7 pr-3 py-2 bg-white border border-neutral-200/80 rounded-xl text-xs font-mono font-bold text-neutral-800 focus:outline-none focus:border-[#00B87A]"
                      required
                    />
                  </div>
                  <p className="text-[9px] text-amber-600 font-bold mt-1 uppercase">
                    * Required: ₦{currentPlanObj.price.toLocaleString()} for {currentPlanObj.name}
                  </p>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-neutral-500 uppercase font-mono block mb-1">
                  Transfer Note / Bank Name (Optional)
                </label>
                <input
                  type="text"
                  value={paymentMemo}
                  onChange={(e) => setPaymentMemo(e.target.value)}
                  placeholder="e.g., Bank transfer from Zenith Bank by John Doe"
                  className="w-full px-3 py-2 bg-white border border-neutral-200/80 rounded-xl text-xs font-medium text-neutral-800 focus:outline-none focus:border-[#00B87A]"
                />
              </div>
            </div>

            {/* Notice Footer */}
            <div className="p-3 bg-amber-50/80 border border-amber-200/80 rounded-2xl text-[11px] text-amber-800 flex items-start gap-2.5 leading-relaxed font-medium">
              <Clock className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <span>
                Once submitted, status will update to <strong>Pending Review</strong> while administrator confirms funds transfer. Access will be fully restored automatically upon approval.
              </span>
            </div>

            {/* Modal Actions */}
            <div className="pt-3 border-t border-neutral-200 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="px-4 py-2 bg-neutral-200 hover:bg-neutral-300 text-neutral-800 rounded-xl font-bold text-xs transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting || !receiptBase64}
                className="px-5 py-2.5 bg-[#00B87A] hover:bg-[#009E66] text-white rounded-xl font-extrabold text-xs transition cursor-pointer flex items-center gap-2 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <>
                    <RotateCw className="w-4 h-4 animate-spin" />
                    <span>Submitting...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4" />
                    <span>Submit Payment Proof</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

export default UploadReceiptModal;
