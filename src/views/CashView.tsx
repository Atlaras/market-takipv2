import React, { useState, useEffect } from 'react';
import {
  Banknote,
  CreditCard,
  RotateCcw,
  Plus,
  Edit2,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Calculator,
  ArrowDownLeft,
  ArrowUpRight,
  Split,
  Coins,
  X,
  RefreshCw,
} from 'lucide-react';
import {
  CashShift,
  CashTransaction,
  UserProfile,
  CashCount,
  DenominationCounts,
} from '../types';
import {
  calculateShiftTotals,
  evaluateCashCount,
  formatCurrency,
  calculateNetCashSale,
  calculateSplitPayment,
} from '../utils/cashCalculations';
import {
  getCurrentTimeString,
  formatTurkishDate,
  getTodayDateString,
} from '../utils/dateValidation';
import {
  addCashTransaction,
  updateCashTransaction,
  deleteCashTransaction,
  saveCashCount,
  getLatestCashCount,
  ensureDailyShift,
} from '../lib/supabase';

interface CashViewProps {
  user: UserProfile;
  activeShift: CashShift | null;
  shiftTransactions: CashTransaction[];
  pastShifts: CashShift[];
  onShiftUpdated: () => void;
}

type QuickActionTab =
  | 'cash_sale'
  | 'card_sale'
  | 'split_payment'
  | 'cash_refund'
  | 'other_in'
  | 'other_out';

interface DenominationItem {
  value: number;
  key: keyof DenominationCounts;
  label: string;
  type: 'banknote' | 'coin';
  badgeBg: string;
  badgeText: string;
}

const DENOMINATIONS: DenominationItem[] = [
  { value: 200, key: 'd200', label: '200 TL', type: 'banknote', badgeBg: 'bg-emerald-100', badgeText: 'text-emerald-800' },
  { value: 100, key: 'd100', label: '100 TL', type: 'banknote', badgeBg: 'bg-blue-100', badgeText: 'text-blue-800' },
  { value: 50,  key: 'd50',  label: '50 TL',  type: 'banknote', badgeBg: 'bg-amber-100', badgeText: 'text-amber-800' },
  { value: 20,  key: 'd20',  label: '20 TL',  type: 'banknote', badgeBg: 'bg-teal-100', badgeText: 'text-teal-800' },
  { value: 10,  key: 'd10',  label: '10 TL',  type: 'banknote', badgeBg: 'bg-rose-100', badgeText: 'text-rose-800' },
  { value: 5,   key: 'd5',   label: '5 TL',   type: 'banknote', badgeBg: 'bg-indigo-100', badgeText: 'text-indigo-800' },
  { value: 1,   key: 'd1',   label: '1 TL',   type: 'coin',     badgeBg: 'bg-yellow-100', badgeText: 'text-yellow-800' },
];

