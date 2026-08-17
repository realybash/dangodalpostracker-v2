import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, where, onSnapshot, doc, setDoc, addDoc, getDocs, limit } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { User } from '../types';
import { QRCodeSVG } from 'qrcode.react';
import { 
  Users, Share2, Copy, Award, DollarSign, CreditCard, ArrowUpRight, 
  CheckCircle2, Clock, AlertTriangle, Activity, Calendar, Coins, 
  Wallet, Banknote, Sparkles, Check, X, Shield, RefreshCw, Landmark, ShieldCheck,
  QrCode, Download, TrendingUp
} from 'lucide-react';

interface ReferralsTabProps {
  currentUser: User;
  showAppNotification?: (msg: string, type: 'success' | 'info' | 'error') => void;
  onOpenBillingModal?: (plan: 'Starter' | 'Professional' | 'Business' | 'Enterprise') => void;
}

export interface SubscriptionData {
  id: string;
  ownerId: string;
  plan: 'Starter' | 'Professional' | 'Business' | 'Enterprise' | 'Free Trial';
  status: 'Trial' | 'Active' | 'Expired' | 'Cancelled';
  serviceCategory?: 'Postracker' | 'Inventory' | 'Combined';
  billingCycle?: 'Monthly' | 'Bi-annual' | 'Annual';
  trialStartDate: string;
  trialEndDate: string;
  subscriptionStartDate: string | null;
  subscriptionEndDate: string | null;
  referredBy: string | null;
  payoutBalance: number;
  payoutLifetime: number;
}

const MODES = {
  Postracker: { id: 'Postracker', name: 'POSTRACKER PLAN' },
  Inventory: { id: 'Inventory', name: 'INVENTORY & SALE MANAGEMENT PLAN' },
  Combined: { id: 'Combined', name: 'POSTRACKER AND INVENTORY & SALE MANAGEMENT' }
} as const;

type SubscriptionMode = keyof typeof MODES;

