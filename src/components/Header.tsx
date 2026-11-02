import React from 'react';
import { ChevronLeft, Bell } from 'lucide-react';
import { NavTab } from './BottomNav';

interface HeaderProps {
  activeTab: NavTab;
  onBack?: () => void;
  onOpenSettings: () => void;
  sktAlertCount?: number;
  onOpenAlerts?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  onBack,
  onOpenSettings,
  sktAlertCount = 0,
  onOpenAlerts,
}) => {
  const getTitle = () => {
    switch (activeTab) {
      case 'qr':
        return 'QR Takibi';
      case 'cash':
        return 'Kasa Takibi';
      case 'skt':
        return 'SKT Takibi';
      case 'reports':
        return 'Raporlar';
      default:
        return '';
    }
  };

  const isHome = activeTab === 'home';

  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-100 shadow-xs pt-safe">
      <div className="max-w-md mx-auto px-4 h-14 flex items-center justify-between">
        {isHome ? (
          <>
            {/* ŞOK Brand Wordmark / Logo */}
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5">
                <div className="relative flex items-center justify-center">
                  {/* Yellow burst background with red diacritic */}
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#FFE000] to-[#FFCC00] flex items-center justify-center shadow-xs border border-amber-300">
                    <span className="text-[#002B70] font-black text-sm tracking-tighter">ŞOK</span>
                  </div>
                </div>
                <div className="flex flex-col">
                  <span className="text-sm font-extrabold text-[#002B70] leading-none">ŞOK</span>
                  <span className="text-[10px] font-semibold text-slate-500 leading-tight">Kişisel Takip</span>
                </div>
              </div>
            </div>

            {/* Right Slot: Notifications & Profile Avatar */}
            <div className="flex items-center gap-2">
              <button
                onClick={onOpenAlerts}
                aria-label="Bildirimler ve Uyarılar"
                className="w-10 h-10 rounded-full flex items-center justify-center text-slate-600 hover:text-[#003B95] hover:bg-slate-50 transition-colors relative"
              >
                <Bell className="w-5 h-5" />
                {sktAlertCount > 0 && (
                  <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-red-500 rounded-full ring-2 ring-white" />
                )}
              </button>

              <button
                onClick={onOpenSettings}
                aria-label="Kullanıcı Ayarları"
                className="w-9 h-9 rounded-full bg-[#003B95] text-white flex items-center justify-center font-bold text-sm shadow-xs hover:bg-[#002B70] transition-transform active:scale-95"
              >
                M
              </button>
            </div>
          </>
        ) : (
          <>
            {/* Subpage Header with Back navigation */}
            <div className="flex items-center gap-1">
              <button
                onClick={onBack}
                aria-label="Geri Dön"
                className="w-9 h-9 -ml-2 rounded-full flex items-center justify-center text-slate-700 hover:bg-slate-100 transition-colors"
              >
                <ChevronLeft className="w-6 h-6 stroke-[2.2]" />
              </button>
              <h1 className="text-base font-bold text-[#002B70] tracking-tight">
                {getTitle()}
              </h1>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={onOpenSettings}
                aria-label="Kullanıcı Ayarları"
                className="w-8 h-8 rounded-full bg-[#003B95] text-white flex items-center justify-center font-bold text-xs shadow-xs hover:bg-[#002B70] active:scale-95 transition-transform"
              >
                M
              </button>
            </div>
          </>
        )}
      </div>
    </header>
  );
};
