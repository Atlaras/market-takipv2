import React, { useState } from 'react';
import {
  BarChart3,
  Download,
  Calendar,
  QrCode,
  Banknote,
  CreditCard,
  RotateCcw,
  CalendarClock,
  ArrowUpRight,
  TrendingUp,
  Layers,
  Users,
  Split,
  ArrowDownLeft,
  FileSpreadsheet,
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import { QRTransaction, CashShift, CashTransaction, ProductBatch, UserProfile } from '../types';
import { formatCurrency, calculateShiftTotals } from '../utils/cashCalculations';
import { getTodayDateString, formatTurkishDate, getExpirationCategory } from '../utils/dateValidation';

interface ReportsViewProps {
  user: UserProfile;
  qrTransactions: QRTransaction[];
  shifts: CashShift[];
  cashTransactions: CashTransaction[];
  batches: ProductBatch[];
}

export const ReportsView: React.FC<ReportsViewProps> = ({
  user,
  qrTransactions,
  shifts,
  cashTransactions,
  batches,
}) => {
  const [period, setPeriod] = useState<'daily' | 'weekly' | 'monthly'>('monthly');

  const todayStr = getTodayDateString();
  const currentMonthStr = todayStr.slice(0, 7);

  // Filter transactions based on selected period
  const filteredQRs = qrTransactions.filter((q) => {
    if (period === 'daily') return q.transaction_date === todayStr;
    if (period === 'monthly') return q.transaction_date.slice(0, 7) === currentMonthStr;
    const weekAgo = new Date(Date.now() - 86400000 * 7).toISOString().split('T')[0];
    return q.transaction_date >= weekAgo && q.transaction_date <= todayStr;
  });

  const filteredCashTx = cashTransactions.filter((c) => {
    const txDate = (c.transaction_at || c.created_at).slice(0, 10);
    if (period === 'daily') return txDate === todayStr;
    if (period === 'monthly') return txDate.slice(0, 7) === currentMonthStr;
    const weekAgo = new Date(Date.now() - 86400000 * 7).toISOString().split('T')[0];
    return txDate >= weekAgo && txDate <= todayStr;
  });

  // SECTION 1: QR Okutma Takip Hesaplamaları (Kasadan ve Cirodan TAMAMEN BAĞIMSIZ)
  const totalQRVolume = filteredQRs.reduce((acc, q) => acc + (Number(q.amount) || 0), 0);
  const totalQRScans = filteredQRs.length;

  const todayQRs = qrTransactions.filter((q) => q.transaction_date === todayStr);
  const todayQRVolume = todayQRs.reduce((acc, q) => acc + (Number(q.amount) || 0), 0);
  const todayQRCount = todayQRs.length;

  const monthQRs = qrTransactions.filter((q) => q.transaction_date.slice(0, 7) === currentMonthStr);
  const monthQRVolume = monthQRs.reduce((acc, q) => acc + (Number(q.amount) || 0), 0);
  const monthQRCount = monthQRs.length;

  // SECTION 2: Kasa ve Satış Hesaplamaları (QR ASLA DAHİL EDİLMEZ!)
  const cashSales = filteredCashTx
    .filter((c) => c.transaction_type === 'cash_sale')
    .reduce((acc, c) => acc + (Number(c.cash_amount ?? c.amount) || 0), 0);

  const cardSales = filteredCashTx
    .filter((c) => c.transaction_type === 'card_sale')
    .reduce((acc, c) => acc + (Number(c.card_amount ?? c.amount) || 0), 0);

  const splitTx = filteredCashTx.filter((c) => c.transaction_type === 'split_payment');
  const splitCashPortion = splitTx.reduce((acc, c) => acc + (Number(c.cash_amount) || 0), 0);
  const splitCardPortion = splitTx.reduce((acc, c) => acc + (Number(c.card_amount) || 0), 0);

  const totalNetCashSales = cashSales + splitCashPortion;
  const totalCardSales = cardSales + splitCardPortion;

  const totalCashRefunds = filteredCashTx
    .filter((c) => c.transaction_type === 'cash_refund')
    .reduce((acc, c) => acc + (Number(c.amount) || 0), 0);

  const totalOtherIn = filteredCashTx
    .filter((c) => c.transaction_type === 'other_in')
    .reduce((acc, c) => acc + (Number(c.amount) || 0), 0);

  const totalOtherOut = filteredCashTx
    .filter((c) => c.transaction_type === 'other_out')
    .reduce((acc, c) => acc + (Number(c.amount) || 0), 0);

  // Kasa Cirosu = Yalnızca Nakit Satışlar + Kart Satışları (QR KESİNLİKLE DAHİL EDİLMEZ!)
  const totalStoreRevenue = totalNetCashSales + totalCardSales;

  // Net Kasa Nakit Akışı (Kasadaki net değişim)
  const netCashFlow = totalNetCashSales - totalCashRefunds + totalOtherIn - totalOtherOut;

  // SKT İstatistikleri
  const sktCritical = batches.filter((b) => getExpirationCategory(b.expiration_date).category === 'critical').length;
  const sktWarning = batches.filter((b) => getExpirationCategory(b.expiration_date).category === 'warning').length;
  const sktExpired = batches.filter((b) => getExpirationCategory(b.expiration_date).category === 'expired').length;
  const sktNormal = batches.filter((b) => getExpirationCategory(b.expiration_date).category === 'normal').length;

  // PDF Export
  const handleExportPDF = () => {
    try {
      const doc = new jsPDF();
      const periodLabel = period === 'daily' ? 'Günlük' : period === 'weekly' ? 'Haftalık' : 'Aylık';

      doc.setFontSize(18);
      doc.text('SOK Kişisel Takip - Rapor Dökümü', 14, 20);

      doc.setFontSize(10);
      doc.text(`Tarih: ${formatTurkishDate(todayStr)} | Kapsam: ${periodLabel}`, 14, 28);
      doc.text(`Kasiyer / Kullanıcı: ${user.name} (${user.email})`, 14, 34);

      doc.setLineWidth(0.5);
      doc.line(14, 38, 196, 38);

      // BÖLÜM 1: QR KOD OKUTMA TAKİP RAPORU (Kasadan Bağımsız)
      doc.setFontSize(13);
      doc.text('BOLUM 1: QR KOD OKUTMA TAKIP RAPORU (KASADAN BAGIMSIZ)', 14, 46);
      doc.setFontSize(9);
      doc.text('* Not: QR takibi musteri barkod okutma hacmidir, kasa ciro ve nakdine dahil edilmez.', 14, 52);

      doc.setFontSize(10);
      doc.text(`• Secilen Donem Okutulan Musteri Sayisi: ${totalQRScans} kisi`, 14, 60);
      doc.text(`• Secilen Donem Toplam QR Okutma Tutari: ${formatCurrency(totalQRVolume)}`, 14, 66);
      doc.text(`• Bugunku QR Okutma Hacmi: ${formatCurrency(todayQRVolume)} (${todayQRCount} kisi)`, 14, 72);
      doc.text(`• Bu Ayki QR Okutma Hacmi: ${formatCurrency(monthQRVolume)} (${monthQRCount} kisi)`, 14, 78);

      doc.line(14, 84, 196, 84);

      // BÖLÜM 2: KASA VE MAGAZA SATIS RAPORU (QR Asla Eklenmez)
      doc.setFontSize(13);
      doc.text('BOLUM 2: KASA VE MAGAZA SATIS RAPORU (QR HARIC)', 14, 94);

      doc.setFontSize(10);
      doc.text(`• Toplam Magaza Cirosu (Nakit + Kart): ${formatCurrency(totalStoreRevenue)}`, 14, 102);
      doc.text(`• Toplam Net Nakit Satis: ${formatCurrency(totalNetCashSales)}`, 14, 108);
      doc.text(`• Toplam Kredi Karti Satisi: ${formatCurrency(totalCardSales)}`, 14, 114);
      doc.text(`• Bolunmus Odemeler (Nakit: ${formatCurrency(splitCashPortion)}, Kart: ${formatCurrency(splitCardPortion)})`, 14, 120);
      doc.text(`• Nakit Iadeler: -${formatCurrency(totalCashRefunds)}`, 14, 126);
      doc.text(`• Diger Nakit Girisleri: +${formatCurrency(totalOtherIn)}`, 14, 132);
      doc.text(`• Diger Nakit Cikislari: -${formatCurrency(totalOtherOut)}`, 14, 138);
      doc.text(`• Net Kasa Nakit Akisi: ${formatCurrency(netCashFlow)}`, 14, 144);

      doc.line(14, 150, 196, 150);

      // BÖLÜM 3: SKT PARTİ RAPORU
      doc.setFontSize(13);
      doc.text('BOLUM 3: SKT PARTI DURUMU', 14, 160);

      doc.setFontSize(10);
      doc.text(`• Kritik (3 gun ve alti): ${sktCritical} Parti`, 14, 168);
      doc.text(`• Yaklasan (7 gun ve alti): ${sktWarning} Parti`, 14, 174);
      doc.text(`• Tarihi Gecmis (Imha / Iade): ${sktExpired} Parti`, 14, 180);
      doc.text(`• Guvenli / Normal: ${sktNormal} Parti`, 14, 186);

      doc.save(`SOK_Rapor_${period}_${todayStr}.pdf`);
    } catch (err) {
      console.error('PDF export error:', err);
      alert('PDF oluşturulurken bir hata meydana geldi.');
    }
  };

  return (
    <div className="space-y-4 pb-28 px-4 max-w-lg mx-auto">
      {/* Top Header & Period Selector */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1 bg-slate-200/80 p-0.5 rounded-xl text-xs font-bold text-slate-600">
          <button
            onClick={() => setPeriod('monthly')}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              period === 'monthly' ? 'bg-[#002B70] text-white shadow-xs' : ''
            }`}
          >
            Aylık
          </button>
          <button
            onClick={() => setPeriod('weekly')}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              period === 'weekly' ? 'bg-[#002B70] text-white shadow-xs' : ''
            }`}
          >
            Haftalık
          </button>
          <button
            onClick={() => setPeriod('daily')}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              period === 'daily' ? 'bg-[#002B70] text-white shadow-xs' : ''
            }`}
          >
            Günlük
          </button>
        </div>

        <button
          onClick={handleExportPDF}
          className="py-1.5 px-3 rounded-xl bg-white border border-slate-200 text-[#002B70] font-bold text-xs flex items-center gap-1.5 shadow-xs hover:bg-slate-50 active:scale-95 transition-all"
        >
          <Download className="w-3.5 h-3.5" />
          <span>PDF İndir</span>
        </button>
      </div>

      {/* ============================================================ */}
      {/* BÖLÜM 1: QR KOD OKUTMA TAKİP RAPORU (KASADAN TAMAMEN AYRI)   */}
      {/* ============================================================ */}
      <div className="bg-white rounded-3xl p-5 border border-blue-200/90 shadow-sm space-y-3 relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-400" />
        
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center">
              <QrCode className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700 block">
                BÖLÜM 1 • KASADAN TAMAMEN BAĞIMSIZ
              </span>
              <h3 className="text-sm font-extrabold text-slate-900">
                QR Kod Okutma Takip Raporu
              </h3>
            </div>
          </div>
          <span className="text-[11px] font-bold text-blue-800 bg-blue-50 px-2.5 py-1 rounded-full">
            {totalQRScans} Müşteri
          </span>
        </div>

        <p className="text-[11px] text-slate-500 leading-relaxed bg-slate-50 p-2.5 rounded-xl border border-slate-100">
          Müşterilerin uygulamalarındaki QR kod okutma istatistiğidir. Kasiyer takip amaçlı tutulur; ciroya veya kasa devir bakiyesine <strong>asla dahil edilmez</strong>.
        </p>

        {/* QR Rakamları */}
        <div className="grid grid-cols-2 gap-2 pt-1 text-xs">
          <div className="bg-blue-50/60 p-3 rounded-2xl border border-blue-100">
            <span className="text-[10px] font-bold text-blue-800 block">
              {period === 'daily' ? 'Günün' : period === 'weekly' ? 'Haftanın' : 'Ayın'} QR Hacmi
            </span>
            <p className="text-lg font-black text-blue-900 tabular-nums mt-0.5">
              {formatCurrency(totalQRVolume)}
            </p>
            <span className="text-[10px] text-blue-600 font-semibold">
              {totalQRScans} Okutma İşlemi
            </span>
          </div>

          <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200/80">
            <span className="text-[10px] font-bold text-slate-600 block">
              Bugünkü Okutma
            </span>
            <p className="text-lg font-black text-slate-900 tabular-nums mt-0.5">
              {formatCurrency(todayQRVolume)}
            </p>
            <span className="text-[10px] text-slate-500 font-semibold">
              {todayQRCount} Müşteri Okutuldu
            </span>
          </div>
        </div>
      </div>

      {/* ============================================================ */}
      {/* BÖLÜM 2: KASA VE MAĞAZA SATIŞ RAPORU (QR ASLA EKLENMEZ)     */}
      {/* ============================================================ */}
      <div className="bg-white rounded-3xl p-5 border border-slate-200/90 shadow-sm space-y-4 relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-400" />

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
              <Banknote className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 block">
                BÖLÜM 2 • FİNANSAL SATIŞ & KASA
              </span>
              <h3 className="text-sm font-extrabold text-slate-900">
                Kasa ve Satış Raporu
              </h3>
            </div>
          </div>
        </div>

        {/* Toplam Ciro Kartı (Nakit + Kart) */}
        <div className="bg-gradient-to-r from-[#002B70] to-[#004BB5] rounded-2xl p-4 text-white">
          <span className="text-[10px] font-bold uppercase tracking-wider text-blue-200 block">
            Toplam Mağaza Cirosu (QR Hariç)
          </span>
          <p className="text-2xl font-black text-white tabular-nums mt-0.5">
            {formatCurrency(totalStoreRevenue)}
          </p>
          <div className="mt-2 pt-2 border-t border-white/15 flex justify-between text-xs text-blue-100">
            <span>Nakit: {formatCurrency(totalNetCashSales)}</span>
            <span>Kart: {formatCurrency(totalCardSales)}</span>
          </div>
        </div>

        {/* Ciro Görsel Grafiği (Sadece Nakit vs Kart) */}
        <div className="pt-1">
          <span className="text-xs font-bold text-slate-700 block mb-2">
            Satış Yöntemi Dağılımı
          </span>
          <div className="flex items-end justify-around h-28 border-b border-slate-100 pb-2">
            {/* Nakit Satış */}
            <div className="flex flex-col items-center gap-1 w-1/3">
              <span className="text-[10px] font-bold text-emerald-700 tabular-nums">
                {formatCurrency(totalNetCashSales)}
              </span>
              <div
                style={{
                  height: `${Math.min(100, Math.max(15, (totalNetCashSales / (totalStoreRevenue || 1)) * 100))}%`,
                }}
                className="w-12 rounded-t-xl bg-gradient-to-t from-emerald-600 to-emerald-400 transition-all duration-500"
              />
              <span className="text-[10px] font-bold text-slate-600 mt-1">Nakit</span>
            </div>

            {/* Kart Satış */}
            <div className="flex flex-col items-center gap-1 w-1/3">
              <span className="text-[10px] font-bold text-purple-700 tabular-nums">
                {formatCurrency(totalCardSales)}
              </span>
              <div
                style={{
                  height: `${Math.min(100, Math.max(15, (totalCardSales / (totalStoreRevenue || 1)) * 100))}%`,
                }}
                className="w-12 rounded-t-xl bg-gradient-to-t from-purple-600 to-purple-400 transition-all duration-500"
              />
              <span className="text-[10px] font-bold text-slate-600 mt-1">Kart</span>
            </div>
          </div>
        </div>

        {/* Detaylı Kasa Kalemleri */}
        <div className="space-y-2 text-xs divide-y divide-slate-100">
          <div className="flex items-center justify-between pt-1.5">
            <span className="text-slate-600">Net Nakit Satışlar:</span>
            <span className="font-bold text-emerald-600 tabular-nums">
              {formatCurrency(totalNetCashSales)}
            </span>
          </div>

          <div className="flex items-center justify-between pt-1.5">
            <span className="text-slate-600">Kredi Kartı Satışları:</span>
            <span className="font-bold text-purple-600 tabular-nums">
              {formatCurrency(totalCardSales)}
            </span>
          </div>

          <div className="flex items-center justify-between pt-1.5">
            <span className="text-slate-600">Bölünmüş Ödemeler (Toplam):</span>
            <span className="font-bold text-indigo-600 tabular-nums">
              {formatCurrency(splitCashPortion + splitCardPortion)}
            </span>
          </div>

          <div className="flex items-center justify-between pt-1.5">
            <span className="text-slate-600">Nakit İadeler:</span>
            <span className="font-bold text-red-500 tabular-nums">
              -{formatCurrency(totalCashRefunds)}
            </span>
          </div>

          <div className="flex items-center justify-between pt-1.5">
            <span className="text-slate-600">Diğer Nakit Girişler:</span>
            <span className="font-bold text-blue-600 tabular-nums">
              +{formatCurrency(totalOtherIn)}
            </span>
          </div>

          <div className="flex items-center justify-between pt-1.5">
            <span className="text-slate-600">Diğer Nakit Çıkışlar:</span>
            <span className="font-bold text-amber-600 tabular-nums">
              -{formatCurrency(totalOtherOut)}
            </span>
          </div>

          <div className="flex items-center justify-between pt-2 text-sm font-black text-slate-900 border-t border-slate-200">
            <span>Net Kasa Nakit Akışı:</span>
            <span className="text-[#002B70] tabular-nums">
              {formatCurrency(netCashFlow)}
            </span>
          </div>
        </div>
      </div>

      {/* SKT Özet Kartı */}
      <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs space-y-3">
        <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
          <CalendarClock className="w-4 h-4 text-emerald-600" />
          <h3 className="text-sm font-bold text-slate-900">SKT Parti Durum Raporu</h3>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="p-2.5 bg-red-50 rounded-xl">
            <span className="text-red-700 font-bold block">Kritik (≤3 Gün)</span>
            <span className="text-lg font-black text-red-800 tabular-nums">{sktCritical}</span>
          </div>
          <div className="p-2.5 bg-amber-50 rounded-xl">
            <span className="text-amber-700 font-bold block">Yaklaşan (≤7 Gün)</span>
            <span className="text-lg font-black text-amber-800 tabular-nums">{sktWarning}</span>
          </div>
          <div className="p-2.5 bg-slate-100 rounded-xl">
            <span className="text-slate-700 font-bold block">Tarihi Geçen</span>
            <span className="text-lg font-black text-slate-800 tabular-nums">{sktExpired}</span>
          </div>
          <div className="p-2.5 bg-emerald-50 rounded-xl">
            <span className="text-emerald-700 font-bold block">Güvenli / Normal</span>
            <span className="text-lg font-black text-emerald-800 tabular-nums">{sktNormal}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
