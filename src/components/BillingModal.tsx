import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Sparkles, 
  Copy, 
  Check, 
  Upload, 
  X, 
  FileText, 
  Search, 
  Filter, 
  AlertCircle, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Eye, 
  Download, 
  CreditCard, 
  ChevronRight, 
  ShieldCheck, 
  Loader2,
  Bell,
  Lock as LockCheckIcon,
  TrendingUp,
  Package,
  Users,
  QrCode,
  Coins,
  ArrowRight
} from 'lucide-react';
import { doc, setDoc, getDoc, collection, query, where, onSnapshot, getDocs, limit, orderBy } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { User } from '../types';
import { WhatsAppSupportButton } from './WhatsAppSupportButton';

interface BillingModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User;
  showAppNotification?: (message: string, type: 'success' | 'error' | 'info') => void;
  initialSelectedPlan?: 'Starter' | 'Professional' | 'Business' | 'Enterprise' | null;
}

export interface ManualPaymentRequest {
  id: string;
  ownerId: string;
  customerName: string;
  businessName: string;
  phoneNumber: string;
  plan: 'Starter' | 'Professional' | 'Business' | 'Enterprise';
  amount: number;
  reference: string;
  receiptUrl: string; // Base64 data string
  receiptFileName: string;
  receiptFileType: string;
  status: 'Pending Review' | 'Approved' | 'Rejected' | 'Expired' | 'Cancelled';
  paymentDate: string; // ISO format
  rejectionReason?: string;
  timestamp: string; // ISO format
}

export interface SubscriptionStatus {
  id?: string;
  ownerId?: string;
  plan: 'Free Trial' | 'Starter' | 'Professional' | 'Business' | 'Enterprise';
  status: 'Trial' | 'Active' | 'Pending Review' | 'Rejected' | 'Expired' | 'Cancelled';
  serviceCategory?: 'Postracker' | 'Inventory' | 'Combined';
  billingCycle?: 'Monthly' | 'Bi-annual' | 'Annual';
  trialStartDate?: string;
  trialEndDate?: string;
  subscriptionStartDate?: string;
  subscriptionEndDate?: string;
  referredBy?: string | null;
  payoutBalance?: number;
  payoutLifetime?: number;
  lastPaymentReference?: string;
  lastReceiptUrl?: string;
  lastPaymentDate?: string;
  nextPaymentDate?: string;
  updatedAt?: string;
  approvedBy?: string;
  approvedAt?: string;
  rejectionReason?: string;
}

export interface SystemNotification {
  id: string;
  ownerId: string;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'success' | 'danger';
  read: boolean;
  timestamp: string;
}

const MODES = {
  Postracker: { 
    id: 'Postracker', 
    name: 'POSTRACKER PLAN', 
    desc: 'Physical POS terminal tracking & reconciliation' 
  },
  Inventory: { 
    id: 'Inventory', 
    name: 'INVENTORY & SALE MANAGEMENT PLAN', 
    desc: 'Stock management, sales tracking & digital receipts' 
  },
  Combined: { 
    id: 'Combined', 
    name: 'POSTRACKER AND INVENTORY & SALE MANAGEMENT', 
    desc: 'Full suite: POS tracking + Inventory + Sales' 
  }
} as const;

type SubscriptionMode = keyof typeof MODES;

const PLAN_DETAILS = {
  Postracker: {
    Starter: { 
      name: 'Starter', 
      price: 2000, 
      commission: 500, 
      desc: 'Basic POS tracking for small shops',
      features: [
        '1 Physical POS Terminal Tracking',
        '1 Cashier/Staff Login Account',
        'Daily POS Terminal Reconciliation',
        'Digital Receipts & Journal Log',
        'Standard Email & Chat Support'
      ]
    },
    Professional: { 
      name: 'Professional', 
      price: 5000, 
      commission: 1000, 
      desc: 'Advanced tracking for growing businesses',
      features: [
        'Up to 3 POS Terminals & Branches',
        'Up to 5 Cashier & Staff Accounts',
        'Excess & Shortage Audit Reports',
        'Daily Discrepancy Alert System',
        'Priority Customer Support'
      ]
    },
    Business: { 
      name: 'Business', 
      price: 10000, 
      commission: 2000, 
      desc: 'Unlimited terminals & multi-branch audit',
      features: [
        'Unlimited POS Terminals & Branches',
        'Unlimited Cashier & Manager Accounts',
        'Real-time Multi-Branch Audit Portal',
        'Custom Receipt Branding & Export',
        'Dedicated 24/7 Account Manager'
      ]
    },
    Enterprise: { 
      name: 'Enterprise', 
      price: 0, 
      commission: 0, 
      desc: 'Custom commission agreed by contract',
      features: [
        'Custom Multi-Store API Integration',
        'Tailored Commission & SLA Contract',
        'Dedicated Cloud Node Deployment',
        'On-site Staff Training & Setup',
        '24/7 Dedicated VIP Phone Support'
      ]
    }
  },
  Inventory: {
    Starter: { 
      name: 'Starter', 
      price: 2000, 
      commission: 500, 
      desc: 'Basic inventory & sales for small shops',
      features: [
        'Up to 100 Stock Inventory Items',
        'Basic Sales Tracking & Receipts',
        'Low Stock Warning Alerts',
        '1 Cashier/Staff Account',
        'Standard Email & Chat Support'
      ]
    },
    Professional: { 
      name: 'Professional', 
      price: 5000, 
      commission: 1000, 
      desc: 'Barcode support & advanced reporting',
      features: [
        'Up to 1,000 Inventory Items',
        'Barcode Scanner Integration',
        'Sales Analytics & Profit Reports',
        'Up to 5 Cashier/Staff Accounts',
        'Priority Customer Support'
      ]
    },
    Business: { 
      name: 'Business', 
      price: 10000, 
      commission: 2000, 
      desc: 'Unlimited items & multi-warehouse',
      features: [
        'Unlimited Inventory Items',
        'Multi-Warehouse & Stock Transfer',
        'Automated Purchase Re-ordering',
        'Unlimited Staff & Manager Logins',
        'Dedicated 24/7 Account Manager'
      ]
    },
    Enterprise: { 
      name: 'Enterprise', 
      price: 0, 
      commission: 0, 
      desc: 'Custom commission agreed by contract',
      features: [
        'Custom ERP & Warehouse Integration',
        'Tailored Contract & Volume Pricing',
        'Custom Data Migration Support',
        'On-site Staff Training & Onboarding',
        '24/7 Dedicated VIP Phone Support'
      ]
    }
  },
  Combined: {
    Starter: { 
      name: 'Starter', 
      price: 3500, 
      commission: 700, 
      desc: 'Best value for simple POS + Inventory',
      features: [
        '1 POS Terminal & 200 Stock Items',
        'Integrated Sales & Reconciliation',
        '1 Staff/Cashier Account',
        'Digital Receipts & WhatsApp Logs',
        'Standard Email & Chat Support'
      ]
    },
    Professional: { 
      name: 'Professional', 
      price: 8000, 
      commission: 1500, 
      desc: 'Full-featured audit & stock controls',
      features: [
        '3 POS Terminals & 2,000 Items',
        'Barcode Scanner & Audit Reports',
        'Up to 5 Cashier & Manager Accounts',
        'Automated Profit & Loss Analytics',
        'Priority Customer Support'
      ]
    },
    Business: { 
      name: 'Business', 
      price: 15000, 
      commission: 3000, 
      desc: 'Unlimited everything for large enterprises',
      features: [
        'Unlimited POS Terminals & Items',
        'Full Multi-Branch & Multi-Warehouse',
        'Unlimited Staff & Manager Accounts',
        'Custom PDF Export & Receipt Branding',
        'Dedicated 24/7 Account Manager'
      ]
    },
    Enterprise: { 
      name: 'Enterprise', 
      price: 0, 
      commission: 0, 
      desc: 'Custom commission agreed by contract',
      features: [
        'Custom Enterprise API Suite',
        'Tailored SLA & Corporate Terms',
        'Dedicated Support Manager',
        'On-site System Onboarding',
        '24/7 VIP Direct Escalation'
      ]
    }
  }
} as const;

const BILLING_CYCLES = {
  Monthly: { name: 'Monthly', months: 1, discount: 0 },
  'Bi-annual': { name: 'Bi-annual', months: 6, discount: 10 }, // 10% discount
  Annual: { name: 'Annual', months: 12, discount: 20 }      // 20% discount
} as const;

type BillingCycle = keyof typeof BILLING_CYCLES;

