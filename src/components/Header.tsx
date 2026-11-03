import React from 'react';
import { ChevronLeft, Bell } from 'lucide-react';
import { NavTab } from './BottomNav';

interface HeaderProps {
  activeTab: NavTab;
  onOpenSettings: () => void;
  sktAlertCount?: number;
  onOpenAlerts?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  onOpenSettings,
  sktAlertCount = 0,
  onOpenAlerts,
}) => {
  const getTitle = () => {
    switch (activeTab) {
      case 'cash':
        return 'Kasa Yönetimi';
      case 'qr':
        return 'QR Takibi';
      case 'skt':
        return 'SKT Takibi';
      case 'reports':
        return 'Raporlar';
      default:
        return 'ŞOK Takip';
    }
  };

  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-100 shadow-xs pt-safe">
      <div className="max-w-md mx-auto px-4 h-14 flex items-center justify-between">
        {/* Left: ŞOK Brand Badge & Title */}
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#FFE000] to-[#FFCC00] flex items-center justify-center shadow-xs border border-amber-300 shrink-0">
            <span className="text-[#002B70] font-black text-xs tracking-tighter">ŞOK</span>
          </div>
          <div>
            <h1 className="text-sm font-extrabold text-[#002B70] leading-none tracking-tight">
              {getTitle()}
            </h1>
            <span className="text-[10px] font-semibold text-slate-500 leading-tight">
              Kişisel Takip
            </span>
          </div>
        </div>

        {/* Right: Alerts Bell & User Settings Avatar */}
        <div className="flex items-center gap-2">
          {onOpenAlerts && (
            <button
              onClick={onOpenAlerts}
              aria-label="SKT Uyarıları"
              className="w-9 h-9 rounded-full flex items-center justify-center text-slate-600 hover:text-[#003B95] hover:bg-slate-100 transition-colors relative"
            >
              <Bell className="w-5 h-5" />
              {sktAlertCount > 0 && (
                <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-red-500 rounded-full ring-2 ring-white" />
              )}
            </button>
          )}

          <button
            onClick={onOpenSettings}
            aria-label="Kullanıcı Ayarları"
            className="w-9 h-9 rounded-full bg-[#003B95] text-white flex items-center justify-center font-bold text-sm shadow-xs hover:bg-[#002B70] active:scale-95 transition-transform"
          >
            M
          </button>
        </div>
      </div>
    </header>
  );
};