const PLAN_RATES = {
  Postracker: {
    Starter: { 
      price: 2000, 
      commission: 500,
      features: [
        '1 Physical POS Terminal Tracking',
        '1 Cashier/Staff Login Account',
        'Daily POS Terminal Reconciliation',
        'Digital Receipts & Journal Log',
        'Standard Email & Chat Support'
      ]
    },
    Professional: { 
      price: 5000, 
      commission: 1000,
      features: [
        'Up to 3 POS Terminals & Branches',
        'Up to 5 Cashier & Staff Accounts',
        'Excess & Shortage Audit Reports',
        'Daily Discrepancy Alert System',
        'Priority Customer Support'
      ]
    },
    Business: { 
      price: 10000, 
      commission: 2000,
      features: [
        'Unlimited POS Terminals & Branches',
        'Unlimited Cashier & Manager Accounts',
        'Real-time Multi-Branch Audit Portal',
        'Custom Receipt Branding & Export',
        'Dedicated 24/7 Account Manager'
      ]
    },
    Enterprise: { 
      price: 0, 
      commission: 0,
      features: [
        'Custom Multi-Store API Integration',
        'Tailored SLA & Custom Contract',
        'Dedicated Cloud Node Deployment',
        'On-site Staff Training & Setup',
        '24/7 Dedicated VIP Phone Support'
      ]
    }
  },
  Inventory: {
    Starter: { 
      price: 2000, 
      commission: 500,
      features: [
        'Up to 100 Stock Inventory Items',
        'Basic Sales Tracking & Receipts',
        'Low Stock Warning Alerts',
        '1 Cashier/Staff Account',
        'Standard Email & Chat Support'
      ]
    },
    Professional: { 
      price: 5000, 
      commission: 1000,
      features: [
        'Up to 1,000 Inventory Items',
        'Barcode Scanner Integration',
        'Sales Analytics & Profit Reports',
        'Up to 5 Cashier/Staff Accounts',
        'Priority Customer Support'
      ]
    },
    Business: { 
      price: 10000, 
      commission: 2000,
      features: [
        'Unlimited Inventory Items',
        'Multi-Warehouse & Stock Transfer',
        'Automated Purchase Re-ordering',
        'Unlimited Staff & Manager Logins',
        'Dedicated 24/7 Account Manager'
      ]
    },
    Enterprise: { 
      price: 0, 
      commission: 0,
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
      price: 3500, 
      commission: 700,
      features: [
        '1 POS Terminal & 200 Stock Items',
        'Integrated Sales & Reconciliation',
        '1 Staff/Cashier Account',
        'Digital Receipts & WhatsApp Logs',
        'Standard Email & Chat Support'
      ]
    },
    Professional: { 
      price: 8000, 
      commission: 1500,
      features: [
        '3 POS Terminals & 2,000 Items',
        'Barcode Scanner & Audit Reports',
        'Up to 5 Cashier & Manager Accounts',
        'Automated Profit & Loss Analytics',
        'Priority Customer Support'
      ]
    },
    Business: { 
      price: 15000, 
      commission: 3000,
      features: [
        'Unlimited POS Terminals & Items',
        'Full Multi-Branch & Multi-Warehouse',
        'Unlimited Staff & Manager Accounts',
        'Custom PDF Export & Receipt Branding',
        'Dedicated 24/7 Account Manager'
      ]
    },
    Enterprise: { 
      price: 0, 
      commission: 0,
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

export const getPlanRate = (mode?: string, plan?: string) => {
  const safeMode = (mode && mode in PLAN_RATES) ? (mode as SubscriptionMode) : 'Postracker';
  const modeRates = PLAN_RATES[safeMode] || PLAN_RATES.Postracker;
  
  let cleanPlan = plan ? plan.replace(/ plan$/i, '').trim() : 'Starter';
  if (cleanPlan === 'Free Trial' || cleanPlan === 'Trial') {
    return { price: 0, commission: 0 };
  }
  if (!(cleanPlan in modeRates)) {
    cleanPlan = 'Starter';
  }
  return modeRates[cleanPlan as keyof typeof modeRates] || { price: 2000, commission: 500 };
};

export interface ReferralRecord {
  id: string;
  referrerId: string;
  referrerCode: string;
  referredId: string;
  referredName: string;
  referredEmail: string;
  referredPhone: string;
  status: 'Pending' | 'Registered' | 'Trial' | 'Trial Expired' | 'Waiting For Payment' | 'Payment Verified' | 'Active' | 'Commission Approved' | 'Commission Paid' | 'Cancelled' | 'Refunded' | 'Rejected';
  plan: string | null;
  mode?: string;
  billingCycle?: string;
  commissionAmount: number;
  createdAt: string;
}

export interface CommissionRecord {
  id: string;
  referrerId: string;
  referredId: string;
  referredName: string;
  amount: number;
  status: 'Approved' | 'Paid' | 'Pending';
  plan: string;
  mode?: string;
  timestamp: string;
  referrerCode?: string;
}

export interface PayoutRecord {
  id: string;
  ownerId: string;
  amount: number;
  bankName: string;
  accountNumber: string;
  accountName: string;
  status: 'Pending' | 'Approved' | 'Paid' | 'Rejected';
  method: 'Bank Transfer' | 'PalmPay' | 'OPay' | 'Moniepoint';
  timestamp: string;
}

export interface PaymentHistoryRecord {
  id: string;
  ownerId: string;
  amount: number;
  plan: string;
  status: 'Success' | 'Failed';
  timestamp: string;
  reference: string;
}

export default function ReferralsTab({ currentUser, showAppNotification, onOpenBillingModal }: ReferralsTabProps) {
  // Local States for real-time Firestore listeners
  const [mySubscription, setMySubscription] = useState<SubscriptionData | null>(null);
  const [myReferrals, setMyReferrals] = useState<ReferralRecord[]>([]);
  const [commissions, setCommissions] = useState<CommissionRecord[]>([]);
  const [payouts, setPayouts] = useState<PayoutRecord[]>([]);
  const [payments, setPayments] = useState<PaymentHistoryRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Copy states
  const [copiedCode, setCopiedCode] = useState<boolean>(false);
  const [copiedLink, setCopiedLink] = useState<boolean>(false);

  // Withdrawal form state
  const [withdrawAmount, setWithdrawAmount] = useState<string>('');
  const [withdrawMethod, setWithdrawMethod] = useState<'Bank Transfer' | 'PalmPay' | 'OPay' | 'Moniepoint'>('OPay');
  const [bankName, setBankName] = useState<string>('');
  const [accountNo, setAccountNo] = useState<string>('');
  const [accountName, setAccountName] = useState<string>('');
  const [submittingWithdraw, setSubmittingWithdraw] = useState<boolean>(false);

  // Simulation controls state
  const [showSimPanel, setShowSimPanel] = useState<boolean>(false);
  const [simReferredName, setSimReferredName] = useState<string>('');
  const [simReferredPhone, setSimReferredPhone] = useState<string>('');
  const [simReferredMode, setSimReferredMode] = useState<SubscriptionMode>('Postracker');
  const [simReferredPlan, setSimReferredPlan] = useState<'Starter' | 'Professional' | 'Business'>('Professional');

  const [activePlanMode, setActivePlanMode] = useState<SubscriptionMode>('Postracker');
  const [commissionTab, setCommissionTab] = useState<'Postracker' | 'Inventory' | 'Combined'>('Postracker');

  const referralCode = currentUser.referralCode || `POST-${currentUser.id.substring(4, 9).toUpperCase()}`;
  const referralLink = `${window.location.origin}/register?ref=${referralCode}`;

  // Helper to download QR code as PNG image
  const handleDownloadQR = () => {
    try {
      const svg = document.getElementById('referral-qr-code-svg');
      if (!svg) return;
      const svgData = new XMLSerializer().serializeToString(svg);
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();
      img.onload = () => {
        canvas.width = img.width + 40;
        canvas.height = img.height + 40;
        if (ctx) {
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 20, 20);
          const pngFile = canvas.toDataURL('image/png');
          const downloadLink = document.createElement('a');
          downloadLink.download = `Referral-QR-${referralCode}.png`;
          downloadLink.href = pngFile;
          downloadLink.click();
          if (showAppNotification) {
            showAppNotification('Referral QR Code downloaded successfully!', 'success');
          }
        }
      };
      img.src = 'data:image/svg+xml;base64,' + btoa(svgData);
    } catch (err) {
      console.error('QR Download Error:', err);
    }
  };

  // 👑 Super Admin Recognition: ID or Phone "08141106560" exclusively
  const isSaaSAdmin = useMemo(() => {
    if (!currentUser) return false;
    return (
      currentUser.phone === '08141106560' || 
      (currentUser as any).phoneNumber === '08141106560' || 
      currentUser.id === '08141106560'
    );
  }, [currentUser]);

  // 1. Fetch Subscription and setup defaults
  useEffect(() => {
    if (!currentUser.id) return;

    setLoading(true);
    const subRef = doc(db, 'subscriptions', currentUser.id);
    const unsubSub = onSnapshot(subRef, async (snapshot) => {
      if (snapshot.exists()) {
        setMySubscription(snapshot.data() as SubscriptionData);
        setLoading(false);
      } else {
        // Initialize default subscription doc
        const defaultSub: SubscriptionData = {
          id: currentUser.id,
          ownerId: currentUser.id,
          plan: 'Free Trial',
          status: 'Trial',
          trialStartDate: currentUser.createdAt || new Date().toISOString(),
          trialEndDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
          subscriptionStartDate: null,
          subscriptionEndDate: null,
          referredBy: currentUser.referredBy || null,
          payoutBalance: 0,
          payoutLifetime: 0
        };
        await setDoc(subRef, defaultSub);
        setMySubscription(defaultSub);
        setLoading(false);

        // If referred by someone, register the referral record
        if (currentUser.referredBy) {
          try {
            // Find referrer Manager
            const usersRef = collection(db, 'users');
            const q = query(usersRef, where('referralCode', '==', currentUser.referredBy.toUpperCase()));
            const querySnap = await getDocs(q);
            if (!querySnap.empty) {
              const referrer = querySnap.docs[0].data();
              const referralId = `${referrer.uid}_${currentUser.id}`;
              const refData: ReferralRecord = {
                id: referralId,
                referrerId: referrer.uid,
                referrerCode: referrer.referralCode,
                referredId: currentUser.id,
                referredName: currentUser.name || 'New Merchant',
                referredEmail: currentUser.email || `${currentUser.phone || 'merchant'}@opay-pos.com`,
                referredPhone: currentUser.phone || '',
                status: 'Trial',
                plan: null,
                commissionAmount: 0,
                createdAt: new Date().toISOString()
              };
              await setDoc(doc(db, 'referrals', referralId), refData);
            }
          } catch (err) {
            console.error('Failed to automatically record referral:', err);
          }
        }
      }
    });

    // Subscriptions to Referrals, Commissions, Payouts, and Payments
    const qReferrals = query(collection(db, 'referrals'), where('referrerId', '==', currentUser.id));
    const unsubRefs = onSnapshot(qReferrals, (snap) => {
      const itemsMap = new Map<string, ReferralRecord>();
      snap.forEach((d) => {
        const item = { id: d.id, ...d.data() } as ReferralRecord;
        if (item.referredId) {
          itemsMap.set(item.referredId, item);
        }
      });
      
      // Merge with existing referrals state
      setMyReferrals(prev => {
        const combinedMap = new Map<string, ReferralRecord>();
        // Add items from Firestore referrals collection first (takes priority)
        itemsMap.forEach((val, key) => combinedMap.set(key, val));
        // Fill in any referred users from users query that aren't in referrals collection yet
        prev.forEach(p => {
          if (!combinedMap.has(p.referredId)) {
            combinedMap.set(p.referredId, p);
          }
        });
        return Array.from(combinedMap.values());
      });
    });

    // Also listen to users collection for any Manager who registered with this manager's referralCode
    const qUsersReferred = query(
      collection(db, 'users'),
      where('role', '==', 'Manager'),
      where('referredBy', '==', referralCode.toUpperCase())
    );
    const unsubUsersReferred = onSnapshot(qUsersReferred, (snap) => {
      const usersReferredList: ReferralRecord[] = [];
      snap.forEach((d) => {
        const u = d.data();
        const uId = d.id || u.uid || u.id;
        usersReferredList.push({
          id: `${currentUser.id}_${uId}`,
          referrerId: currentUser.id,
          referrerCode: referralCode,
          referredId: uId,
          referredName: u.fullName || u.name || 'Referred Manager',
          referredEmail: u.email || `${u.phone || u.phoneNumber || 'merchant'}@opay-pos.com`,
          referredPhone: u.phone || u.phoneNumber || '',
          status: 'Trial',
          plan: 'Free Trial',
          commissionAmount: 0,
          createdAt: u.createdAt || new Date().toISOString()
        });
      });

      setMyReferrals(prev => {
        const combinedMap = new Map<string, ReferralRecord>();
        // Keep existing records from referrals collection
        prev.forEach(p => combinedMap.set(p.referredId, p));
        // Add usersReferredList if not already present
        usersReferredList.forEach(uRef => {
          if (!combinedMap.has(uRef.referredId)) {
            combinedMap.set(uRef.referredId, uRef);
          }
        });
        return Array.from(combinedMap.values());
      });
    });

    const qCommissions = query(collection(db, 'referral_commissions'), where('referrerId', '==', currentUser.id));
    const unsubComm = onSnapshot(qCommissions, (snap) => {
      const items: CommissionRecord[] = [];
      snap.forEach((d) => items.push({ id: d.id, ...d.data() } as CommissionRecord));
      setCommissions(items);
    });

    const qPayouts = query(collection(db, 'payouts'), where('ownerId', '==', currentUser.id));
    const unsubPayouts = onSnapshot(qPayouts, (snap) => {
      const items: PayoutRecord[] = [];
      snap.forEach((d) => items.push({ id: d.id, ...d.data() } as PayoutRecord));
      setPayouts(items);
    });

    const qPayments = query(collection(db, 'payment_history'), where('ownerId', '==', currentUser.id));
    const unsubPayments = onSnapshot(qPayments, (snap) => {
      const items: PaymentHistoryRecord[] = [];
      snap.forEach((d) => items.push({ id: d.id, ...d.data() } as PaymentHistoryRecord));
      setPayments(items);
    });

    return () => {
      unsubSub();
      unsubRefs();
      unsubUsersReferred();
      unsubComm();
      unsubPayouts();
      unsubPayments();
    };
  }, [currentUser.id, currentUser.referredBy, currentUser.referralCode]);

  const handleCopyCode = async () => {
    let success = false;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(referralCode);
        success = true;
      }
    } catch (e) {
      console.warn('Clipboard API writeText failed:', e);
    }

    if (!success) {
      try {
        const textarea = document.createElement('textarea');
        textarea.value = referralCode;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        success = document.execCommand('copy');
        document.body.removeChild(textarea);
      } catch (e) {
        console.error('Fallback execCommand failed:', e);
      }
    }

    setCopiedCode(true);
    if (showAppNotification) showAppNotification('Referral code copied!', 'success');
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleCopyLink = async () => {
    let success = false;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(referralLink);
        success = true;
      }
    } catch (e) {
      console.warn('Clipboard API writeText failed:', e);
    }

    if (!success) {
      try {
        const textarea = document.createElement('textarea');
        textarea.value = referralLink;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        success = document.execCommand('copy');
        document.body.removeChild(textarea);
      } catch (e) {
        console.error('Fallback execCommand failed:', e);
      }
    }

    setCopiedLink(true);
    if (showAppNotification) showAppNotification('Referral link copied to clipboard!', 'success');
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleShareLink = async () => {
    const shareText = `Join POS Track using my referral code (${referralCode}) to track your POS terminals and transactions: ${referralLink}`;
    
    // Attempt native browser Web Share API
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'POS Track Manager Referral',
          text: `Join POS Track using my referral code (${referralCode}):`,
          url: referralLink,
        });
        if (showAppNotification) showAppNotification('Shared successfully!', 'success');
        return;
      } catch (err) {
        console.log('Native share closed or unavailable, falling back to WhatsApp/Copy:', err);
      }
    }

    // Fallback if native share fails or unsupported
    await handleCopyLink();
    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(shareText)}`;
    window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
  };

  // Submit Payout Request
  const handleRequestPayout = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountNum = parseFloat(withdrawAmount);
    if (isNaN(amountNum) || amountNum < 2000) {
      if (showAppNotification) showAppNotification('Minimum withdrawal amount is ₦2,000', 'error');
      return;
    }

    const availableBal = (mySubscription?.payoutBalance || 0);
    if (amountNum > availableBal) {
      if (showAppNotification) showAppNotification('Insufficient referral payout balance', 'error');
      return;
    }

    setSubmittingWithdraw(true);
    try {
      const payoutId = `payout_${Math.random().toString(36).substr(2, 9)}`;
      const payoutData: PayoutRecord = {
        id: payoutId,
        ownerId: currentUser.id,
        amount: amountNum,
        bankName: withdrawMethod === 'Bank Transfer' ? bankName : withdrawMethod,
        accountNumber: accountNo,
        accountName: accountName,
        status: 'Pending',
        method: withdrawMethod,
        timestamp: new Date().toISOString()
      };

      // Add payout request doc
      await setDoc(doc(db, 'payouts', payoutId), payoutData);

      // Deduct from payoutBalance
      const subRef = doc(db, 'subscriptions', currentUser.id);
      await setDoc(subRef, {
        payoutBalance: availableBal - amountNum
      }, { merge: true });

      setWithdrawAmount('');
      setBankName('');
      setAccountNo('');
      setAccountName('');
      if (showAppNotification) showAppNotification('Withdrawal request submitted successfully!', 'success');
    } catch (err) {
      console.error('Payout request failed:', err);
      if (showAppNotification) showAppNotification('Failed to submit payout request.', 'error');
    } finally {
      setSubmittingWithdraw(false);
    }
  };

  // Live Simulated Purchase of Subscription by Current Manager
  const simulateSubscriptionPurchase = async (plan: 'Starter' | 'Professional' | 'Business', mode: SubscriptionMode = 'Postracker') => {
    if (!currentUser.id) return;
    const amount = getPlanRate(mode, plan).price;
    const txId = `pay_${Math.random().toString(36).substr(2, 9)}`;

    try {
      // 1. Record payment history
      const paymentData: PaymentHistoryRecord = {
        id: txId,
        ownerId: currentUser.id,
        amount: amount,
        plan: `${mode} ${plan}`,
        status: 'Success',
        timestamp: new Date().toISOString(),
        reference: `POS-PAY-${Math.floor(100000 + Math.random() * 900000)}`
      };
      await setDoc(doc(db, 'payment_history', txId), paymentData);

      // 2. Record subscription history
      await setDoc(doc(db, 'subscription_history', txId), {
        id: txId,
        ownerId: currentUser.id,
        plan: plan,
        mode: mode,
        status: 'Active',
        timestamp: new Date().toISOString()
      });

      // 3. Update subscription status
      const subRef = doc(db, 'subscriptions', currentUser.id);
      const updatedSub = {
        plan: plan,
        serviceCategory: mode,
        status: 'Active' as const,
        subscriptionStartDate: new Date().toISOString(),
        subscriptionEndDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        lastPaymentDate: new Date().toISOString(),
        nextPaymentDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
      };
      await setDoc(subRef, updatedSub, { merge: true });

      // 4. Update Referrer record and commissions if referredBy is configured
      if (mySubscription?.referredBy) {
        // Query referrer Manager user
        const usersRef = collection(db, 'users');
        const qReferrer = query(usersRef, where('referralCode', '==', mySubscription.referredBy.toUpperCase()));
        const snapRef = await getDocs(qReferrer);

        if (!snapRef.empty) {
          const referrerUser = snapRef.docs[0].data();
          const commAmt = getPlanRate(mode, plan).commission;

          const referralId = `${referrerUser.uid}_${currentUser.id}`;
          // Update referral status to Active & Commission Approved
          await setDoc(doc(db, 'referrals', referralId), {
            status: 'Active',
            plan: plan,
            mode: mode,
            commissionAmount: commAmt,
            updatedAt: new Date().toISOString()
          }, { merge: true });

          // Add commission record
          const commId = `comm_${Math.random().toString(36).substr(2, 9)}`;
          await setDoc(doc(db, 'referral_commissions', commId), {
            id: commId,
            referrerId: referrerUser.uid,
            referredId: currentUser.id,
            referredName: currentUser.name,
            amount: commAmt,
            status: 'Approved',
            plan: plan,
            timestamp: new Date().toISOString()
          });

          // Increment referrer's balance in Firestore
          const referrerSubRef = doc(db, 'subscriptions', referrerUser.uid);
          const referrerSubSnap = await getDocs(query(collection(db, 'subscriptions'), where('ownerId', '==', referrerUser.uid), limit(1)));
          
          let currentBal = 0;
          let currentLifetime = 0;
          if (!referrerSubSnap.empty) {
            const rData = referrerSubSnap.docs[0].data();
            currentBal = rData.payoutBalance || 0;
            currentLifetime = rData.payoutLifetime || 0;
          }
          await setDoc(referrerSubRef, {
            payoutBalance: currentBal + commAmt,
            payoutLifetime: currentLifetime + commAmt
          }, { merge: true });
        }
      }

      if (showAppNotification) showAppNotification(`Successfully subscribed to ${plan} Plan!`, 'success');
    } catch (err) {
      console.error('Subscription purchase simulation failed:', err);
      if (showAppNotification) showAppNotification('Subscription purchase failed.', 'error');
    }
  };

  // Advanced Referral Playground (Simulate referred managers registering and paying)
  const handleSimulateReferredUserRegistration = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!simReferredName.trim() || !simReferredPhone.trim()) {
      if (showAppNotification) showAppNotification('Please enter name and phone number', 'error');
      return;
    }

    try {
      const mockReferredUid = `sim_mgr_${Math.random().toString(36).substr(2, 9)}`;
      
      // 1. Create a simulated user
      await setDoc(doc(db, 'users', mockReferredUid), {
        uid: mockReferredUid,
        id: mockReferredUid,
        fullName: simReferredName.trim(),
        name: simReferredName.trim(),
        phoneNumber: simReferredPhone.trim(),
        phone: simReferredPhone.trim(),
        role: 'Manager',
        ownerId: mockReferredUid,
        email: `${simReferredPhone.trim()}@opay-pos.com`,
        activated: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        status: 'active',
        referralCode: `MGR-SIM-${Math.random().toString(36).substr(2, 5).toUpperCase()}`,
        referredBy: referralCode.toUpperCase(),
        permissions: ['admin', 'manager']
      });

      // 2. Create referred user's subscription doc in "Trial"
      const trialSub: SubscriptionData = {
        id: mockReferredUid,
        ownerId: mockReferredUid,
        plan: 'Free Trial',
        status: 'Trial',
        trialStartDate: new Date().toISOString(),
        trialEndDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
        subscriptionStartDate: null,
        subscriptionEndDate: null,
        referredBy: referralCode.toUpperCase(),
        payoutBalance: 0,
        payoutLifetime: 0
      };
      await setDoc(doc(db, 'subscriptions', mockReferredUid), trialSub);

      // 3. Create active referral entry for our current user
      const referralId = `${currentUser.id}_${mockReferredUid}`;
      const refRecord: ReferralRecord = {
        id: referralId,
        referrerId: currentUser.id,
        referrerCode: referralCode,
        referredId: mockReferredUid,
        referredName: simReferredName.trim(),
        referredEmail: `${simReferredPhone.trim()}@opay-pos.com`,
        referredPhone: simReferredPhone.trim(),
        status: 'Trial',
        plan: null,
        commissionAmount: 0,
        createdAt: new Date().toISOString()
      };
      await setDoc(doc(db, 'referrals', referralId), refRecord);

      if (showAppNotification) {
        showAppNotification(`Simulated registration of ${simReferredName} (Trial Started)!`, 'success');
      }

      setSimReferredName('');
      setSimReferredPhone('');
    } catch (err) {
      console.error('Registration simulation failed:', err);
    }
  };

  // Simulate payment / renewal trigger for a simulated referred manager
  const triggerReferredPayment = async (ref: ReferralRecord, plan: 'Starter' | 'Professional' | 'Business', mode: SubscriptionMode = 'Postracker') => {
    const rate = getPlanRate(mode, plan);
    const amount = rate.price;
    const commAmt = rate.commission;

    try {
      // 1. Update referred manager's subscription in DB
      await setDoc(doc(db, 'subscriptions', ref.referredId), {
        plan: plan,
        serviceCategory: mode,
        status: 'Active',
        subscriptionStartDate: new Date().toISOString(),
        subscriptionEndDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        lastPaymentDate: new Date().toISOString(),
        nextPaymentDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
      }, { merge: true });

      // 2. Update Referral record
      await setDoc(doc(db, 'referrals', ref.id), {
        status: 'Active',
        plan: plan,
        mode: mode,
        commissionAmount: commAmt
      }, { merge: true });

      // 3. Add Commission approved record
      const commId = `comm_${Math.random().toString(36).substr(2, 9)}`;
      await setDoc(doc(db, 'referral_commissions', commId), {
        id: commId,
        referrerId: currentUser.id,
        referredId: ref.referredId,
        referredName: ref.referredName,
        amount: commAmt,
        status: 'Approved',
        plan: plan,
        mode: mode,
        timestamp: new Date().toISOString()
      });

      // 4. Update Current Referrer's subscription metrics
      const currentBal = mySubscription?.payoutBalance || 0;
      const currentLife = mySubscription?.payoutLifetime || 0;
      await setDoc(doc(db, 'subscriptions', currentUser.id), {
        payoutBalance: currentBal + commAmt,
        payoutLifetime: currentLife + commAmt
      }, { merge: true });

      if (showAppNotification) {
        showAppNotification(`Simulated subscription payment from ${ref.referredName}! Recurring commission of ₦${commAmt.toLocaleString()} approved.`, 'success');
      }
    } catch (err) {
      console.error('Payment simulation failed:', err);
    }
  };

  // Simulate referred user cancelling / payment failing
  const triggerReferredPaymentFailed = async (ref: ReferralRecord) => {
    try {
      // 1. Mark referred manager's subscription as Expired / Cancelled
      await setDoc(doc(db, 'subscriptions', ref.referredId), {
        status: 'Expired'
      }, { merge: true });

      // 2. Mark Referral record status to paused
      await setDoc(doc(db, 'referrals', ref.id), {
        status: 'Trial Expired'
      }, { merge: true });

      if (showAppNotification) {
        showAppNotification(`Subscription payment failed for ${ref.referredName}. Recurring commission paused.`, 'info');
      }
    } catch (err) {
      console.error('Cancel simulation failed:', err);
    }
  };

  // Calculations for referral stats
  const registeredCount = myReferrals.length;
  const trialCount = myReferrals.filter(r => r.status === 'Trial').length;
  const activeSubscribers = myReferrals.filter(r => r.status === 'Active').length;
  const pendingCommission = myReferrals.filter(r => r.status === 'Trial').length * 1000; // Expected potential
  const approvedCommission = mySubscription?.payoutBalance || 0;
  const lifetimeEarnings = mySubscription?.payoutLifetime || 0;
  const paidCommission = lifetimeEarnings - approvedCommission;

  // Render subscription pill
  const getSubscriptionPill = (status: string, plan: string) => {
    if (status === 'Trial') {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-amber-50 text-amber-700 border border-amber-200 uppercase tracking-wider font-mono">
          <Clock className="w-3.5 h-3.5" /> Free Trial (14d)
        </span>
      );
    } else if (status === 'Active') {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-emerald-50 text-emerald-700 border border-emerald-200 uppercase tracking-wider font-mono animate-pulse">
          <ShieldCheck className="w-3.5 h-3.5" /> {plan} Active
        </span>
      );
    } else {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-rose-50 text-rose-700 border border-rose-200 uppercase tracking-wider font-mono">
          <AlertTriangle className="w-3.5 h-3.5" /> Expired / Lock
        </span>
      );
    }
  };

  // Determine trial remaining days
  const getTrialDaysRemaining = () => {
    if (!mySubscription || mySubscription.status !== 'Trial') return 0;
    const end = new Date(mySubscription.trialEndDate).getTime();
    const now = Date.now();
    const diff = end - now;
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-white border border-neutral-200 rounded-3xl shadow-sm text-center">
        <div className="w-10 h-10 border-4 border-[#00B87A] border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-neutral-500 font-bold text-sm">Loading Subscriptions & Partnerships...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      
      {/* 1. CURRENT SUBSCRIPTION PROFILE OVERVIEW CARD */}
      <div className="bg-white border border-neutral-200 rounded-3xl p-6 shadow-sm relative overflow-hidden">
        {/* Subtle decorative background glow */}
        <div className="absolute right-0 top-0 -mr-16 -mt-16 w-48 h-48 bg-emerald-500/5 rounded-full blur-2xl pointer-events-none" />
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2.5">
              <h2 className="text-lg font-black text-neutral-800 tracking-tight">Your Subscription Profile</h2>
              {mySubscription && getSubscriptionPill(mySubscription.status, `${mySubscription.serviceCategory || 'Postracker'} ${mySubscription.plan}`)}
            </div>
            <p className="text-xs text-neutral-500 font-medium max-w-xl">
              Manage your SaaS subscription, unlock premium features, and invite friends to earn massive commissions.
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            {mySubscription?.status === 'Trial' && (
              <div className="bg-amber-50 border border-amber-100 p-3 rounded-2xl text-right">
                <span className="block text-[10px] font-bold text-amber-600 uppercase tracking-wider font-mono">Trial Days Left</span>
                <span className="text-lg font-black text-amber-800 font-mono">{getTrialDaysRemaining()} Days</span>
              </div>
            )}
            
            {mySubscription?.status === 'Active' && mySubscription.subscriptionEndDate && (
              <div className="bg-emerald-50 border border-emerald-100 p-3 rounded-2xl text-right font-mono">
                <span className="block text-[10px] font-bold text-emerald-600 uppercase tracking-wider">Next Payment</span>
                <span className="text-sm font-black text-emerald-800">
                  {new Date(mySubscription.subscriptionEndDate).toLocaleDateString(undefined, {month: 'short', day: 'numeric', year: 'numeric'})}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* SUBSCRIPTION CATEGORY SELECTOR */}
        <div className="mt-6 border-t border-neutral-100 pt-6">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-4">
            <h3 className="text-xs font-extrabold uppercase tracking-widest text-neutral-400 font-mono">Select Service Plan Mode</h3>
            <div className="flex bg-neutral-100 p-1 rounded-2xl">
              {Object.values(MODES).map((mode) => (
                <button
                  key={mode.id}
                  onClick={() => setActivePlanMode(mode.id as SubscriptionMode)}
                  className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition ${
                    activePlanMode === mode.id
                      ? 'bg-white text-emerald-600 shadow-sm'
                      : 'text-neutral-500 hover:text-neutral-700'
                  }`}
                >
                  {mode.id}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            
            {/* Starter Plan */}
            <div className={`border p-5 rounded-2xl transition relative flex flex-col justify-between ${
              mySubscription?.plan === 'Starter' && mySubscription.status === 'Active' && mySubscription.serviceCategory === activePlanMode
                ? 'border-[#00B87A] bg-emerald-50/10 shadow-xs ring-1 ring-[#00B87A]'
                : 'border-neutral-200 bg-neutral-50/20 hover:border-neutral-300'
            }`}>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold text-neutral-700">Starter</span>
                  <span className="text-[10px] font-black uppercase text-neutral-400 bg-neutral-100 px-2 py-0.5 rounded-full font-mono">₦{PLAN_RATES[activePlanMode].Starter.price.toLocaleString()}/mo</span>
                </div>
                <div className="text-xl font-black text-neutral-800 font-mono">₦{PLAN_RATES[activePlanMode].Starter.price.toLocaleString()}<span className="text-xs text-neutral-400">/mo</span></div>
                <p className="text-[11px] text-neutral-500 font-medium">Referrer earns ₦{PLAN_RATES[activePlanMode].Starter.commission.toLocaleString()} recurring monthly.</p>

                {/* Features Value List */}
                <div className="pt-2 border-t border-neutral-100 space-y-1.5">
                  <span className="text-[9px] font-extrabold uppercase text-neutral-400 font-mono block">Customer Value Included:</span>
                  {PLAN_RATES[activePlanMode].Starter.features.map((feat, idx) => (
                    <div key={idx} className="flex items-start gap-1.5 text-[10px] text-neutral-600 leading-tight">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                      <span>{feat}</span>
                    </div>
                  ))}
                </div>
              </div>
              <button
                onClick={() => {
                  if (onOpenBillingModal) {
                    onOpenBillingModal('Starter');
                  } else {
                    simulateSubscriptionPurchase('Starter', activePlanMode);
                  }
                }}
                className={`mt-4 w-full py-2 px-1.5 rounded-xl text-xs font-black transition text-center cursor-pointer ${
                  mySubscription?.plan === 'Starter' && mySubscription.status === 'Active' && mySubscription.serviceCategory === activePlanMode
                    ? 'bg-[#00B87A] text-white'
                    : 'bg-neutral-800 text-white hover:bg-neutral-900'
                }`}
              >
                {mySubscription?.plan === 'Starter' && mySubscription.status === 'Active' && mySubscription.serviceCategory === activePlanMode ? 'Active Plan' : 'Subscribe Now'}
              </button>
            </div>

            {/* Professional Plan */}
            <div className={`border p-5 rounded-2xl transition relative flex flex-col justify-between ${
              mySubscription?.plan === 'Professional' && mySubscription.status === 'Active' && mySubscription.serviceCategory === activePlanMode
                ? 'border-[#00B87A] bg-emerald-50/10 shadow-xs ring-1 ring-[#00B87A]'
                : 'border-neutral-200 bg-neutral-50/20 hover:border-neutral-300'
            }`}>
              <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1.5 bg-[#00B87A] text-white px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider shadow-sm font-mono">POPULAR</div>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold text-neutral-700">Professional</span>
                  <span className="text-[10px] font-black uppercase text-neutral-400 bg-neutral-100 px-2 py-0.5 rounded-full font-mono">₦{PLAN_RATES[activePlanMode].Professional.price.toLocaleString()}/mo</span>
                </div>
                <div className="text-xl font-black text-neutral-800 font-mono">₦{PLAN_RATES[activePlanMode].Professional.price.toLocaleString()}<span className="text-xs text-neutral-400">/mo</span></div>
                <p className="text-[11px] text-neutral-500 font-medium">Referrer earns ₦{PLAN_RATES[activePlanMode].Professional.commission.toLocaleString()} recurring monthly.</p>

                {/* Features Value List */}
                <div className="pt-2 border-t border-neutral-100 space-y-1.5">
                  <span className="text-[9px] font-extrabold uppercase text-neutral-400 font-mono block">Customer Value Included:</span>
                  {PLAN_RATES[activePlanMode].Professional.features.map((feat, idx) => (
                    <div key={idx} className="flex items-start gap-1.5 text-[10px] text-neutral-600 leading-tight">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                      <span>{feat}</span>
                    </div>
                  ))}
                </div>
              </div>
              <button
                onClick={() => {
                  if (onOpenBillingModal) {
                    onOpenBillingModal('Professional');
                  } else {
                    simulateSubscriptionPurchase('Professional', activePlanMode);
                  }
                }}
                className={`mt-4 w-full py-2 px-1.5 rounded-xl text-xs font-black transition text-center cursor-pointer ${
                  mySubscription?.plan === 'Professional' && mySubscription.status === 'Active' && mySubscription.serviceCategory === activePlanMode
                    ? 'bg-[#00B87A] text-white'
                    : 'bg-[#00B87A] text-white hover:bg-emerald-600'
                }`}
              >
                {mySubscription?.plan === 'Professional' && mySubscription.status === 'Active' && mySubscription.serviceCategory === activePlanMode ? 'Active Plan' : 'Subscribe Now'}
              </button>
            </div>

            {/* Business Plan */}
            <div className={`border p-5 rounded-2xl transition relative flex flex-col justify-between ${
              mySubscription?.plan === 'Business' && mySubscription.status === 'Active' && mySubscription.serviceCategory === activePlanMode
                ? 'border-[#00B87A] bg-emerald-50/10 shadow-xs ring-1 ring-[#00B87A]'
                : 'border-neutral-200 bg-neutral-50/20 hover:border-neutral-300'
            }`}>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold text-neutral-700">Business</span>
                  <span className="text-[10px] font-black uppercase text-neutral-400 bg-neutral-100 px-2 py-0.5 rounded-full font-mono">₦{PLAN_RATES[activePlanMode].Business.price.toLocaleString()}/mo</span>
                </div>
                <div className="text-xl font-black text-neutral-800 font-mono">₦{PLAN_RATES[activePlanMode].Business.price.toLocaleString()}<span className="text-xs text-neutral-400">/mo</span></div>
                <p className="text-[11px] text-neutral-500 font-medium">Referrer earns ₦{PLAN_RATES[activePlanMode].Business.commission.toLocaleString()} recurring monthly.</p>

                {/* Features Value List */}
                <div className="pt-2 border-t border-neutral-100 space-y-1.5">
                  <span className="text-[9px] font-extrabold uppercase text-neutral-400 font-mono block">Customer Value Included:</span>
                  {PLAN_RATES[activePlanMode].Business.features.map((feat, idx) => (
                    <div key={idx} className="flex items-start gap-1.5 text-[10px] text-neutral-600 leading-tight">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                      <span>{feat}</span>
                    </div>
                  ))}
                </div>
              </div>
              <button
                onClick={() => {
                  if (onOpenBillingModal) {
                    onOpenBillingModal('Business');
                  } else {
                    simulateSubscriptionPurchase('Business', activePlanMode);
                  }
                }}
                className={`mt-4 w-full py-2 px-1.5 rounded-xl text-xs font-black transition text-center cursor-pointer ${
                  mySubscription?.plan === 'Business' && mySubscription.status === 'Active' && mySubscription.serviceCategory === activePlanMode
                    ? 'bg-[#00B87A] text-white'
                    : 'bg-neutral-800 text-white hover:bg-neutral-900'
                }`}
              >
                {mySubscription?.plan === 'Business' && mySubscription.status === 'Active' && mySubscription.serviceCategory === activePlanMode ? 'Active Plan' : 'Subscribe Now'}
              </button>
            </div>

          </div>
        </div>
      </div>

      {/* 2. REFERRAL & CASHIER LINKAGE GUIDANCE CARD */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        
        {/* Card 1: Manager Refer Cashier (Staff Linkage) */}
        <div className="bg-gradient-to-br from-indigo-900 to-slate-900 text-white rounded-3xl p-5 shadow-sm border border-indigo-800/50 space-y-3 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-indigo-500/20 text-indigo-300 border border-indigo-400/30 font-mono">
              👥 Cashier Staff Linkage
            </span>
            <span className="text-[10px] font-bold text-indigo-300 font-mono">Auto-Attached</span>
          </div>

          <div>
            <h3 className="text-base font-black text-white">Manager Refer Cashier to Work For You</h3>
            <p className="text-xs text-indigo-200/80 font-medium mt-1 leading-relaxed">
              Give your unique code below to your Cashiers when they register. When they select <strong className="text-white">Cashier / Staff</strong> and enter your code, they are <strong className="text-emerald-400">automatically attached to your business account</strong> so you can monitor their terminal transactions, shifts, and cash drawers in real time!
            </p>
          </div>

          <div className="bg-indigo-950/80 border border-indigo-700/50 rounded-2xl p-3 flex items-center justify-between gap-2">
            <div className="space-y-0.5">
              <span className="block text-[9px] font-bold uppercase text-indigo-300 font-mono">Your Manager Staff Code</span>
              <span className="text-base font-black font-mono tracking-widest text-emerald-400">{referralCode}</span>
            </div>
            <button
              type="button"
              onClick={handleCopyCode}
              className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black px-3 py-2 rounded-xl transition cursor-pointer flex items-center gap-1.5 shrink-0"
            >
              {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedCode ? 'Copied' : 'Copy Code'}</span>
            </button>
          </div>
        </div>

        {/* Card 2: Manager Refer Manager (Affiliate Earnings) */}
        <div className="bg-gradient-to-br from-emerald-900 to-teal-950 text-white rounded-3xl p-5 shadow-sm border border-emerald-800/50 space-y-3 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 font-mono">
              💰 Affiliate Commissions
            </span>
            <span className="text-[10px] font-bold text-yellow-300 font-mono">20% Monthly Recurring</span>
          </div>

          <div>
            <h3 className="text-base font-black text-white">Manager Refer Manager (Earn Cash)</h3>
            <p className="text-xs text-emerald-200/80 font-medium mt-1 leading-relaxed">
              Invite other POS Business Managers to sign up for POS Track. Earn <strong className="text-yellow-300 font-bold">up to ₦2,000 monthly recurring commission</strong> for every active manager you refer as long as they stay subscribed!
            </p>
          </div>

          <div className="bg-emerald-950/80 border border-emerald-700/50 rounded-2xl p-3 flex flex-wrap items-center justify-between gap-2">
            <div className="space-y-0.5 min-w-0 grow">
              <span className="block text-[9px] font-bold uppercase text-emerald-300 font-mono">Affiliate Direct Link</span>
              <span className="text-xs font-black font-mono text-emerald-200 truncate block">{referralLink}</span>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={handleShareLink}
                className="bg-[#00B87A] hover:bg-emerald-500 text-white text-xs font-black px-3 py-2 rounded-xl transition cursor-pointer flex items-center gap-1.5"
                title="Share via WhatsApp or Apps"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>Share</span>
              </button>
              <button
                type="button"
                onClick={handleCopyLink}
                className="bg-emerald-800 hover:bg-emerald-700 text-emerald-100 text-xs font-black px-3 py-2 rounded-xl transition cursor-pointer flex items-center gap-1.5"
                title="Copy Link to Clipboard"
              >
                {copiedLink ? <Check className="w-3.5 h-3.5 text-yellow-300" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedLink ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
          </div>
        </div>

      </div>

      {/* 2. REFERRAL PROGRAM HEADER & SHARING BAR */}
      <div className="bg-emerald-600 text-white rounded-3xl p-6 shadow-sm space-y-5 relative overflow-hidden">
        {/* Subtle aesthetic patterns */}
        <div className="absolute right-0 bottom-0 -mr-20 -mb-20 w-56 h-56 bg-white/5 rounded-full" />
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-yellow-300 animate-pulse fill-yellow-300 shrink-0" />
              <h2 className="text-base font-black uppercase tracking-wider font-mono">POS Track Affiliates</h2>
            </div>
            <h1 className="text-2xl font-black tracking-tight leading-none">Share & Earn ₦1,000+ Monthly Recurring Commissions!</h1>
            <p className="text-xs text-emerald-100 max-w-xl">
              Get paid <strong className="text-yellow-300">up to ₦2,000 monthly</strong> for every active manager you refer. Commissions continue recurring as long as they stay subscribed.
            </p>
          </div>
          
          <div className="bg-emerald-700/50 backdrop-blur-md border border-emerald-500/30 px-5 py-4 rounded-2xl flex items-center gap-4">
            <div className="space-y-0.5">
              <span className="block text-[9px] font-black uppercase text-emerald-300 font-mono">Commission Share</span>
              <span className="text-xl font-black text-yellow-300 font-mono">20% Monthly</span>
            </div>
            <div className="w-px h-8 bg-emerald-500/40" />
            <div className="space-y-0.5">
              <span className="block text-[9px] font-black uppercase text-emerald-300 font-mono">Min Payout</span>
              <span className="text-xl font-black text-white font-mono">₦2,000</span>
            </div>
          </div>
        </div>

        {/* Copy referral link and code row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-3 border-t border-white/10">
          <div className="space-y-1.5">
            <label className="block text-[10px] font-black uppercase text-emerald-200 font-mono tracking-wider">Your Unique Referral Code</label>
            <div className="flex items-center gap-2">
              <div className="bg-white/10 border border-white/20 rounded-xl px-4 py-3 font-mono text-sm font-bold tracking-widest text-white grow flex items-center justify-between">
                <span>{referralCode}</span>
              </div>
              <button
                type="button"
                onClick={handleCopyCode}
                className="bg-white text-emerald-800 hover:bg-neutral-100 font-black p-3.5 rounded-xl transition cursor-pointer shrink-0"
                title="Copy Code"
              >
                {copiedCode ? <Check className="w-4 h-4 text-emerald-600 stroke-[3]" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-[10px] font-black uppercase text-emerald-200 font-mono tracking-wider">Your Direct Invitation Link</label>
            <div className="flex items-center gap-2">
              <div className="bg-white/10 border border-white/20 rounded-xl px-4 py-3 font-mono text-xs font-bold text-emerald-100 truncate grow select-all">
                {referralLink}
              </div>
              <button
                type="button"
                onClick={handleShareLink}
                className="bg-white text-emerald-900 hover:bg-emerald-50 font-black px-3.5 py-3 rounded-xl transition cursor-pointer shrink-0 flex items-center gap-1 text-xs"
                title="Share via WhatsApp or Apps"
              >
                <Share2 className="w-4 h-4 text-emerald-700" />
                <span className="hidden sm:inline">Share</span>
              </button>
              <button
                type="button"
                onClick={handleCopyLink}
                className="bg-emerald-800 text-white hover:bg-emerald-700 font-black p-3.5 rounded-xl transition cursor-pointer shrink-0"
                title="Copy Link"
              >
                {copiedLink ? <Check className="w-4 h-4 text-yellow-300 stroke-[3]" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* REFERRAL QR CODE CARD (Image 1) */}
      <div className="bg-white border border-neutral-200 rounded-3xl p-6 shadow-sm text-center flex flex-col items-center justify-center space-y-4 relative overflow-hidden">
        <div className="p-4 bg-white border-2 border-emerald-500/20 rounded-2xl shadow-xs inline-block">
          <QRCodeSVG 
            id="referral-qr-code-svg" 
            value={referralLink} 
            size={180} 
            fgColor="#00B87A" 
            bgColor="#FFFFFF" 
            level="H" 
          />
        </div>

        <div className="space-y-1 max-w-md">
          <div className="flex items-center justify-center gap-2">
            <QrCode className="w-5 h-5 text-emerald-600" />
            <h3 className="text-base font-extrabold text-neutral-800">Your Referral QR Code</h3>
          </div>
          <p className="text-xs text-neutral-500 font-medium leading-relaxed">
            Print this QR code on a flyer, business card, or share it on social media. Anyone who scans it lands directly on your referral registration page.
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
          <span className="px-3.5 py-1.5 rounded-full text-xs font-mono font-black bg-emerald-50 text-emerald-700 border border-emerald-200">
            {referralCode}
          </span>
          <button
            type="button"
            onClick={handleCopyCode}
            className="bg-[#00B87A] hover:bg-emerald-600 text-white font-black text-xs px-4 py-2 rounded-xl shadow-xs flex items-center gap-1.5 transition cursor-pointer"
          >
            <Copy className="w-3.5 h-3.5" />
            <span>{copiedCode ? 'Copied' : 'Copy Code'}</span>
          </button>
        </div>

        <button
          type="button"
          onClick={handleDownloadQR}
          className="bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-extrabold text-xs px-5 py-2 rounded-full flex items-center gap-1.5 transition cursor-pointer"
        >
          <Download className="w-3.5 h-3.5" />
          <span>↓ Save QR</span>
        </button>
      </div>

      {/* 3. PARTNERSHIP METRICS GRID */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        
        {/* Metric 1 */}
        <div className="bg-white border border-neutral-200 rounded-3xl p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-neutral-400 font-mono">Total Invited</span>
            <div className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4">
            <span className="text-2xl font-black text-neutral-800 font-mono">{registeredCount}</span>
            <span className="block text-[10px] font-bold text-neutral-400 mt-0.5">Managers registered</span>
          </div>
        </div>

        {/* Metric 2 */}
        <div className="bg-white border border-neutral-200 rounded-3xl p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-neutral-400 font-mono">Active Subscribed</span>
            <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4">
            <span className="text-2xl font-black text-[#00B87A] font-mono">{activeSubscribers}</span>
            <span className="block text-[10px] font-bold text-neutral-400 mt-0.5">Yielding commission</span>
          </div>
        </div>

        {/* Metric 3 */}
        <div className="bg-white border border-neutral-200 rounded-3xl p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-neutral-400 font-mono">Available Payout</span>
            <div className="p-1.5 rounded-lg bg-amber-50 text-amber-600">
              <Wallet className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4">
            <span className="text-2xl font-black text-neutral-800 font-mono">₦{approvedCommission.toLocaleString()}</span>
            <span className="block text-[10px] font-bold text-neutral-400 mt-0.5">Ready to withdraw</span>
          </div>
        </div>

        {/* Metric 4 */}
        <div className="bg-white border border-neutral-200 rounded-3xl p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-neutral-400 font-mono">Lifetime Earned</span>
            <div className="p-1.5 rounded-lg bg-rose-50 text-rose-600">
              <Banknote className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4">
            <span className="text-2xl font-black text-rose-600 font-mono">₦{lifetimeEarnings.toLocaleString()}</span>
            <span className="block text-[10px] font-bold text-neutral-400 mt-0.5">Total payout + balance</span>
          </div>
        </div>

      </div>

      {/* COMMISSION STRUCTURE CARD (Image 2 & 3) */}
      <div className="bg-white border border-neutral-200 rounded-3xl p-6 shadow-sm space-y-4">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-emerald-600 shrink-0" />
          <h3 className="text-base font-extrabold text-neutral-800">Commission Structure</h3>
        </div>

        {/* Tabs Switcher */}
        <div className="flex bg-neutral-100 p-1 rounded-2xl w-fit">
          <button
            type="button"
            onClick={() => setCommissionTab('Postracker')}
            className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition cursor-pointer ${
              commissionTab === 'Postracker'
                ? 'bg-white text-emerald-700 shadow-xs'
                : 'text-neutral-500 hover:text-neutral-700'
            }`}
          >
            POS TRACKER
          </button>
          <button
            type="button"
            onClick={() => setCommissionTab('Inventory')}
            className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition cursor-pointer ${
              commissionTab === 'Inventory'
                ? 'bg-white text-emerald-700 shadow-xs'
                : 'text-neutral-500 hover:text-neutral-700'
            }`}
          >
            INVENTORY & SALES
          </button>
          <button
            type="button"
            onClick={() => setCommissionTab('Combined')}
            className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition cursor-pointer ${
              commissionTab === 'Combined'
                ? 'bg-white text-emerald-700 shadow-xs'
                : 'text-neutral-500 hover:text-neutral-700'
            }`}
          >
            COMBINED
          </button>
        </div>

        {/* Commission Rates Table */}
        <div className="overflow-x-auto rounded-2xl border border-neutral-100">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-emerald-50/70 text-emerald-900 border-b border-emerald-100">
                <th className="py-3 px-4 text-[11px] font-black uppercase font-mono tracking-wider">PLAN</th>
                <th className="py-3 px-4 text-[11px] font-black uppercase font-mono tracking-wider text-center">MONTHLY PRICE</th>
                <th className="py-3 px-4 text-[11px] font-black uppercase font-mono tracking-wider text-center">1ST PAYMENT</th>
                <th className="py-3 px-4 text-[11px] font-black uppercase font-mono tracking-wider text-center">MONTHLY RENEWAL</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 text-xs font-medium">
              {/* Starter */}
              <tr className="hover:bg-neutral-50/50">
                <td className="py-3.5 px-4 font-extrabold text-neutral-800 flex items-center gap-1.5">
                  <span className="text-amber-500">⭐</span> Starter
                </td>
                <td className="py-3.5 px-4 font-mono font-bold text-neutral-700 text-center">
                  ₦{commissionTab === 'Combined' ? '3,500' : '2,000'}
                </td>
                <td className="py-3.5 px-4 font-mono font-black text-emerald-600 text-center">
                  ₦{commissionTab === 'Combined' ? '700' : '500'}
                </td>
                <td className="py-3.5 px-4 font-mono font-black text-emerald-600 text-center">
                  ₦{commissionTab === 'Combined' ? '500/mo' : '300/mo'}
                </td>
              </tr>

              {/* Professional */}
              <tr className="hover:bg-neutral-50/50">
                <td className="py-3.5 px-4 font-extrabold text-neutral-800 flex items-center gap-1.5">
                  <span className="text-emerald-500">✨</span> Professional
                </td>
                <td className="py-3.5 px-4 font-mono font-bold text-neutral-700 text-center">
                  ₦{commissionTab === 'Combined' ? '8,000' : '5,000'}
                </td>
                <td className="py-3.5 px-4 font-mono font-black text-emerald-600 text-center">
                  ₦{commissionTab === 'Combined' ? '1,500' : '1,000'}
                </td>
                <td className="py-3.5 px-4 font-mono font-black text-emerald-600 text-center">
                  ₦{commissionTab === 'Combined' ? '1,000/mo' : '700/mo'}
                </td>
              </tr>

              {/* Business */}
              <tr className="hover:bg-neutral-50/50">
                <td className="py-3.5 px-4 font-extrabold text-neutral-800 flex items-center gap-1.5">
                  <span className="text-amber-500">👑</span> Business
                </td>
                <td className="py-3.5 px-4 font-mono font-bold text-neutral-700 text-center">
                  ₦{commissionTab === 'Combined' ? '15,000' : '10,000'}
                </td>
                <td className="py-3.5 px-4 font-mono font-black text-emerald-600 text-center">
                  ₦{commissionTab === 'Combined' ? '3,000' : '2,000'}
                </td>
                <td className="py-3.5 px-4 font-mono font-black text-emerald-600 text-center">
                  ₦{commissionTab === 'Combined' ? '2,000/mo' : '1,200/mo'}
                </td>
              </tr>

              {/* Enterprise */}
              <tr className="text-neutral-400 hover:bg-neutral-50/50">
                <td className="py-3.5 px-4 font-bold text-neutral-500">Enterprise</td>
                <td className="py-3.5 px-4 font-mono text-center">Custom</td>
                <td colSpan={2} className="py-3.5 px-4 font-mono italic text-center text-neutral-400">
                  Negotiated by contract —
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Legend notes */}
        <div className="pt-2 border-t border-neutral-100 space-y-2 text-xs text-neutral-600 font-medium">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
            <span>First payment = one-time sign-up bonus</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-sky-500 shrink-0" />
            <span>6-month = renewal rate × 6 (paid once, 10% customer discount applied)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-purple-500 shrink-0" />
            <span>Annual = renewal rate × 12 (paid once, 20% customer discount applied)</span>
          </div>
        </div>
      </div>

      {/* 4. WITHDRAWAL FORM AND PAYOUT STATUS LISTING */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Payout Withdrawal Request Form */}
        <div className="bg-white border border-neutral-200 rounded-3xl p-6 shadow-sm md:col-span-1 space-y-4">
          <div className="flex items-center gap-2">
            <Coins className="w-5 h-5 text-amber-500 shrink-0" />
            <h3 className="text-sm font-extrabold text-neutral-800">Request Withdrawal</h3>
          </div>
          <p className="text-xs text-neutral-500 font-medium leading-normal">
            Withdraw your earned commissions straight to your bank, OPay, Moniepoint, or PalmPay wallet instantly.
          </p>

          <form onSubmit={handleRequestPayout} className="space-y-4">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest text-neutral-400 mb-1">Method</label>
              <select
                value={withdrawMethod}
                onChange={(e: any) => setWithdrawMethod(e.target.value)}
                className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-2.5 text-xs font-bold text-neutral-800 focus:outline-none focus:border-[#00B87A]"
              >
                <option value="OPay">OPay Wallet</option>
                <option value="PalmPay">PalmPay Wallet</option>
                <option value="Moniepoint">Moniepoint Bank</option>
                <option value="Bank Transfer">Other Bank Transfer</option>
              </select>
            </div>

            {withdrawMethod === 'Bank Transfer' && (
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-neutral-400 mb-1">Bank Name</label>
                <input
                  type="text"
                  required
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  placeholder="e.g. GTBank, Zenith Bank"
                  className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-2.5 text-xs font-bold text-neutral-800 placeholder:text-neutral-400 focus:outline-none focus:border-[#00B87A]"
                />
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-neutral-400 mb-1">Account No</label>
                <input
                  type="text"
                  required
                  pattern="\d{10}"
                  maxLength={10}
                  value={accountNo}
                  onChange={(e) => setAccountNo(e.target.value.replace(/\D/g, ''))}
                  placeholder="10-digit NUBAN"
                  className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-2.5 text-xs font-bold text-neutral-800 placeholder:text-neutral-400 focus:outline-none focus:border-[#00B87A] font-mono"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-neutral-400 mb-1">Amount (₦)</label>
                <input
                  type="number"
                  required
                  min={2000}
                  value={withdrawAmount}
                  onChange={(e) => setWithdrawAmount(e.target.value)}
                  placeholder="Min ₦2,000"
                  className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-2.5 text-xs font-bold text-neutral-800 placeholder:text-neutral-400 focus:outline-none focus:border-[#00B87A] font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest text-neutral-400 mb-1">Account Name</label>
              <input
                type="text"
                required
                value={accountName}
                onChange={(e) => setAccountName(e.target.value)}
                placeholder="Receiver full legal name"
                className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-2.5 text-xs font-bold text-neutral-800 placeholder:text-neutral-400 focus:outline-none focus:border-[#00B87A]"
              />
            </div>

            <button
              type="submit"
              disabled={submittingWithdraw || approvedCommission < 2000}
              className={`w-full py-3 rounded-xl text-xs font-black uppercase tracking-wider text-center cursor-pointer transition ${
                approvedCommission >= 2000
                  ? 'bg-amber-500 hover:bg-amber-600 text-white shadow-xs'
                  : 'bg-neutral-100 text-neutral-400 cursor-not-allowed'
              }`}
            >
              {submittingWithdraw ? 'Processing request...' : 'Request Payout Now'}
            </button>
          </form>
        </div>

        {/* Invited / Referred Managers History list */}
        <div className="bg-white border border-neutral-200 rounded-3xl p-6 shadow-sm md:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-indigo-500 shrink-0" />
              <h3 className="text-sm font-extrabold text-neutral-800">Your Referred Managers</h3>
            </div>
            <span className="text-[10px] font-black uppercase text-neutral-400 font-mono">
              Status updates automatically on active payment
            </span>
          </div>

          <div className="overflow-x-auto">
            {myReferrals.length === 0 ? (
              <div className="text-center py-8 text-neutral-400 space-y-2">
                <Users className="w-10 h-10 mx-auto stroke-[1.2] text-neutral-300" />
                <p className="text-xs font-bold">No registered referrals found yet.</p>
                <p className="text-[10px] text-neutral-400">Share your referral link above to invite other POS managers!</p>
              </div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-neutral-100">
                    <th className="py-2.5 text-[10px] font-black uppercase tracking-wider text-neutral-400 font-mono">Merchant details</th>
                    <th className="py-2.5 text-[10px] font-black uppercase tracking-wider text-neutral-400 font-mono text-center">Referral status</th>
                    <th className="py-2.5 text-[10px] font-black uppercase tracking-wider text-neutral-400 font-mono text-right">Commission (₦)</th>
                    {showSimPanel && (
                      <th className="py-2.5 text-[10px] font-black uppercase tracking-wider text-neutral-400 font-mono text-center">Simulator actions</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-50">
                  {myReferrals.map((ref) => (
                    <tr key={ref.id} className="hover:bg-neutral-50/40 transition">
                      <td className="py-3">
                        <div className="space-y-0.5">
                          <span className="text-xs font-bold text-neutral-800 block">{ref.referredName}</span>
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] font-mono text-neutral-500">{ref.referredPhone || ref.referredEmail}</span>
                            {ref.mode && (
                              <span className="text-[8px] font-black uppercase bg-emerald-100 text-emerald-800 px-1 rounded">
                                {ref.mode}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-3 text-center">
                        <div className="flex flex-col items-center gap-1">
                          <span className={`inline-block px-2 py-0.5 rounded-full text-[9px] font-black font-mono uppercase tracking-wider ${
                            ref.status === 'Active'
                              ? 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                              : ref.status === 'Trial'
                                ? 'bg-amber-50 text-amber-600 border border-amber-100'
                                : 'bg-neutral-50 text-neutral-500 border border-neutral-100'
                          }`}>
                            {ref.status}
                          </span>
                          {ref.plan && <span className="text-[9px] font-bold text-neutral-400 uppercase">{ref.plan}</span>}
                        </div>
                      </td>
                      <td className="py-3 text-right font-mono text-xs font-black text-neutral-700">
                        {ref.commissionAmount > 0 ? `+₦${ref.commissionAmount}/mo` : '₦0/mo'}
                      </td>
                      
                      {/* Advanced developer/SaaS operator simulation panel inline row */}
                      {showSimPanel && (
                        <td className="py-3 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => triggerReferredPayment(ref, (ref.plan as any) || 'Professional', (ref.mode as any) || 'Postracker')}
                              className="px-2 py-1 bg-emerald-50 text-emerald-700 rounded-md text-[9px] font-black hover:bg-emerald-100"
                            >
                              Pay {(ref.plan as any) || 'Pro'} (₦{getPlanRate(ref.mode || undefined, ref.plan || undefined).price.toLocaleString()})
                            </button>
                            <button
                              type="button"
                              onClick={() => triggerReferredPaymentFailed(ref)}
                              className="px-2 py-1 bg-rose-50 text-rose-700 rounded-md text-[9px] font-black hover:bg-rose-100"
                            >
                              Fail/Expire
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

      </div>

      {/* 5. HISTORIC LOGS FOR PAYOUTS & TRANSACTIONS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Commission Earnings History */}
        <div className="bg-white border border-neutral-200 rounded-3xl p-6 shadow-sm space-y-3">
          <div className="flex items-center gap-2">
            <Coins className="w-5 h-5 text-emerald-500 shrink-0" />
            <h3 className="text-sm font-extrabold text-neutral-800">Referral Earnings</h3>
          </div>
          <div className="overflow-y-auto max-h-48 pr-1">
            {commissions.length === 0 ? (
              <p className="text-center py-6 text-neutral-400 text-xs font-bold">No commission earnings found.</p>
            ) : (
              <div className="space-y-2">
                {commissions.map((c) => {
                  const refRecord = myReferrals.find(r => r.referredId === c.referredId);
                  return (
                  <div key={c.id} className="flex items-center justify-between p-3 bg-neutral-50 rounded-2xl text-xs">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-neutral-800">₦{c.amount.toLocaleString()} — {c.referredName}</span>
                        {c.mode && (
                          <span className="text-[8px] font-black uppercase bg-emerald-100 text-emerald-800 px-1 rounded">
                            {c.mode}
                          </span>
                        )}
                      </div>
                      <span className="block text-[10px] text-neutral-400 font-mono">
                        Plan: {c.plan} • Code: {refRecord?.referrerCode || 'N/A'}
                      </span>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-black font-mono uppercase tracking-wider ${
                      c.status === 'Paid'
                        ? 'bg-emerald-50 text-emerald-600'
                        : c.status === 'Approved'
                          ? 'bg-amber-50 text-amber-600'
                          : 'bg-rose-50 text-rose-600'
                    }`}>
                      {c.status}
                    </span>
                  </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Payout Withdrawal History */}
        <div className="bg-white border border-neutral-200 rounded-3xl p-6 shadow-sm space-y-3">
          <div className="flex items-center gap-2">
            <Landmark className="w-5 h-5 text-amber-500 shrink-0" />
            <h3 className="text-sm font-extrabold text-neutral-800">Withdrawal Payout History</h3>
          </div>
          <div className="overflow-y-auto max-h-48 pr-1">
            {payouts.length === 0 ? (
              <p className="text-center py-6 text-neutral-400 text-xs font-bold">No payout history found.</p>
            ) : (
              <div className="space-y-2">
                {payouts.map((p) => (
                  <div key={p.id} className="flex items-center justify-between p-3 bg-neutral-50 rounded-2xl text-xs">
                    <div className="space-y-0.5">
                      <span className="font-bold text-neutral-800">₦{p.amount.toLocaleString()} — {p.method}</span>
                      <span className="block text-[10px] text-neutral-400 font-mono">
                        {new Date(p.timestamp).toLocaleString()}
                      </span>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-black font-mono uppercase tracking-wider ${
                      p.status === 'Paid'
                        ? 'bg-emerald-50 text-emerald-600'
                        : p.status === 'Pending'
                          ? 'bg-amber-50 text-amber-600'
                          : 'bg-rose-50 text-rose-600'
                    }`}>
                      {p.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Subscription Payments History */}
        <div className="bg-white border border-neutral-200 rounded-3xl p-6 shadow-sm space-y-3">
          <div className="flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-indigo-500 shrink-0" />
            <h3 className="text-sm font-extrabold text-neutral-800">Your Subscription History</h3>
          </div>
          <div className="overflow-y-auto max-h-48 pr-1">
            {payments.length === 0 ? (
              <p className="text-center py-6 text-neutral-400 text-xs font-bold">No subscription payments found.</p>
            ) : (
              <div className="space-y-2">
                {payments.map((pm) => (
                  <div key={pm.id} className="flex items-center justify-between p-3 bg-neutral-50 rounded-2xl text-xs">
                    <div className="space-y-0.5">
                      <span className="font-bold text-neutral-800">₦{pm.amount.toLocaleString()} — {pm.plan} Plan</span>
                      <span className="block text-[10px] text-neutral-400 font-mono">Ref: {pm.reference}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] font-mono text-neutral-400 block">{new Date(pm.timestamp).toLocaleDateString()}</span>
                      <span className="text-[9px] font-black text-emerald-600 uppercase font-mono">SUCCESS</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

      </div>

      {/* 6. ADVANCED VERIFICATION PLAYGROUND/SIMULATOR (CRITICAL FOR LIVE ACCEPTANCE TESTS) */}
      {isSaaSAdmin && (
        <div className="bg-neutral-900 text-white rounded-3xl p-6 shadow-xl space-y-5 relative overflow-hidden">
          <div className="absolute right-0 bottom-0 translate-x-1/3 translate-y-1/3 w-64 h-64 bg-[#00B87A]/10 rounded-full blur-3xl pointer-events-none" />
          
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-[#00B87A]" />
                <span className="text-xs font-black uppercase text-[#00B87A] font-mono tracking-wider">DevOps QA Playground</span>
              </div>
              <h2 className="text-lg font-black tracking-tight leading-none">SaaS Lifecycle Live Simulation Tool</h2>
              <p className="text-xs text-neutral-400 max-w-xl">
                Simulate register/payment scenarios requested in requirements (User B paying or failing to pay, and pausing/resuming commissions for User A).
              </p>
            </div>

            <button
              type="button"
              onClick={() => setShowSimPanel(!showSimPanel)}
              className="flex items-center gap-2 py-2 px-4 bg-white/10 hover:bg-white/20 rounded-xl text-xs font-black transition text-center cursor-pointer font-mono text-white"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${showSimPanel ? 'animate-spin' : ''}`} />
              {showSimPanel ? 'Hide Simulator Panel' : 'Enable Simulator Panel'}
            </button>
          </div>

          {showSimPanel && (
            <div className="mt-4 border-t border-white/10 pt-4 space-y-6">
              
              {/* Scenario simulator instructions */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-white/5 border border-white/10 p-5 rounded-2xl text-xs leading-relaxed">
                <div className="space-y-2">
                  <h4 className="font-extrabold text-[#00B87A]">How to Test Scenarios (Live Database Checks)</h4>
                  <ul className="space-y-1 text-neutral-300 list-disc list-inside">
                    <li><strong>Scenario 1:</strong> Enter a fake name/phone on the right and click "Register Simulated Manager". They register in "Trial". Observe your count increases but Commission remains ₦0 (Status: Trial).</li>
                    <li><strong>Scenario 2:</strong> Under referred manager row, click "Pay Pro (₦5,000)". Observe your lifetime/monthly earnings immediately update by +₦1,000!</li>
                    <li><strong>Scenario 3:</strong> Click "Fail/Expire" on that row. Observe status changes and recurring commission pauses!</li>
                    <li><strong>Scenario 4:</strong> Click "Pay Pro (₦5,000)" again. Observe status resumes to Active immediately!</li>
                  </ul>
                </div>

                {/* Sim manager registration form */}
                <form onSubmit={handleSimulateReferredUserRegistration} className="space-y-3">
                  <h4 className="font-extrabold text-[#00B87A]">Simulate Manager Registration</h4>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      required
                      value={simReferredName}
                      onChange={(e) => setSimReferredName(e.target.value)}
                      placeholder="Merchant Name"
                      className="bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-xs font-medium text-white focus:outline-none placeholder:text-neutral-500"
                    />
                    <input
                      type="tel"
                      required
                      value={simReferredPhone}
                      onChange={(e) => setSimReferredPhone(e.target.value.replace(/\D/g, ''))}
                      placeholder="Phone number"
                      className="bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-xs font-medium text-white focus:outline-none placeholder:text-neutral-500 font-mono"
                    />
                  </div>
                  <button
                    type="submit"
                    className="w-full bg-[#00B87A] hover:bg-emerald-600 py-2.5 rounded-lg text-xs font-black uppercase text-center transition cursor-pointer text-white"
                  >
                    Register Simulated Manager
                  </button>
                </form>
              </div>
              
            </div>
          )}
        </div>
      )}

    </div>
  );
}
