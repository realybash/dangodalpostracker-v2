import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { X, RefreshCcw, Camera } from 'lucide-react';

interface BarcodeScannerProps {
  onScan: (decodedText: string) => void;
  onClose: () => void;
  title?: string;
}

export const BarcodeScanner: React.FC<BarcodeScannerProps> = ({ onScan, onClose, title = 'Scan Barcode' }) => {
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<'requesting' | 'starting' | 'running' | 'error'>('requesting');
  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const containerId = 'barcode-reader-surface';

  const startScanner = async () => {
    try {
      setStatus('starting');
      setError(null);

      const html5QrCode = new Html5Qrcode(containerId);
      html5QrCodeRef.current = html5QrCode;

      const config = {
        fps: 15,
        qrbox: { width: 250, height: 180 },
        aspectRatio: 1.0,
        formatsToSupport: [
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.EAN_8,
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.CODE_39,
          Html5QrcodeSupportedFormats.UPC_A,
          Html5QrcodeSupportedFormats.UPC_E,
          Html5QrcodeSupportedFormats.QR_CODE
        ]
      };

      // Prefer back camera (environment)
      await html5QrCode.start(
        { facingMode: "environment" },
        config,
        (decodedText) => {
          onScan(decodedText);
          html5QrCode.stop().then(() => onClose()).catch(console.error);
        },
        (errorMessage) => {
          // Keep scanning...
        }
      );
      
      setStatus('running');
    } catch (err: any) {
      console.error('Camera Error:', err);
      setError(err.message || 'Could not start camera. Please ensure permissions are granted and you are using a secure connection (HTTPS).');
      setStatus('error');
    }
  };

  useEffect(() => {
    startScanner();

    return () => {
      if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
        html5QrCodeRef.current.stop().catch(err => console.error('Failed to stop scanner', err));
      }
    };
  }, []);

  return (
    <div className="fixed inset-0 bg-neutral-900/90 backdrop-blur-xl flex items-center justify-center p-4 z-[100] animate-fade-in">
      <div className="bg-white rounded-[40px] max-w-lg w-full overflow-hidden shadow-2xl relative border border-white/10">
        {/* Header */}
        <div className="p-6 border-b border-neutral-100 flex items-center justify-between bg-white">
          <div>
            <h3 className="text-xl font-black text-neutral-900 tracking-tight">{title}</h3>
            <p className="text-[10px] text-neutral-400 font-black uppercase tracking-widest mt-0.5">
              {status === 'running' ? 'Scanning active' : 'Waiting for camera...'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="bg-neutral-100 text-neutral-500 hover:text-neutral-900 p-2.5 rounded-full transition-all active:scale-95"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Scanner Surface */}
        <div className="p-8 bg-neutral-50 relative min-h-[350px] flex flex-col items-center justify-center">
          <div 
            id={containerId} 
            className="w-full aspect-square max-w-[320px] rounded-[32px] overflow-hidden border-4 border-white shadow-2xl bg-black relative z-10"
          >
            {status === 'starting' && (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-white space-y-4">
                <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                <p className="text-xs font-black uppercase tracking-widest">Initializing...</p>
              </div>
            )}
            
            {status === 'error' && (
              <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center bg-neutral-900">
                <div className="w-16 h-16 rounded-full bg-rose-500/20 flex items-center justify-center text-rose-500 mb-4">
                  <Camera className="w-8 h-8" />
                </div>
                <p className="text-[11px] text-neutral-300 font-bold leading-relaxed mb-6">
                  {error}
                </p>
                <button
                  onClick={startScanner}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3 rounded-2xl text-xs font-black flex items-center gap-2 transition-all active:scale-95 shadow-lg shadow-emerald-600/20"
                >
                  <RefreshCcw className="w-4 h-4" />
                  Retry Camera
                </button>
              </div>
            )}
          </div>

          {/* Decorative Corner Borders for the scan area */}
          {status === 'running' && (
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-[320px] aspect-square pointer-events-none z-20">
              <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-emerald-500 rounded-tl-3xl" />
              <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-emerald-500 rounded-tr-3xl" />
              <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-emerald-500 rounded-bl-3xl" />
              <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-emerald-500 rounded-br-3xl" />
              {/* Scanning animation line */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[90%] h-0.5 bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.8)] animate-scan-line opacity-50" />
            </div>
          )}

          {/* Guidelines */}
          <div className="mt-8 w-full space-y-4">
            <div className="flex items-center gap-4 p-5 bg-emerald-50 rounded-[24px] border border-emerald-100 shadow-sm">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-600 shrink-0">
                <Camera className="w-5 h-5" />
              </div>
              <p className="text-[11px] text-emerald-800 font-bold leading-relaxed">
                Position the barcode clearly within the center frame. Ensure good lighting for instant detection.
              </p>
            </div>
            
            <p className="text-center text-[9px] text-neutral-400 font-black uppercase tracking-[0.2em]">
              Supports Code 128 • EAN • UPC • QR
            </p>
          </div>
        </div>
      </div>
      
      <style>{`
        @keyframes scan-line {
          0% { top: 10%; }
          100% { top: 90%; }
        }
        .animate-scan-line {
          animation: scan-line 2s ease-in-out infinite alternate;
        }
      `}</style>
    </div>
  );
};
