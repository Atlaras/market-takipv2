import React, { useState } from 'react';
import {
  QrCode,
  Calculator,
  CalendarClock,
  Clock,
  ChevronRight,
  TrendingUp,
  CreditCard,
  Banknote,
  CheckCircle2,
  AlertTriangle,
  ArrowUpRight,
} from 'lucide-react';
import { NavTab } from '../components/BottomNav';
import { UserProfile, QRTransaction, CashShift, CashTransaction, ProductBatch } from '../types';
import { formatCurrency } from '../utils/cashCalculations';
import { getTodayDateString, formatTurkishDate } from '../utils/dateValidation';

interface HomeViewProps {
  user: UserProfile;
  onNavigate: (tab: NavTab) => void;
  qrTransactions: QRTransaction[];
  activeShift: CashShift | null;
  cashTransactions: CashTransaction[];
  batches: ProductBatch[];
  onStartShiftClick: () => void;
}

export const HomeView: React.FC<HomeViewProps> = ({
  user,
  onNavigate,
  qrTransactions,
  activeShift,
  cashTransactions,
  batches,
  onStartShiftClick,
}) => {
  const [statsPeriod, setStatsPeriod] = useState<'month' | 'today' | 'week'>('month');

  const todayStr = getTodayDateString();

  // Calculate Today's QR Total
  const todayQRs = qrTransactions.filter((q) => q.transaction_date === todayStr);
  const todayQRTotal = todayQRs.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);

  // Period-based stats calculations
  const periodQRs = qrTransactions.filter((q) => {
    if (statsPeriod === 'today') return q.transaction_date === todayStr;
    if (statsPeriod === 'month') return q.transaction_date.slice(0, 7) === todayStr.slice(0, 7);
    return true; // week or all
  });
  const periodQRTotal = periodQRs.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);

  const periodCashSales = cashTransactions
    .filter((c) => c.transaction_type === 'cash_sale')
    .reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);

  const periodCardSales = cashTransactions
    .filter((c) => c.transaction_type === 'card_sale')
    .reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);

  const totalPeriodRevenue = periodCashSales + periodCardSales;

  // SKT warning count (expired or due within 7 days)
  const urgentBatches = batches.filter((b) => {
    if (b.status === 'consumed' || b.status === 'disposed') return false;
    return b.expiration_date <= new Date(Date.now() + 86400000 * 7).toISOString().split('T')[0];
  });

  return (
    <div className="space-y-4 pb-24">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-b from-white to-[#F4F7FB] px-4 pt-4 pb-2">
        <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">
          Merhaba <span className="text-[#002B70]">{user.name}</span> 👋
        </h2>
        <p className="text-xs text-slate-500 font-medium mt-0.5">
          Kişisel İşlem ve Vardiya Yönetimi
        </p>
      </div>

      <div className="px-4 space-y-4">
        {/* Big Yellow QR Summary Card (Directly from Mockup) */}
        <div
          onClick={() => onNavigate('qr')}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && onNavigate('qr')}
          className="w-full bg-gradient-to-r from-[#FFDD00] via-[#FFE533] to-[#FFD000] rounded-3xl p-5 shadow-lg shadow-amber-500/15 border border-amber-300/60 cursor-pointer active:scale-[0.98] transition-transform flex items-center justify-between"
        >
          <div className="flex items-center gap-3.5">
            <div className="w-13 h-13 rounded-2xl bg-[#002B70] text-[#FFE000] flex items-center justify-center shrink-0 shadow-md">
              <QrCode className="w-7 h-7 stroke-[2.2]" />
            </div>
            <div>
              <p className="text-xs font-bold text-[#002B70]/80 tracking-tight">
                Bugünün QR Toplamı
              </p>
              <p className="text-2xl font-black text-[#002B70] tracking-tight tabular-nums mt-0.5">
                {formatCurrency(todayQRTotal)}
              </p>
            </div>
          </div>

          <div className="w-10 h-10 rounded-full bg-white/90 text-[#002B70] flex items-center justify-center shadow-xs shrink-0">
            <ChevronRight className="w-5 h-5 stroke-[2.5]" />
          </div>
        </div>

        {/* Quick Access Grid (3 Cards as in mockup) */}
        <div className="grid grid-cols-3 gap-2.5">
          {/* QR Takibi */}
          <button
            onClick={() => onNavigate('qr')}
            className="flex flex-col items-center justify-center p-3.5 rounded-2xl bg-white border border-slate-200/70 shadow-xs hover:border-blue-300 active:scale-95 transition-all text-center group"
          >
            <div className="w-11 h-11 rounded-xl bg-blue-50 text-[#0055D4] flex items-center justify-center mb-2 group-hover:scale-105 transition-transform">
              <QrCode className="w-6 h-6 stroke-[2]" />
            </div>
            <span className="text-xs font-bold text-slate-800">QR Takibi</span>
            <span className="text-[10px] text-slate-400 mt-0.5">{todayQRs.length} İşlem</span>
          </button>

          {/* Kasa Takibi */}
          <button
            onClick={() => onNavigate('cash')}
            className="flex flex-col items-center justify-center p-3.5 rounded-2xl bg-white border border-slate-200/70 shadow-xs hover:border-blue-300 active:scale-95 transition-all text-center group"
          >
            <div className="w-11 h-11 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center mb-2 group-hover:scale-105 transition-transform">
              <Calculator className="w-6 h-6 stroke-[2]" />
            </div>
            <span className="text-xs font-bold text-slate-800">Kasa Takibi</span>
            <span className="text-[10px] text-slate-400 mt-0.5">
              {activeShift ? 'Aktif' : 'Vardiya Başlat'}
            </span>
          </button>

          {/* SKT Takibi */}
          <button
            onClick={() => onNavigate('skt')}
            className="flex flex-col items-center justify-center p-3.5 rounded-2xl bg-white border border-slate-200/70 shadow-xs hover:border-blue-300 active:scale-95 transition-all text-center group relative"
          >
            <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center mb-2 group-hover:scale-105 transition-transform">
              <CalendarClock className="w-6 h-6 stroke-[2]" />
            </div>
            <span className="text-xs font-bold text-slate-800">SKT Takibi</span>
            <span className="text-[10px] text-slate-400 mt-0.5">
              {urgentBatches.length > 0 ? `${urgentBatches.length} Uyarı` : 'Düzenli'}
            </span>
            {urgentBatches.length > 0 && (
              <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-red-500" />
            )}
          </button>
        </div>

        {/* Vardiya Bilgisi Card */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center shrink-0">
              <Clock className="w-5 h-5 stroke-[2]" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-900">Vardiya Bilgisi</p>
              {activeShift ? (
                <p className="text-xs text-slate-600 mt-0.5 font-medium">
                  {activeShift.shift_name} ({activeShift.start_time})
                </p>
              ) : (
                <p className="text-xs text-slate-400 mt-0.5">Şu an açık vardiya bulunmuyor</p>
              )}
            </div>
          </div>

          {activeShift ? (
            <button
              onClick={() => onNavigate('cash')}
              className="px-3 py-1.5 rounded-full bg-emerald-100 text-emerald-800 font-bold text-xs flex items-center gap-1 active:scale-95"
            >
              <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse" />
              Aktif
            </button>
          ) : (
            <button
              onClick={onStartShiftClick}
              className="px-3 py-1.5 rounded-xl bg-[#002B70] text-white font-bold text-xs hover:bg-[#001D4D] active:scale-95 shadow-xs"
            >
              Başlat
            </button>
          )}
        </div>

        {/* Hızlı İstatistikler Section */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4 text-[#0055D4]" />
              <h3 className="text-sm font-bold text-slate-900">Hızlı İstatistikler</h3>
            </div>

            {/* Segmented Period Tabs */}
            <div className="flex items-center bg-slate-100 p-0.5 rounded-xl text-[11px] font-semibold text-slate-600">
              <button
                onClick={() => setStatsPeriod('today')}
                className={`px-2.5 py-1 rounded-lg transition-all ${
                  statsPeriod === 'today' ? 'bg-white text-[#002B70] shadow-xs' : ''
                }`}
              >
                Bugün
              </button>
              <button
                onClick={() => setStatsPeriod('month')}
                className={`px-2.5 py-1 rounded-lg transition-all ${
                  statsPeriod === 'month' ? 'bg-white text-[#002B70] shadow-xs' : ''
                }`}
              >
                Bu Ay
              </button>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {/* Stat 1: QR Toplamı */}
            <div className="bg-white rounded-2xl p-2.5 sm:p-3 border border-slate-200/80 shadow-xs flex flex-col justify-between min-w-0">
              <div className="w-8 h-8 rounded-lg bg-blue-50 text-[#0055D4] flex items-center justify-center mb-1.5">
                <QrCode className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <p className="text-xs sm:text-sm font-black text-slate-900 tabular-nums truncate">
                  {formatCurrency(periodQRTotal)}
                </p>
                <p className="text-[10px] font-medium text-slate-500 mt-0.5 truncate">QR Okutma</p>
              </div>
            </div>

            {/* Stat 2: Kasa Nakit */}
            <div className="bg-white rounded-2xl p-2.5 sm:p-3 border border-slate-200/80 shadow-xs flex flex-col justify-between min-w-0">
              <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center mb-1.5">
                <Banknote className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <p className="text-xs sm:text-sm font-black text-slate-900 tabular-nums truncate">
                  {formatCurrency(periodCashSales)}
                </p>
                <p className="text-[10px] font-medium text-slate-500 mt-0.5 truncate">Nakit Satış</p>
              </div>
            </div>

            {/* Stat 3: Kart Satış */}
            <div className="bg-white rounded-2xl p-2.5 sm:p-3 border border-slate-200/80 shadow-xs flex flex-col justify-between min-w-0">
              <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-700 flex items-center justify-center mb-1.5">
                <CreditCard className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <p className="text-xs sm:text-sm font-black text-slate-900 tabular-nums truncate">
                  {formatCurrency(periodCardSales)}
                </p>
                <p className="text-[10px] font-medium text-slate-500 mt-0.5 truncate">Kart Satış</p>
              </div>
            </div>
          </div>
        </div>

        {/* Son İşlemler (Recent Activities) */}
        <div className="space-y-2.5 pt-1">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900">Son İşlemler</h3>
            <button
              onClick={() => onNavigate('qr')}
              className="text-xs font-semibold text-[#0055D4] flex items-center gap-0.5 hover:underline"
            >
              <span>Tümü</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs divide-y divide-slate-100 overflow-hidden">
            {todayQRs.length === 0 ? (
              <div className="p-6 text-center text-slate-400 text-xs">
                Bugün için henüz bir QR işlemi kaydedilmedi.
              </div>
            ) : (
              todayQRs.slice(0, 4).map((tx) => (
                <div key={tx.id} className="p-3.5 flex items-center justify-between hover:bg-slate-50/60 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                      <CheckCircle2 className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-900 tabular-nums">
                        {formatCurrency(tx.amount)}
                      </p>
                      <p className="text-[11px] text-slate-500 truncate">
                        {tx.description || 'Müşteri QR Okutma'}
                      </p>
                    </div>
                  </div>
                  <span className="text-[11px] text-slate-400 tabular-nums shrink-0 ml-2">
                    {tx.transaction_time?.slice(0, 5)}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
