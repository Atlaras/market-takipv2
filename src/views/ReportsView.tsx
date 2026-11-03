import React, { useState, useEffect } from 'react';
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
  Coins,
  CheckCircle2,
  AlertCircle,
  Tag,
  Trash,
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import {
  QRTransaction,
  CashShift,
  CashTransaction,
  ProductBatch,
  UserProfile,
  CashCount,
  DenominationCounts,
} from '../types';
import { formatCurrency } from '../utils/cashCalculations';
import {
  getTodayDateString,
  formatTurkishDate,
  getExpirationCategory,
} from '../utils/dateValidation';
import { getAllCashCounts } from '../lib/supabase';

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
  cashTransactions,
  batches,
}) => {
  // Period filter: 'daily' | 'monthly' | 'yearly' | 'all'
  const [period, setPeriod] = useState<'daily' | 'monthly' | 'yearly' | 'all'>('monthly');
  const [cashCounts, setCashCounts] = useState<CashCount[]>([]);
  const [isLoadingCounts, setIsLoadingCounts] = useState(false);

  const todayStr = getTodayDateString();
  const currentMonthStr = todayStr.slice(0, 7); // YYYY-MM
  const currentYearStr = todayStr.slice(0, 4); // YYYY

  // Fetch all physical cash counts
  useEffect(() => {
    let isMounted = true;
    async function loadCounts() {
      setIsLoadingCounts(true);
      try {
        const counts = await getAllCashCounts(user.id);
        if (isMounted) setCashCounts(counts);
      } catch {
        // silent
      } finally {
        if (isMounted) setIsLoadingCounts(false);
      }
    }
    loadCounts();
    return () => {
      isMounted = false;
    };
  }, [user.id]);

  // Filter transactions based on selected period
  const filteredQRs = qrTransactions.filter((q) => {
    if (period === 'daily') return q.transaction_date === todayStr;
    if (period === 'monthly') return q.transaction_date.slice(0, 7) === currentMonthStr;
    if (period === 'yearly') return q.transaction_date.slice(0, 4) === currentYearStr;
    return true;
  });

  const filteredCashTx = cashTransactions.filter((c) => {
    const txDate = (c.transaction_at || c.created_at).slice(0, 10);
    if (period === 'daily') return txDate === todayStr;
    if (period === 'monthly') return txDate.slice(0, 7) === currentMonthStr;
    if (period === 'yearly') return txDate.slice(0, 4) === currentYearStr;
    return true;
  });

  // Latest cash count
  const latestCount = cashCounts[0] || null;

  // SECTION 1: QR Okutma Takip Hesaplamaları (Kasadan ve Cirodan TAMAMEN BAĞIMSIZ)
  const totalQRVolume = filteredQRs.reduce((acc, q) => acc + (Number(q.amount) || 0), 0);
  const totalQRScans = filteredQRs.length;

  const todayQRs = qrTransactions.filter((q) => q.transaction_date === todayStr);
  const todayQRVolume = todayQRs.reduce((acc, q) => acc + (Number(q.amount) || 0), 0);
  const todayQRCount = todayQRs.length;

  const generalQRVolume = qrTransactions.reduce((acc, q) => acc + (Number(q.amount) || 0), 0);
  const generalQRCount = qrTransactions.length;

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
  const sktCritical = batches.filter(
    (b) => b.status !== 'disposed' && getExpirationCategory(b.expiration_date).category === 'critical'
  ).length;
  const sktWarning = batches.filter(
    (b) => b.status !== 'disposed' && getExpirationCategory(b.expiration_date).category === 'warning'
  ).length;
  const sktExpired = batches.filter(
    (b) => b.status !== 'disposed' && getExpirationCategory(b.expiration_date).category === 'expired'
  ).length;
  const sktDisposed = batches.filter((b) => b.status === 'disposed').length;

  // PDF Export
  const handleExportPDF = () => {
    try {
      const doc = new jsPDF();
      const periodLabel =
        period === 'daily'
          ? 'Günlük'
          : period === 'monthly'
          ? 'Aylık'
          : period === 'yearly'
          ? 'Yıllık'
          : 'Genel (Tüm Zamanlar)';

      doc.setFontSize(18);
      doc.text('SOK Kisisel Takip - Profesyonel Rapor Dokumu', 14, 20);

      doc.setFontSize(10);
      doc.text(`Tarih: ${formatTurkishDate(todayStr)} | Kapsam: ${periodLabel}`, 14, 28);
      doc.text(`Kasiyer / Kullanici: ${user.name} (${user.email})`, 14, 34);

      doc.setLineWidth(0.5);
      doc.line(14, 38, 196, 38);

      // BÖLÜM 1: KASA VE MAĞAZA SATIŞ RAPORU
      doc.setFontSize(13);
      doc.text('BOLUM 1: KASA VE MAGAZA SATIS RAPORU (QR HARIC)', 14, 46);

      doc.setFontSize(10);
      doc.text(`• Toplam Magaza Cirosu (Nakit + Kart): ${formatCurrency(totalStoreRevenue)}`, 14, 54);
      doc.text(`• Toplam Net Nakit Satis: ${formatCurrency(totalNetCashSales)}`, 14, 60);
      doc.text(`• Toplam Kredi Karti Satisi: ${formatCurrency(totalCardSales)}`, 14, 66);
      doc.text(
        `• Bolunmus Odemeler: Nakit ${formatCurrency(splitCashPortion)} + Kart ${formatCurrency(splitCardPortion)}`,
        14,
        72
      );
      doc.text(`• Nakit Iadeler: -${formatCurrency(totalCashRefunds)}`, 14, 78);
      doc.text(`• Diger Nakit Girisleri / Avans: +${formatCurrency(totalOtherIn)}`, 14, 84);
      doc.text(`• Diger Masraf ve Cikislar: -${formatCurrency(totalOtherOut)}`, 14, 90);
      doc.text(`• Net Kasa Nakit Akisi: ${formatCurrency(netCashFlow)}`, 14, 96);

      doc.line(14, 102, 196, 102);

      // BÖLÜM 2: FİİLÎ KASA SAYIMI VE AÇIK / FAZLA RAPORU
      doc.setFontSize(13);
      doc.text('BOLUM 2: FIILI KASA SAYIMI VE FARK ANALIZI', 14, 110);

      if (latestCount) {
        const diff = latestCount.actual_cash - (latestCount.expected_cash ?? netCashFlow);
        const statusLabel =
          diff > 0.01 ? `KASA FAZLASI (+${formatCurrency(diff)})` : diff < -0.01 ? `KASA ACIGI (${formatCurrency(diff)})` : 'KASA TAM DENK';

        doc.setFontSize(10);
        doc.text(`• Son Sayilan Fiili Kasa Tutari: ${formatCurrency(latestCount.actual_cash)}`, 14, 118);
        doc.text(`• Sayim Zamani: ${latestCount.counted_at?.slice(0, 16).replace('T', ' ')}`, 14, 124);
        doc.text(`• Durum ve Kasa Farki: ${statusLabel}`, 14, 130);

        if (latestCount.count_breakdown) {
          const b = latestCount.count_breakdown as any;
          doc.setFontSize(9);
          doc.text(
            `  Kupur Dokumu: 200TL: ${b.d200 ?? 0} ad | 100TL: ${b.d100 ?? 0} ad | 50TL: ${b.d50 ?? 0} ad | 20TL: ${b.d20 ?? 0} ad | 10TL: ${b.d10 ?? 0} ad | 5TL: ${b.d5 ?? 0} ad | 1TL: ${b.d1 ?? 0} ad`,
            14,
            136
          );
        }
      } else {
        doc.setFontSize(10);
        doc.text('• Henuz fiili kasa sayimi kaydi bulunmamaktadir.', 14, 118);
      }

      doc.line(14, 144, 196, 144);

      // BÖLÜM 3: QR KOD OKUTMA TAKİP RAPORU (Kasadan Bağımsız)
      doc.setFontSize(13);
      doc.text('BOLUM 3: QR KOD OKUTMA TAKIP RAPORU (KASADAN BAGIMSIZ)', 14, 154);
      doc.setFontSize(9);
      doc.text('* Not: QR takibi musteri sadakat okutmasidir, kasa ciro ve nakdine kesinlikle eklenmez.', 14, 160);

      doc.setFontSize(10);
      doc.text(`• Secilen Donem Okutulan Musteri Sayisi: ${totalQRScans} kisi`, 14, 168);
      doc.text(`• Secilen Donem Toplam QR Okutma Hacmi: ${formatCurrency(totalQRVolume)}`, 14, 174);
      doc.text(`• Bugunku QR Okutma Hacmi: ${formatCurrency(todayQRVolume)} (${todayQRCount} kisi)`, 14, 180);
      doc.text(`• Genel QR Okutma Hacmi: ${formatCurrency(generalQRVolume)} (${generalQRCount} kisi)`, 14, 186);

      doc.line(14, 192, 196, 192);

      // BÖLÜM 4: SKT VE REYON DURUMU
      doc.setFontSize(13);
      doc.text('BOLUM 4: SKT VE REYON SAGLIGI', 14, 202);

      doc.setFontSize(10);
      doc.text(`• Kritik Reyon Urunleri (<= 3 gun): ${sktCritical} Parti`, 14, 210);
      doc.text(`• Indirim Girisi Bekleyenler (<= 7 gun): ${sktWarning} Parti`, 14, 216);
      doc.text(`• Toplanip Imha Edilecek Tarihi Gecmisler: ${sktExpired} Parti`, 14, 222);
      doc.text(`• Raftan Toplanmis / Imha Edilmis Urunler: ${sktDisposed} Parti`, 14, 228);

      doc.save(`SOK_Rapor_${period}_${todayStr}.pdf`);
    } catch (err) {
      console.error('PDF export error:', err);
      alert('PDF oluşturulurken bir hata meydana geldi.');
    }
  };

  return (
    <div className="space-y-4 pb-28 px-4 max-w-lg mx-auto">
      {/* Top Header & Period Selector (Aylık / Yıllık / Günlük / Genel) */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1 bg-slate-200/90 p-1 rounded-2xl text-xs font-bold text-slate-700">
          <button
            onClick={() => setPeriod('daily')}
            className={`px-3 py-1.5 rounded-xl transition-all ${
              period === 'daily' ? 'bg-[#002B70] text-white shadow-xs' : 'hover:bg-slate-300/60'
            }`}
          >
            Günlük
          </button>
          <button
            onClick={() => setPeriod('monthly')}
            className={`px-3 py-1.5 rounded-xl transition-all ${
              period === 'monthly' ? 'bg-[#002B70] text-white shadow-xs' : 'hover:bg-slate-300/60'
            }`}
          >
            Aylık
          </button>
          <button
            onClick={() => setPeriod('yearly')}
            className={`px-3 py-1.5 rounded-xl transition-all ${
              period === 'yearly' ? 'bg-[#002B70] text-white shadow-xs' : 'hover:bg-slate-300/60'
            }`}
          >
            Yıllık
          </button>
          <button
            onClick={() => setPeriod('all')}
            className={`px-3 py-1.5 rounded-xl transition-all ${
              period === 'all' ? 'bg-[#002B70] text-white shadow-xs' : 'hover:bg-slate-300/60'
            }`}
          >
            Genel
          </button>
        </div>

        <button
          onClick={handleExportPDF}
          className="py-2 px-3.5 rounded-2xl bg-white border border-slate-200 text-[#002B70] font-black text-xs flex items-center gap-1.5 shadow-xs hover:bg-slate-50 active:scale-95 transition-all shrink-0"
        >
          <Download className="w-3.5 h-3.5" />
          <span>PDF İndir</span>
        </button>
      </div>

      {/* ============================================================ */}
      {/* 1. KASA VE MAĞAZA SATIŞ RAPORU (PROFESYONEL ÖZET)            */}
      {/* ============================================================ */}
      <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold">
              <Banknote className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-emerald-800 block">
                KASA & CİRO PERFORMANSI
              </span>
              <h3 className="text-sm font-extrabold text-slate-900">
                {period === 'daily'
                  ? 'Günlük Kasa Raporu'
                  : period === 'monthly'
                  ? 'Aylık Kasa Raporu'
                  : period === 'yearly'
                  ? 'Yıllık Kasa Raporu'
                  : 'Genel Kasa Raporu'}
              </h3>
            </div>
          </div>
          <span className="text-[10px] font-extrabold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800">
            QR Hariç Net Satış
          </span>
        </div>

        {/* Ana KPI Kartları Grid */}
        <div className="grid grid-cols-2 gap-2.5">
          {/* Toplam Satış Cirosu */}
          <div className="bg-slate-50 rounded-2xl p-3.5 border border-slate-200/80">
            <span className="text-[10px] font-bold uppercase text-slate-500 block">
              Toplam Mağaza Cirosu
            </span>
            <p className="text-xl font-black text-slate-900 tabular-nums mt-0.5">
              {formatCurrency(totalStoreRevenue)}
            </p>
            <span className="text-[10px] text-slate-400 font-medium">Nakit + Kart Satışları</span>
          </div>

          {/* Net Kasa Nakit Akışı */}
          <div className="bg-slate-50 rounded-2xl p-3.5 border border-slate-200/80">
            <span className="text-[10px] font-bold uppercase text-slate-500 block">
              Net Kasa Nakit Akışı
            </span>
            <p
              className={`text-xl font-black tabular-nums mt-0.5 ${
                netCashFlow >= 0 ? 'text-emerald-700' : 'text-red-700'
              }`}
            >
              {formatCurrency(netCashFlow)}
            </p>
            <span className="text-[10px] text-slate-400 font-medium">Kasaya giren net nakit</span>
          </div>
        </div>

        {/* Satış Yöntemi Dağılım Çubuğu */}
        <div className="space-y-1.5 pt-1">
          <div className="flex justify-between text-xs font-bold text-slate-700">
            <span className="text-emerald-700">Nakit: {formatCurrency(totalNetCashSales)}</span>
            <span className="text-purple-700">Kart: {formatCurrency(totalCardSales)}</span>
          </div>
          <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden flex">
            <div
              style={{
                width: `${
                  totalStoreRevenue > 0
                    ? Math.round((totalNetCashSales / totalStoreRevenue) * 100)
                    : 50
                }%`,
              }}
              className="bg-emerald-500 h-full transition-all duration-500"
              title="Nakit Oranı"
            />
            <div
              style={{
                width: `${
                  totalStoreRevenue > 0
                    ? Math.round((totalCardSales / totalStoreRevenue) * 100)
                    : 50
                }%`,
              }}
              className="bg-purple-500 h-full transition-all duration-500"
              title="Kart Oranı"
            />
          </div>
        </div>

        {/* Detay Satırları */}
        <div className="divide-y divide-slate-100 text-xs pt-1">
          <div className="py-1.5 flex justify-between text-slate-600">
            <span>Bölünmüş Ödeme (Nakit / Kart):</span>
            <span className="font-bold text-slate-800 tabular-nums">
              {formatCurrency(splitCashPortion)} / {formatCurrency(splitCardPortion)}
            </span>
          </div>
          <div className="py-1.5 flex justify-between text-slate-600">
            <span>Nakit İadeler (Kasadan Çıkış):</span>
            <span className="font-bold text-red-600 tabular-nums">
              -{formatCurrency(totalCashRefunds)}
            </span>
          </div>
          <div className="py-1.5 flex justify-between text-slate-600">
            <span>Diğer Nakit Girişleri (Avans vb.):</span>
            <span className="font-bold text-blue-600 tabular-nums">
              +{formatCurrency(totalOtherIn)}
            </span>
          </div>
          <div className="py-1.5 flex justify-between text-slate-600">
            <span>Diğer Masraflar / Çıkışlar:</span>
            <span className="font-bold text-amber-700 tabular-nums">
              -{formatCurrency(totalOtherOut)}
            </span>
          </div>
        </div>
      </div>

      {/* ============================================================ */}
      {/* 2. FİİLÎ KASA SAYIMI VE AÇIK / FAZLA RAPORU                  */}
      {/* ============================================================ */}
      <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-2xl bg-amber-50 text-amber-700 flex items-center justify-center font-bold">
              <Coins className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-amber-800 block">
                FİİLÎ SAYIM & KASA MUTABAKATI
              </span>
              <h3 className="text-sm font-extrabold text-slate-900">
                Banknot ve Madeni Para Sayımı
              </h3>
            </div>
          </div>
        </div>

        {latestCount ? (
          (() => {
            const diff = latestCount.actual_cash - (latestCount.expected_cash ?? netCashFlow);
            const isExact = Math.abs(diff) <= 0.01;
            const isSurplus = diff > 0.01;
            const isDeficit = diff < -0.01;

            return (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200">
                    <span className="text-[10px] text-slate-500 font-semibold block">
                      Sayılan Fiilî Kasa
                    </span>
                    <p className="text-lg font-black text-[#002B70] tabular-nums mt-0.5">
                      {formatCurrency(latestCount.actual_cash)}
                    </p>
                    <span className="text-[9px] text-slate-400">
                      {latestCount.counted_at?.slice(11, 16)} saatinde
                    </span>
                  </div>

                  <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200">
                    <span className="text-[10px] text-slate-500 font-semibold block">
                      Beklenen Kasa Nakdi
                    </span>
                    <p className="text-lg font-black text-slate-800 tabular-nums mt-0.5">
                      {formatCurrency(latestCount.expected_cash ?? netCashFlow)}
                    </p>
                    <span className="text-[9px] text-slate-400">Sistem hesaplaması</span>
                  </div>
                </div>

                {/* Fark Durum Kutusu */}
                <div
                  className={`p-3.5 rounded-2xl border flex items-center justify-between text-xs font-bold ${
                    isExact
                      ? 'bg-blue-50 border-blue-200 text-blue-900'
                      : isSurplus
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                      : 'bg-red-50 border-red-200 text-red-900'
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    {isExact ? (
                      <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />
                    ) : isSurplus ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                    )}
                    <span>
                      {isExact
                        ? 'Kasa Tam Denk (Fark Yok)'
                        : isSurplus
                        ? 'Kasa Fazlası Bulundu'
                        : 'Kasa Açığı Bulundu'}
                    </span>
                  </div>
                  <span className="text-sm font-black tabular-nums">
                    {isExact
                      ? '₺0,00'
                      : isSurplus
                      ? `+${formatCurrency(diff)}`
                      : formatCurrency(diff)}
                  </span>
                </div>

                {/* Küpür Dağılımı Dökümü */}
                {latestCount.count_breakdown && (
                  <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200/80">
                    <span className="text-[10px] font-bold text-slate-500 uppercase block mb-1.5">
                      Küpür / Adet Dökümü
                    </span>
                    <div className="grid grid-cols-4 gap-1.5 text-center text-xs">
                      {Object.entries({
                        '200 TL': (latestCount.count_breakdown as any).d200 ?? 0,
                        '100 TL': (latestCount.count_breakdown as any).d100 ?? 0,
                        '50 TL': (latestCount.count_breakdown as any).d50 ?? 0,
                        '20 TL': (latestCount.count_breakdown as any).d20 ?? 0,
                        '10 TL': (latestCount.count_breakdown as any).d10 ?? 0,
                        '5 TL': (latestCount.count_breakdown as any).d5 ?? 0,
                        '1 TL': (latestCount.count_breakdown as any).d1 ?? 0,
                      }).map(([denom, qty]) => (
                        <div key={denom} className="bg-white p-1.5 rounded-xl border border-slate-200">
                          <span className="text-[9px] text-slate-400 block font-bold">{denom}</span>
                          <span className="font-extrabold text-slate-800">{qty} ad</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })()
        ) : (
          <p className="text-xs text-slate-400 text-center py-4">
            Henüz kaydedilmiş fiilî kasa sayımı bulunmuyor.
          </p>
        )}
      </div>

      {/* ============================================================ */}
      {/* 3. QR KOD OKUTMA TAKİP RAPORU (KASADAN TAMAMEN BAĞIMSIZ)     */}
      {/* ============================================================ */}
      <div className="bg-white rounded-3xl p-5 border border-blue-200 shadow-xs space-y-3 relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-600 to-indigo-600" />

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-2xl bg-blue-50 text-blue-700 flex items-center justify-center font-bold">
              <QrCode className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-blue-700 block">
                KASADAN TAMAMEN BAĞIMSIZ
              </span>
              <h3 className="text-sm font-extrabold text-slate-900">
                Müşteri QR Okutma Takibi
              </h3>
            </div>
          </div>
          <span className="text-[10px] font-extrabold bg-blue-100 text-blue-900 px-2.5 py-1 rounded-full">
            {totalQRScans} Okutma
          </span>
        </div>

        <p className="text-[11px] text-slate-600 bg-slate-50 p-2.5 rounded-2xl border border-slate-100 leading-relaxed">
          * Bu tutar mağazadaki kasiyerin müşteri mobil QR kodlarını okutma hacmidir. Kasa satış cirosuna veya nakit kasaya hiçbir koşulda eklenmez.
        </p>

        <div className="grid grid-cols-2 gap-2.5">
          <div className="bg-blue-50/70 p-3 rounded-2xl border border-blue-100">
            <span className="text-[10px] font-bold uppercase text-blue-800 block">
              Seçilen Dönem QR Hacmi
            </span>
            <p className="text-xl font-black text-blue-950 tabular-nums mt-0.5">
              {formatCurrency(totalQRVolume)}
            </p>
            <span className="text-[10px] text-blue-700 font-medium">
              {totalQRScans} Müşteri / Okutma
            </span>
          </div>

          <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200">
            <span className="text-[10px] font-bold uppercase text-slate-500 block">
              Genel QR Hacmi
            </span>
            <p className="text-xl font-black text-slate-900 tabular-nums mt-0.5">
              {formatCurrency(generalQRVolume)}
            </p>
            <span className="text-[10px] text-slate-500 font-medium">
              {generalQRCount} Müşteri (Toplam)
            </span>
          </div>
        </div>
      </div>

      {/* ============================================================ */}
      {/* 4. SKT VE REYON SAĞLIĞI RAPORU                               */}
      {/* ============================================================ */}
      <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-2xl bg-amber-50 text-amber-700 flex items-center justify-center font-bold">
              <CalendarClock className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-amber-800 block">
                REYON DENETİMİ
              </span>
              <h3 className="text-sm font-extrabold text-slate-900">
                SKT & Fire Raporu
              </h3>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="p-3 bg-amber-50/80 border border-amber-200 rounded-2xl flex items-center justify-between">
            <div>
              <span className="text-[10px] text-amber-900 font-bold block">İndirim Bekleyen</span>
              <p className="text-lg font-black text-amber-900">{sktWarning} Parti</p>
            </div>
            <Tag className="w-5 h-5 text-amber-600" />
          </div>

          <div className="p-3 bg-red-50/80 border border-red-200 rounded-2xl flex items-center justify-between">
            <div>
              <span className="text-[10px] text-red-900 font-bold block">Tarihi Geçen</span>
              <p className="text-lg font-black text-red-900">{sktExpired} Parti</p>
            </div>
            <Trash className="w-5 h-5 text-red-600" />
          </div>
        </div>

        <div className="p-2.5 bg-slate-50 border border-slate-100 rounded-2xl flex items-center justify-between text-xs text-slate-600">
          <span>Raftan Toplanıp İmha Edilen Toplam:</span>
          <span className="font-extrabold text-slate-900">{sktDisposed} Parti</span>
        </div>
      </div>
    </div>
  );
};
