import React from 'react';
import { Home, QrCode, Calculator, CalendarClock, BarChart3, LucideIcon } from 'lucide-react';

export type NavTab = 'home' | 'qr' | 'cash' | 'skt' | 'reports';

interface TabItem {
  id: NavTab;
  label: string;
  icon: LucideIcon;
  badge?: number;
}

interface BottomNavProps {
  activeTab: NavTab;
  onTabChange: (tab: NavTab) => void;
  sktAlertCount?: number;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  activeTab,
  onTabChange,
  sktAlertCount = 0,
}) => {
  const tabs: TabItem[] = [
    { id: 'home', label: 'Ana Sayfa', icon: Home },
    { id: 'qr', label: 'QR Takibi', icon: QrCode },
    { id: 'cash', label: 'Kasa', icon: Calculator },
    { id: 'skt', label: 'SKT', icon: CalendarClock, badge: sktAlertCount },
    { id: 'reports', label: 'Raporlar', icon: BarChart3 },
  ];

  return (
    <nav
      aria-label="Alt Navigasyon Menüsü"
      className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200/80 shadow-[0_-4px_20px_rgba(0,0,0,0.04)] pb-safe"
    >
      <div className="max-w-md mx-auto grid grid-cols-5 h-16 items-center px-1">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`flex flex-col items-center justify-center py-1 transition-colors relative min-h-[48px] ${
                isActive ? 'text-[#0055D4]' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              <div className="relative">
                <Icon
                  className={`w-6 h-6 transition-transform ${
                    isActive ? 'scale-110 stroke-[2.4]' : 'stroke-[1.8]'
                  }`}
                />
                {tab.badge && tab.badge > 0 ? (
                  <span className="absolute -top-1 -right-2 bg-red-500 text-white text-[10px] font-bold rounded-full h-4 min-w-[16px] px-1 flex items-center justify-center ring-2 ring-white">
                    {tab.badge > 99 ? '99+' : tab.badge}
                  </span>
                ) : null}
              </div>
              <span
                className={`text-[11px] mt-1 font-medium tracking-tight whitespace-nowrap ${
                  isActive ? 'font-bold text-[#0055D4]' : 'text-slate-500'
                }`}
              >
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
