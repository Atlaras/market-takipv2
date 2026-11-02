import React, { useState } from 'react';
import {
  QrCode,
  Plus,
  Edit2,
  Trash2,
  CheckCircle2,
  AlertCircle,
  X,
  Users,
  Calendar,
  Layers,
} from 'lucide-react';
import { QRTransaction, UserProfile, AppSettings } from '../types';
import { formatCurrency } from '../utils/cashCalculations';
import {
  getTodayDateString,
  getCurrentTimeString,
  isFutureDate,
  isPastDate,
  formatTurkishDate,
  isPasswordAuthValid,
} from '../utils/dateValidation';
import { saveQRTransaction, deleteQRTransaction } from '../lib/supabase';
import { PasswordAuthModal } from '../components/PasswordAuthModal';

interface QRViewProps {
  user: UserProfile;
  transactions: QRTransaction[];
  onTransactionsUpdated: () => void;
  appSettings: AppSettings;
}

export const QRView: React.FC<QRViewProps> = ({
  user,
  transactions,
  onTransactionsUpdated,
  appSettings,
}) => {
  const todayStr = getTodayDateString();

  // Form state: ONLY amount input
  const [amountInput, setAmountInput] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Edit state
  const [editingItem, setEditingItem] = useState<QRTransaction | null>(null);

  // Password confirmation state for historical edits/deletions
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);

  // Separate QR Statistics (Every record is 1 scanned customer / QR read)
  const todayTransactions = transactions.filter((t) => t.transaction_date === todayStr);
  const todayCount = todayTransactions.length;
  const todayTotal = todayTransactions.reduce((acc, t) => acc + (Number(t.amount) || 0), 0);

  const monthStr = todayStr.slice(0, 7);
  const monthTransactions = transactions.filter((t) => t.transaction_date.slice(0, 7) === monthStr);
  const monthCount = monthTransactions.length;
  const monthTotal = monthTransactions.reduce((acc, t) => acc + (Number(t.amount) || 0), 0);

  const generalCount = transactions.length;
  const generalTotal = transactions.reduce((acc, t) => acc + (Number(t.amount) || 0), 0);

  const runWithPasswordCheckIfPast = (targetDate: string, action: () => void) => {
    if (isFutureDate(targetDate)) {
      setFormError('Gelecek tarihli QR işlemi oluşturulamaz.');
      return;
    }

    if (isPastDate(targetDate) && appSettings.historical_lock_enabled) {
      setFormError('Geçmiş kayıt kilidi aktif. Geçmiş tarihli kayıtlar kilitlenmiştir.');
      return;
    }

    if (isPastDate(targetDate)) {
      if (isPasswordAuthValid(user.lastPasswordAuthAt)) {
        action();
      } else {
        setPendingAction(() => action);
        setAuthModalOpen(true);
      }
    } else {
      action();
    }
  };

  const handleSaveTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const parsedAmount = parseFloat(amountInput.replace(',', '.'));
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setFormError('Lütfen geçerli bir tutar giriniz.');
      return;
    }

    const targetDate = editingItem ? editingItem.transaction_date : todayStr;

    const action = async () => {
      setIsSubmitting(true);
      try {
        const now = new Date();
        const txAt = editingItem
          ? editingItem.transaction_at
          : now.toISOString();

        await saveQRTransaction({
          id: editingItem ? editingItem.id : undefined,
          user_id: user.id,
          amount: parsedAmount,
          description: 'Müşteri QR Okutma',
          transaction_at: txAt,
          transaction_date: editingItem ? editingItem.transaction_date : todayStr,
          transaction_time: editingItem ? editingItem.transaction_time : getCurrentTimeString(),
        });

        // Reset form
        setAmountInput('');
        setEditingItem(null);
        setFormError(null);
        onTransactionsUpdated();
      } catch (err: any) {
        setFormError(err.message || 'Kayıt sırasında hata oluştu.');
      } finally {
        setIsSubmitting(false);
      }
    };

    runWithPasswordCheckIfPast(targetDate, action);
  };

  const handleStartEdit = (tx: QRTransaction) => {
    runWithPasswordCheckIfPast(tx.transaction_date, () => {
      setEditingItem(tx);
      setAmountInput(tx.amount.toString());
      setFormError(null);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  };

  const handleCancelEdit = () => {
    setEditingItem(null);
    setAmountInput('');
    setFormError(null);
  };

  const handleDeleteClick = (tx: QRTransaction) => {
    const action = async () => {
      if (window.confirm(`${formatCurrency(tx.amount)} tutarındaki QR okutma kaydını silmek istediğinize emin misiniz?`)) {
        try {
          await deleteQRTransaction(tx.id, user.id);
          if (editingItem?.id === tx.id) {
            handleCancelEdit();
          }
          onTransactionsUpdated();
        } catch (err: any) {
          alert(err.message || 'Silme işlemi başarısız.');
        }
      }
    };
    runWithPasswordCheckIfPast(tx.transaction_date, action);
  };

  return (
    <div className="space-y-4 pb-28 px-4 max-w-lg mx-auto">
      {/* QR Bilgilendirme Notu */}
      <div className="bg-blue-50/70 border border-blue-200/70 rounded-2xl p-3 flex items-start gap-2.5 text-xs text-[#002B70]">
        <QrCode className="w-4 h-4 text-[#0055D4] shrink-0 mt-0.5" />
        <div className="leading-relaxed">
          <span className="font-bold">Müşteri QR Kod Takibi:</span> Okutulan müşteri kodları kasiyer takip amaçlıdır.
          Kasa satışlarına veya nakit devrine dahil edilmez.
        </div>
      </div>

      {/* QR İstatistikleri: Günlük / Aylık / Genel */}
      <div className="grid grid-cols-3 gap-2">
        {/* Günlük */}
        <div className="bg-white rounded-2xl p-3 border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded-md">
              Günlük
            </span>
            <Users className="w-3.5 h-3.5 text-blue-600" />
          </div>
          <div>
            <p className="text-base font-black text-slate-900 tabular-nums">
              {formatCurrency(todayTotal)}
            </p>
            <p className="text-[11px] font-medium text-slate-500 mt-0.5">
              {todayCount} Müşteri / İşlem
            </p>
          </div>
        </div>

        {/* Aylık */}
        <div className="bg-white rounded-2xl p-3 border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded-md">
              Aylık
            </span>
            <Calendar className="w-3.5 h-3.5 text-purple-600" />
          </div>
          <div>
            <p className="text-base font-black text-slate-900 tabular-nums">
              {formatCurrency(monthTotal)}
            </p>
            <p className="text-[11px] font-medium text-slate-500 mt-0.5">
              {monthCount} Müşteri / İşlem
            </p>
          </div>
        </div>

        {/* Genel */}
        <div className="bg-white rounded-2xl p-3 border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded-md">
              Genel
            </span>
            <Layers className="w-3.5 h-3.5 text-slate-600" />
          </div>
          <div>
            <p className="text-base font-black text-slate-900 tabular-nums">
              {formatCurrency(generalTotal)}
            </p>
            <p className="text-[11px] font-medium text-slate-500 mt-0.5">
              {generalCount} Müşteri / İşlem
            </p>
          </div>
        </div>
      </div>

      {/* Sadeleştirilmiş QR Ekleme / Düzenleme Formu: Yalnızca Tutar Girişi ve Kaydet Butonu */}
      <div className={`bg-white rounded-2xl p-4 border transition-all ${editingItem ? 'border-amber-400 ring-2 ring-amber-200' : 'border-slate-200/80'} shadow-xs`}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs ${editingItem ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'}`}>
              <QrCode className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-bold text-slate-900">
              {editingItem ? 'QR Kaydını Düzenle' : 'Yeni QR Okutma'}
            </h3>
          </div>
          {editingItem && (
            <button
              type="button"
              onClick={handleCancelEdit}
              className="text-xs font-semibold text-slate-500 hover:text-slate-800 flex items-center gap-1 bg-slate-100 px-2 py-1 rounded-lg"
            >
              <X className="w-3.5 h-3.5" />
              <span>Vazgeç</span>
            </button>
          )}
        </div>

        <form onSubmit={handleSaveTransaction} className="space-y-3">
          <div>
            <label htmlFor="qr-amount-input" className="block text-xs font-bold text-slate-700 mb-1">
              Okutulan QR Tutarı (TL)
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-3 text-slate-400 font-bold text-sm">₺</span>
              <input
                id="qr-amount-input"
                type="number"
                step="0.01"
                min="0.01"
                value={amountInput}
                onChange={(e) => setAmountInput(e.target.value)}
                placeholder="Örn: 150.00"
                required
                autoFocus={Boolean(editingItem)}
                className="w-full pl-9 pr-4 py-2.5 text-base font-bold rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#0055D4] focus:border-transparent tabular-nums"
              />
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Tarih ve saat sistem tarafından otomatik kaydedilir.
            </p>
          </div>

          {formError && (
            <div className="flex items-start gap-2 p-2.5 bg-red-50 text-red-700 rounded-xl text-xs border border-red-100">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{formError}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting || !amountInput}
            className={`w-full py-3 rounded-xl font-bold text-sm text-white transition-all flex items-center justify-center gap-2 active:scale-[0.99] disabled:opacity-50 ${
              editingItem ? 'bg-amber-600 hover:bg-amber-700' : 'bg-[#002B70] hover:bg-[#001D4D]'
            } shadow-md`}
          >
            {isSubmitting ? (
              <span>Kaydediliyor...</span>
            ) : editingItem ? (
              <>
                <Edit2 className="w-4 h-4" />
                <span>Değişikliği Kaydet</span>
              </>
            ) : (
              <>
                <Plus className="w-4 h-4" />
                <span>Kaydet</span>
              </>
            )}
          </button>
        </form>
      </div>

      {/* QR İşlem Geçmişi */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900">QR İşlem Geçmişi</h3>
          <span className="text-xs text-slate-400 font-medium">
            Toplam {transactions.length} Kayıt
          </span>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs divide-y divide-slate-100 overflow-hidden">
          {transactions.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs">
              Henüz kaydedilmiş bir QR okutma işlemi bulunmuyor.
            </div>
          ) : (
            transactions.map((tx) => (
              <div
                key={tx.id}
                className={`p-3.5 flex items-center justify-between hover:bg-slate-50 transition-colors ${
                  editingItem?.id === tx.id ? 'bg-amber-50/60' : ''
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-black text-slate-900 tabular-nums">
                      {formatCurrency(tx.amount)}
                    </p>
                    <p className="text-[11px] text-slate-500 truncate">
                      {formatTurkishDate(tx.transaction_date)} • {tx.transaction_time?.slice(0, 5) || 'Saatli'}
                    </p>
                  </div>
                </div>

                {/* Düzenle ve Sil Butonları Doğrudan Görünür */}
                <div className="flex items-center gap-1.5 shrink-0 ml-2">
                  <button
                    type="button"
                    onClick={() => handleStartEdit(tx)}
                    className="p-1.5 rounded-lg text-slate-500 hover:text-blue-700 hover:bg-blue-50 active:scale-95 transition-all"
                    title="Düzenle"
                    aria-label="Kaydı Düzenle"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteClick(tx)}
                    className="p-1.5 rounded-lg text-slate-500 hover:text-red-700 hover:bg-red-50 active:scale-95 transition-all"
                    title="Sil"
                    aria-label="Kaydı Sil"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Password Re-auth Modal for Past Dates */}
      <PasswordAuthModal
        isOpen={authModalOpen}
        onCancel={() => {
          setAuthModalOpen(false);
          setPendingAction(null);
        }}
        onSuccess={() => {
          setAuthModalOpen(false);
          if (pendingAction) {
            pendingAction();
            setPendingAction(null);
          }
        }}
        actionTitle="Geçmiş Tarihli QR Kayıt İşlemi"
      />
    </div>
  );
};