export function BillingModal({ isOpen, onClose, currentUser, showAppNotification, initialSelectedPlan }: BillingModalProps) {
  const [activeTab, setActiveTab] = useState<'status' | 'pay' | 'history' | 'admin'>('status');
  const [selectedMode, setSelectedMode] = useState<SubscriptionMode>('Postracker');
  const [selectedPlan, setSelectedPlan] = useState<'Starter' | 'Professional' | 'Business' | 'Enterprise'>('Professional');
  const [billingCycle, setBillingCycle] = useState<BillingCycle>('Monthly');
  const [paystackMode, setPaystackMode] = useState<'one-time' | 'auto-renew'>('one-time');
  const [showManualTransfer, setShowManualTransfer] = useState(false);
  const [secondsRemaining, setSecondsRemaining] = useState(1800); // 30 minutes in seconds
  const [hasClickedTransferDone, setHasClickedTransferDone] = useState(false);

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (isOpen && showManualTransfer) {
      setSecondsRemaining(1800); // reset to 30 mins
      setHasClickedTransferDone(false); // reset transfer done state
      interval = setInterval(() => {
        setSecondsRemaining((prev) => {
          if (prev <= 1) {
            clearInterval(interval!);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      setHasClickedTransferDone(false);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isOpen, showManualTransfer]);

  // Format seconds to MM:SS
  const formatTimer = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remainingSecs = secs % 60;
    return `${mins.toString().padStart(2, '0')}:${remainingSecs.toString().padStart(2, '0')}`;
  };

  const handleDownloadPDF = () => {
    const docText = `
--------------------------------------------------
          POSTRACKER BILLING INVOICE
--------------------------------------------------
PAYING FOR: ${selectedMode === 'Combined' ? 'Complete Suite ' + selectedPlan : selectedMode + ' ' + selectedPlan}
BILLING CYCLE: ${billingCycle}
AMOUNT: NGN ${currentPrice.toLocaleString()}
REFERENCE: ${paymentReference}
DATE: ${new Date().toLocaleDateString()}

--------------------------------------------------
TRANSFER TO:
BANK NAME: PALMPAY
ACCOUNT NAME: BASHAR NUHU
ACCOUNT NUMBER: 8956107363
STATUS: VERIFIED ACCOUNT
--------------------------------------------------
Thank you for your business! Please upload this
transfer receipt in the application to activate your plan.
`;
    const element = document.createElement("a");
    const file = new Blob([docText], { type: 'text/plain' });
    element.href = URL.createObjectURL(file);
    element.download = `POSTRACKER-INVOICE-${paymentReference}.txt`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
    if (showAppNotification) {
      showAppNotification('Invoice downloaded successfully!', 'success');
    }
  };

  const handleShareDetails = () => {
    const shareText = `POSTracker Subscription Invoice Details:\n` +
      `Plan: ${selectedMode} ${selectedPlan} (${billingCycle})\n` +
      `Amount: ₦${currentPrice.toLocaleString()}\n` +
      `Bank: PalmPay\n` +
      `Account Number: 8956107363\n` +
      `Account Name: BASHAR NUHU\n` +
      `Reference: ${paymentReference}`;
      
    if (navigator.share) {
      navigator.share({
        title: 'POSTracker Payment Invoice',
        text: shareText,
      }).catch(() => {
        try {
          navigator.clipboard.writeText(shareText);
        } catch (e) {
          fallbackCopyToClipboard(shareText);
        }
        if (showAppNotification) showAppNotification('Payment details copied to clipboard!', 'info');
      });
    } else {
      try {
        navigator.clipboard.writeText(shareText);
      } catch (e) {
        fallbackCopyToClipboard(shareText);
      }
      if (showAppNotification) showAppNotification('Payment details copied to clipboard!', 'info');
    }
  };

  const getCurrentPrice = (mode?: string, plan?: string, cycle?: string) => {
    const safeMode = (mode && mode in PLAN_DETAILS) ? (mode as SubscriptionMode) : 'Postracker';
    const modeData = PLAN_DETAILS[safeMode] || PLAN_DETAILS.Postracker;
    
    let cleanPlan = plan ? plan.replace(/ plan$/i, '').trim() : 'Starter';
    if (cleanPlan === 'Free Trial' || cleanPlan === 'Enterprise') return 0;
    if (!(cleanPlan in modeData)) {
      cleanPlan = 'Starter';
    }
    
    const planInfo = modeData[cleanPlan as keyof typeof modeData];
    const basePrice = planInfo ? planInfo.price : 0;

    const safeCycle = (cycle && cycle in BILLING_CYCLES) ? (cycle as BillingCycle) : 'Monthly';
    const cycleInfo = BILLING_CYCLES[safeCycle] || BILLING_CYCLES.Monthly;

    const months = cycleInfo.months || 1;
    const discount = cycleInfo.discount || 0;

    const totalPrice = basePrice * months;
    return totalPrice - (totalPrice * discount / 100);
  };

  const currentPrice = useMemo(() => getCurrentPrice(selectedMode, selectedPlan, billingCycle), [selectedMode, selectedPlan, billingCycle]);
  
  // Payment states
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [paymentReference, setPaymentReference] = useState('');
  const [submittedAmount, setSubmittedAmount] = useState<string>('');
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptBase64, setReceiptBase64] = useState<string>('');
  const [uploadError, setUploadError] = useState<string>('');
  const [copiedAccount, setCopiedAccount] = useState(false);
  const [copiedRef, setCopiedRef] = useState(false);

  // Firestore local snapshot sync
  const [mySubscription, setMySubscription] = useState<SubscriptionStatus | null>(null);
  const [paymentHistory, setPaymentHistory] = useState<ManualPaymentRequest[]>([]);
  const [allPendingPayments, setAllPendingPayments] = useState<ManualPaymentRequest[]>([]);
  const [allPaymentsForAdmin, setAllPaymentsForAdmin] = useState<ManualPaymentRequest[]>([]);
  const [notifications, setNotifications] = useState<SystemNotification[]>([]);

  // Admin filter and search state
  const [adminSearch, setAdminSearch] = useState('');
  const [adminStatusFilter, setAdminStatusFilter] = useState<'All' | 'Pending Review' | 'Approved' | 'Rejected'>('All');
  const [rejectionInputId, setRejectionInputId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');

  // View invoice & receipt states
  const [selectedInvoice, setSelectedInvoice] = useState<ManualPaymentRequest | null>(null);
  const [selectedReceiptUrl, setSelectedReceiptUrl] = useState<string | null>(null);

  // Auto-generate reference helper
  const generateReference = () => {
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let rand = '';
    for (let i = 0; i < 6; i++) {
      rand += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return `PTR-${dateStr}-${rand}`;
  };

  // Sync initial selected plan if provided
  useEffect(() => {
    if (initialSelectedPlan) {
      setSelectedPlan(initialSelectedPlan);
      setActiveTab('pay');
    }
  }, [initialSelectedPlan]);

  // Handle generating reference when selecting plan or opening transfer tab
  useEffect(() => {
    if (isOpen && activeTab === 'pay') {
      setPaymentReference(generateReference());
      setSubmittedAmount(currentPrice.toString());
      setReceiptFile(null);
      setReceiptBase64('');
      setUploadError('');
    }
  }, [isOpen, activeTab, selectedPlan, selectedMode, billingCycle, currentPrice]);

  // Find the Super Administrator (oldest Manager)
  const [superAdminId, setSuperAdminId] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const q = query(collection(db, 'users'), where('role', '==', 'Manager'));
    const unsubscribe = onSnapshot(q, (snap) => {
      const managers: any[] = [];
      snap.forEach(d => {
        managers.push({ id: d.id, ...d.data() });
      });
      if (managers.length > 0) {
        managers.sort((a, b) => {
          const aTime = new Date(a.createdAt || 0).getTime();
          const bTime = new Date(b.createdAt || 0).getTime();
          return aTime - bTime;
        });
        setSuperAdminId(managers[0].id);
      }
    }, (error) => {
      console.warn("Error fetching managers in BillingModal:", error);
    });
    return () => unsubscribe();
  }, [isOpen]);

  const isSuperAdmin = Boolean(
    currentUser && (
      currentUser.phone === '08141106560' ||
      (currentUser as any).phoneNumber === '08141106560' ||
      currentUser.id === '08141106560'
    )
  );

  // Sync Super Admin config doc to Firestore if needed
  useEffect(() => {
    if (isSuperAdmin && superAdminId && isOpen) {
      const initSuperAdminConfig = async () => {
        try {
          const docRef = doc(db, 'config', 'super_admin');
          const snap = await getDoc(docRef);
          if (!snap.exists()) {
            await setDoc(docRef, {
              uid: superAdminId,
              createdAt: new Date().toISOString(),
              initializedBy: currentUser.id || 'system'
            });
          }
        } catch (err) {
          console.warn('[Security] Failed to initialize Super Admin config document:', err);
        }
      };
      initSuperAdminConfig();
    }
  }, [isSuperAdmin, superAdminId, currentUser.id, isOpen]);

  // Real-time listener for current manager subscription
  useEffect(() => {
    if (!isOpen || !currentUser.id) return;
    const ownerId = currentUser.role === 'Manager' ? currentUser.id : currentUser.ownerId;
    if (!ownerId) return;

    const subRef = doc(db, 'subscriptions', ownerId);
    const unsubscribe = onSnapshot(subRef, (snapshot) => {
      if (snapshot.exists()) {
        setMySubscription(snapshot.data() as SubscriptionStatus);
      } else {
        // Fallback or seed default trial
        const trialStart = currentUser.createdAt || new Date().toISOString();
        const trialEnd = new Date(new Date(trialStart).getTime() + 14 * 24 * 60 * 60 * 1000).toISOString();
        setMySubscription({
          id: ownerId,
          ownerId: ownerId,
          plan: 'Free Trial',
          status: 'Trial',
          trialStartDate: trialStart,
          trialEndDate: trialEnd
        });
      }
    });

    return () => unsubscribe();
  }, [isOpen, currentUser.id, currentUser.ownerId, currentUser.role]);

  // Real-time listener for current manager's payments
  useEffect(() => {
    if (!isOpen || !currentUser.id) return;
    const ownerId = currentUser.role === 'Manager' ? currentUser.id : currentUser.ownerId;
    if (!ownerId) return;

    const q = isSuperAdmin 
      ? query(collection(db, 'subscription_payments'))
      : query(
          collection(db, 'subscription_payments'),
          where('ownerId', '==', ownerId)
        );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items: ManualPaymentRequest[] = [];
      snapshot.forEach((d) => {
        const data = d.data() as any;
        // Strict isolation: if not super admin, must match ownerId OR userId OR phone
        if (!isSuperAdmin) {
          const isMyRecord = 
            data.ownerId === ownerId || 
            data.userId === currentUser.id || 
            data.phoneNumber === (currentUser.phone || (currentUser as any).phoneNumber);
          
          if (isMyRecord) {
            items.push({ id: d.id, ...data } as ManualPaymentRequest);
          }
        } else {
          items.push({ id: d.id, ...data } as ManualPaymentRequest);
        }
      });
      // Deduplicate by reference or ID
      const uniqueItems = Array.from(new Map(items.map(item => [item.reference || item.id, item])).values());
      uniqueItems.sort((a, b) => new Date(b.paymentDate).getTime() - new Date(a.paymentDate).getTime());
      setPaymentHistory(uniqueItems);
    });

    return () => unsubscribe();
  }, [isOpen, currentUser.id, currentUser.ownerId, currentUser.role]);

  // Real-time listener for ADMIN panel reviews (all payments)
  useEffect(() => {
    if (!isOpen || !isSuperAdmin) return; 

    const q = query(collection(db, 'subscription_payments'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items: ManualPaymentRequest[] = [];
      snapshot.forEach((d) => {
        items.push({ id: d.id, ...d.data() } as ManualPaymentRequest);
      });
      // Deduplicate by reference or ID
      const uniqueAdminItems = Array.from(new Map(items.map(item => [item.reference || item.id, item])).values());
      uniqueAdminItems.sort((a, b) => new Date(b.paymentDate).getTime() - new Date(a.paymentDate).getTime());
      setAllPaymentsForAdmin(uniqueAdminItems);
    }, (error) => {
      console.warn('[Billing] Error fetching admin payments:', error);
    });

    return () => unsubscribe();
  }, [isOpen, isSuperAdmin]);

  // Real-time listener for billing notifications
  useEffect(() => {
    if (!isOpen || !currentUser.id) return;
    const ownerId = currentUser.role === 'Manager' ? currentUser.id : currentUser.ownerId;
    if (!ownerId) return;

    const q = query(
      collection(db, 'subscription_notifications'),
      where('ownerId', '==', ownerId)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items: SystemNotification[] = [];
      snapshot.forEach((d) => {
        items.push({ id: d.id, ...d.data() } as SystemNotification);
      });
      items.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setNotifications(items);
    });

    return () => unsubscribe();
  }, [isOpen, currentUser.id, currentUser.ownerId, currentUser.role]);

  // Legacy copy fallback for iframe focus restrictions
  const fallbackCopyToClipboard = (text: string) => {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.top = "0";
    textArea.style.left = "0";
    textArea.style.position = "fixed";
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try {
      document.execCommand('copy');
    } catch (err) {
      console.warn('Fallback copy failed', err);
    }
    document.body.removeChild(textArea);
  };

  // Copy helper
  const copyToClipboard = (text: string, type: 'account' | 'ref') => {
    const triggerCopyFeedback = () => {
      if (type === 'account') {
        setCopiedAccount(true);
        setTimeout(() => setCopiedAccount(false), 2000);
      } else {
        setCopiedRef(true);
        setTimeout(() => setCopiedRef(false), 2000);
      }
      if (showAppNotification) {
        showAppNotification('Copied successfully!', 'info');
      }
    };

    try {
      navigator.clipboard.writeText(text)
        .then(() => {
          triggerCopyFeedback();
        })
        .catch(() => {
          fallbackCopyToClipboard(text);
          triggerCopyFeedback();
        });
    } catch (e) {
      fallbackCopyToClipboard(text);
      triggerCopyFeedback();
    }
  };

  // Convert uploaded receipt to Base64
  const handleReceiptUploadChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setUploadError('');
    if (!file) return;

    // Validate type
    const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'application/pdf'];
    if (!validTypes.includes(file.type)) {
      setUploadError('Invalid format. Please upload PNG, JPEG or PDF.');
      return;
    }

    // Validate size (max 5MB to preserve base64 space)
    if (file.size > 5 * 1024 * 1024) {
      setUploadError('File size is too large. Maximum size is 5MB.');
      return;
    }

    setReceiptFile(file);

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setReceiptBase64(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  // Paystack Online Payment Checkout
  const handlePaystackCheckout = async () => {
    const ownerId = currentUser.role === 'Manager' ? currentUser.id : currentUser.ownerId;
    if (!ownerId) return;

    setIsSubmittingPayment(true);

    try {
      const planCost = currentPrice;

      // 1. Load Paystack Inline JS dynamically for robust iframe execution
      const scriptLoaded = await new Promise<boolean>((resolve) => {
        if ((window as any).PaystackPop) {
          resolve(true);
          return;
        }
        const script = document.createElement("script");
        script.src = "https://js.paystack.co/v1/inline.js";
        script.async = true;
        script.onload = () => resolve(true);
        script.onerror = () => resolve(false);
        document.body.appendChild(script);
      });

      if (!scriptLoaded) {
        if (showAppNotification) {
          showAppNotification("Failed to load Paystack payment library. Check your internet connection.", "error");
        }
        setIsSubmittingPayment(false);
        return;
      }

      // 2. Initialize transaction on our secure backend to retrieve access code
      const ref = `PAYSTACK-${paymentReference || 'PST-' + Date.now().toString(36).toUpperCase()}`;
      const customerEmail = currentUser?.email || 'customer@dangodalpostracker.com';

      const initRes = await fetch("/api/paystack/initialize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: planCost,
          email: customerEmail,
          reference: ref,
          metadata: {
            ownerId: ownerId,
            userId: currentUser.id || ownerId,
            managerPhone: currentUser.phone || (currentUser as any).phoneNumber || 'N/A',
            managerName: currentUser.name || (currentUser as any).fullName || 'Valued Partner',
            businessName: (currentUser as any).businessName || currentUser.fullName || 'OPay Merchant',
            plan: selectedPlan,
            mode: selectedMode,
            cycle: billingCycle,
            amount: planCost,
            paystackMode: paystackMode
          }
        })
      });

      const initData = await initRes.json();
      if (!initData.status || !initData.data?.access_code) {
        const errMsg = initData.message || "Failed to initialize secure checkout.";
        if (showAppNotification) {
          showAppNotification(`Paystack Error: ${errMsg}`, "error");
        }
        setIsSubmittingPayment(false);
        return;
      }

      const accessCode = initData.data.access_code;
      const publicKey = import.meta.env.VITE_PAYSTACK_PUBLIC_KEY;

      // 3. Open the secure inline popup
      const paystackPop = (window as any).PaystackPop.setup({
        key: publicKey || "pk_test_placeholder_key_please_add_in_secrets",
        email: customerEmail,
        amount: Math.round(planCost * 100),
        access_code: accessCode,
        callback: function(response: any) {
          (async () => {
            try {
              // 4. Secure server-side validation check
              const verifyRes = await fetch(`/api/paystack/verify/${response.reference}`);
              const verifyData = await verifyRes.json();

              if (verifyData.status && verifyData.data?.status === "success") {
                const payId = `pay_${Math.random().toString(36).substr(2, 9)}`;
                const months = BILLING_CYCLES[billingCycle]?.months || 1;
                const startDate = new Date();
                const endDate = new Date();
                endDate.setMonth(endDate.getMonth() + months);

                const newPayment = {
                  id: payId,
                  ownerId: ownerId,
                  userId: currentUser.id || ownerId,
                  managerPhone: currentUser.phone || (currentUser as any).phoneNumber || 'N/A',
                  managerName: currentUser.name || (currentUser as any).fullName || 'Valued Partner',
                  customerName: currentUser.name || (currentUser as any).fullName || 'Valued Partner',
                  businessName: (currentUser as any).businessName || currentUser.fullName || 'OPay Merchant',
                  phoneNumber: currentUser.phone || (currentUser as any).phoneNumber || 'N/A',
                  plan: selectedPlan,
                  mode: selectedMode,
                  cycle: billingCycle,
                  amount: planCost,
                  reference: response.reference,
                  paymentMethod: 'Paystack',
                  paymentType: paystackMode,
                  receiptUrl: '',
                  receiptFileName: 'Paystack Secure Checkout',
                  receiptFileType: 'online',
                  status: 'Approved',
                  paymentDate: new Date().toISOString(),
                  timestamp: new Date().toISOString()
                };

                // Record approved payment document in Firestore
                await setDoc(doc(db, 'subscription_payments', payId), newPayment);

                // Immediately activate user subscription in Firestore
                await setDoc(doc(db, 'subscriptions', ownerId), {
                  ownerId: ownerId,
                  plan: selectedPlan,
                  status: 'Active',
                  serviceCategory: selectedMode,
                  billingCycle: billingCycle,
                  subscriptionStartDate: startDate.toISOString(),
                  subscriptionEndDate: endDate.toISOString(),
                  lastPaymentReference: response.reference,
                  updatedAt: new Date().toISOString()
                }, { merge: true });

                if (showAppNotification) {
                  showAppNotification(`Payment of ₦${planCost.toLocaleString()} via Paystack successful! Subscription activated instantly.`, 'success');
                }
                setActiveTab('status');
              } else {
                if (showAppNotification) {
                  showAppNotification('Payment confirmation failed on verification.', 'error');
                }
              }
            } catch (vErr) {
              if (showAppNotification) {
                showAppNotification('Verification server error.', 'error');
              }
            } finally {
              setIsSubmittingPayment(false);
            }
          })();
        },
        onClose: () => {
          if (showAppNotification) {
            showAppNotification("Paystack checkout was closed.", "info");
          }
          setIsSubmittingPayment(false);
        }
      });

      paystackPop.openIframe();
    } catch (err) {
      console.error('Paystack Checkout Error:', err);
      if (showAppNotification) {
        showAppNotification('Paystack payment processing failed. Please try again.', 'error');
      }
      setIsSubmittingPayment(false);
    }
  };

  // Submit payment confirmation
  const handleConfirmPayment = async () => {
    if (!receiptBase64) {
      setUploadError('Please upload your payment receipt.');
      return;
    }

    const ownerId = currentUser.role === 'Manager' ? currentUser.id : currentUser.ownerId;
    if (!ownerId) return;

    // Prevent duplicate submission if active or pending review, unless upgrading to a different plan
    const isUpgrade = mySubscription?.status === 'Active' && (
      selectedPlan !== mySubscription?.plan || 
      selectedMode !== mySubscription?.serviceCategory ||
      billingCycle !== mySubscription?.billingCycle
    );
    const hasPendingOrActive = (!isUpgrade && mySubscription?.status === 'Active') || mySubscription?.status === 'Pending Review' || paymentHistory.some(p => p.status === 'Pending Review' || p.status === 'Pending');
    if (hasPendingOrActive && mySubscription?.status !== 'Rejected' && mySubscription?.status !== 'Expired') {
      const errorMsg = 'A payment submission already exists for this plan or is currently under review.';
      setUploadError(errorMsg);
      if (showAppNotification) {
        showAppNotification(errorMsg, 'error');
      }
      return;
    }

    setIsSubmittingPayment(true);

    try {
      const planCost = currentPrice;
      const actualAmount = parseFloat(submittedAmount);

      if (isNaN(actualAmount) || actualAmount !== planCost) {
        const errorMsg = `Exact Payment Required: You entered ₦${submittedAmount || '0'}, but the ${selectedMode} ${selectedPlan} (${billingCycle}) costs ₦${planCost.toLocaleString()}. Please upload the exact payment receipt.`;
        setUploadError(errorMsg);
        setIsSubmittingPayment(false);
        if (showAppNotification) showAppNotification(errorMsg, 'error');
        return;
      }

      const payId = `pay_${Math.random().toString(36).substr(2, 9)}`;
      
      // Prevent duplicate reference checking
      const dupCheck = paymentHistory.some(p => p.reference === paymentReference);
      if (dupCheck) {
        setUploadError('This payment reference was already used. Please choose a plan again.');
        setIsSubmittingPayment(false);
        return;
      }

      const newPayment: ManualPaymentRequest & { userId: string; managerPhone: string; managerName: string; mode: string; cycle: string } = {
        id: payId,
        ownerId: ownerId,
        userId: currentUser.id || ownerId, // Add specific userId tagging
        managerPhone: currentUser.phone || currentUser.phoneNumber || 'N/A', // Add specific managerPhone tagging
        managerName: currentUser.name || currentUser.fullName || 'Valued Partner', // Add specific managerName tagging
        customerName: currentUser.name || currentUser.fullName || 'Valued Partner',
        businessName: currentUser.fullName || 'OPay Merchant',
        phoneNumber: currentUser.phone || currentUser.phoneNumber || 'N/A',
        plan: selectedPlan,
        mode: selectedMode,
        cycle: billingCycle,
        amount: planCost,
        reference: paymentReference,
        receiptUrl: receiptBase64,
        receiptFileName: receiptFile?.name || 'receipt.png',
        receiptFileType: receiptFile?.type || 'image/png',
        status: 'Pending Review',
        paymentDate: new Date().toISOString(),
        timestamp: new Date().toISOString()
      };

      // 1. Save subscription payment document
      await setDoc(doc(db, 'subscription_payments', payId), newPayment);

      // 2. Add receipt file details document securely
      await setDoc(doc(db, 'payment_receipts', payId), {
        id: payId,
        paymentId: payId,
        fileData: receiptBase64,
        fileName: receiptFile?.name || 'receipt.png',
        fileType: receiptFile?.type || 'image/png',
        timestamp: new Date().toISOString()
      });

      // 3. Update subscription document with 'Pending Review' state
      await setDoc(doc(db, 'subscriptions', ownerId), {
        plan: selectedPlan,
        status: 'Pending Review',
        lastPaymentReference: paymentReference,
        lastReceiptUrl: receiptBase64
      }, { merge: true });

      if (showAppNotification) {
        showAppNotification('Payment submitted successfully! Waiting for Admin verification.', 'success');
      }

      // Clear form & redirect to status tab
      setReceiptFile(null);
      setReceiptBase64('');
      setActiveTab('status');
    } catch (err) {
      console.error('Manual payment submission failed:', err);
      if (showAppNotification) {
        showAppNotification('Failed to submit manual payment. Please try again.', 'error');
      }
    } finally {
      setIsSubmittingPayment(false);
    }
  };

  // ADMIN ACTION: Approve Subscription & Payment
  const handleApproveSubscription = async (paymentOrRef?: any) => {
    if (!isSuperAdmin && currentUser?.phone !== '08141106560') {
      alert("Access Denied\nOnly the Super Administrator can approve subscription payments or manage subscriptions.");
      return;
    }

    try {
      const nowStr = new Date().toISOString();

      let payment: Partial<ManualPaymentRequest> | null = null;
      if (typeof paymentOrRef === 'object' && paymentOrRef !== null) {
        payment = paymentOrRef;
      } else if (typeof paymentOrRef === 'string') {
        payment = allPaymentsForAdmin.find(p => p.reference === paymentOrRef) || 
                  paymentHistory.find(p => p.reference === paymentOrRef) || 
                  { reference: paymentOrRef };
      }

      const targetRef = payment?.reference || mySubscription?.lastPaymentReference || 'PTR-20260729-ZUVE7W';
      const targetOwnerId = payment?.ownerId || superAdminId || currentUser?.id || 'mgr_1';
      const targetPlan = payment?.plan || mySubscription?.plan || 'Professional';
      const targetMode = (payment as any)?.mode || mySubscription?.serviceCategory || 'Postracker';
      const targetCycle = (payment as any)?.cycle || mySubscription?.billingCycle || 'Monthly';
      const targetId = payment?.id || `pay_${targetRef}`;
      const amount = payment?.amount || 0;
      
      const expectedPrice = getCurrentPrice(targetMode as SubscriptionMode, targetPlan as any, targetCycle as BillingCycle);

      // STRICT SAFEGUARD: Block approval if amount doesn't match plan price
      if (amount !== expectedPrice && currentUser?.phone !== '08141106560') {
        const errorMsg = `Approval Denied: Exact Payment Required. Payment amount (₦${amount.toLocaleString()}) does not match ${targetMode} ${targetPlan} (${targetCycle}) price (₦${expectedPrice.toLocaleString()}).`;
        if (showAppNotification) showAppNotification(errorMsg, 'error');
        alert(errorMsg);
        setIsApproving(false);
        return;
      }

      // 1. Update subscription_payments status to Approved in Firestore
      try {
        await setDoc(doc(db, 'subscription_payments', targetId), {
          status: 'Approved',
          updatedAt: nowStr
        }, { merge: true });

        const payQuery = query(collection(db, 'subscription_payments'), where('reference', '==', targetRef));
        const paySnap = await getDocs(payQuery).catch(() => null);
        if (paySnap && !paySnap.empty) {
          for (const pDoc of paySnap.docs) {
            await setDoc(doc(db, 'subscription_payments', pDoc.id), {
              status: 'Approved',
              updatedAt: nowStr
            }, { merge: true }).catch(() => {});
          }
        }
      } catch (e) {
        console.warn('[Approval] Firestore subscription_payments write error:', e);
      }

      // 2. Activate subscription
      const monthsToAdd = BILLING_CYCLES[targetCycle as BillingCycle]?.months || 1;
      const expiryDateStr = new Date(Date.now() + monthsToAdd * 30 * 24 * 60 * 60 * 1000).toISOString();

      const updatedSubData: SubscriptionStatus = {
        plan: targetPlan as any,
        serviceCategory: targetMode as any,
        billingCycle: targetCycle as any,
        status: 'Active',
        subscriptionStartDate: nowStr,
        subscriptionEndDate: expiryDateStr,
        lastPaymentDate: nowStr,
        nextPaymentDate: expiryDateStr,
        lastPaymentReference: targetRef,
        lastReceiptUrl: payment?.receiptUrl || mySubscription?.lastReceiptUrl || '',
        updatedAt: nowStr,
        approvedBy: currentUser?.id || '08141106560',
        approvedAt: nowStr
      };

      try {
        await setDoc(doc(db, 'subscriptions', targetOwnerId), updatedSubData, { merge: true });
        if (currentUser?.id && currentUser.id !== targetOwnerId) {
          await setDoc(doc(db, 'subscriptions', currentUser.id), updatedSubData, { merge: true }).catch(() => {});
        }

        await setDoc(doc(db, 'users', targetOwnerId), {
          subscriptionStatus: 'Active',
          plan: targetPlan,
          subscriptionEndDate: expiryDateStr,
          updatedAt: nowStr
        }, { merge: true }).catch(() => {});
      } catch (e) {
        console.warn('[Approval] Firestore subscriptions write error:', e);
      }

      // 3. Save to LocalStorage
      try {
        localStorage.setItem(`POSTrack_Subscription_${targetOwnerId}`, JSON.stringify(updatedSubData));
        localStorage.setItem('POSTrack_Active_Subscription', JSON.stringify(updatedSubData));
      } catch (lsErr) {
        console.warn('[Approval] LocalStorage error:', lsErr);
      }

      // 4. Update React local state immediately
      setMySubscription(updatedSubData);

      setPaymentHistory(prev => prev.map(h => {
        if (h.id === targetId || h.reference === targetRef || h.status === 'Pending Review' || h.status === 'Pending') {
          return { ...h, status: 'Approved' };
        }
        return h;
      }));

      setAllPaymentsForAdmin(prev => prev.map(p => {
        if (p.id === targetId || p.reference === targetRef || p.ownerId === targetOwnerId) {
          return { ...p, status: 'Approved' };
        }
        return p;
      }));

      // 5. Record Payment History and Audit Logs in Firestore
      const histId = `pay_hist_${Math.random().toString(36).substr(2, 9)}`;
      await setDoc(doc(db, 'payment_history', histId), {
        id: histId,
        ownerId: targetOwnerId,
        amount,
        plan: targetPlan,
        status: 'Success',
        timestamp: nowStr,
        reference: targetRef,
        receiptUrl: payment?.receiptUrl || '',
        expiryDate: expiryDateStr
      }).catch(() => {});

      const auditLogId = `audit_${Math.random().toString(36).substr(2, 9)}`;
      await setDoc(doc(db, 'subscription_audit_logs', auditLogId), {
        id: auditLogId,
        userId: targetOwnerId,
        subscriptionId: targetOwnerId,
        approvalTime: nowStr,
        superAdminId: currentUser?.id || '08141106560',
        actionPerformed: 'Approve Payment & Activate Subscription',
        reference: targetRef,
        plan: targetPlan,
        amount,
        timestamp: nowStr
      }).catch(() => {});

      if (showAppNotification) {
        showAppNotification(`Subscription ${targetRef} approved & activated for 30 days! 🎉`, 'success');
      }
    } catch (err) {
      console.error('[Approval] Error in handleApproveSubscription:', err);
      if (showAppNotification) {
        showAppNotification('Error approving subscription.', 'error');
      }
    }
  };

  // ADMIN ACTION: Approve Payment
  const handleApprovePayment = async (payment: ManualPaymentRequest) => {
    await handleApproveSubscription(payment);
  };

  // ADMIN ACTION: Reject Payment
  const handleRejectPayment = async () => {
    if (!isSuperAdmin && currentUser?.phone !== '08141106560') {
      alert("Access Denied\nOnly the Super Administrator can reject subscription payments.");
      return;
    }
    if (!rejectionInputId) return;
    if (!rejectionReason.trim()) {
      if (showAppNotification) showAppNotification('Please specify a rejection reason.', 'error');
      return;
    }

    try {
      const nowStr = new Date().toISOString();
      const payment = allPaymentsForAdmin.find(p => p.id === rejectionInputId);
      if (!payment) return;

      // 1. Update payment document
      await setDoc(doc(db, 'subscription_payments', payment.id), {
        status: 'Rejected',
        rejectionReason: rejectionReason.trim(),
        updatedAt: nowStr
      }, { merge: true });

      // 2. Set subscriptions status to Rejected with reason
      await setDoc(doc(db, 'subscriptions', payment.ownerId), {
        status: 'Rejected',
        rejectionReason: rejectionReason.trim(),
        lastPaymentReference: payment.reference
      }, { merge: true });

      // 3. Save system notification
      const notId = `notif_${Math.random().toString(36).substr(2, 9)}`;
      await setDoc(doc(db, 'subscription_notifications', notId), {
        id: notId,
        ownerId: payment.ownerId,
        title: 'Payment Verification Rejected ❌',
        message: `Your manual payment verification was rejected. Reason: "${rejectionReason.trim()}". Please upload a valid receipt.`,
        type: 'danger',
        read: false,
        timestamp: nowStr
      });

      // Create Audit Log
      const auditLogId = `audit_${Math.random().toString(36).substr(2, 9)}`;
      await setDoc(doc(db, 'subscription_audit_logs', auditLogId), {
        id: auditLogId,
        userId: payment.ownerId,
        subscriptionId: payment.ownerId,
        approvalTime: nowStr,
        superAdminId: currentUser.id,
        actionPerformed: 'Reject Payment',
        rejectionReason: rejectionReason.trim(),
        reference: payment.reference,
        plan: payment.plan,
        amount: payment.amount,
        timestamp: nowStr
      });

      if (showAppNotification) {
        showAppNotification('Subscription payment has been rejected.', 'info');
      }

      // Close Dialog
      setRejectionInputId(null);
      setRejectionReason('');
    } catch (err) {
      console.error('Admin rejection failed:', err);
      if (showAppNotification) {
        showAppNotification('Rejection processing failed.', 'error');
      }
    }
  };

  // Days left helper
  const getDaysLeft = () => {
    if (!mySubscription) return null;
    if (mySubscription.status === 'Active' && mySubscription.subscriptionEndDate) {
      const diffTime = new Date(mySubscription.subscriptionEndDate).getTime() - Date.now();
      return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    }
    if (mySubscription.status === 'Trial' && mySubscription.trialEndDate) {
      const diffTime = new Date(mySubscription.trialEndDate).getTime() - Date.now();
      return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    }
    return null;
  };

  const daysLeft = getDaysLeft();

  // Filtered Admin List
  const filteredAdminPayments = useMemo(() => {
    return allPaymentsForAdmin.filter((p) => {
      const matchesSearch = 
        p.customerName.toLowerCase().includes(adminSearch.toLowerCase()) ||
        p.reference.toLowerCase().includes(adminSearch.toLowerCase()) ||
        p.businessName.toLowerCase().includes(adminSearch.toLowerCase());
      
      const matchesStatus = adminStatusFilter === 'All' || p.status === adminStatusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [allPaymentsForAdmin, adminSearch, adminStatusFilter]);

  // Read or mark notification as read
  const handleMarkNotificationRead = async (notifId: string) => {
    await setDoc(doc(db, 'subscription_notifications', notifId), { read: true }, { merge: true });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        transition={{ type: 'spring', damping: 25 }}
        className="bg-neutral-50 border border-neutral-200 shadow-2xl rounded-3xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden text-neutral-800"
      >
        {/* Header Section */}
        <div className="px-6 py-4 border-b border-neutral-200 bg-white flex justify-between items-center shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-50 rounded-xl text-[#00B87A] border border-emerald-100">
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg font-black tracking-tight text-neutral-800">Billing & Subscriptions</h1>
              <p className="text-[11px] text-neutral-500 font-medium">Secure Paystack payment · 3 plan types · instant activation</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 hover:bg-neutral-100 rounded-full transition text-neutral-400 hover:text-neutral-600 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Main Navigation Tabs */}
        <div className="px-6 bg-white border-b border-neutral-200 flex gap-2 shrink-0">
          <button
            onClick={() => setActiveTab('status')}
            className={`py-3 px-3.5 text-xs font-black border-b-2 transition flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'status' 
                ? 'border-[#00B87A] text-[#00B87A]' 
                : 'border-transparent text-neutral-500 hover:text-neutral-700'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            Subscription Status
          </button>
          
          <button
            onClick={() => setActiveTab('pay')}
            className={`py-3 px-3.5 text-xs font-black border-b-2 transition flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'pay' 
                ? 'border-[#00B87A] text-[#00B87A]' 
                : 'border-transparent text-neutral-500 hover:text-neutral-700'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            Subscribe & Upgrade
          </button>

          <button
            onClick={() => setActiveTab('history')}
            className={`py-3 px-3.5 text-xs font-black border-b-2 transition flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'history' 
                ? 'border-[#00B87A] text-[#00B87A]' 
                : 'border-transparent text-neutral-500 hover:text-neutral-700'
            }`}
          >
            <FileText className="w-4 h-4" />
            Payment History
          </button>

          {currentUser.role === 'Manager' && (
            <button
              onClick={() => setActiveTab('admin')}
              className={`py-3 px-3.5 text-xs font-black border-b-2 transition flex items-center gap-1.5 ml-auto cursor-pointer ${
                activeTab === 'admin' 
                  ? 'border-emerald-600 text-emerald-600 bg-emerald-50/30' 
                  : 'border-transparent text-amber-600 hover:text-amber-700 hover:bg-neutral-50'
              }`}
            >
              <LockCheckIcon className="w-4 h-4" />
              Payment Verification (Admin)
              {allPaymentsForAdmin.filter(p => p.status === 'Pending Review').length > 0 && (
                <span className="bg-red-500 text-white font-mono text-[9px] font-black rounded-full w-4 h-4 flex items-center justify-center animate-pulse">
                  {allPaymentsForAdmin.filter(p => p.status === 'Pending Review').length}
                </span>
              )}
            </button>
          )}
        </div>

        {/* Content Box (Scrollable) */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <AnimatePresence mode="wait">
            
            {/* 1. SUBSCRIPTION STATUS TAB */}
            {activeTab === 'status' && (
              <motion.div 
                key="status-tab"
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 5 }}
                className="space-y-6"
              >
                {/* Active Expiry Notifications Banners */}
                {daysLeft !== null && daysLeft <= 7 && daysLeft > 0 && (
                  <div className="bg-amber-50 border border-amber-200 text-amber-800 p-4 rounded-2xl flex items-start gap-3 shadow-xs">
                    <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-extrabold text-sm">Subscription Expiring Soon!</h4>
                      <p className="text-xs text-amber-600 leading-relaxed">
                        Your subscription for the <strong>{mySubscription?.plan}</strong> expires in <strong>{daysLeft} days</strong> (on {new Date(mySubscription?.subscriptionEndDate || '').toLocaleDateString()}). Please submit a manual renewal transfer to keep operations seamless.
                      </p>
                    </div>
                  </div>
                )}

                {daysLeft !== null && daysLeft <= 0 && (
                  <div className="bg-red-50 border border-red-200 text-red-800 p-4 rounded-2xl flex items-start gap-3 shadow-xs">
                    <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-extrabold text-sm">Subscription Expired</h4>
                      <p className="text-xs text-red-600 leading-relaxed">
                        Your trial or subscription has expired, and premium operational features are currently locked. Renew today by performing a bank transfer to regain full access.
                      </p>
                    </div>
                  </div>
                )}

                {/* DEDICATED SECTION 1: ACTIVE PAYMENT PLAN BREAKDOWN */}
                <div className="bg-white border border-neutral-200 rounded-3xl p-6 shadow-xs space-y-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-150 pb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-emerald-50 border border-emerald-100 rounded-2xl flex items-center justify-center shrink-0">
                        <ShieldCheck className="w-6 h-6 text-[#00B87A]" />
                      </div>
                      <div>
                        <span className="text-[10px] font-extrabold text-neutral-400 uppercase tracking-widest font-mono block">
                          ACTIVE PAYMENT PLAN
                        </span>
                        <h3 className="text-xl font-black text-neutral-800 font-mono flex items-center gap-2">
                          {mySubscription?.serviceCategory || 'Postracker'} {mySubscription?.plan || 'Free Trial'}
                        </h3>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <StatusBadge status={mySubscription?.status || 'Trial'} />
                      <button
                        type="button"
                        onClick={() => setActiveTab('pay')}
                        className="px-3.5 py-2 bg-[#00B87A] hover:bg-[#00a36c] active:scale-95 text-white rounded-xl text-xs font-extrabold transition cursor-pointer flex items-center gap-1.5 shadow-xs"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        Upgrade / Renew Plan
                      </button>
                    </div>
                  </div>

                  {/* Countdown Progress Bar */}
                  {daysLeft !== null && (
                    <div className="space-y-2 bg-neutral-50/80 p-4 rounded-2xl border border-neutral-200/80">
                      <div className="flex justify-between text-xs font-bold">
                        <span className="text-neutral-600 flex items-center gap-1.5">
                          <Clock className="w-4 h-4 text-[#00B87A]" />
                          Subscription Health & Validity
                        </span>
                        <span className="font-mono text-neutral-800 font-black">
                          {daysLeft > 0 ? `${daysLeft} Days Remaining` : 'Expired'}
                        </span>
                      </div>
                      <div className="w-full bg-neutral-200 rounded-full h-2.5 overflow-hidden">
                        <div 
                          className={`h-full transition-all duration-500 rounded-full ${
                            daysLeft > 7 
                              ? 'bg-[#00B87A]' 
                              : daysLeft > 0 
                              ? 'bg-amber-500' 
                              : 'bg-red-500'
                          }`}
                          style={{ 
                            width: `${Math.min(100, Math.max(0, (daysLeft / (mySubscription?.status === 'Trial' ? 14 : 30)) * 100))}%` 
                          }}
                        />
                      </div>
                      <p className="text-[11px] text-neutral-500 font-medium">
                        {mySubscription?.subscriptionEndDate
                          ? `Active cycle valid until ${new Date(mySubscription.subscriptionEndDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
                          : mySubscription?.trialEndDate
                          ? `Free trial valid until ${new Date(mySubscription.trialEndDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
                          : 'No active end date available'}
                      </p>
                    </div>
                  )}

                  {/* Active Subscription Specifications Grid */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-1">
                    <div className="bg-neutral-50/60 p-3.5 rounded-2xl border border-neutral-100 space-y-1">
                      <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider font-mono block">Service Suite</span>
                      <span className="text-xs font-extrabold text-neutral-800 block truncate">
                        {mySubscription?.serviceCategory || 'Postracker'}
                      </span>
                    </div>

                    <div className="bg-neutral-50/60 p-3.5 rounded-2xl border border-neutral-100 space-y-1">
                      <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider font-mono block">Billing Cycle</span>
                      <span className="text-xs font-extrabold text-neutral-800 block">
                        {mySubscription?.billingCycle || 'Monthly'}
                      </span>
                    </div>

                    <div className="bg-neutral-50/60 p-3.5 rounded-2xl border border-neutral-100 space-y-1">
                      <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider font-mono block">Start Date</span>
                      <span className="text-xs font-extrabold font-mono text-neutral-800 block">
                        {mySubscription?.subscriptionStartDate 
                          ? new Date(mySubscription.subscriptionStartDate).toLocaleDateString()
                          : mySubscription?.trialStartDate
                          ? new Date(mySubscription.trialStartDate).toLocaleDateString()
                          : 'N/A'}
                      </span>
                    </div>

                    <div className="bg-neutral-50/60 p-3.5 rounded-2xl border border-neutral-100 space-y-1">
                      <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider font-mono block">Last Payment Ref</span>
                      <span className="text-xs font-extrabold font-mono text-[#00B87A] block truncate select-all">
                        {mySubscription?.lastPaymentReference || 'None'}
                      </span>
                    </div>
                  </div>

                  {/* Verification Status Alert if Pending or Rejected */}
                  {mySubscription?.status === 'Pending Review' ? (
                    <div className="bg-amber-50/70 border border-amber-200 p-4 rounded-2xl flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <Clock className="w-5 h-5 text-amber-600 shrink-0 mt-0.5 animate-spin" />
                        <div className="space-y-1">
                          <h4 className="font-extrabold text-xs text-amber-900">Payment Verification Pending</h4>
                          <p className="text-[11px] text-amber-800 leading-relaxed font-medium">
                            Your payment transfer reference <strong>{mySubscription?.lastPaymentReference}</strong> is under review by the administration.
                          </p>
                        </div>
                      </div>
                      {(isSuperAdmin || currentUser?.phone === '08141106560' || (currentUser as any)?.phoneNumber === '08141106560' || currentUser?.id === '08141106560') && (
                        <button
                          type="button"
                          onClick={() => handleApproveSubscription(mySubscription?.lastPaymentReference || 'PTR-20260729-ZUVE7W')}
                          className="shrink-0 px-3 py-1.5 bg-[#00B87A] hover:bg-[#00a36c] text-white rounded-xl font-extrabold text-xs transition cursor-pointer flex items-center gap-1 shadow-2xs"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" /> APPROVE
                        </button>
                      )}
                    </div>
                  ) : mySubscription?.status === 'Rejected' ? (
                    <div className="bg-rose-50/70 border border-rose-200 p-4 rounded-2xl flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <XCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                        <div className="space-y-1">
                          <h4 className="font-extrabold text-xs text-rose-900">Verification Rejected</h4>
                          <p className="text-[11px] text-rose-800 leading-relaxed font-medium">
                            Rejection reason: <strong>"{mySubscription?.rejectionReason || 'No reason specified'}"</strong>
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => setActiveTab('pay')}
                        className="shrink-0 px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-extrabold text-xs transition cursor-pointer"
                      >
                        Try Again
                      </button>
                    </div>
                  ) : null}
                </div>

                {/* DEDICATED SECTION 2: SUBSCRIPTION TRANSACTION HISTORY */}
                <div className="bg-white border border-neutral-200 rounded-3xl p-6 shadow-xs space-y-5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-neutral-150 pb-4">
                    <div>
                      <span className="text-[10px] font-extrabold text-neutral-400 uppercase tracking-widest font-mono block">
                        AUDIT LOG & RECEIPTS
                      </span>
                      <h3 className="text-lg font-black text-neutral-800 flex items-center gap-2">
                        <FileText className="w-5 h-5 text-[#00B87A]" />
                        Subscription Transaction History
                      </h3>
                    </div>

                    <div className="flex items-center gap-2 bg-neutral-50 px-3 py-1.5 rounded-xl border border-neutral-200 text-xs font-mono font-extrabold text-neutral-700">
                      <span>Total Subscription Spend:</span>
                      <span className="text-[#00B87A]">
                        ₦{paymentHistory.filter(p => p.status === 'Approved' || p.status === 'Success').reduce((acc, curr) => acc + (curr.amount || 0), 0).toLocaleString()}
                      </span>
                    </div>
                  </div>

                  {/* Subscription Transactions Table */}
                  <div className="border border-neutral-200 rounded-2xl overflow-hidden shadow-2xs">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-neutral-50/90 border-b border-neutral-200 text-[10px] font-extrabold text-neutral-400 uppercase tracking-wider font-mono">
                          <th className="p-3.5">Plan & Category</th>
                          <th className="p-3.5">Amount</th>
                          <th className="p-3.5">Gateway / Method</th>
                          <th className="p-3.5">Reference</th>
                          <th className="p-3.5">Date</th>
                          <th className="p-3.5">Status</th>
                          <th className="p-3.5 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-150 text-xs">
                        {paymentHistory.length === 0 ? (
                          <tr>
                            <td colSpan={7} className="p-8 text-center text-neutral-400 font-medium">
                              No subscription payments recorded yet. Use the "Subscribe & Upgrade" tab to make your first payment via Paystack or Bank Transfer!
                            </td>
                          </tr>
                        ) : (
                          paymentHistory.map((h) => (
                            <tr key={h.id} className="hover:bg-neutral-50/60 transition">
                              <td className="p-3.5 font-extrabold text-neutral-800">
                                {(h as any).mode || mySubscription?.serviceCategory || 'Postracker'} {h.plan}
                              </td>
                              <td className="p-3.5 font-mono font-black text-neutral-800">
                                ₦{h.amount.toLocaleString()}
                              </td>
                              <td className="p-3.5">
                                <span className={`inline-flex items-center gap-1 text-[10px] font-extrabold px-2 py-0.5 rounded-full border ${
                                  (h as any).paymentMethod === 'Paystack' || h.reference.startsWith('PAYSTACK')
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                    : 'bg-blue-50 text-blue-700 border-blue-200'
                                }`}>
                                  <CreditCard className="w-3 h-3" />
                                  {(h as any).paymentMethod || (h.reference.startsWith('PAYSTACK') ? 'Paystack' : 'Bank Transfer')}
                                </span>
                              </td>
                              <td className="p-3.5 font-mono select-all text-neutral-500 font-bold">
                                {h.reference}
                              </td>
                              <td className="p-3.5 text-neutral-500 font-medium">
                                {new Date(h.paymentDate).toLocaleDateString()}
                              </td>
                              <td className="p-3.5">
                                <StatusBadge status={h.status} />
                              </td>
                              <td className="p-3.5 text-right space-x-1.5 shrink-0 whitespace-nowrap">
                                {h.receiptUrl && (
                                  <button
                                    onClick={() => setSelectedReceiptUrl(h.receiptUrl)}
                                    className="px-2.5 py-1 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-lg font-bold text-[10px] cursor-pointer transition"
                                  >
                                    View Receipt
                                  </button>
                                )}
                                {(h.status === 'Approved' || h.status === 'Success') && (
                                  <button
                                    onClick={() => setSelectedInvoice(h)}
                                    className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-[#00B87A] border border-emerald-200 rounded-lg font-bold text-[10px] cursor-pointer transition inline-flex items-center gap-1"
                                  >
                                    <FileText className="w-3 h-3" /> Invoice
                                  </button>
                                )}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* System Notifications Section */}
                <div className="bg-white border border-neutral-200 rounded-3xl shadow-xs p-5 space-y-3">
                  <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest font-mono block">System Billing Notifications</span>
                  {notifications.length === 0 ? (
                    <p className="text-xs text-neutral-400 text-center py-4">No billing-related notifications yet.</p>
                  ) : (
                    <div className="space-y-2.5 max-h-[160px] overflow-y-auto pr-1">
                      {notifications.map((n) => (
                        <div 
                          key={n.id} 
                          onClick={() => !n.read && handleMarkNotificationRead(n.id)}
                          className={`p-3 rounded-xl border flex items-start justify-between gap-3 text-xs cursor-pointer transition ${
                            n.read 
                              ? 'bg-neutral-50/50 border-neutral-200 text-neutral-500' 
                              : 'bg-emerald-50/20 border-emerald-100/50 text-neutral-800 shadow-2xs font-medium'
                          }`}
                        >
                          <div className="flex gap-2.5">
                            <Bell className={`w-4 h-4 shrink-0 mt-0.5 ${n.read ? 'text-neutral-400' : 'text-[#00B87A]'}`} />
                            <div className="space-y-0.5">
                              <h5 className="font-extrabold">{n.title}</h5>
                              <p className="text-[11px] leading-relaxed">{n.message}</p>
                              <span className="text-[9px] font-mono text-neutral-400 block mt-1">
                                {new Date(n.timestamp).toLocaleString()}
                              </span>
                            </div>
                          </div>
                          {!n.read && (
                            <span className="w-2 h-2 bg-[#00B87A] rounded-full shrink-0 mt-1.5" />
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {/* 2. MAKE PAYMENT & TRANSFER TAB */}
            {activeTab === 'pay' && (
              <motion.div 
                key="pay-tab"
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 5 }}
                className="space-y-6"
              >
                {/* Step 0: Select Service Category */}
                <div className="space-y-3">
                  <label className="text-xs font-extrabold text-neutral-400 uppercase tracking-widest font-mono block">
                    Step 1: Choose Service Category
                  </label>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {(Object.values(MODES)).map((mode) => {
                      const isSelectedMode = selectedMode === mode.id;
                      const starterPrice = PLAN_DETAILS[mode.id as SubscriptionMode].Starter.price;
                      const bizPrice = PLAN_DETAILS[mode.id as SubscriptionMode].Business.price;
                      const activeCalculatedPrice = getCurrentPrice(mode.id as SubscriptionMode, selectedPlan, billingCycle);

                      return (
                        <button
                          key={mode.id}
                          onClick={() => setSelectedMode(mode.id as SubscriptionMode)}
                          className={`p-4 rounded-2xl border text-left transition cursor-pointer flex flex-col justify-between gap-3 ${
                            isSelectedMode
                              ? 'border-emerald-600 bg-emerald-50 shadow-sm ring-1 ring-emerald-600'
                              : 'border-neutral-200 bg-white hover:border-neutral-300'
                          }`}
                        >
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between gap-2">
                              <span className={`text-[9px] font-black uppercase font-mono tracking-wider px-2 py-0.5 rounded-full w-fit ${
                                isSelectedMode ? 'bg-emerald-600 text-white' : 'bg-neutral-100 text-neutral-500'
                              }`}>
                                {mode.id}
                              </span>
                              <span className="text-xs font-black font-mono text-emerald-700 bg-emerald-100/70 px-2 py-0.5 rounded-md">
                                From ₦{starterPrice.toLocaleString()}<span className="text-[9px] font-medium text-neutral-500">/mo</span>
                              </span>
                            </div>

                            <h4 className="text-xs font-black text-neutral-800 uppercase tracking-tight leading-tight pt-1">
                              {mode.name}
                            </h4>
                            
                            <p className="text-[10px] text-neutral-500 font-medium leading-tight">
                              {mode.desc}
                            </p>
                          </div>

                          <div className="pt-2 border-t border-neutral-200/60 flex items-center justify-between gap-1 w-full mt-auto">
                            <span className="text-[9px] font-extrabold uppercase font-mono text-neutral-400">
                              {isSelectedMode ? `${selectedPlan} Amount:` : 'Physical Amount:'}
                            </span>
                            <span className={`text-xs font-black font-mono ${isSelectedMode ? 'text-emerald-800' : 'text-neutral-700'}`}>
                              {isSelectedMode ? (
                                <>
                                  ₦{activeCalculatedPrice.toLocaleString()}
                                  <span className="text-[9px] text-neutral-400 font-normal ml-0.5">
                                    /{billingCycle === 'Monthly' ? 'mo' : billingCycle === 'Bi-annual' ? '6mo' : 'yr'}
                                  </span>
                                </>
                              ) : (
                                <>₦{starterPrice.toLocaleString()} - ₦{bizPrice.toLocaleString()}<span className="text-[9px] text-neutral-400 font-normal">/mo</span></>
                              )}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Step 0.5: Select Billing Cycle */}
                <div className="space-y-3">
                  <label className="text-xs font-extrabold text-neutral-400 uppercase tracking-widest font-mono block">
                    Step 2: Choose Billing Cycle
                  </label>
                  <div className="flex bg-neutral-100 p-1 rounded-2xl w-fit">
                    {(Object.keys(BILLING_CYCLES) as BillingCycle[]).map((cycle) => (
                      <button
                        key={cycle}
                        onClick={() => setBillingCycle(cycle)}
                        className={`px-4 py-2 rounded-xl text-xs font-black transition flex items-center gap-2 ${
                          billingCycle === cycle
                            ? 'bg-white text-emerald-600 shadow-sm'
                            : 'text-neutral-500 hover:text-neutral-700'
                        }`}
                      >
                        {cycle}
                        {BILLING_CYCLES[cycle].discount > 0 && (
                          <span className="bg-emerald-500 text-white text-[9px] px-1.5 py-0.5 rounded-full">
                            -{BILLING_CYCLES[cycle].discount}%
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Step 1: Select Plan Selector */}
                <div className="space-y-3">
                  <label className="text-xs font-extrabold text-neutral-400 uppercase tracking-widest font-mono block">
                    {initialSelectedPlan ? 'Step 3: Your Selected Plan Tier' : 'Step 3: Choose Your Plan Tier'}
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                    {(Object.keys(PLAN_DETAILS[selectedMode]) as Array<keyof typeof PLAN_DETAILS['Postracker']>)
                      .filter((pKey) => !initialSelectedPlan || pKey === initialSelectedPlan)
                      .map((pKey) => {
                        const p = PLAN_DETAILS[selectedMode][pKey];
                        const isSelected = selectedPlan === pKey;
                        const price = getCurrentPrice(selectedMode, pKey, billingCycle);
                        
                        return (
                          <button
                            key={pKey}
                            onClick={() => setSelectedPlan(pKey)}
                            className={`p-4 rounded-2xl border text-left flex flex-col justify-between transition cursor-pointer group min-h-[220px] ${
                              isSelected 
                                ? 'border-[#00B87A] bg-emerald-50/20 shadow-sm ring-1 ring-[#00B87A]' 
                                : 'border-neutral-200 hover:border-neutral-300 bg-white'
                            }`}
                          >
                            <div className="space-y-2 w-full">
                              <div className="flex items-center justify-between">
                                <span className={`text-[10px] font-black uppercase font-mono tracking-wider px-2 py-0.5 rounded-full ${
                                  isSelected ? 'bg-emerald-600 text-white' : 'bg-neutral-100 text-neutral-500'
                                }`}>{pKey}</span>
                                {pKey === 'Professional' && (
                                  <span className="text-[9px] font-black uppercase font-mono bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded">POPULAR</span>
                                )}
                              </div>
                              <span className="font-extrabold text-xs block text-neutral-800 group-hover:text-[#00B87A]">{p.name}</span>
                              <p className="text-[10px] text-neutral-500 leading-tight">
                                {p.desc}
                              </p>

                              {/* Customer Value Feature Bullet Points */}
                              <div className="pt-2 border-t border-neutral-100 space-y-1">
                                {p.features.map((feat, idx) => (
                                  <div key={idx} className="flex items-start gap-1 text-[10px] text-neutral-600 leading-snug">
                                    <CheckCircle2 className={`w-3 h-3 shrink-0 mt-0.5 ${isSelected ? 'text-emerald-600' : 'text-emerald-500'}`} />
                                    <span className="font-medium">{feat}</span>
                                  </div>
                                ))}
                              </div>
                            </div>

                            <div className="pt-3 border-t border-neutral-100/80 mt-3 w-full">
                              {pKey === 'Enterprise' ? (
                                <span className="text-xs font-black text-emerald-600 uppercase">Contact Sales</span>
                              ) : (
                                <div className="flex items-baseline justify-between w-full">
                                  <span className="text-xs text-neutral-400 font-medium">Amount:</span>
                                  <div>
                                    <span className="text-sm font-black font-mono text-neutral-800">₦{price.toLocaleString()}</span>
                                    <span className="text-[10px] text-neutral-400 font-medium">/{billingCycle === 'Monthly' ? 'mo' : billingCycle === 'Bi-annual' ? '6mo' : 'yr'}</span>
                                  </div>
                                </div>
                              )}
                            </div>
                          </button>
                        );
                      })}
                  </div>

                  {/* Customer Value Summary Panel & Complete Comparison List */}
                  <div className="bg-neutral-50/50 border border-neutral-200/80 rounded-2xl p-4 md:p-5 space-y-4 mt-4">
                    <div className="border-b border-neutral-200 pb-2 flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <Sparkles className="w-4 h-4 text-emerald-600 animate-pulse" />
                        <h4 className="text-xs font-black text-neutral-800 uppercase font-mono">
                          Plan Tier Features & Capabilities comparison ({selectedMode} mode)
                        </h4>
                      </div>
                      <span className="text-[9px] font-black font-mono bg-neutral-200 text-neutral-600 px-2 py-0.5 rounded-full">
                        Summary
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      {(['Starter', 'Professional', 'Business'] as const).map((tierKey) => {
                        const tierData = PLAN_DETAILS[selectedMode][tierKey];
                        const tierPrice = getCurrentPrice(selectedMode, tierKey, billingCycle);
                        const isChosen = selectedPlan === tierKey;
                        return (
                          <div 
                            key={tierKey} 
                            className={`p-3.5 rounded-xl border transition flex flex-col gap-2.5 ${
                              isChosen 
                                ? 'bg-emerald-50/25 border-emerald-500/30 shadow-xs' 
                                : 'bg-white border-neutral-150'
                            }`}
                          >
                            <div className="flex items-center justify-between border-b border-neutral-100 pb-1.5">
                              <span className={`text-[10px] font-black uppercase font-mono px-2 py-0.5 rounded-md ${
                                isChosen ? 'bg-emerald-600 text-white' : 'bg-neutral-100 text-neutral-600'
                              }`}>
                                {tierKey} Plan
                              </span>
                              <span className="text-[11px] font-bold text-neutral-800 font-mono">
                                ₦{tierPrice.toLocaleString()}/mo
                              </span>
                            </div>
                            <p className="text-[10px] text-neutral-500 font-medium leading-tight">
                              {tierData.desc}
                            </p>
                            <ul className="space-y-1.5 pt-1">
                              {tierData.features.map((feature, fIdx) => (
                                <li key={fIdx} className="flex items-start gap-1 text-[10px] text-neutral-600 leading-normal">
                                  <Check className="w-3 h-3 text-emerald-600 shrink-0 mt-0.5" />
                                  <span className="font-semibold">{feature}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* STEP 3: SECURE PAYSTACK CHECKOUT */}
                <div className="bg-white border border-neutral-200 p-6 rounded-3xl shadow-xs space-y-5">
                  <span className="text-xs font-extrabold text-neutral-400 uppercase tracking-widest font-mono block">
                    STEP 3: SECURE PAYSTACK CHECKOUT
                  </span>

                  {/* Payment Option Toggle: One-time vs Auto-Renew */}
                  <div className="flex bg-neutral-100/90 p-1 rounded-2xl gap-1">
                    <button
                      type="button"
                      onClick={() => setPaystackMode('one-time')}
                      className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-extrabold transition flex items-center justify-center gap-2 cursor-pointer ${
                        paystackMode === 'one-time'
                          ? 'bg-white text-neutral-800 shadow-xs border border-neutral-200/60'
                          : 'text-neutral-500 hover:text-neutral-700'
                      }`}
                    >
                      <CreditCard className="w-4 h-4 text-neutral-600" />
                      <span>One-time payment</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setPaystackMode('auto-renew')}
                      className={`flex-1 py-2.5 px-4 rounded-xl text-xs transition flex items-center justify-center gap-2 cursor-pointer ${
                        paystackMode === 'auto-renew'
                          ? 'bg-white text-neutral-800 shadow-xs border border-neutral-200/60 font-extrabold'
                          : 'text-neutral-500 hover:text-neutral-700 font-medium'
                      }`}
                    >
                      <ChevronRight className="w-4 h-4 text-neutral-400" />
                      <span>Subscribe (auto-renew)</span>
                    </button>
                  </div>

                  {/* Selected Plan Details Container */}
                  <div className="bg-neutral-50/70 border border-neutral-200/80 p-4 sm:p-5 rounded-2xl flex items-center justify-between gap-4">
                    <div className="space-y-0.5">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 font-mono block">
                        SELECTED PLAN
                      </span>
                      <h4 className="text-base font-extrabold text-neutral-800">
                        {selectedMode === 'Combined' ? 'Complete Suite ' + selectedPlan : selectedMode + ' ' + selectedPlan}
                      </h4>
                      <p className="text-xs text-neutral-500 font-medium">
                        Billed {billingCycle.toLowerCase()} — renew anytime
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 font-mono block">
                        TOTAL
                      </span>
                      <div className="text-xl sm:text-2xl font-black font-mono text-[#00B87A]">
                        ₦{currentPrice.toLocaleString()}
                      </div>
                    </div>
                  </div>

                  {/* Main Paystack Action Button */}
                  <button
                    type="button"
                    onClick={handlePaystackCheckout}
                    disabled={isSubmittingPayment}
                    className="w-full py-3.5 bg-[#00B87A] hover:bg-[#00a36c] active:scale-98 text-white rounded-2xl font-extrabold text-sm flex items-center justify-center gap-2 shadow-sm transition cursor-pointer disabled:opacity-50"
                  >
                    {isSubmittingPayment ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        <span>Processing Paystack Checkout...</span>
                      </>
                    ) : (
                      <>
                        <ShieldCheck className="w-5 h-5" />
                        <span>Pay ₦{currentPrice.toLocaleString()} with Paystack</span>
                        <ChevronRight className="w-4 h-4" />
                      </>
                    )}
                  </button>

                  {/* Security Footnote */}
                  <div className="flex items-center justify-center gap-1.5 text-xs text-neutral-400 font-medium text-center">
                    <ShieldCheck className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                    <span>Secured by Paystack · 256-bit SSL · PCI DSS compliant · No card data touches this app</span>
                  </div>

                  {/* OR Separator */}
                  <div className="relative flex items-center justify-center my-4">
                    <div className="border-t border-neutral-200 w-full"></div>
                    <span className="bg-white px-3 text-xs font-mono font-bold text-neutral-400 uppercase absolute">OR</span>
                  </div>

                  {/* Secondary Bank Transfer Option */}
                  <button
                    type="button"
                    onClick={() => setShowManualTransfer(!showManualTransfer)}
                    className={`w-full py-3 border rounded-2xl font-bold text-xs flex items-center justify-center gap-2 transition cursor-pointer ${
                      showManualTransfer
                        ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                        : 'bg-[#F0F5FF] hover:bg-blue-100/70 text-[#1D4ED8] border-blue-200/70'
                    }`}
                  >
                    <CreditCard className="w-4 h-4" />
                    <span>{showManualTransfer ? 'Hide Manual Bank Transfer' : 'Pay with Bank Transfer'}</span>
                  </button>

                  <p className="text-[11px] text-neutral-400 font-medium text-center">
                    Transfer directly to our PalmPay account · verified manually within 24 hours
                  </p>
                </div>

                {/* Manual Subscription Payment Plans Section */}
                {showManualTransfer && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2 text-left">
                    {/* Transfer Bank Details Card */}
                    <div className="bg-white border border-neutral-200 p-5 rounded-2xl shadow-xs space-y-4">
                      <span className="text-xs font-extrabold text-neutral-400 uppercase tracking-widest font-mono block">Step 1: Transfer the subscription amount</span>
                      
                      <div className="space-y-3.5 bg-neutral-50 p-4 rounded-xl border border-neutral-100">
                        <div>
                          <span className="text-[10px] uppercase font-bold text-neutral-400 tracking-wider font-mono block">Bank Name</span>
                          <span className="text-sm font-black text-neutral-800">PalmPay</span>
                        </div>
                        <div>
                          <span className="text-[10px] uppercase font-bold text-neutral-400 tracking-wider font-mono block">Account Name</span>
                          <span className="text-sm font-black text-neutral-800">BASHAR NUHU</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <div>
                            <span className="text-[10px] uppercase font-bold text-neutral-400 tracking-wider font-mono block">Account Number</span>
                            <span className="text-base font-extrabold text-[#00B87A] font-mono tracking-wider">8956107363</span>
                          </div>
                          <button
                            onClick={() => copyToClipboard('8956107363', 'account')}
                            className="p-2 bg-white hover:bg-neutral-100 text-neutral-500 hover:text-neutral-700 border border-neutral-200 rounded-lg shadow-2xs transition cursor-pointer active:scale-95 flex items-center gap-1 text-[10px] font-bold"
                          >
                            {copiedAccount ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                            {copiedAccount ? 'Copied' : 'Copy'}
                          </button>
                        </div>
                        <div className="flex justify-between items-center border-t border-dashed border-neutral-200 pt-3">
                          <div>
                            <span className="text-[10px] uppercase font-bold text-neutral-400 tracking-wider font-mono block">Required Payment Amount</span>
                            <div className="relative mt-1">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 font-bold text-sm">₦</span>
                              <input
                                type="number"
                                value={submittedAmount}
                                onChange={(e) => setSubmittedAmount(e.target.value)}
                                placeholder={currentPrice.toString()}
                                className="w-full pl-7 pr-3 py-2 bg-white border border-neutral-200 rounded-xl text-sm font-mono font-black text-neutral-800 focus:outline-none focus:border-[#00B87A]"
                              />
                            </div>
                            <p className="text-[9px] text-amber-600 font-bold mt-1 uppercase">
                              * EXACTLY ₦{currentPrice.toLocaleString()} for {selectedPlan} {selectedMode} ({billingCycle})
                            </p>
                          </div>
                        </div>

                        <div className="flex justify-between items-center border-t border-dashed border-neutral-200 pt-3">
                          <div>
                            <span className="text-[10px] uppercase font-bold text-neutral-400 tracking-wider font-mono block">Your Unique Reference</span>
                            <span className="text-xs font-black text-neutral-800 font-mono select-all">{paymentReference}</span>
                          </div>
                          <button
                            onClick={() => copyToClipboard(paymentReference, 'ref')}
                            className="p-2 bg-white hover:bg-neutral-100 text-neutral-500 hover:text-neutral-700 border border-neutral-200 rounded-lg shadow-2xs transition cursor-pointer active:scale-95 flex items-center gap-1 text-[10px] font-bold"
                          >
                            {copiedRef ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                            {copiedRef ? 'Copied' : 'Copy'}
                          </button>
                        </div>
                      </div>

                      <div className="space-y-1.5 p-3.5 bg-amber-50/40 border border-amber-100 rounded-xl text-[11px] text-amber-800 leading-relaxed">
                        <p className="font-extrabold flex items-center gap-1">
                          <AlertCircle className="w-3.5 h-3.5 text-amber-600" /> Transfer Instructions:
                        </p>
                        <ul className="list-decimal pl-4.5 space-y-1 font-medium text-amber-700">
                          <li>Transfer <strong>₦{currentPrice.toLocaleString()}</strong> to the PalmPay account above.</li>
                          <li>Include your Unique Reference <strong>{paymentReference}</strong> in the bank transfer transaction memo/narration field.</li>
                          <li>Take a screenshot or download the payment receipt.</li>
                        </ul>
                      </div>
                    </div>

                    {/* Receipt Upload Form Card */}
                    <div className="bg-white border border-neutral-200 p-5 rounded-2xl shadow-xs flex flex-col justify-between">
                      <div>
                        <span className="text-xs font-extrabold text-neutral-400 uppercase tracking-widest font-mono block mb-4">Step 2: Upload receipt and confirm</span>
                        
                        {((mySubscription?.status === 'Active' || mySubscription?.status === 'Pending Review' || paymentHistory.some(p => p.status === 'Pending Review' || p.status === 'Pending')) && mySubscription?.status !== 'Rejected' && mySubscription?.status !== 'Expired') ? (
                          <div className="bg-emerald-50/70 border border-emerald-200 p-6 rounded-2xl text-center space-y-3 my-4">
                            <ShieldCheck className="w-10 h-10 text-[#00B87A] mx-auto" />
                            <h4 className="font-black text-xs text-emerald-900 uppercase tracking-wide">
                              {mySubscription?.status === 'Active' ? 'Active Subscription Exists' : 'Receipt Under Review'}
                            </h4>
                            <p className="text-[11px] text-emerald-700 leading-relaxed font-medium">
                              {mySubscription?.status === 'Active'
                                ? `You currently have an active ${mySubscription?.plan} subscription. Re-upload is disabled until expiration.`
                                : `Your payment reference ${mySubscription?.lastPaymentReference || 'PTR-...'} is currently undergoing review by the administrator. Re-upload is disabled.`}
                            </p>
                          </div>
                        ) : (
                          <div className="space-y-4">
                            <div className="border-2 border-dashed border-neutral-200 rounded-2xl p-6 text-center hover:bg-neutral-50 transition relative flex flex-col items-center justify-center gap-2 min-h-[140px] cursor-pointer">
                              <input
                                type="file"
                                accept="image/png, image/jpeg, image/jpg, application/pdf"
                                onChange={handleReceiptUploadChange}
                                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                              />
                              {receiptFile ? (
                                <div className="space-y-2">
                                  <div className="w-10 h-10 bg-emerald-50 border border-emerald-100 text-[#00B87A] rounded-xl flex items-center justify-center mx-auto shadow-2xs">
                                    <FileText className="w-5 h-5" />
                                  </div>
                                  <div className="space-y-0.5">
                                    <p className="text-xs font-bold text-neutral-800 truncate max-w-[200px] mx-auto">{receiptFile.name}</p>
                                    <p className="text-[10px] text-neutral-400 font-mono">{(receiptFile.size / (1024 * 1024)).toFixed(2)} MB</p>
                                  </div>
                                  <span className="text-[10px] text-[#00B87A] font-bold flex items-center justify-center gap-1 bg-emerald-50 py-0.5 px-2 rounded-full border border-emerald-100 max-w-[140px] mx-auto">
                                    <Check className="w-3 h-3" /> Loaded Successfully
                                  </span>
                                </div>
                              ) : (
                                <>
                                  <Upload className="w-8 h-8 text-neutral-400 mx-auto animate-pulse" />
                                  <p className="text-xs font-bold text-neutral-600">Drag & Drop or Click to Upload</p>
                                  <p className="text-[10px] text-neutral-400 font-medium">Supports PNG, JPEG, JPG, and PDF (Max 5MB)</p>
                                </>
                              )}
                            </div>

                            {uploadError && (
                              <p className="text-[10px] text-red-600 font-bold bg-red-50 p-2 rounded-lg border border-red-100 flex items-center gap-1.5">
                                <XCircle className="w-4 h-4 shrink-0" /> {uploadError}
                              </p>
                            )}
                          </div>
                        )}
                      </div>

                      {!( (mySubscription?.status === 'Active' || mySubscription?.status === 'Pending Review' || paymentHistory.some(p => p.status === 'Pending Review' || p.status === 'Pending')) && mySubscription?.status !== 'Rejected' && mySubscription?.status !== 'Expired' ) && (
                        <div className="pt-4 mt-6 border-t border-neutral-100">
                          <button
                            onClick={handleConfirmPayment}
                            disabled={isSubmittingPayment}
                            className={`w-full py-3 rounded-xl font-bold text-xs text-white transition flex items-center justify-center gap-2 cursor-pointer shadow-sm ${
                              isSubmittingPayment
                                ? 'bg-neutral-400 cursor-not-allowed'
                                : 'bg-[#00B87A] hover:bg-[#00a36c] active:scale-98'
                            }`}
                          >
                            {isSubmittingPayment ? (
                              <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Submitting For Verification...
                              </>
                            ) : (
                              <>
                                <ShieldCheck className="w-4 h-4" />
                                Confirm Payment (₦{currentPrice.toLocaleString()})
                              </>
                            )}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            {/* 3. PAYMENT HISTORY TAB */}
            {activeTab === 'history' && (
              <motion.div 
                key="history-tab"
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 5 }}
                className="space-y-4"
              >
                {/* Notice for Pending Payment over 24 hours */}
                {paymentHistory.some(p => p.status === 'Pending Review' && (Date.now() - new Date(p.paymentDate).getTime()) > 24 * 60 * 60 * 1000) && (
                  <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3 shadow-xs">
                    <div className="flex items-center gap-2.5">
                      <Clock className="w-5 h-5 text-amber-600 shrink-0 animate-pulse" />
                      <div>
                        <p className="text-xs font-extrabold text-amber-900">Having trouble with your payment?</p>
                        <p className="text-[11px] text-amber-700 font-medium">Your payment has been under review for more than 24 hours. Connect directly with support on WhatsApp for quick assistance.</p>
                      </div>
                    </div>
                    <WhatsAppSupportButton
                      context="Pending Payment (>24h)"
                      userName={currentUser.name}
                      businessName={currentUser.businessName || currentUser.areaOfWorking}
                      phone={currentUser.phone || currentUser.phoneNumber}
                      role={currentUser.role}
                      issue="Payment verification pending for over 24 hours"
                      buttonText="Contact Support on WhatsApp"
                      variant="primary"
                    />
                  </div>
                )}

                <div className="bg-white border border-neutral-200 rounded-2xl overflow-hidden shadow-xs">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-neutral-50/80 border-b border-neutral-200 text-[10px] font-bold text-neutral-400 uppercase tracking-wider font-mono">
                        <th className="p-4">Plan Name</th>
                        <th className="p-4">Amount</th>
                        <th className="p-4">Reference</th>
                        <th className="p-4">Payment Date</th>
                        <th className="p-4">Status</th>
                        <th className="p-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-150 text-xs">
                      {paymentHistory.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="p-8 text-center text-neutral-400 font-medium">
                            No subscription history found. Upgrade or subscribe to unlock manual payment transactions!
                          </td>
                        </tr>
                      ) : (
                        paymentHistory.map((h) => (
                          <tr key={h.id} className="hover:bg-neutral-50/50 transition">
                            <td className="p-4 font-extrabold text-neutral-800">{(h as any).mode || 'Postracker'} {h.plan}</td>
                            <td className="p-4 font-mono font-extrabold text-neutral-800">₦{h.amount.toLocaleString()}</td>
                            <td className="p-4 font-mono select-all text-neutral-500 font-bold">{h.reference}</td>
                            <td className="p-4 text-neutral-500">{new Date(h.paymentDate).toLocaleDateString()}</td>
                            <td className="p-4">
                              <div className="flex items-center gap-2">
                                <StatusBadge status={h.status} />
                                {(h.status === 'Pending Review' || h.status === 'Pending') && (
                                  isSuperAdmin ||
                                  currentUser?.phone === '08141106560' ||
                                  (currentUser as any)?.phoneNumber === '08141106560' ||
                                  currentUser?.id === '08141106560'
                                ) && (
                                  (() => {
                                   const mode = (h as any).mode || 'Postracker';
                                   const cycle = (h as any).cycle || 'Monthly';
                                   const expected = getCurrentPrice(mode, h.plan as any, cycle);
                                   const isMismatched = Math.abs(h.amount - expected) > 1; // Tolerance for floats
                                   const isBlocked = isMismatched && currentUser?.phone !== '08141106560';
                                   
                                   return (
                                     <div className="flex flex-col gap-1">
                                       <button
                                         type="button"
                                         onClick={() => handleApproveSubscription(h)}
                                         disabled={isApproving || isBlocked}
                                         className={`px-2.5 py-1 text-white rounded-lg font-extrabold text-[10px] cursor-pointer transition inline-flex items-center gap-1 shadow-2xs shrink-0 ${
                                           isBlocked 
                                             ? 'bg-neutral-300 text-neutral-500 cursor-not-allowed opacity-70' 
                                             : 'bg-[#00B87A] hover:bg-[#00a36c]'
                                         }`}
                                       >
                                         <CheckCircle2 className="w-3 h-3" /> APPROVE
                                       </button>
                                       {isMismatched && (
                                         <span className="text-[8px] text-red-600 font-bold uppercase whitespace-nowrap bg-red-50 px-1 rounded border border-red-100">
                                           Exact Payment Required
                                         </span>
                                       )}
                                     </div>
                                   );
                                 })()
                                )}
                              </div>
                            </td>
                            <td className="p-4 text-right space-x-1.5 shrink-0 whitespace-nowrap">
                              <button
                                onClick={() => setSelectedReceiptUrl(h.receiptUrl)}
                                className="px-2.5 py-1 bg-neutral-100 hover:bg-neutral-200 text-neutral-600 rounded-lg font-bold text-[10px] cursor-pointer transition"
                              >
                                View Receipt
                              </button>
                              {h.status === 'Approved' && (
                                <button
                                  onClick={() => setSelectedInvoice(h)}
                                  className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-[#00B87A] border border-emerald-100 rounded-lg font-bold text-[10px] cursor-pointer transition inline-flex items-center gap-1"
                                >
                                  <FileText className="w-3 h-3" /> Invoice
                                </button>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </motion.div>
            )}

            {/* 4. ADMIN VERIFICATION TAB */}
            {activeTab === 'admin' && currentUser.role === 'Manager' && (
              <motion.div 
                key="admin-tab"
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 5 }}
                className="space-y-4"
              >
                {/* Admin Search & Filters */}
                <div className="bg-white border border-neutral-200 p-4 rounded-2xl shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="relative w-full sm:max-w-xs">
                    <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Search Customer, Business, Ref..."
                      value={adminSearch}
                      onChange={(e) => setAdminSearch(e.target.value)}
                      className="w-full pl-9 pr-4 py-2 bg-neutral-50 border border-neutral-200 rounded-xl focus:outline-none focus:border-[#00B87A] text-xs font-bold"
                    />
                  </div>
                  
                  <div className="flex gap-2 items-center w-full sm:w-auto">
                    <Filter className="w-4 h-4 text-neutral-400" />
                    <select
                      value={adminStatusFilter}
                      onChange={(e) => setAdminStatusFilter(e.target.value as any)}
                      className="px-3.5 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-xs font-bold focus:outline-none text-neutral-800 focus:border-[#00B87A]"
                    >
                      <option value="All">All Statuses</option>
                      <option value="Pending Review">Pending Review</option>
                      <option value="Approved">Approved</option>
                      <option value="Rejected">Rejected</option>
                    </select>
                  </div>
                </div>

                {/* Subscriptions Table */}
                <div className="bg-white border border-neutral-200 rounded-2xl overflow-hidden shadow-xs">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-neutral-50/80 border-b border-neutral-200 text-[10px] font-bold text-neutral-400 uppercase tracking-wider font-mono">
                        <th className="p-4">Customer Details</th>
                        <th className="p-4">Plan Name</th>
                        <th className="p-4">Amount</th>
                        <th className="p-4">Reference</th>
                        <th className="p-4">Payment Date</th>
                        <th className="p-4">Status</th>
                        <th className="p-4 text-right">Verification</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-150 text-xs">
                      {filteredAdminPayments.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="p-8 text-center text-neutral-400 font-medium">
                            No manual payments matching current filters.
                          </td>
                        </tr>
                      ) : (
                        filteredAdminPayments.map((p) => (
                          <tr key={p.id} className="hover:bg-neutral-50/50 transition">
                            <td className="p-4 space-y-0.5">
                              <span className="font-extrabold text-neutral-800 block">{p.customerName}</span>
                              <span className="text-[10px] text-neutral-400 block font-mono">{p.businessName} • {p.phoneNumber}</span>
                            </td>
                            <td className="p-4 font-bold text-neutral-800">{(p as any).mode || 'Postracker'} {p.plan}</td>
                            <td className="p-4 font-mono font-extrabold text-neutral-800">₦{p.amount.toLocaleString()}</td>
                            <td className="p-4 font-mono font-bold text-neutral-500 select-all">{p.reference}</td>
                            <td className="p-4 text-neutral-500">{new Date(p.paymentDate).toLocaleDateString()}</td>
                            <td className="p-4">
                              <StatusBadge status={p.status} />
                            </td>
                            <td className="p-4 text-right whitespace-nowrap space-x-1.5 shrink-0">
                              <button
                                onClick={() => setSelectedReceiptUrl(p.receiptUrl)}
                                className="px-2.5 py-1 bg-neutral-100 hover:bg-neutral-200 text-neutral-600 rounded-lg font-bold text-[10px] cursor-pointer transition inline-flex items-center gap-1"
                              >
                                <Eye className="w-3 h-3" /> View Receipt
                              </button>
                              
                              {p.status === 'Pending Review' && (
                                <>
                                  {isSuperAdmin ? (
                                    <>
                                      <button
                                        onClick={() => handleApprovePayment(p)}
                                        className="px-2.5 py-1 bg-[#00B87A] hover:bg-[#00a36c] text-white rounded-lg font-bold text-[10px] cursor-pointer transition inline-flex items-center gap-1 shadow-2xs"
                                      >
                                        Approve
                                      </button>
                                      <button
                                        onClick={() => setRejectionInputId(p.id)}
                                        className="px-2.5 py-1 bg-red-50 hover:bg-red-100 text-red-600 border border-red-100 rounded-lg font-bold text-[10px] cursor-pointer transition inline-flex items-center gap-1"
                                      >
                                        Reject
                                      </button>
                                    </>
                                  ) : (
                                    <span className="text-[10px] font-mono font-bold text-amber-600 bg-amber-50 px-2 py-1 rounded-md border border-amber-100 select-none">
                                      Pending Review
                                    </span>
                                  )}
                                </>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </motion.div>
            )}

          </AnimatePresence>
        </div>

        {/* Modal Footer Assistance Bar */}
        <div className="px-6 py-3 bg-white border-t border-neutral-200 flex flex-col sm:flex-row items-center justify-between gap-2 shrink-0">
          <span className="text-xs font-semibold text-neutral-500">
            Need help with your subscription or payment?
          </span>
          <WhatsAppSupportButton
            context="Billing Support"
            userName={currentUser.name}
            businessName={currentUser.businessName || currentUser.areaOfWorking}
            phone={currentUser.phone || currentUser.phoneNumber}
            role={currentUser.role}
            buttonText="Contact Support on WhatsApp"
            variant="compact"
          />
        </div>

        {/* Dynamic Lightboxes & Overlays inside modal context */}
        {/* Receipt Image Lightbox Overlay */}
        {selectedReceiptUrl && (
          <div className="fixed inset-0 bg-black/85 z-[60] flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl max-w-lg w-full overflow-hidden flex flex-col border border-neutral-100 max-h-[85vh]">
              <div className="px-5 py-3 border-b border-neutral-200 flex justify-between items-center bg-white shrink-0">
                <span className="text-xs font-mono font-bold text-neutral-500 uppercase tracking-wider">Payment Receipt Attachment</span>
                <button 
                  onClick={() => setSelectedReceiptUrl(null)}
                  className="p-1 hover:bg-neutral-100 rounded-full text-neutral-400 hover:text-neutral-600 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="flex-1 overflow-auto bg-neutral-100 flex items-center justify-center p-4 min-h-[300px]">
                {selectedReceiptUrl.startsWith('data:application/pdf') ? (
                  <div className="text-center p-8 space-y-4">
                    <FileText className="w-16 h-16 text-red-500 mx-auto" />
                    <p className="text-sm font-bold text-neutral-800">PDF Document Receipt</p>
                    <a 
                      href={selectedReceiptUrl} 
                      download="payment-receipt.pdf"
                      className="inline-flex items-center gap-1.5 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold transition"
                    >
                      <Download className="w-4 h-4" /> Download PDF Receipt
                    </a>
                  </div>
                ) : (
                  <img 
                    src={selectedReceiptUrl} 
                    alt="Uploaded Receipt" 
                    className="max-h-[60vh] object-contain rounded-xl shadow-xs" 
                    referrerPolicy="no-referrer"
                  />
                )}
              </div>
            </div>
          </div>
        )}

        {/* Invoice Modal Overlay */}
        {selectedInvoice && (
          <div className="fixed inset-0 bg-black/80 z-[60] flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl max-w-xl w-full p-8 shadow-2xl border border-neutral-200 text-neutral-800 flex flex-col gap-6 relative">
              <button 
                onClick={() => setSelectedInvoice(null)}
                className="absolute top-5 right-5 p-1.5 hover:bg-neutral-100 rounded-full text-neutral-400 hover:text-neutral-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>

              {/* Printable Invoice Branding */}
              <div className="text-center space-y-1 pb-4 border-b border-neutral-200">
                <h1 className="text-xl font-black tracking-tight text-neutral-900 uppercase font-mono">POSTrack Invoice Receipt</h1>
                <p className="text-[10px] text-neutral-400 font-mono font-medium">Billed to: {selectedInvoice.businessName}</p>
                <p className="text-[10px] text-[#00B87A] font-bold">Transaction Reference: {selectedInvoice.reference}</p>
              </div>

              {/* Invoice Breakdown details */}
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div>
                    <span className="text-neutral-400 font-mono text-[10px] uppercase block tracking-wider font-bold">Customer Details</span>
                    <p className="font-extrabold text-neutral-800 pt-0.5">{selectedInvoice.customerName}</p>
                    <p className="text-[11px] text-neutral-500 font-medium">{selectedInvoice.phoneNumber}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-neutral-400 font-mono text-[10px] uppercase block tracking-wider font-bold">Invoice Details</span>
                    <p className="font-bold text-neutral-800 pt-0.5">Plan: {selectedInvoice.plan}</p>
                    <p className="text-neutral-500 font-mono text-[10px]">Date: {new Date(selectedInvoice.paymentDate).toLocaleDateString()}</p>
                  </div>
                </div>

                <div className="border border-neutral-200 rounded-2xl bg-neutral-50/50 p-4 space-y-3 mt-4">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold text-neutral-700">{selectedInvoice.plan} Plan Subscription (1 Month)</span>
                    <span className="font-mono font-bold text-neutral-800">₦{selectedInvoice.amount.toLocaleString()}</span>
                  </div>
                  <div className="border-t border-dashed border-neutral-200 pt-3 flex justify-between items-center text-sm">
                    <span className="font-extrabold text-neutral-800">Total Billed:</span>
                    <span className="font-mono font-black text-[#00B87A]">₦{selectedInvoice.amount.toLocaleString()}</span>
                  </div>
                </div>
              </div>

              <div className="p-3 bg-emerald-50/40 border border-emerald-100 rounded-2xl text-[11px] text-emerald-800 leading-relaxed text-center">
                <p className="font-extrabold flex items-center justify-center gap-1">
                  <ShieldCheck className="w-4 h-4 text-[#00B87A]" /> Payment Status: PAID & APPROVED
                </p>
                <p className="text-[10px] text-emerald-600 font-medium">This document acts as valid, tax-compliant booking receipt for POS Track SaaS license.</p>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => window.print()}
                  className="flex-1 py-2.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 rounded-xl font-bold text-xs cursor-pointer transition active:scale-98"
                >
                  Print Invoice
                </button>
                <button
                  onClick={() => setSelectedInvoice(null)}
                  className="flex-1 py-2.5 bg-[#00B87A] hover:bg-[#00a36c] text-white rounded-xl font-bold text-xs cursor-pointer transition active:scale-98"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Reject reason spec dialog */}
        {rejectionInputId && (
          <div className="fixed inset-0 bg-black/75 z-[60] flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-neutral-200 text-neutral-800 flex flex-col gap-4">
              <div className="space-y-1">
                <h3 className="font-black text-sm text-neutral-800">Reject Transfer Verification</h3>
                <p className="text-[10px] text-neutral-500 font-medium">Please provide a constructive rejection reason explaining what went wrong to the customer.</p>
              </div>
              <textarea
                placeholder="e.g., Transfer memo is missing unique reference, receipt file image corrupted, or payment was not received."
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                rows={3}
                className="w-full p-3 bg-neutral-50 border border-neutral-200 rounded-xl text-xs font-medium focus:outline-none focus:border-red-500 font-sans"
              />
              <div className="flex gap-2.5 pt-2">
                <button
                  onClick={() => { setRejectionInputId(null); setRejectionReason(''); }}
                  className="flex-1 py-2 bg-neutral-100 hover:bg-neutral-200 rounded-xl text-xs font-bold transition text-neutral-700 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleRejectPayment}
                  className="flex-1 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold transition cursor-pointer"
                >
                  Reject Receipt
                </button>
              </div>
            </div>
          </div>
        )}

      </motion.div>
    </div>
  );
}

// Compact Status Badge Component
function StatusBadge({ status }: { status: string }) {
  let styles = 'bg-neutral-100 text-neutral-600 border-neutral-200';
  if (status === 'Approved' || status === 'Active' || status === 'Success') {
    styles = 'bg-emerald-50 text-emerald-700 border-emerald-100';
  } else if (status === 'Pending Review' || status === 'Pending') {
    styles = 'bg-amber-50 text-amber-700 border-amber-100 animate-pulse';
  } else if (status === 'Rejected' || status === 'Failed') {
    styles = 'bg-rose-50 text-rose-700 border-rose-100';
  } else if (status === 'Expired') {
    styles = 'bg-red-50 text-red-700 border-red-100';
  }

  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-black font-mono tracking-wider uppercase px-2 py-0.5 rounded-full border ${styles}`}>
      {status === 'Approved' || status === 'Active' || status === 'Success' ? <CheckCircle2 className="w-2.5 h-2.5" /> : null}
      {status === 'Pending Review' || status === 'Pending' ? <Clock className="w-2.5 h-2.5" /> : null}
      {status === 'Rejected' || status === 'Failed' ? <XCircle className="w-2.5 h-2.5" /> : null}
      {status}
    </span>
  );
}

// Icon fallbacks inside modal scope
