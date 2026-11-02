import React, { useState, useEffect } from 'react';
import { Download, Share, X, PlusSquare } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export const PWAInstallPrompt: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Detect standalone mode
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    setIsInstalled(isStandalone);

    // Detect iOS
    const ua = window.navigator.userAgent.toLowerCase();
    const isIOSDevice = /iphone|ipad|ipod/.test(ua);
    setIsIOS(isIOSDevice);

    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  if (isInstalled || dismissed) return null;

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setIsInstalled(true);
        setDeferredPrompt(null);
      }
    } else if (isIOS) {
      setShowIOSGuide(true);
    }
  };

  return (
    <>
      <div className="bg-gradient-to-r from-[#002B70] to-[#003B95] text-white px-4 py-2.5 flex items-center justify-between text-xs shadow-md border-b border-white/10">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-[#FFE000] text-[#002B70] flex items-center justify-center font-black text-xs shrink-0 shadow-sm">
            ŞOK
          </div>
          <div>
            <p className="font-semibold text-white">Uygulamayı Ana Ekrana Ekle</p>
            <p className="text-white/80 text-[11px]">Hızlı ve tam ekran mobil deneyim</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleInstallClick}
            className="bg-[#FFE000] text-[#002B70] font-bold px-3 py-1.5 rounded-lg text-xs flex items-center gap-1 active:scale-95 transition-transform"
          >
            <Download className="w-3.5 h-3.5" />
            Yükle
          </button>
          <button
            onClick={() => setDismissed(true)}
            aria-label="Bildirimi kapat"
            className="text-white/60 hover:text-white p-1 rounded-md"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {showIOSGuide && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl text-slate-900 border border-slate-100">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-[#002B70]">iPhone Ana Ekranına Ekleme</h3>
              <button
                onClick={() => setShowIOSGuide(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
                aria-label="Kapat"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="py-4 space-y-3 text-xs text-slate-700 leading-relaxed">
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center font-bold shrink-0 text-xs">
                  1
                </div>
                <div>
                  Safari alt çubuğundaki <span className="font-bold inline-flex items-center gap-1 text-[#003B95]"><Share className="w-3.5 h-3.5" /> Paylaş</span> simgesine dokunun.
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center font-bold shrink-0 text-xs">
                  2
                </div>
                <div>
                  Açılan menüde aşağı kaydırıp <span className="font-bold inline-flex items-center gap-1 text-[#003B95]"><PlusSquare className="w-3.5 h-3.5" /> Ana Ekrana Ekle</span> seçeneğini seçin.
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center font-bold shrink-0 text-xs">
                  3
                </div>
                <div>
                  Sağ üstteki <span className="font-bold text-[#003B95]">Ekle</span> butonuna basarak kurulumu tamamlayın.
                </div>
              </div>
            </div>
            <button
              onClick={() => setShowIOSGuide(false)}
              className="w-full py-2.5 rounded-xl bg-[#002B70] text-white font-semibold text-xs active:bg-[#001D4D] transition-colors"
            >
              Anladım
            </button>
          </div>
        </div>
      )}
    </>
  );
};
