import React from 'react';
import { MessageCircle } from 'lucide-react';
import { motion } from 'motion/react';

export interface WhatsAppSupportProps {
  userName?: string;
  businessName?: string;
  phone?: string;
  role?: string;
  issue?: string;
  context?: string;
  buttonText?: string;
  variant?: 'primary' | 'outline' | 'card' | 'compact' | 'floating';
  className?: string;
}

export const WHATSAPP_NUMBER = "2348141106560";

export function getWhatsAppSupportUrl(options: {
  userName?: string;
  businessName?: string;
  phone?: string;
  role?: string;
  issue?: string;
  context?: string;
} = {}): string {
  let text = `Hello POSTRACK Support,\nI need assistance with my POSTRACK account.`;
  if (options.context) {
    text += ` (${options.context})`;
  }
  text += `\nMy Name: ${options.userName || ''}`;
  text += `\nBusiness Name: ${options.businessName || ''}`;
  text += `\nPhone Number: ${options.phone || ''}`;
  text += `\nManager/Cashier: ${options.role || ''}`;
  text += `\nIssue: ${options.issue || ''}`;
  text += `\nPlease assist me.`;

  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`;
}

export const WhatsAppSupportButton: React.FC<WhatsAppSupportProps> = ({
  userName = '',
  businessName = '',
  phone = '',
  role = '',
  issue = '',
  context,
  buttonText = 'Contact Support on WhatsApp',
  variant = 'primary',
  className = ''
}) => {
  const whatsappUrl = getWhatsAppSupportUrl({
    userName,
    businessName,
    phone,
    role,
    issue,
    context
  });

  const handleOpen = (e: React.MouseEvent) => {
    e.stopPropagation();
    window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
  };

  if (variant === 'floating') {
    return (
      <motion.a
        drag
        dragMomentum={false}
        whileDrag={{ scale: 1.1, cursor: 'grabbing' }}
        href={whatsappUrl}
        target="_blank"
        rel="noopener noreferrer"
        onClick={handleOpen}
        title="Contact POSTRACK Support on WhatsApp (+2348141106560) - Drag to move"
        className={`fixed bottom-24 right-4 sm:bottom-28 sm:right-6 z-50 flex items-center gap-2.5 px-4 py-3 bg-[#25D366] hover:bg-[#20ba5a] text-white font-extrabold text-xs rounded-full shadow-2xl transition-shadow cursor-grab border border-white/30 touch-none select-none ${className}`}
      >
        <MessageCircle className="w-5 h-5 fill-current shrink-0" />
        <span className="hidden sm:inline">{buttonText}</span>
      </motion.a>
    );
  }

  if (variant === 'compact') {
    return (
      <a
        href={whatsappUrl}
        target="_blank"
        rel="noopener noreferrer"
        onClick={handleOpen}
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#25D366]/10 hover:bg-[#25D366]/20 text-[#128C7E] font-bold text-xs rounded-lg transition-colors border border-[#25D366]/30 ${className}`}
      >
        <MessageCircle className="w-3.5 h-3.5 text-[#25D366]" />
        <span>{buttonText}</span>
      </a>
    );
  }

  if (variant === 'outline') {
    return (
      <a
        href={whatsappUrl}
        target="_blank"
        rel="noopener noreferrer"
        onClick={handleOpen}
        className={`inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-white dark:bg-neutral-800 border border-emerald-500/40 text-[#128C7E] dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 font-extrabold text-xs rounded-xl transition-all shadow-xs ${className}`}
      >
        <MessageCircle className="w-4 h-4 text-[#25D366]" />
        <span>{buttonText}</span>
      </a>
    );
  }

  if (variant === 'card') {
    return (
      <div className={`p-4 bg-emerald-50/80 dark:bg-emerald-950/20 border border-emerald-200/80 dark:border-emerald-800/40 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${className}`}>
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#25D366] text-white flex items-center justify-center shrink-0 shadow-sm">
            <MessageCircle className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-extrabold text-xs text-emerald-900 dark:text-emerald-300">Need Help? POSTRACK Support</h4>
            <p className="text-[11px] text-emerald-700 dark:text-emerald-400 mt-0.5">
              Chat live with support staff on WhatsApp (+2348141106560)
            </p>
          </div>
        </div>
        <a
          href={whatsappUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={handleOpen}
          className="w-full sm:w-auto px-4 py-2.5 bg-[#25D366] hover:bg-[#20ba5a] text-white font-black text-xs rounded-xl transition-all shadow-xs flex items-center justify-center gap-2 shrink-0"
        >
          <MessageCircle className="w-4 h-4" />
          <span>{buttonText}</span>
        </a>
      </div>
    );
  }

  // Primary variant
  return (
    <a
      href={whatsappUrl}
      target="_blank"
      rel="noopener noreferrer"
      onClick={handleOpen}
      className={`inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-[#25D366] hover:bg-[#20ba5a] text-white font-black text-xs rounded-xl shadow-md hover:shadow-lg transition-all active:scale-98 ${className}`}
    >
      <MessageCircle className="w-4 h-4" />
      <span>{buttonText}</span>
    </a>
  );
};

export default WhatsAppSupportButton;
