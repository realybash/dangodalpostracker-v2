import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ShieldCheck, 
  Smartphone, 
  TrendingUp, 
  Users, 
  Terminal, 
  Zap, 
  CheckCircle2, 
  ArrowRight, 
  Lock, 
  Globe, 
  WifiOff, 
  DollarSign, 
  PieChart, 
  Building2, 
  Layers, 
  HelpCircle, 
  Sparkles, 
  ChevronRight, 
  BarChart3, 
  Receipt, 
  CreditCard, 
  AlertTriangle, 
  X, 
  Mail, 
  Phone, 
  MapPin, 
  Shield, 
  FileText, 
  Check, 
  Clock, 
  Search,
  ExternalLink
} from 'lucide-react';

import conferenceImg from '../assets/images/dangodal_conference_speaker_1786538211942.jpg';
import dangodalHeroImg from '../assets/images/dangodal-hero.jpg';

interface LandingPageProps {
  onGetStarted: () => void;
  onOpenDashboard?: () => void;
  isAuthenticated: boolean;
  activeUserName?: string;
}

export function LandingPage({
  onGetStarted,
  onOpenDashboard,
  isAuthenticated,
  activeUserName
}: LandingPageProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeModal, setActiveModal] = useState<'privacy' | 'terms' | 'security' | 'contact' | null>(null);

  const scrollToSection = (id: string) => {
    setMobileMenuOpen(false);
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-[#00B87A] selection:text-white antialiased overflow-x-hidden">
      {/* BACKGROUND DECORATIVE GRADIENTS */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-[#00B87A]/15 rounded-full blur-3xl" />
        <div className="absolute top-1/3 -right-40 w-[500px] h-[500px] bg-indigo-600/10 rounded-full blur-3xl" />
        <div className="absolute bottom-10 left-1/4 w-[600px] h-[600px] bg-emerald-600/10 rounded-full blur-3xl" />
      </div>

      {/* STICKY NAVIGATION BAR */}
      <nav className="sticky top-0 z-50 bg-slate-950/80 backdrop-blur-md border-b border-slate-800/80 transition-all duration-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-20">
            {/* BRAND LOGO */}
            <div className="flex items-center gap-3 cursor-pointer" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#00B87A] to-emerald-400 flex items-center justify-center text-slate-950 font-black text-xl shadow-lg shadow-[#00B87A]/20">
                D
              </div>
              <div className="flex flex-col">
                <span className="font-extrabold text-lg tracking-tight bg-gradient-to-r from-white via-slate-100 to-slate-300 bg-clip-text text-transparent">
                  DANGODAL<span className="text-[#00B87A]">POSTRACKER</span>
                </span>
                <span className="text-[10px] text-emerald-400 font-medium tracking-widest uppercase -mt-1">
                  postracker.com.ng
                </span>
              </div>
            </div>

            {/* DESKTOP NAV LINKS */}
            <div className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-300">
              <button onClick={() => scrollToSection('features')} className="hover:text-[#00B87A] transition duration-150">Features</button>
              <button onClick={() => scrollToSection('operations')} className="hover:text-[#00B87A] transition duration-150">POS & Agents</button>
              <button onClick={() => scrollToSection('intelligence')} className="hover:text-[#00B87A] transition duration-150">Intelligence</button>
              <button onClick={() => scrollToSection('security')} className="hover:text-[#00B87A] transition duration-150">Security & Offline</button>
              <button onClick={() => scrollToSection('audience')} className="hover:text-[#00B87A] transition duration-150">Who Is It For</button>
            </div>

            {/* HEADER CTA BUTTONS */}
            <div className="hidden md:flex items-center gap-3">
              {isAuthenticated ? (
                <button
                  onClick={onOpenDashboard}
                  className="px-5 py-2.5 rounded-xl bg-[#00B87A] hover:bg-emerald-500 text-slate-950 font-bold text-sm transition duration-150 shadow-md shadow-[#00B87A]/25 flex items-center gap-2"
                >
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-slate-900 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-slate-950"></span>
                  </span>
                  Open Dashboard ({activeUserName || 'POS Portal'})
                  <ArrowRight className="w-4 h-4" />
                </button>
              ) : (
                <button
                  onClick={onGetStarted}
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#00B87A] to-emerald-500 hover:from-emerald-400 hover:to-emerald-500 text-slate-950 font-extrabold text-sm transition duration-150 shadow-lg shadow-[#00B87A]/30 flex items-center gap-2 cursor-pointer"
                >
                  POS Terminal Login / Register
                  <ArrowRight className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* MOBILE HAMBURGER BUTTON */}
            <div className="md:hidden flex items-center">
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="p-2 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 focus:outline-none"
                aria-label="Toggle navigation menu"
              >
                {mobileMenuOpen ? <X className="w-6 h-6" /> : <div className="w-6 h-5 flex flex-col justify-between"><span className="w-full h-0.5 bg-slate-200"></span><span className="w-full h-0.5 bg-slate-200"></span><span className="w-full h-0.5 bg-slate-200"></span></div>}
              </button>
            </div>
          </div>
        </div>

        {/* MOBILE MENU DROPDOWN */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="md:hidden border-b border-slate-800 bg-slate-900/95 px-4 pt-3 pb-6 space-y-3"
            >
              <button onClick={() => scrollToSection('features')} className="block w-full text-left py-2 text-slate-200 hover:text-[#00B87A] font-medium text-sm">Features</button>
              <button onClick={() => scrollToSection('operations')} className="block w-full text-left py-2 text-slate-200 hover:text-[#00B87A] font-medium text-sm">POS & Agents</button>
              <button onClick={() => scrollToSection('intelligence')} className="block w-full text-left py-2 text-slate-200 hover:text-[#00B87A] font-medium text-sm">Intelligence</button>
              <button onClick={() => scrollToSection('security')} className="block w-full text-left py-2 text-slate-200 hover:text-[#00B87A] font-medium text-sm">Security & Offline</button>
              <button onClick={() => scrollToSection('audience')} className="block w-full text-left py-2 text-slate-200 hover:text-[#00B87A] font-medium text-sm">Who Is It For</button>
              
              <div className="pt-3 border-t border-slate-800">
                {isAuthenticated ? (
                  <button
                    onClick={onOpenDashboard}
                    className="w-full py-3 rounded-xl bg-[#00B87A] text-slate-950 font-bold text-center text-sm shadow-md flex items-center justify-center gap-2"
                  >
                    Open Dashboard ({activeUserName || 'POS Portal'})
                    <ArrowRight className="w-4 h-4" />
                  </button>
                ) : (
                  <button
                    onClick={onGetStarted}
                    className="w-full py-3 rounded-xl bg-gradient-to-r from-[#00B87A] to-emerald-500 text-slate-950 font-extrabold text-center text-sm shadow-md flex items-center justify-center gap-2"
                  >
                    POS Terminal Login / Register
                    <ArrowRight className="w-4 h-4" />
                  </button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>

      {/* HERO SECTION */}
      <section className="relative pt-16 pb-24 md:pt-24 md:pb-36 overflow-hidden z-10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="space-y-8 flex flex-col items-center">
            
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5" />
              Smart POS & Business Operating System
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight text-white leading-[1.1]">
              Smart POS & Business <span className="bg-gradient-to-r from-[#00B87A] via-emerald-400 to-teal-300 bg-clip-text text-transparent">Operating System</span>
            </h1>

            <p className="text-base sm:text-lg text-slate-300 font-normal leading-relaxed max-w-2xl mx-auto">
              Empower your agency banking, cashier shifts, automated commission tracking, and multi-tier business operations with real-time analytics and offline resilience.
            </p>

            {/* CTAs */}
            <div className="flex flex-wrap items-center justify-center gap-4 pt-2">
              <button
                onClick={onGetStarted}
                className="px-8 py-4 rounded-xl bg-gradient-to-r from-[#00B87A] to-emerald-500 hover:from-emerald-400 hover:to-emerald-500 text-slate-950 font-extrabold text-base transition duration-150 shadow-xl shadow-[#00B87A]/30 flex items-center gap-2.5 cursor-pointer transform hover:-translate-y-0.5"
              >
                Get Started Now
                <ArrowRight className="w-5 h-5" />
              </button>
              {isAuthenticated && (
                <button
                  onClick={onOpenDashboard}
                  className="px-6 py-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 font-bold text-base transition duration-150 border border-slate-700 flex items-center gap-2 cursor-pointer shadow-sm"
                >
                  Open Active Dashboard
                </button>
              )}
            </div>

            {/* TRUST METRICS BADGE */}
            <div className="pt-8 grid grid-cols-3 gap-6 sm:gap-12 border-t border-slate-800/80 w-full max-w-xl mx-auto">
              <div>
                <div className="text-xl sm:text-2xl font-black text-white">99.9%</div>
                <div className="text-xs text-slate-400 font-medium">Uptime Reliability</div>
              </div>
              <div>
                <div className="text-xl sm:text-2xl font-black text-emerald-400">₦0.00</div>
                <div className="text-xs text-slate-400 font-medium">Reconciliation Error</div>
              </div>
              <div>
                <div className="text-xl sm:text-2xl font-black text-white">24/7</div>
                <div className="text-xs text-slate-400 font-medium">Cloud Sync</div>
              </div>
            </div>

            {/* HERO IMAGE CONTAINER */}
            <div className="pt-6 w-full max-w-lg mx-auto">
              <div className="relative mx-auto">
                <div className="absolute -inset-1 rounded-2xl bg-gradient-to-r from-[#00B87A] to-emerald-600 opacity-30 blur-lg"></div>
                <div className="relative rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden shadow-2xl">
                  <img 
                    src={dangodalHeroImg} 
                    alt="Dan Godal POS Tracker Professional Setup" 
                    referrerPolicy="no-referrer"
                    loading="eager"
                    decoding="async"
                    className="w-full h-auto object-cover hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-slate-950 via-slate-950/70 to-transparent p-4 sm:p-6 text-left">
                    <span className="inline-block px-2.5 py-1 rounded bg-[#00B87A] text-slate-950 font-black text-[10px] tracking-wider uppercase mb-1">Verified Operations</span>
                    <h3 className="text-white font-bold text-sm sm:text-base">Secure POS Terminal & Agency Banking Standard</h3>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* TRUST / VALUE BAR */}
      <section className="py-8 bg-slate-900/80 border-y border-slate-800 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            <div className="flex flex-col items-center justify-center p-3">
              <Terminal className="w-6 h-6 text-[#00B87A] mb-2" />
              <span className="font-bold text-white text-sm">POS Operations</span>
              <span className="text-xs text-slate-400">Multi-terminal tracking</span>
            </div>
            <div className="flex flex-col items-center justify-center p-3">
              <Users className="w-6 h-6 text-emerald-400 mb-2" />
              <span className="font-bold text-white text-sm">Agent Management</span>
              <span className="text-xs text-slate-400">Hierarchical commissions</span>
            </div>
            <div className="flex flex-col items-center justify-center p-3">
              <TrendingUp className="w-6 h-6 text-teal-400 mb-2" />
              <span className="font-bold text-white text-sm">Transaction Intelligence</span>
              <span className="text-xs text-slate-400">Real-time profit visibility</span>
            </div>
            <div className="flex flex-col items-center justify-center p-3">
              <Building2 className="w-6 h-6 text-indigo-400 mb-2" />
              <span className="font-bold text-white text-sm">Business Management</span>
              <span className="text-xs text-slate-400">Inventory & expenses</span>
            </div>
          </div>
        </div>
      </section>

      {/* THE PROBLEM SECTION */}
      <section className="py-20 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16 space-y-3">
            <span className="text-xs font-mono font-bold tracking-widest uppercase text-rose-400">Operational Bottlenecks</span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
              Why Traditional POS Record Keeping Fails
            </h2>
            <p className="text-slate-400 text-sm sm:text-base">
              Running agency banking without a dedicated operating system leads to revenue leakage and unverified shift shortages.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-slate-900/60 border border-rose-500/20 rounded-2xl p-6 sm:p-8 space-y-4">
              <div className="w-12 h-12 rounded-xl bg-rose-500/10 text-rose-400 flex items-center justify-center">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white">Manual Ledger Discrepancies</h3>
              <p className="text-slate-400 text-xs sm:text-sm leading-relaxed">
                Paper notebooks and scattered Excel sheets make it impossible to track cash floats, POS terminal charges, and actual profits accurately at closing time.
              </p>
            </div>

            <div className="bg-slate-900/60 border border-amber-500/20 rounded-2xl p-6 sm:p-8 space-y-4">
              <div className="w-12 h-12 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center">
                <DollarSign className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white">Unclear Provider Fee Margins</h3>
              <p className="text-slate-400 text-xs sm:text-sm leading-relaxed">
                Without automated transaction fee calculation, operators often lose track of provider charges versus customer surcharges, eating into net earnings.
              </p>
            </div>

            <div className="bg-slate-900/60 border border-purple-500/20 rounded-2xl p-6 sm:p-8 space-y-4">
              <div className="w-12 h-12 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center">
                <WifiOff className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white">Network Downtime Vulnerability</h3>
              <p className="text-slate-400 text-xs sm:text-sm leading-relaxed">
                Standard web apps fail when internet service drops, leaving agents stranded and unable to record offline cash transactions during network outages.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* THE SOLUTION: COMPREHENSIVE OPERATIONS GRID */}
      <section id="features" className="py-24 bg-slate-900/50 border-t border-slate-800/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16 space-y-3">
            <span className="text-xs font-mono font-bold tracking-widest uppercase text-[#00B87A]">Complete POS Operating System</span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
              Everything You Need to Run & Scale Your POS Business
            </h2>
            <p className="text-slate-400 text-sm sm:text-base">
              A robust suite of 12 powerful modules built specifically for Nigerian merchants, supervisors, and super agents.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            
            {/* 1 */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 hover:border-[#00B87A]/50 transition group">
              <div className="flex items-center justify-between mb-4">
                <div className="w-10 h-10 rounded-xl bg-[#00B87A]/10 text-[#00B87A] flex items-center justify-center group-hover:scale-110 transition">
                  <Receipt className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-mono bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded-full font-bold">Active</span>
              </div>
              <h3 className="font-bold text-white text-base mb-2">POS Transactions Engine</h3>
              <p className="text-slate-400 text-xs leading-relaxed">
                Record and categorize withdrawals, deposits, transfers, and bill payments with automated customer charge and provider fee calculation.
              </p>
            </div>

            {/* 2 */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 hover:border-[#00B87A]/50 transition group">
              <div className="flex items-center justify-between mb-4">
                <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center group-hover:scale-110 transition">
                  <Users className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-mono bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded-full font-bold">Active</span>
              </div>
              <h3 className="font-bold text-white text-base mb-2">Agent & Staff Management</h3>
              <p className="text-slate-400 text-xs leading-relaxed">
                Manage cashiers, field agents, and supervisors. Assign unique access credentials and track individual operational performance.
              </p>
            </div>

            {/* 3 */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 hover:border-[#00B87A]/50 transition group">
              <div className="flex items-center justify-between mb-4">
                <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center group-hover:scale-110 transition">
                  <Terminal className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-mono bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded-full font-bold">Active</span>
              </div>
              <h3 className="font-bold text-white text-base mb-2">Terminal Fleet Management</h3>
              <p className="text-slate-400 text-xs leading-relaxed">
                Track POS machines across multiple locations. Monitor battery health, serial numbers, provider assignments, and daily terminal volume.
              </p>
            </div>

            {/* 4 */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 hover:border-[#00B87A]/50 transition group">
              <div className="flex items-center justify-between mb-4">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center group-hover:scale-110 transition">
                  <TrendingUp className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-mono bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded-full font-bold">Active</span>
              </div>
              <h3 className="font-bold text-white text-base mb-2">Realized Gain & Profit Tracking</h3>
              <p className="text-slate-400 text-xs leading-relaxed">
                Instantly calculate net profit by subtracting provider stamp duties and service costs from customer charges in real time.
              </p>
            </div>

            {/* 5 */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 hover:border-[#00B87A]/50 transition group">
              <div className="flex items-center justify-between mb-4">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center group-hover:scale-110 transition">
                  <DollarSign className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-mono bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded-full font-bold">Active</span>
              </div>
              <h3 className="font-bold text-white text-base mb-2">Expense & Inventory Ledger</h3>
              <p className="text-slate-400 text-xs leading-relaxed">
                Keep an accurate ledger of store inventory, data subscriptions, generator fueling, shop rent, and daily operational expenses.
              </p>
            </div>

            {/* 6 */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 hover:border-[#00B87A]/50 transition group">
              <div className="flex items-center justify-between mb-4">
                <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center group-hover:scale-110 transition">
                  <BarChart3 className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-mono bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded-full font-bold">Active</span>
              </div>
              <h3 className="font-bold text-white text-base mb-2">Advanced Analytics & Reports</h3>
              <p className="text-slate-400 text-xs leading-relaxed">
                Generate professional daily, weekly, and monthly PDF/CSV reports for business audits, partner reviews, and tax calculations.
              </p>
            </div>

            {/* 7 */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 hover:border-[#00B87A]/50 transition group">
              <div className="flex items-center justify-between mb-4">
                <div className="w-10 h-10 rounded-xl bg-rose-500/10 text-rose-400 flex items-center justify-center group-hover:scale-110 transition">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-mono bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded-full font-bold">Active</span>
              </div>
              <h3 className="font-bold text-white text-base mb-2">Cashier Reconciliation Calculator</h3>
              <p className="text-slate-400 text-xs leading-relaxed">
                Eliminate cash shortages with our built-in shift balancing tool that tallies physical cash, POS receipts, and transfers instantly.
              </p>
            </div>

            {/* 8 */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 hover:border-[#00B87A]/50 transition group">
              <div className="flex items-center justify-between mb-4">
                <div className="w-10 h-10 rounded-xl bg-teal-500/10 text-teal-400 flex items-center justify-center group-hover:scale-110 transition">
                  <Layers className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-mono bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded-full font-bold">Active</span>
              </div>
              <h3 className="font-bold text-white text-base mb-2">Multi-Tier Subscription Tiers</h3>
              <p className="text-slate-400 text-xs leading-relaxed">
                Flexible plans ranging from Starter to Enterprise, tailored to support single-location agents right up to nationwide super-aggregators.
              </p>
            </div>

            {/* 9 */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 hover:border-[#00B87A]/50 transition group">
              <div className="flex items-center justify-between mb-4">
                <div className="w-10 h-10 rounded-xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center group-hover:scale-110 transition">
                  <Globe className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-mono bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded-full font-bold">Active</span>
              </div>
              <h3 className="font-bold text-white text-base mb-2">Automated Referral Commissions</h3>
              <p className="text-slate-400 text-xs leading-relaxed">
                Earn passive income by inviting fellow agents and merchants. Track referral commissions and payouts seamlessly in your wallet.
              </p>
            </div>

          </div>
        </div>
      </section>

      {/* POS AGENT & NETWORK SCALING SECTION */}
      <section id="operations" className="py-24 relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            
            <div className="lg:col-span-6 space-y-6">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold uppercase tracking-wider">
                <Terminal className="w-3.5 h-3.5" />
                Designed For POS Operators
              </div>
              <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
                Built For Speed: Tactile Keypad & Instant Charge Matrix
              </h2>
              <p className="text-slate-300 text-base leading-relaxed">
                Whether you are processing a ₦50,000 withdrawal or selling airtime, our lightning-fast transaction drawer lets you record operations in under 3 seconds.
              </p>
              
              <div className="space-y-4 pt-2">
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 mt-1">
                    <Check className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="font-bold text-white text-sm">Instant Charge & Commission Preview</h4>
                    <p className="text-slate-400 text-xs">Know your exact profit before confirming any cash withdrawal or transfer.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 mt-1">
                    <Check className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="font-bold text-white text-sm">Multi-Terminal Assignment</h4>
                    <p className="text-slate-400 text-xs">Assign POS terminals to specific cashiers and track daily float balances effortlessly.</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="lg:col-span-6">
              <div className="relative mx-auto max-w-lg lg:max-w-none">
                <div className="absolute -inset-1 rounded-2xl bg-gradient-to-tr from-emerald-500 to-indigo-600 opacity-30 blur-lg"></div>
                <div className="relative rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden shadow-2xl">
                  <img 
                    src={conferenceImg} 
                    alt="Dan Godal Conference Presentation and Community Engagement" 
                    referrerPolicy="no-referrer"
                    loading="lazy"
                    decoding="async"
                    className="w-full h-auto object-cover hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-slate-950 via-slate-950/70 to-transparent p-4 sm:p-6">
                    <span className="inline-block px-2.5 py-1 rounded bg-indigo-600 text-white font-black text-[10px] tracking-wider uppercase mb-1">Community Growth</span>
                    <h3 className="text-white font-bold text-sm sm:text-base">Empowering POS Networks Across Nigeria</h3>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* SECURITY & OFFLINE SECTION */}
      <section id="security" className="py-24 bg-slate-900/50 border-t border-slate-800/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16 space-y-3">
            <span className="text-xs font-mono font-bold tracking-widest uppercase text-[#00B87A]">Enterprise Grade Security</span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
              Bank-Grade Protection & Offline Resilience
            </h2>
            <p className="text-slate-400 text-sm sm:text-base">
              Your financial records are secured with strict authentication, role-based access, and local encrypted caching.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 space-y-4">
              <div className="w-12 h-12 rounded-xl bg-[#00B87A]/10 text-[#00B87A] flex items-center justify-center">
                <Shield className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white">Role-Based Access Control</h3>
              <p className="text-slate-400 text-xs sm:text-sm leading-relaxed">
                Restrict sensitive profit reports and administrative controls to supervisors and business owners while cashiers access only daily transaction drawers.
              </p>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 space-y-4">
              <div className="w-12 h-12 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center">
                <WifiOff className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white">Offline-First Local Storage</h3>
              <p className="text-slate-400 text-xs sm:text-sm leading-relaxed">
                Never miss a transaction during internet outages. Data is securely cached locally and automatically synced to the cloud when connectivity returns.
              </p>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 space-y-4">
              <div className="w-12 h-12 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center">
                <Lock className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white">Encrypted Cloud Sync</h3>
              <p className="text-slate-400 text-xs sm:text-sm leading-relaxed">
                Powered by secure Firebase infrastructure ensuring your multi-branch agent data remains private, backed up, and accessible across devices.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* WHO IS IT FOR? */}
      <section id="audience" className="py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16 space-y-3">
            <span className="text-xs font-mono font-bold tracking-widest uppercase text-emerald-400">Target Audience</span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
              Built for Every Level of Agency Banking
            </h2>
            <p className="text-slate-400 text-sm sm:text-base">
              Whether you operate a single stand or manage a nationwide network of 100+ terminals.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center font-bold">01</div>
              <h3 className="text-white font-bold text-base">POS Agents</h3>
              <p className="text-slate-400 text-xs leading-relaxed">Single location operators looking to track daily withdrawals, deposits, and true profits.</p>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-3">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center font-bold">02</div>
              <h3 className="text-white font-bold text-base">Supervisors</h3>
              <p className="text-slate-400 text-xs leading-relaxed">Managers overseeing multiple cashiers, shift reconciliations, and terminal floats.</p>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-3">
              <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center font-bold">03</div>
              <h3 className="text-white font-bold text-base">Aggregators</h3>
              <p className="text-slate-400 text-xs leading-relaxed">Business owners managing fleets of POS machines across cities with multi-branch reporting.</p>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center font-bold">04</div>
              <h3 className="text-white font-bold text-base">Super Agents</h3>
              <p className="text-slate-400 text-xs leading-relaxed">Enterprise agency networks requiring robust role permissions and automated referral tracking.</p>
            </div>
          </div>
        </div>
      </section>

      {/* FINAL CTA BANNER */}
      <section className="py-20 bg-gradient-to-r from-emerald-950 via-slate-900 to-slate-950 border-t border-slate-800">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-6">
          <h2 className="text-3xl sm:text-4xl font-black text-white">
            Ready to Transform Your POS Business Operations?
          </h2>
          <p className="text-slate-300 text-base max-w-2xl mx-auto">
            Join thousands of Nigerian POS operators who have eliminated reconciliation errors and scaled their profits with Dan Godal Post Tracker.
          </p>
          <div className="pt-4 flex flex-wrap justify-center gap-4">
            <button
              onClick={onGetStarted}
              className="px-8 py-4 rounded-xl bg-gradient-to-r from-[#00B87A] to-emerald-500 hover:from-emerald-400 hover:to-emerald-500 text-slate-950 font-extrabold text-base transition shadow-xl shadow-[#00B87A]/30 flex items-center gap-2 cursor-pointer"
            >
              Get Started Now — Login / Register
              <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="bg-slate-950 border-t border-slate-800 text-slate-400 text-sm py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-10 mb-12">
            
            <div className="lg:col-span-2 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-[#00B87A] flex items-center justify-center text-slate-950 font-black text-lg">
                  D
                </div>
                <span className="font-extrabold text-white text-lg tracking-tight">
                  DANGODAL<span className="text-[#00B87A]">POSTRACKER</span>
                </span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed max-w-sm">
                Smart POS & Business Operating System built for Nigerian agency banking, multi-terminal management, and real-time profit tracking.
              </p>
              <div className="text-xs text-emerald-400 font-mono">
                Official Domain: <a href="https://postracker.com.ng" target="_blank" rel="noopener noreferrer" className="underline hover:text-emerald-300">postracker.com.ng</a>
              </div>
            </div>

            <div>
              <h4 className="font-bold text-white text-xs uppercase tracking-wider mb-4">Quick Navigation</h4>
              <ul className="space-y-2 text-xs">
                <li><button onClick={() => scrollToSection('features')} className="hover:text-white transition">Features & Modules</button></li>
                <li><button onClick={() => scrollToSection('operations')} className="hover:text-white transition">POS & Agents</button></li>
                <li><button onClick={() => scrollToSection('security')} className="hover:text-white transition">Security & Offline</button></li>
                <li><button onClick={() => scrollToSection('audience')} className="hover:text-white transition">Who Is It For</button></li>
              </ul>
            </div>

            <div>
              <h4 className="font-bold text-white text-xs uppercase tracking-wider mb-4">Legal & Support</h4>
              <ul className="space-y-2 text-xs">
                <li><button onClick={() => setActiveModal('privacy')} className="hover:text-white transition">Privacy Policy</button></li>
                <li><button onClick={() => setActiveModal('terms')} className="hover:text-white transition">Terms of Service</button></li>
                <li><button onClick={() => setActiveModal('security')} className="hover:text-white transition">Security Standards</button></li>
                <li><button onClick={() => setActiveModal('contact')} className="hover:text-white transition">Contact Support</button></li>
              </ul>
            </div>

            <div>
              <h4 className="font-bold text-white text-xs uppercase tracking-wider mb-4">Contact Details</h4>
              <ul className="space-y-3 text-xs">
                <li className="flex items-center gap-2"><Mail className="w-4 h-4 text-[#00B87A]" /> support@postracker.com.ng</li>
                <li className="flex items-center gap-2"><Phone className="w-4 h-4 text-[#00B87A]" /> +234 800 POS TRACK</li>
                <li className="flex items-center gap-2"><MapPin className="w-4 h-4 text-[#00B87A]" /> Lagos, Nigeria</li>
              </ul>
            </div>

          </div>

          <div className="pt-8 border-t border-slate-900 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-4">
            <p>© {new Date().getFullYear()} Dan Godal Post Tracker (postracker.com.ng). All rights reserved.</p>
            <div className="flex items-center gap-6">
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-500"></span> Systems Operational</span>
            </div>
          </div>
        </div>
      </footer>

      {/* MODALS FOR LEGAL / CONTACT */}
      <AnimatePresence>
        {activeModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 text-slate-200 relative shadow-2xl"
            >
              <button 
                onClick={() => setActiveModal(null)} 
                className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>

              {activeModal === 'privacy' && (
                <div className="space-y-4">
                  <h3 className="text-xl font-bold text-white">Privacy Policy</h3>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    At Dan Godal Post Tracker (postracker.com.ng), we take your data privacy seriously. All transaction records, agent logs, and business credentials are encrypted both in transit and at rest using enterprise-grade Firebase security standards. We never share your financial data with third parties.
                  </p>
                </div>
              )}

              {activeModal === 'terms' && (
                <div className="space-y-4">
                  <h3 className="text-xl font-bold text-white">Terms of Service</h3>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    By using Dan Godal Post Tracker, you agree to maintain accurate records, secure your login credentials, and comply with all Nigerian financial regulations regarding agency banking and merchant operations.
                  </p>
                </div>
              )}

              {activeModal === 'security' && (
                <div className="space-y-4">
                  <h3 className="text-xl font-bold text-white">Security Standards</h3>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Our platform utilizes Firestore security rules, HTTPS encryption, role-based access control, and offline-first encrypted local storage to ensure uninterrupted business operations and strict data isolation.
                  </p>
                </div>
              )}

              {activeModal === 'contact' && (
                <div className="space-y-4">
                  <h3 className="text-xl font-bold text-white">Contact Support</h3>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Need assistance with your POS terminals, subscription plans, or multi-tier agent setup? Reach out to our 24/7 support team at <strong className="text-emerald-400">support@postracker.com.ng</strong> or call <strong className="text-emerald-400">+234 800 POS TRACK</strong>.
                  </p>
                </div>
              )}

              <div className="mt-6 pt-4 border-t border-slate-800 flex justify-end">
                <button 
                  onClick={() => setActiveModal(null)}
                  className="px-4 py-2 rounded-xl bg-[#00B87A] text-slate-950 font-bold text-xs hover:bg-emerald-400 transition"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
