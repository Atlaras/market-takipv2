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
  Lock,
  Unlock,
  AlertTriangle,
  FileText,
} from 'lucide-react';
import {
  CashShift,
  CashTransaction,
  CashTransactionType,
  UserProfile,
  CashCount,
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
  createShift,
  closeShift,
  addCashTransaction,
  updateCashTransaction,
  deleteCashTransaction,
  saveCashCount,
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
  | 'other_out'
  | 'cash_count';

export const CashView: React.FC<CashViewProps> = ({
  user,
  activeShift,
  shiftTransactions,
  pastShifts,
  onShiftUpdated,
}) => {
  // Quick action active tab
  const [activeTab, setActiveTab] = useState<QuickActionTab>('cash_sale');

  // Input states for forms
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

  // 7. Fiilî Kasa Sayımı
  const [actualCashInput, setActualCashInput] = useState('');
  const [countNotesInput, setCountNotesInput] = useState('');
  const [latestCount, setLatestCount] = useState<CashCount | null>(null);

  // General form feedback
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Edit state for cash transaction
  const [editingTx, setEditingTx] = useState<CashTransaction | null>(null);

  // Background auto-shift creation state if none exists
  const [isAutoCreatingShift, setIsAutoCreatingShift] = useState(false);

  // Ensure an active shift is readily available so the user is never blocked
  const ensureShift = async (): Promise<string> => {
    if (activeShift) return activeShift.id;
    setIsAutoCreatingShift(true);
    try {
      const newShift = await createShift(
        user.id,
        'Günlük Vardiya',
        getCurrentTimeString().slice(0, 5),
        0,
        false, // starting_cash_known: false -> "Bilinmiyor", no false 350 TL assumption!
        'Otomatik Başlatılan Vardiya'
      );
      onShiftUpdated();
      return newShift.id;
    } finally {
      setIsAutoCreatingShift(false);
    }
  };

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
    setActualCashInput('');
    setCountNotesInput('');
    setEditingTx(null);
    setFormError(null);
  };

  // Calculate live shift totals
  const totals = activeShift
    ? calculateShiftTotals(
        activeShift.starting_cash,
        activeShift.starting_cash_known,
        shiftTransactions
      )
    : calculateShiftTotals(0, false, shiftTransactions);

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

  // Handle saving new or updated transaction
  const handleSaveTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    try {
      const shiftId = await ensureShift();
      setIsSubmitting(true);

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

        const desc = otherInDescInput.trim() || 'Diğer Nakit Girişi';

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

        const desc = otherOutDescInput.trim() || 'Diğer Nakit Çıkışı';

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
      } else if (activeTab === 'cash_count') {
        const counted = parseFloat(actualCashInput.replace(',', '.'));
        if (isNaN(counted) || counted < 0) {
          setFormError('Lütfen sayılan gerçek nakit tutarını giriniz.');
          setIsSubmitting(false);
          return;
        }

        const evaluation = evaluateCashCount(
          counted,
          totals.expectedCash,
          totals.startingCashKnown
        );

        const countResult = await saveCashCount({
          shift_id: shiftId,
          user_id: user.id,
          actual_cash: counted,
          expected_cash: totals.expectedCash,
          difference: evaluation.difference,
          status: evaluation.status,
          notes: countNotesInput.trim() || undefined,
        });

        setLatestCount(countResult);
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

  // Close shift
  const handleCloseShift = async () => {
    if (!activeShift) return;
    if (window.confirm('Vardiyayı kapatıp kasa devrini tamamlamak istediğinize emin misiniz?')) {
      try {
        await closeShift(activeShift.id, user.id);
        onShiftUpdated();
      } catch (err: any) {
        alert(err.message || 'Vardiya kapatılamadı.');
      }
    }
  };

  return (
    <div className="space-y-4 pb-28 px-4 max-w-lg mx-auto">
      {/* Kasa Özeti Kartı */}
      <div className="bg-gradient-to-br from-[#002B70] via-[#00398A] to-[#0055D4] rounded-3xl p-5 text-white shadow-xl shadow-blue-950/20">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center text-[#FFE000]">
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

          {activeShift && (
            <button
              onClick={handleCloseShift}
              className="text-[11px] font-bold bg-white/10 hover:bg-white/20 active:scale-95 text-white px-2.5 py-1.5 rounded-xl border border-white/20 transition-all flex items-center gap-1"
            >
              <Lock className="w-3.5 h-3.5" />
              <span>Vardiya Kapat</span>
            </button>
          )}
        </div>

        {/* Ciro ve Kasa Detayları Şeridi */}
        <div className="pt-3 border-t border-white/15 grid grid-cols-3 gap-2 text-xs">
          <div>
            <span className="text-blue-200 text-[10px] block">Toplam Ciro</span>
            <p className="font-bold text-white tabular-nums">
              {formatCurrency(totals.totalRevenue)}
            </p>
          </div>
          <div>
            <span className="text-blue-200 text-[10px] block">Nakit Satışlar</span>
            <p className="font-bold text-emerald-300 tabular-nums">
              {formatCurrency(totals.totalCashSales)}
            </p>
          </div>
          <div>
            <span className="text-blue-200 text-[10px] block">Kart Satışları</span>
            <p className="font-bold text-purple-300 tabular-nums">
              {formatCurrency(totals.totalCardSales)}
            </p>
          </div>
        </div>

        {/* Başlangıç Nakdi Durumu */}
        <div className="mt-2.5 pt-2 border-t border-white/10 flex items-center justify-between text-[11px] text-blue-200">
          <span>Başlangıç Kasası:</span>
          <span className="font-semibold text-white">
            {totals.startingCashKnown
              ? formatCurrency(totals.startingCash)
              : 'Bilinmiyor (0 TL kabul edilmedi)'}
          </span>
        </div>
      </div>

      {/* Üstte Yatay Hızlı İşlem Seçici Sekmeleri (Direct Quick Action Bar) */}
      <div className="space-y-1.5">
        <span className="text-xs font-bold text-slate-700 ml-1">İşlem Türü Seçin</span>
        <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
          <button
            type="button"
            onClick={() => {
              setActiveTab('cash_sale');
              if (editingTx?.transaction_type !== 'cash_sale') setEditingTx(null);
            }}
            className={`px-3 py-2 rounded-xl text-xs font-bold shrink-0 transition-all flex items-center gap-1.5 ${
              activeTab === 'cash_sale'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-700/20'
                : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            <Banknote className="w-3.5 h-3.5" />
            <span>Nakit Satış</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('card_sale');
              if (editingTx?.transaction_type !== 'card_sale') setEditingTx(null);
            }}
            className={`px-3 py-2 rounded-xl text-xs font-bold shrink-0 transition-all flex items-center gap-1.5 ${
              activeTab === 'card_sale'
                ? 'bg-purple-600 text-white shadow-md shadow-purple-700/20'
                : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            <CreditCard className="w-3.5 h-3.5" />
            <span>Kredi Kartı</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('split_payment');
              if (editingTx?.transaction_type !== 'split_payment') setEditingTx(null);
            }}
            className={`px-3 py-2 rounded-xl text-xs font-bold shrink-0 transition-all flex items-center gap-1.5 ${
              activeTab === 'split_payment'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-700/20'
                : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            <Split className="w-3.5 h-3.5" />
            <span>Bölünmüş</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('cash_refund');
              if (editingTx?.transaction_type !== 'cash_refund') setEditingTx(null);
            }}
            className={`px-3 py-2 rounded-xl text-xs font-bold shrink-0 transition-all flex items-center gap-1.5 ${
              activeTab === 'cash_refund'
                ? 'bg-red-600 text-white shadow-md shadow-red-700/20'
                : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Nakit İade</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('other_in');
              if (editingTx?.transaction_type !== 'other_in') setEditingTx(null);
            }}
            className={`px-3 py-2 rounded-xl text-xs font-bold shrink-0 transition-all flex items-center gap-1.5 ${
              activeTab === 'other_in'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-700/20'
                : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            <ArrowDownLeft className="w-3.5 h-3.5" />
            <span>Diğer Giriş</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('other_out');
              if (editingTx?.transaction_type !== 'other_out') setEditingTx(null);
            }}
            className={`px-3 py-2 rounded-xl text-xs font-bold shrink-0 transition-all flex items-center gap-1.5 ${
              activeTab === 'other_out'
                ? 'bg-amber-600 text-white shadow-md shadow-amber-700/20'
                : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            <ArrowUpRight className="w-3.5 h-3.5" />
            <span>Diğer Çıkış</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('cash_count');
              setEditingTx(null);
            }}
            className={`px-3 py-2 rounded-xl text-xs font-bold shrink-0 transition-all flex items-center gap-1.5 ${
              activeTab === 'cash_count'
                ? 'bg-[#002B70] text-white shadow-md shadow-blue-950/20'
                : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            <Calculator className="w-3.5 h-3.5" />
            <span>Fiilî Sayım</span>
          </button>
        </div>
      </div>

      {/* Doğrudan İşlem Giriş Kartı */}
      <div className={`bg-white rounded-2xl p-4 border shadow-xs transition-all ${editingTx ? 'border-amber-400 ring-2 ring-amber-200' : 'border-slate-200/80'}`}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-900">
              {editingTx
                ? 'İşlemi Düzenle'
                : activeTab === 'cash_sale'
                ? 'Nakit Satış Kaydı'
                : activeTab === 'card_sale'
                ? 'Kredi Kartı Satış Kaydı'
                : activeTab === 'split_payment'
                ? 'Bölünmüş Ödeme (Nakit + Kart)'
                : activeTab === 'cash_refund'
                ? 'Nakit İade Kaydı'
                : activeTab === 'other_in'
                ? 'Diğer Nakit Girişi'
                : activeTab === 'other_out'
                ? 'Diğer Nakit Çıkışı'
                : 'Fiilî Kasa Sayımı Yap'}
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
                <span className="font-semibold text-emerald-900">
                  Kasaya Girecek Net Nakit:
                </span>
                <span className="font-extrabold text-emerald-700 text-sm tabular-nums">
                  {liveNetCashSale.isValid
                    ? formatCurrency(liveNetCashSale.netCash)
                    : '₺0,00'}
                </span>
              </div>
            </div>
          )}

          {/* TAB 2: Kredi Kartı */}
          {activeTab === 'card_sale' && (
            <div className="space-y-3">
              <div>
                <label htmlFor="card-amount" className="block text-xs font-bold text-slate-700 mb-1">
                  Karttan Çekilen Tutar (TL)
                </label>
                <input
                  id="card-amount"
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={cardAmountInput}
                  onChange={(e) => setCardAmountInput(e.target.value)}
                  placeholder="Örn: 1000"
                  required
                  className="w-full px-3 py-2 text-sm font-semibold rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-500 tabular-nums"
                />
              </div>
              <div className="bg-purple-50 border border-purple-200/80 rounded-xl p-2.5 text-[11px] text-purple-900 leading-relaxed">
                Kart satışları kasaya/nakit çekmecesine girmez, ciro toplamına eklenir.
              </div>
            </div>
          )}

          {/* TAB 3: Bölünmüş Ödeme */}
          {activeTab === 'split_payment' && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label htmlFor="split-cash" className="block text-xs font-bold text-slate-700 mb-1">
                    Nakit Alınan (TL)
                  </label>
                  <input
                    id="split-cash"
                    type="number"
                    step="0.01"
                    min="0"
                    value={splitCashInput}
                    onChange={(e) => setSplitCashInput(e.target.value)}
                    placeholder="Örn: 600"
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
                    placeholder="Örn: 500"
                    className="w-full px-3 py-2 text-sm font-semibold rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 tabular-nums"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="split-change" className="block text-xs font-bold text-slate-700 mb-1">
                  Verilen Para Üstü (TL)
                </label>
                <input
                  id="split-change"
                  type="number"
                  step="0.01"
                  min="0"
                  value={splitChangeInput}
                  onChange={(e) => setSplitChangeInput(e.target.value)}
                  placeholder="Yalnızca nakit kısımdan düşülür (Örn: 200)"
                  className="w-full px-3 py-2 text-sm font-semibold rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 tabular-nums"
                />
              </div>

              <div className="bg-indigo-50 border border-indigo-200/80 rounded-xl p-2.5 text-xs space-y-1">
                <div className="flex justify-between text-indigo-900 font-semibold">
                  <span>Net Nakit Girişi:</span>
                  <span className="tabular-nums font-bold">
                    {formatCurrency(liveSplitCalc.netCash)}
                  </span>
                </div>
                <div className="flex justify-between text-indigo-900 font-semibold">
                  <span>Kart Satış Etkisi:</span>
                  <span className="tabular-nums font-bold">
                    {formatCurrency(liveSplitCalc.cardAmount)}
                  </span>
                </div>
                <div className="flex justify-between text-indigo-950 font-extrabold border-t border-indigo-200 pt-1">
                  <span>Toplam Satış (Ciro):</span>
                  <span className="tabular-nums">
                    {formatCurrency(liveSplitCalc.totalSale)}
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
                  placeholder="Örn: Ürün bozuk iadesi"
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
                  Açıklama
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
                  Açıklama
                </label>
                <input
                  id="other-out-desc"
                  type="text"
                  value={otherOutDescInput}
                  onChange={(e) => setOtherOutDescInput(e.target.value)}
                  placeholder="Örn: Mağaza temizlik masrafı"
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
            </div>
          )}

          {/* TAB 7: Fiilî Sayım */}
          {activeTab === 'cash_count' && (
            <div className="space-y-3">
              <div>
                <label htmlFor="actual-cash" className="block text-xs font-bold text-slate-700 mb-1">
                  Sayılan Gerçek Nakit (TL)
                </label>
                <input
                  id="actual-cash"
                  type="number"
                  step="0.01"
                  min="0"
                  value={actualCashInput}
                  onChange={(e) => setActualCashInput(e.target.value)}
                  placeholder="Örn: 1450.00"
                  required
                  className="w-full px-3 py-2 text-sm font-semibold rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#002B70] tabular-nums"
                />
              </div>

              <div>
                <label htmlFor="count-notes" className="block text-xs font-bold text-slate-700 mb-1">
                  Sayım Notu (İsteğe Bağlı)
                </label>
                <input
                  id="count-notes"
                  type="text"
                  value={countNotesInput}
                  onChange={(e) => setCountNotesInput(e.target.value)}
                  placeholder="Örn: Akşam sayımı"
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 focus:outline-none"
                />
              </div>

              {/* Anlık Sayım Karşılaştırma Kartı */}
              {actualCashInput && (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs space-y-1.5">
                  <div className="flex justify-between text-slate-600">
                    <span>Beklenen Kasa:</span>
                    <span className="font-bold tabular-nums">
                      {formatCurrency(totals.expectedCash)}
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Sayılan Kasa:</span>
                    <span className="font-bold tabular-nums">
                      {formatCurrency(parseFloat(actualCashInput) || 0)}
                    </span>
                  </div>

                  <div className="border-t border-slate-200 pt-1.5 flex justify-between items-center font-bold">
                    <span>Kasa Farkı:</span>
                    {totals.startingCashKnown ? (
                      (() => {
                        const countEval = evaluateCashCount(
                          parseFloat(actualCashInput) || 0,
                          totals.expectedCash,
                          true
                        );
                        return (
                          <span
                            className={`px-2 py-0.5 rounded-lg text-xs tabular-nums ${
                              countEval.status === 'surplus'
                                ? 'bg-emerald-100 text-emerald-800'
                                : countEval.status === 'deficit'
                                ? 'bg-red-100 text-red-800'
                                : 'bg-slate-200 text-slate-800'
                            }`}
                          >
                            {countEval.status === 'surplus' && 'Kasa Fazlası: '}
                            {countEval.status === 'deficit' && 'Kasa Açığı: '}
                            {countEval.status === 'exact' && 'Tam / Denk: '}
                            {countEval.formattedDifference}
                          </span>
                        );
                      })()
                    ) : (
                      <span className="text-[11px] text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md">
                        Başlangıç kasası bilinmediği için kesin fark hesaplanamaz
                      </span>
                    )}
                  </div>
                </div>
              )}
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
                : activeTab === 'other_out'
                ? 'bg-amber-600 hover:bg-amber-700'
                : 'bg-[#002B70] hover:bg-[#001D4D]'
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
                <span>
                  {activeTab === 'cash_count' ? 'Sayımı Kaydet' : 'İşlemi Kaydet'}
                </span>
              </>
            )}
          </button>
        </form>
      </div>

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
              Bu vardiyada henüz bir kasa işlemi kaydedilmedi.
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
                          {isOtherOut && 'Çıkış'}
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