export const CashView: React.FC<CashViewProps> = ({
  user,
  activeShift,
  shiftTransactions,
  onShiftUpdated,
}) => {
  // Quick action active tab for transaction entry
  const [activeTab, setActiveTab] = useState<QuickActionTab>('cash_sale');

  // Input states for transaction forms
  // 1. Nakit Satış
  const [cashReceivedInput, setCashReceivedInput] = useState('');
  const [changeGivenInput, setChangeGivenInput] = useState('');

  // 2. Kredi Kartı Satışı
  const [cardAmountInput, setCardAmountInput] = useState('');

  // 3. Bölünmüş Ödeme
  const [splitCashInput, setSplitCashInput] = useState('');
  const [splitCardInput, setSplitCardInput] = useState('');
  const [splitChangeInput, setSplitChangeInput] = useState('');

  // 4. Nakit İade
  const [refundAmountInput, setRefundAmountInput] = useState('');
  const [refundDescInput, setRefundDescInput] = useState('');

  // 5. Diğer Nakit Giriş
  const [otherInAmountInput, setOtherInAmountInput] = useState('');
  const [otherInDescInput, setOtherInDescInput] = useState('');

  // 6. Diğer Nakit Çıkış
  const [otherOutAmountInput, setOtherOutAmountInput] = useState('');
  const [otherOutDescInput, setOtherOutDescInput] = useState('');

  // General form feedback
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Edit state for cash transaction
  const [editingTx, setEditingTx] = useState<CashTransaction | null>(null);

  // =========================================================================
  // FİİLÎ SAYIM (Banknot ve Madeni Para Sayımı)
  // =========================================================================
  const [isCountModalOpen, setIsCountModalOpen] = useState(false);
  const [denomCounts, setDenomCounts] = useState<DenominationCounts>({
    d200: 0,
    d100: 0,
    d50: 0,
    d20: 0,
    d10: 0,
    d5: 0,
    d1: 0,
  });
  const [countNote, setCountNote] = useState('');
  const [latestCount, setLatestCount] = useState<CashCount | null>(null);
  const [isSavingCount, setIsSavingCount] = useState(false);
  const [countSaveSuccess, setCountSaveSuccess] = useState(false);

  // Calculate live shift totals
  const totals = activeShift
    ? calculateShiftTotals(
        activeShift.starting_cash,
        activeShift.starting_cash_known,
        shiftTransactions
      )
    : calculateShiftTotals(0, true, shiftTransactions);

  // Load latest physical count
  useEffect(() => {
    let isMounted = true;
    async function loadLatest() {
      try {
        const count = await getLatestCashCount(activeShift?.id, user.id);
        if (isMounted && count) {
          setLatestCount(count);
          if (count.count_breakdown) {
            const b = count.count_breakdown as any;
            setDenomCounts({
              d200: Number(b.d200 ?? b['200']) || 0,
              d100: Number(b.d100 ?? b['100']) || 0,
              d50: Number(b.d50 ?? b['50']) || 0,
              d20: Number(b.d20 ?? b['20']) || 0,
              d10: Number(b.d10 ?? b['10']) || 0,
              d5: Number(b.d5 ?? b['5']) || 0,
              d1: Number(b.d1 ?? b['1']) || 0,
            });
          }
        }
      } catch {
        // silent
      }
    }
    loadLatest();
    return () => {
      isMounted = false;
    };
  }, [activeShift, user.id]);

  // Live calculation helpers for user feedback while typing
  const liveNetCashSale = calculateNetCashSale(
    parseFloat(cashReceivedInput.replace(',', '.')) || 0,
    parseFloat(changeGivenInput.replace(',', '.')) || 0
  );

  const liveSplitCalc = calculateSplitPayment(
    parseFloat(splitCashInput.replace(',', '.')) || 0,
    parseFloat(splitCardInput.replace(',', '.')) || 0,
    parseFloat(splitChangeInput.replace(',', '.')) || 0
  );

  // Reset inputs
  const resetInputs = () => {
    setCashReceivedInput('');
    setChangeGivenInput('');
    setCardAmountInput('');
    setSplitCashInput('');
    setSplitCardInput('');
    setSplitChangeInput('');
    setRefundAmountInput('');
    setRefundDescInput('');
    setOtherInAmountInput('');
    setOtherInDescInput('');
    setOtherOutAmountInput('');
    setOtherOutDescInput('');
    setEditingTx(null);
    setFormError(null);
  };

  // Handle saving new or updated transaction
  const handleSaveTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    try {
      setIsSubmitting(true);
      const shiftId = activeShift?.id || (await ensureDailyShift(user.id)).id;

      if (activeTab === 'cash_sale') {
        const received = parseFloat(cashReceivedInput.replace(',', '.'));
        const change = parseFloat(changeGivenInput.replace(',', '.')) || 0;
        const calc = calculateNetCashSale(received, change);

        if (!calc.isValid) {
          setFormError(calc.error || 'Geçersiz nakit satış tutarı.');
          setIsSubmitting(false);
          return;
        }

        const desc = change > 0
          ? `Alınan: ${formatCurrency(received)}, Para Üstü: ${formatCurrency(change)}`
          : 'Nakit Satış';

        if (editingTx) {
          await updateCashTransaction({
            id: editingTx.id,
            shift_id: shiftId,
            user_id: user.id,
            transaction_type: 'cash_sale',
            amount: calc.netCash,
            cash_amount: calc.netCash,
            card_amount: 0,
            description: desc,
          });
        } else {
          await addCashTransaction({
            shift_id: shiftId,
            user_id: user.id,
            transaction_type: 'cash_sale',
            amount: calc.netCash,
            cash_amount: calc.netCash,
            card_amount: 0,
            description: desc,
          });
        }
      } else if (activeTab === 'card_sale') {
        const cardAmt = parseFloat(cardAmountInput.replace(',', '.'));
        if (isNaN(cardAmt) || cardAmt <= 0) {
          setFormError('Lütfen geçerli bir kart tutarı giriniz.');
          setIsSubmitting(false);
          return;
        }

        if (editingTx) {
          await updateCashTransaction({
            id: editingTx.id,
            shift_id: shiftId,
            user_id: user.id,
            transaction_type: 'card_sale',
            amount: cardAmt,
            cash_amount: 0,
            card_amount: cardAmt,
            description: 'Kredi Kartı Satışı',
          });
        } else {
          await addCashTransaction({
            shift_id: shiftId,
            user_id: user.id,
            transaction_type: 'card_sale',
            amount: cardAmt,
            cash_amount: 0,
            card_amount: cardAmt,
            description: 'Kredi Kartı Satışı',
          });
        }
      } else if (activeTab === 'split_payment') {
        const cashRec = parseFloat(splitCashInput.replace(',', '.')) || 0;
        const cardAmt = parseFloat(splitCardInput.replace(',', '.')) || 0;
        const change = parseFloat(splitChangeInput.replace(',', '.')) || 0;
        const split = calculateSplitPayment(cashRec, cardAmt, change);

        if (!split.isValid) {
          setFormError(split.error || 'Geçersiz bölünmüş ödeme.');
          setIsSubmitting(false);
          return;
        }

        const desc = `Bölünmüş (Nakit: ${formatCurrency(split.netCash)}${change > 0 ? ` [Alınan: ${formatCurrency(cashRec)}, P.Üstü: ${formatCurrency(change)}]` : ''}, Kart: ${formatCurrency(split.cardAmount)})`;

        if (editingTx) {
          await updateCashTransaction({
            id: editingTx.id,
            shift_id: shiftId,
            user_id: user.id,
            transaction_type: 'split_payment',
            amount: split.totalSale,
            cash_amount: split.netCash,
            card_amount: split.cardAmount,
            description: desc,
          });
        } else {
          await addCashTransaction({
            shift_id: shiftId,
            user_id: user.id,
            transaction_type: 'split_payment',
            amount: split.totalSale,
            cash_amount: split.netCash,
            card_amount: split.cardAmount,
            description: desc,
          });
        }
      } else if (activeTab === 'cash_refund') {
        const refAmt = parseFloat(refundAmountInput.replace(',', '.'));
        if (isNaN(refAmt) || refAmt <= 0) {
          setFormError('Lütfen iade edilen tutarı giriniz.');
          setIsSubmitting(false);
          return;
        }

        const desc = refundDescInput.trim() || 'Nakit İade';

        if (editingTx) {
          await updateCashTransaction({
            id: editingTx.id,
            shift_id: shiftId,
            user_id: user.id,
            transaction_type: 'cash_refund',
            amount: refAmt,
            cash_amount: refAmt,
            card_amount: 0,
            description: desc,
          });
        } else {
          await addCashTransaction({
            shift_id: shiftId,
            user_id: user.id,
            transaction_type: 'cash_refund',
            amount: refAmt,
            cash_amount: refAmt,
            card_amount: 0,
            description: desc,
          });
        }
      } else if (activeTab === 'other_in') {
        const inAmt = parseFloat(otherInAmountInput.replace(',', '.'));
        if (isNaN(inAmt) || inAmt <= 0) {
          setFormError('Lütfen giriş tutarını giriniz.');
          setIsSubmitting(false);
          return;
        }

        const desc = otherInDescInput.trim() || 'Kasa Avans / Giriş';

        if (editingTx) {
          await updateCashTransaction({
            id: editingTx.id,
            shift_id: shiftId,
            user_id: user.id,
            transaction_type: 'other_in',
            amount: inAmt,
            cash_amount: inAmt,
            card_amount: 0,
            description: desc,
          });
        } else {
          await addCashTransaction({
            shift_id: shiftId,
            user_id: user.id,
            transaction_type: 'other_in',
            amount: inAmt,
            cash_amount: inAmt,
            card_amount: 0,
            description: desc,
          });
        }
      } else if (activeTab === 'other_out') {
        const outAmt = parseFloat(otherOutAmountInput.replace(',', '.'));
        if (isNaN(outAmt) || outAmt <= 0) {
          setFormError('Lütfen çıkış tutarını giriniz.');
          setIsSubmitting(false);
          return;
        }

        const desc = otherOutDescInput.trim() || 'Gider / Masraf Çıkışı';

        if (editingTx) {
          await updateCashTransaction({
            id: editingTx.id,
            shift_id: shiftId,
            user_id: user.id,
            transaction_type: 'other_out',
            amount: outAmt,
            cash_amount: outAmt,
            card_amount: 0,
            description: desc,
          });
        } else {
          await addCashTransaction({
            shift_id: shiftId,
            user_id: user.id,
            transaction_type: 'other_out',
            amount: outAmt,
            cash_amount: outAmt,
            card_amount: 0,
            description: desc,
          });
        }
      }

      resetInputs();
      onShiftUpdated();
    } catch (err: any) {
      setFormError(err.message || 'İşlem kaydedilemedi.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Start editing a transaction
  const handleStartEdit = (tx: CashTransaction) => {
    setEditingTx(tx);
    setFormError(null);

    if (tx.transaction_type === 'cash_sale') {
      setActiveTab('cash_sale');
      setCashReceivedInput(tx.amount.toString());
      setChangeGivenInput('');
    } else if (tx.transaction_type === 'card_sale') {
      setActiveTab('card_sale');
      setCardAmountInput(tx.amount.toString());
    } else if (tx.transaction_type === 'split_payment') {
      setActiveTab('split_payment');
      setSplitCashInput((tx.cash_amount || 0).toString());
      setSplitCardInput((tx.card_amount || 0).toString());
      setSplitChangeInput('');
    } else if (tx.transaction_type === 'cash_refund') {
      setActiveTab('cash_refund');
      setRefundAmountInput(tx.amount.toString());
      setRefundDescInput(tx.description);
    } else if (tx.transaction_type === 'other_in') {
      setActiveTab('other_in');
      setOtherInAmountInput(tx.amount.toString());
      setOtherInDescInput(tx.description);
    } else if (tx.transaction_type === 'other_out') {
      setActiveTab('other_out');
      setOtherOutAmountInput(tx.amount.toString());
      setOtherOutDescInput(tx.description);
    }

    window.scrollTo({ top: 180, behavior: 'smooth' });
  };

  // Delete transaction
  const handleDeleteTx = async (txId: string) => {
    if (window.confirm('Bu kasa hareketini silmek istediğinize emin misiniz?')) {
      try {
        await deleteCashTransaction(txId, user.id);
        if (editingTx?.id === txId) {
          resetInputs();
        }
        onShiftUpdated();
      } catch (err: any) {
        alert(err.message || 'Silme işlemi başarısız.');
      }
    }
  };

  // =========================================================================
  // FİİLÎ SAYIM HESAPLAMA VE KAYIT
  // =========================================================================
  const updateDenomCount = (key: keyof DenominationCounts, delta: number) => {
    setDenomCounts((prev) => {
      const current = prev[key] || 0;
      const nextVal = Math.max(0, current + delta);
      return { ...prev, [key]: nextVal };
    });
  };

  const setDenomDirect = (key: keyof DenominationCounts, rawVal: string) => {
    const val = parseInt(rawVal) || 0;
    setDenomCounts((prev) => ({
      ...prev,
      [key]: Math.max(0, val),
    }));
  };

  // Total counted physical cash
  const physicalCountTotal = DENOMINATIONS.reduce((sum, item) => {
    const count = denomCounts[item.key] || 0;
    return sum + item.value * count;
  }, 0);

  // Live difference between physical cash count and expected cash in drawer
  const differenceAmount = physicalCountTotal - totals.expectedCash;
  const isExact = Math.abs(differenceAmount) < 0.005;
  const isSurplus = differenceAmount > 0.005;
  const isDeficit = differenceAmount < -0.005;

  const handleSavePhysicalCount = async () => {
    setIsSavingCount(true);
    setFormError(null);
    try {
      const shiftId = activeShift?.id || (await ensureDailyShift(user.id)).id;
      const status = isExact ? 'exact' : isSurplus ? 'surplus' : 'deficit';

      const saved = await saveCashCount({
        shift_id: shiftId,
        user_id: user.id,
        actual_cash: physicalCountTotal,
        expected_cash: totals.expectedCash,
        difference: differenceAmount,
        status,
        notes: countNote.trim() || undefined,
        count_breakdown: denomCounts,
      });

      setLatestCount(saved);
      setCountSaveSuccess(true);
      setTimeout(() => setCountSaveSuccess(false), 2500);
      setIsCountModalOpen(false);
      onShiftUpdated();
    } catch (err: any) {
      alert(err.message || 'Fiilî sayım kaydedilemedi.');
    } finally {
      setIsSavingCount(false);
    }
  };

  const handleResetCounts = () => {
    if (window.confirm('Tüm adetleri sıfırlamak istediğinize emin misiniz?')) {
      setDenomCounts({
        d200: 0,
        d100: 0,
        d50: 0,
        d20: 0,
        d10: 0,
        d5: 0,
        d1: 0,
      });
    }
  };

  // Diff styling helper for latest count
  const renderLatestCountBadge = () => {
    if (!latestCount) return null;
    const diff = latestCount.actual_cash - totals.expectedCash;
    if (diff > 0.005) {
      return (
        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
          Kasa Fazlası: +{formatCurrency(diff)}
        </span>
      );
    } else if (diff < -0.005) {
      return (
        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-500/20 text-red-300 border border-red-500/30">
          Kasa Açığı: {formatCurrency(diff)}
        </span>
      );
    } else {
      return (
        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
          Kasa Tam Denk (₺0,00)
        </span>
      );
    }
  };

  return (
    <div className="space-y-4 pb-28 px-4 max-w-lg mx-auto">
      {/* Kasa Özeti Kartı (Günlük Kasa Durumu) */}
      <div className="bg-gradient-to-br from-[#002B70] via-[#00398A] to-[#0055D4] rounded-3xl p-5 text-white shadow-xl shadow-blue-950/20">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center text-[#FFE000]">
              <Banknote className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[11px] font-semibold text-blue-200 uppercase tracking-wider block">
                Beklenen Kasa Nakdi
              </span>
              <p className="text-2xl font-black text-white tabular-nums">
                {formatCurrency(totals.expectedCash)}
              </p>
            </div>
          </div>

          <button
            onClick={() => setIsCountModalOpen(true)}
            className="text-[11px] font-black bg-[#FFE000] hover:bg-[#FFD000] active:scale-95 text-[#002B70] px-3 py-2 rounded-xl shadow-md transition-all flex items-center gap-1.5 shrink-0"
          >
            <Coins className="w-3.5 h-3.5" />
            <span>Fiilî Sayım</span>
          </button>
        </div>

        {/* Ciro ve Kasa Detayları Şeridi */}
        <div className="pt-3 border-t border-white/15 grid grid-cols-3 gap-2 text-xs">
          <div>
            <span className="text-blue-200 text-[10px] block">Günlük Ciro</span>
            <p className="font-bold text-white tabular-nums">
              {formatCurrency(totals.totalRevenue)}
            </p>
          </div>
          <div>
            <span className="text-blue-200 text-[10px] block">Nakit Satış</span>
            <p className="font-bold text-emerald-300 tabular-nums">
              {formatCurrency(totals.totalCashSales)}
            </p>
          </div>
          <div>
            <span className="text-blue-200 text-[10px] block">Kart Satış</span>
            <p className="font-bold text-purple-300 tabular-nums">
              {formatCurrency(totals.totalCardSales)}
            </p>
          </div>
        </div>

        {/* Fiilî Sayım Durumu Bilgi Çubuğu */}
        <div className="mt-3 pt-2.5 border-t border-white/10 flex items-center justify-between text-xs">
          <div className="flex items-center gap-1.5 text-blue-100">
            <Coins className="w-3.5 h-3.5 text-amber-300" />
            <span>
              {latestCount
                ? `Son Sayım: ${formatCurrency(latestCount.actual_cash)}`
                : 'Bugün henüz sayım yapılmadı'}
            </span>
          </div>
          <div>{renderLatestCountBadge()}</div>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* İŞLEM TÜRÜ SEÇİMİ — HIZLI VE SABİT 2x3 MATRİS (YATAY KAYDIRMA YOK)   */}
      {/* ===================================================================== */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between ml-1">
          <span className="text-xs font-bold text-slate-700">İşlem Türü Seçin</span>
          <span className="text-[10px] font-semibold text-slate-400">Tek Dokunuşla Seç</span>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {/* 1. Nakit Satış */}
          <button
            type="button"
            onClick={() => {
              setActiveTab('cash_sale');
              if (editingTx?.transaction_type !== 'cash_sale') setEditingTx(null);
            }}
            className={`p-2.5 rounded-2xl text-left border transition-all flex flex-col justify-between min-h-[68px] ${
              activeTab === 'cash_sale'
                ? 'bg-emerald-600 text-white border-emerald-700 shadow-md shadow-emerald-700/20 ring-2 ring-emerald-300'
                : 'bg-white text-slate-700 border-slate-200/80 hover:bg-slate-50'
            }`}
          >
            <div className="flex items-center justify-between w-full">
              <div
                className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                  activeTab === 'cash_sale' ? 'bg-white/20 text-white' : 'bg-emerald-50 text-emerald-600'
                }`}
              >
                <Banknote className="w-4 h-4" />
              </div>
              <span
                className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded ${
                  activeTab === 'cash_sale' ? 'bg-white/20 text-white' : 'bg-emerald-100 text-emerald-800'
                }`}
              >
                +Nakit
              </span>
            </div>
            <span className="text-xs font-bold tracking-tight mt-1 truncate">Nakit Satış</span>
          </button>

          {/* 2. Kredi Kartı */}
          <button
            type="button"
            onClick={() => {
              setActiveTab('card_sale');
              if (editingTx?.transaction_type !== 'card_sale') setEditingTx(null);
            }}
            className={`p-2.5 rounded-2xl text-left border transition-all flex flex-col justify-between min-h-[68px] ${
              activeTab === 'card_sale'
                ? 'bg-purple-600 text-white border-purple-700 shadow-md shadow-purple-700/20 ring-2 ring-purple-300'
                : 'bg-white text-slate-700 border-slate-200/80 hover:bg-slate-50'
            }`}
          >
            <div className="flex items-center justify-between w-full">
              <div
                className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                  activeTab === 'card_sale' ? 'bg-white/20 text-white' : 'bg-purple-50 text-purple-600'
                }`}
              >
                <CreditCard className="w-4 h-4" />
              </div>
              <span
                className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded ${
                  activeTab === 'card_sale' ? 'bg-white/20 text-white' : 'bg-purple-100 text-purple-800'
                }`}
              >
                POS
              </span>
            </div>
            <span className="text-xs font-bold tracking-tight mt-1 truncate">Kredi Kartı</span>
          </button>

          {/* 3. Bölünmüş */}
          <button
            type="button"
            onClick={() => {
              setActiveTab('split_payment');
              if (editingTx?.transaction_type !== 'split_payment') setEditingTx(null);
            }}
            className={`p-2.5 rounded-2xl text-left border transition-all flex flex-col justify-between min-h-[68px] ${
              activeTab === 'split_payment'
                ? 'bg-indigo-600 text-white border-indigo-700 shadow-md shadow-indigo-700/20 ring-2 ring-indigo-300'
                : 'bg-white text-slate-700 border-slate-200/80 hover:bg-slate-50'
            }`}
          >
            <div className="flex items-center justify-between w-full">
              <div
                className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                  activeTab === 'split_payment' ? 'bg-white/20 text-white' : 'bg-indigo-50 text-indigo-600'
                }`}
              >
                <Split className="w-4 h-4" />
              </div>
              <span
                className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded ${
                  activeTab === 'split_payment' ? 'bg-white/20 text-white' : 'bg-indigo-100 text-indigo-800'
                }`}
              >
                Karma
              </span>
            </div>
            <span className="text-xs font-bold tracking-tight mt-1 truncate">Bölünmüş</span>
          </button>

          {/* 4. Nakit İade */}
          <button
            type="button"
            onClick={() => {
              setActiveTab('cash_refund');
              if (editingTx?.transaction_type !== 'cash_refund') setEditingTx(null);
            }}
            className={`p-2.5 rounded-2xl text-left border transition-all flex flex-col justify-between min-h-[68px] ${
              activeTab === 'cash_refund'
                ? 'bg-red-600 text-white border-red-700 shadow-md shadow-red-700/20 ring-2 ring-red-300'
                : 'bg-white text-slate-700 border-slate-200/80 hover:bg-slate-50'
            }`}
          >
            <div className="flex items-center justify-between w-full">
              <div
                className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                  activeTab === 'cash_refund' ? 'bg-white/20 text-white' : 'bg-red-50 text-red-600'
                }`}
              >
                <RotateCcw className="w-4 h-4" />
              </div>
              <span
                className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded ${
                  activeTab === 'cash_refund' ? 'bg-white/20 text-white' : 'bg-red-100 text-red-800'
                }`}
              >
                -İade
              </span>
            </div>
            <span className="text-xs font-bold tracking-tight mt-1 truncate">Nakit İade</span>
          </button>

          {/* 5. Kasa Avans / Giriş */}
          <button
            type="button"
            onClick={() => {
              setActiveTab('other_in');
              if (editingTx?.transaction_type !== 'other_in') setEditingTx(null);
            }}
            className={`p-2.5 rounded-2xl text-left border transition-all flex flex-col justify-between min-h-[68px] ${
              activeTab === 'other_in'
                ? 'bg-blue-600 text-white border-blue-700 shadow-md shadow-blue-700/20 ring-2 ring-blue-300'
                : 'bg-white text-slate-700 border-slate-200/80 hover:bg-slate-50'
            }`}
          >
            <div className="flex items-center justify-between w-full">
              <div
                className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                  activeTab === 'other_in' ? 'bg-white/20 text-white' : 'bg-blue-50 text-blue-600'
                }`}
              >
                <ArrowDownLeft className="w-4 h-4" />
              </div>
              <span
                className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded ${
                  activeTab === 'other_in' ? 'bg-white/20 text-white' : 'bg-blue-100 text-blue-800'
                }`}
              >
                Giriş
              </span>
            </div>
            <span className="text-xs font-bold tracking-tight mt-1 truncate">Kasa Avans</span>
          </button>

          {/* 6. Gider / Masraf */}
          <button
            type="button"
            onClick={() => {
              setActiveTab('other_out');
              if (editingTx?.transaction_type !== 'other_out') setEditingTx(null);
            }}
            className={`p-2.5 rounded-2xl text-left border transition-all flex flex-col justify-between min-h-[68px] ${
              activeTab === 'other_out'
                ? 'bg-amber-600 text-white border-amber-700 shadow-md shadow-amber-700/20 ring-2 ring-amber-300'
                : 'bg-white text-slate-700 border-slate-200/80 hover:bg-slate-50'
            }`}
          >
            <div className="flex items-center justify-between w-full">
              <div
                className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                  activeTab === 'other_out' ? 'bg-white/20 text-white' : 'bg-amber-50 text-amber-600'
                }`}
              >
                <ArrowUpRight className="w-4 h-4" />
              </div>
              <span
                className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded ${
                  activeTab === 'other_out' ? 'bg-white/20 text-white' : 'bg-amber-100 text-amber-800'
                }`}
              >
                Masraf
              </span>
            </div>
            <span className="text-xs font-bold tracking-tight mt-1 truncate">Gider / Masraf</span>
          </button>
        </div>
      </div>

      {/* Doğrudan İşlem Giriş Kartı */}
      <div
        className={`bg-white rounded-2xl p-4 border shadow-xs transition-all ${
          editingTx ? 'border-amber-400 ring-2 ring-amber-200' : 'border-slate-200/80'
        }`}
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-extrabold text-slate-900">
              {editingTx
                ? 'İşlemi Düzenle'
                : activeTab === 'cash_sale'
                ? 'Nakit Satış Girişi'
                : activeTab === 'card_sale'
                ? 'Kredi Kartı Satış Girişi'
                : activeTab === 'split_payment'
                ? 'Bölünmüş Ödeme (Nakit + Kart)'
                : activeTab === 'cash_refund'
                ? 'Nakit İade Girişi'
                : activeTab === 'other_in'
                ? 'Kasa Avans / Para Girişi'
                : 'Gider / Masraf Çıkışı'}
            </span>
          </div>
          {editingTx && (
            <button
              type="button"
              onClick={resetInputs}
              className="text-xs font-semibold text-slate-500 hover:text-slate-800 flex items-center gap-1 bg-slate-100 px-2 py-1 rounded-lg"
            >
              <X className="w-3.5 h-3.5" />
              <span>Vazgeç</span>
            </button>
          )}
        </div>

        <form onSubmit={handleSaveTransaction} className="space-y-3">
          {/* TAB 1: Nakit Satış */}
          {activeTab === 'cash_sale' && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label htmlFor="cash-received" className="block text-xs font-bold text-slate-700 mb-1">
                    Alınan Nakit (TL)
                  </label>
                  <input
                    id="cash-received"
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={cashReceivedInput}
                    onChange={(e) => setCashReceivedInput(e.target.value)}
                    placeholder="Örn: 500"
                    required
                    className="w-full px-3 py-2 text-sm font-semibold rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 tabular-nums"
                  />
                </div>
                <div>
                  <label htmlFor="change-given" className="block text-xs font-bold text-slate-700 mb-1">
                    Para Üstü (TL)
                  </label>
                  <input
                    id="change-given"
                    type="number"
                    step="0.01"
                    min="0"
                    value={changeGivenInput}
                    onChange={(e) => setChangeGivenInput(e.target.value)}
                    placeholder="Örn: 125"
                    className="w-full px-3 py-2 text-sm font-semibold rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 tabular-nums"
                  />
                </div>
              </div>

              {/* Net Nakit Anlık Önizleme */}
              <div className="bg-emerald-50 border border-emerald-200/80 rounded-xl p-2.5 flex items-center justify-between text-xs">
                <span className="font-semibold text-emerald-900">Kasaya Girecek Net Nakit:</span>
                <span className="font-extrabold text-emerald-700 text-sm tabular-nums">
                  {liveNetCashSale.isValid ? formatCurrency(liveNetCashSale.netCash) : '₺0,00'}
                </span>
              </div>
            </div>
          )}

          {/* TAB 2: Kredi Kartı */}
          {activeTab === 'card_sale' && (
            <div>
              <label htmlFor="card-amount" className="block text-xs font-bold text-slate-700 mb-1">
                Kredi Kartı / POS Satış Tutarı (TL)
              </label>
              <input
                id="card-amount"
                type="number"
                step="0.01"
                min="0.01"
                value={cardAmountInput}
                onChange={(e) => setCardAmountInput(e.target.value)}
                placeholder="Örn: 350.00"
                required
                className="w-full px-3 py-2 text-sm font-semibold rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-500 tabular-nums"
              />
            </div>
          )}

          {/* TAB 3: Bölünmüş Ödeme */}
          {activeTab === 'split_payment' && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label htmlFor="split-cash" className="block text-xs font-bold text-slate-700 mb-1">
                    Alınan Nakit (TL)
                  </label>
                  <input
                    id="split-cash"
                    type="number"
                    step="0.01"
                    min="0"
                    value={splitCashInput}
                    onChange={(e) => setSplitCashInput(e.target.value)}
                    placeholder="Örn: 200"
                    className="w-full px-3 py-2 text-sm font-semibold rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 tabular-nums"
                  />
                </div>
                <div>
                  <label htmlFor="split-card" className="block text-xs font-bold text-slate-700 mb-1">
                    Karttan Çekilen (TL)
                  </label>
                  <input
                    id="split-card"
                    type="number"
                    step="0.01"
                    min="0"
                    value={splitCardInput}
                    onChange={(e) => setSplitCardInput(e.target.value)}
                    placeholder="Örn: 300"
                    className="w-full px-3 py-2 text-sm font-semibold rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 tabular-nums"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="split-change" className="block text-xs font-bold text-slate-700 mb-1">
                  Verilen Para Üstü (Varsa TL)
                </label>
                <input
                  id="split-change"
                  type="number"
                  step="0.01"
                  min="0"
                  value={splitChangeInput}
                  onChange={(e) => setSplitChangeInput(e.target.value)}
                  placeholder="Örn: 50"
                  className="w-full px-3 py-2 text-sm font-semibold rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 tabular-nums"
                />
              </div>

              {/* Anlık Bölünmüş Satış Özeti */}
              <div className="bg-indigo-50 border border-indigo-200/80 rounded-xl p-2.5 grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-indigo-900 block font-medium">Net Nakit:</span>
                  <span className="font-extrabold text-indigo-700 tabular-nums">
                    {liveSplitCalc.isValid ? formatCurrency(liveSplitCalc.netCash) : '₺0,00'}
                  </span>
                </div>
                <div>
                  <span className="text-indigo-900 block font-medium">Toplam Satış:</span>
                  <span className="font-extrabold text-indigo-900 tabular-nums">
                    {liveSplitCalc.isValid ? formatCurrency(liveSplitCalc.totalSale) : '₺0,00'}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: Nakit İade */}
          {activeTab === 'cash_refund' && (
            <div className="space-y-3">
              <div>
                <label htmlFor="refund-amount" className="block text-xs font-bold text-slate-700 mb-1">
                  İade Edilen Nakit (TL)
                </label>
                <input
                  id="refund-amount"
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={refundAmountInput}
                  onChange={(e) => setRefundAmountInput(e.target.value)}
                  placeholder="Örn: 75.00"
                  required
                  className="w-full px-3 py-2 text-sm font-semibold rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-red-500 tabular-nums"
                />
              </div>
              <div>
                <label htmlFor="refund-desc" className="block text-xs font-bold text-slate-700 mb-1">
                  İade Nedeni / Açıklama
                </label>
                <input
                  id="refund-desc"
                  type="text"
                  value={refundDescInput}
                  onChange={(e) => setRefundDescInput(e.target.value)}
                  placeholder="Örn: Ürün iadesi"
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>
            </div>
          )}

          {/* TAB 5: Diğer Giriş */}
          {activeTab === 'other_in' && (
            <div className="space-y-3">
              <div>
                <label htmlFor="other-in-amt" className="block text-xs font-bold text-slate-700 mb-1">
                  Giriş Tutarı (TL)
                </label>
                <input
                  id="other-in-amt"
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={otherInAmountInput}
                  onChange={(e) => setOtherInAmountInput(e.target.value)}
                  placeholder="Örn: 200.00"
                  required
                  className="w-full px-3 py-2 text-sm font-semibold rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 tabular-nums"
                />
              </div>
              <div>
                <label htmlFor="other-in-desc" className="block text-xs font-bold text-slate-700 mb-1">
                  Açıklama / Kaynak
                </label>
                <input
                  id="other-in-desc"
                  type="text"
                  value={otherInDescInput}
                  onChange={(e) => setOtherInDescInput(e.target.value)}
                  placeholder="Örn: Bozuk para takviyesi"
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          )}

          {/* TAB 6: Diğer Çıkış */}
          {activeTab === 'other_out' && (
            <div className="space-y-3">
              <div>
                <label htmlFor="other-out-amt" className="block text-xs font-bold text-slate-700 mb-1">
                  Çıkış Tutarı (TL)
                </label>
                <input
                  id="other-out-amt"
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={otherOutAmountInput}
                  onChange={(e) => setOtherOutAmountInput(e.target.value)}
                  placeholder="Örn: 150.00"
                  required
                  className="w-full px-3 py-2 text-sm font-semibold rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500 tabular-nums"
                />
              </div>
              <div>
                <label htmlFor="other-out-desc" className="block text-xs font-bold text-slate-700 mb-1">
                  Açıklama / Masraf Kalemi
                </label>
                <input
                  id="other-out-desc"
                  type="text"
                  value={otherOutDescInput}
                  onChange={(e) => setOtherOutDescInput(e.target.value)}
                  placeholder="Örn: Mağaza sarf malzeme masrafı"
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
            </div>
          )}

          {formError && (
            <div className="flex items-start gap-2 p-2.5 bg-red-50 text-red-700 rounded-xl text-xs border border-red-100">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{formError}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className={`w-full py-2.5 rounded-xl font-bold text-xs text-white transition-all flex items-center justify-center gap-1.5 active:scale-[0.99] disabled:opacity-50 ${
              editingTx
                ? 'bg-amber-600 hover:bg-amber-700'
                : activeTab === 'cash_sale'
                ? 'bg-emerald-600 hover:bg-emerald-700'
                : activeTab === 'card_sale'
                ? 'bg-purple-600 hover:bg-purple-700'
                : activeTab === 'split_payment'
                ? 'bg-indigo-600 hover:bg-indigo-700'
                : activeTab === 'cash_refund'
                ? 'bg-red-600 hover:bg-red-700'
                : activeTab === 'other_in'
                ? 'bg-blue-600 hover:bg-blue-700'
                : 'bg-amber-600 hover:bg-amber-700'
            } shadow-md`}
          >
            {isSubmitting ? (
              <span>Kaydediliyor...</span>
            ) : editingTx ? (
              <>
                <Edit2 className="w-3.5 h-3.5" />
                <span>Değişikliği Kaydet</span>
              </>
            ) : (
              <>
                <Plus className="w-3.5 h-3.5" />
                <span>İşlemi Kaydet</span>
              </>
            )}
          </button>
        </form>
      </div>

      {/* ===================================================================== */}
      {/* FİİLÎ KASA SAYIMI MODAL/DRAWER (BANKNOT VE MADENİ PARA ADETLERİ)     */}
      {/* ===================================================================== */}
      {isCountModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-md w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden border border-slate-100">
            {/* Modal Header */}
            <div className="p-4 bg-gradient-to-r from-[#002B70] to-[#0055D4] text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center text-[#FFE000]">
                  <Coins className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-white">Fiilî Kasa Sayımı</h3>
                  <p className="text-[10px] text-blue-200">Banknot ve Madeni Para Adetleri</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsCountModalOpen(false)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body: Denomination Rows */}
            <div className="p-4 overflow-y-auto space-y-2.5 flex-1 divide-y divide-slate-100">
              <div className="flex items-center justify-between text-xs font-bold text-slate-500 pb-1">
                <span>Küpür / Nominal</span>
                <span>Adet ve Toplam</span>
              </div>

              {DENOMINATIONS.map((item) => {
                const count = denomCounts[item.key] || 0;
                const rowTotal = item.value * count;

                return (
                  <div key={item.key} className="pt-2.5 flex items-center justify-between gap-2">
                    {/* Küpür Rozeti */}
                    <div className="flex items-center gap-2 shrink-0 w-24">
                      <span className={`text-xs font-black px-2.5 py-1 rounded-xl ${item.badgeBg} ${item.badgeText} border border-slate-200/60 shadow-2xs`}>
                        {item.label}
                      </span>
                    </div>

                    {/* Adet Kontrol Butonları & Input */}
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => updateDenomCount(item.key, -1)}
                        className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-700 font-bold text-sm flex items-center justify-center"
                      >
                        -
                      </button>
                      <input
                        type="number"
                        min="0"
                        value={count === 0 ? '' : count}
                        onChange={(e) => setDenomDirect(item.key, e.target.value)}
                        placeholder="0"
                        className="w-14 h-7 text-center font-bold text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-600 tabular-nums"
                      />
                      <button
                        type="button"
                        onClick={() => updateDenomCount(item.key, 1)}
                        className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-700 font-bold text-sm flex items-center justify-center"
                      >
                        +
                      </button>
                      <button
                        type="button"
                        onClick={() => updateDenomCount(item.key, 5)}
                        className="px-1.5 h-7 rounded-lg bg-blue-50 text-blue-700 font-bold text-[10px] hover:bg-blue-100 active:scale-95"
                        title="+5 Adet Ekle"
                      >
                        +5
                      </button>
                    </div>

                    {/* Satır Toplamı */}
                    <div className="text-right w-24 shrink-0">
                      <span className="text-xs font-bold text-slate-900 tabular-nums">
                        {formatCurrency(rowTotal)}
                      </span>
                    </div>
                  </div>
                );
              })}

              {/* Not Alanı */}
              <div className="pt-3">
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Sayım Notu (İsteğe Bağlı)
                </label>
                <input
                  type="text"
                  value={countNote}
                  onChange={(e) => setCountNote(e.target.value)}
                  placeholder="Örn: Gün ortası sayımı"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#002B70]"
                />
              </div>
            </div>

            {/* Modal Footer: Live Comparison & Action */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 shrink-0 space-y-3">
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                  <span className="text-[10px] text-slate-500 font-semibold block">Sayılan Fiilî Kasa:</span>
                  <span className="text-base font-black text-[#002B70] tabular-nums">
                    {formatCurrency(physicalCountTotal)}
                  </span>
                </div>
                <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                  <span className="text-[10px] text-slate-500 font-semibold block">Beklenen Kasa Nakdi:</span>
                  <span className="text-base font-black text-slate-800 tabular-nums">
                    {formatCurrency(totals.expectedCash)}
                  </span>
                </div>
              </div>

              {/* Fark Göstergesi (Açık / Fazla / Denk) */}
              <div
                className={`p-3 rounded-2xl border flex items-center justify-between text-xs font-bold ${
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
                      ? 'Kasa Tam Denk'
                      : isSurplus
                      ? 'Kasa Fazlası Var'
                      : 'Kasa Açığı Var'}
                  </span>
                </div>
                <span className="text-sm font-black tabular-nums">
                  {isExact
                    ? '₺0,00'
                    : isSurplus
                    ? `+${formatCurrency(differenceAmount)}`
                    : formatCurrency(differenceAmount)}
                </span>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleResetCounts}
                  className="px-3 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-600 font-bold text-xs hover:bg-slate-100 active:scale-95"
                >
                  Sıfırla
                </button>
                <button
                  type="button"
                  onClick={handleSavePhysicalCount}
                  disabled={isSavingCount}
                  className="flex-1 py-2.5 rounded-xl bg-[#002B70] hover:bg-[#001D4D] text-[#FFE000] font-black text-xs shadow-md active:scale-95 transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  {isSavingCount ? (
                    <span>Kaydediliyor...</span>
                  ) : countSaveSuccess ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      <span>Sayım Kaydedildi!</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Sayımı Kaydet ve Onayla</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Kasa Hareketleri Geçmişi */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900">Kasa Hareketleri</h3>
          <span className="text-xs text-slate-400 font-medium">
            {shiftTransactions.length} Hareket
          </span>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs divide-y divide-slate-100 overflow-hidden">
          {shiftTransactions.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs">
              Bu gün için henüz bir kasa işlemi kaydedilmedi.
            </div>
          ) : (
            shiftTransactions.map((tx) => {
              const isCashSale = tx.transaction_type === 'cash_sale';
              const isCardSale = tx.transaction_type === 'card_sale';
              const isSplit = tx.transaction_type === 'split_payment';
              const isRefund = tx.transaction_type === 'cash_refund';
              const isOtherIn = tx.transaction_type === 'other_in';
              const isOtherOut = tx.transaction_type === 'other_out';

              return (
                <div
                  key={tx.id}
                  className={`p-3.5 flex items-center justify-between hover:bg-slate-50 transition-colors ${
                    editingTx?.id === tx.id ? 'bg-amber-50/60' : ''
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                        isCashSale
                          ? 'bg-emerald-50 text-emerald-600'
                          : isCardSale
                          ? 'bg-purple-50 text-purple-600'
                          : isSplit
                          ? 'bg-indigo-50 text-indigo-600'
                          : isRefund
                          ? 'bg-red-50 text-red-600'
                          : isOtherIn
                          ? 'bg-blue-50 text-blue-600'
                          : 'bg-amber-50 text-amber-600'
                      }`}
                    >
                      {isCashSale && <Banknote className="w-4 h-4" />}
                      {isCardSale && <CreditCard className="w-4 h-4" />}
                      {isSplit && <Split className="w-4 h-4" />}
                      {isRefund && <RotateCcw className="w-4 h-4" />}
                      {isOtherIn && <ArrowDownLeft className="w-4 h-4" />}
                      {isOtherOut && <ArrowUpRight className="w-4 h-4" />}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-xs font-bold text-slate-900 tabular-nums">
                          {formatCurrency(tx.amount)}
                        </p>
                        <span
                          className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md ${
                            isCashSale
                              ? 'bg-emerald-100 text-emerald-800'
                              : isCardSale
                              ? 'bg-purple-100 text-purple-800'
                              : isSplit
                              ? 'bg-indigo-100 text-indigo-800'
                              : isRefund
                              ? 'bg-red-100 text-red-800'
                              : isOtherIn
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {isCashSale && 'Nakit Satış'}
                          {isCardSale && 'Kredi Kartı'}
                          {isSplit && 'Bölünmüş'}
                          {isRefund && 'İade'}
                          {isOtherIn && 'Giriş'}
                          {isOtherOut && 'Masraf'}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 truncate mt-0.5">
                        {tx.description}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0 ml-2">
                    <span className="text-[10px] text-slate-400 tabular-nums mr-1">
                      {tx.transaction_at?.slice(11, 16) || 'Saat'}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleStartEdit(tx)}
                      className="p-1.5 rounded-lg text-slate-500 hover:text-blue-700 hover:bg-blue-50 active:scale-95"
                      title="Düzenle"
                      aria-label="Kasa işlemini düzenle"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteTx(tx.id)}
                      className="p-1.5 rounded-lg text-slate-500 hover:text-red-700 hover:bg-red-50 active:scale-95"
                      title="Sil"
                      aria-label="Kasa işlemini sil"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
