import React, { useState } from 'react';
import { Lock, ShieldAlert, X } from 'lucide-react';
import { revalidatePassword } from '../lib/supabase';

interface PasswordAuthModalProps {
  isOpen: boolean;
  onSuccess: () => void;
  onCancel: () => void;
  actionTitle?: string;
}

export const PasswordAuthModal: React.FC<PasswordAuthModalProps> = ({
  isOpen,
  onSuccess,
  onCancel,
  actionTitle = 'Geçmiş Tarihli Kayıt Güvenlik Doğrulaması',
}) => {
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) {
      setError('Lütfen hesap parolanızı giriniz.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const isValid = await revalidatePassword(password);
      if (isValid) {
        setPassword('');
        onSuccess();
      } else {
        setError('Parola doğrulanamadı. Lütfen kontrol edip tekrar deneyiniz.');
      }
    } catch {
      setError('Doğrulama sırasında bir hata oluştu.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl border border-slate-100 text-slate-900 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center">
              <Lock className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-bold text-[#002B70]">Güvenlik Doğrulaması</h3>
          </div>
          <button
            onClick={onCancel}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-md"
            aria-label="Kapat"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="mt-3">
          <p className="text-xs text-slate-600 leading-relaxed">
            {actionTitle}. Güvenlik protokolü gereği geçmişe dönük işlem yapabilmek için lütfen hesap parolanızı onaylayınız.
          </p>

          <form onSubmit={handleSubmit} className="mt-4 space-y-4">
            <div>
              <label htmlFor="auth-password" className="block text-xs font-semibold text-slate-700 mb-1">
                Hesap Parolası
              </label>
              <input
                id="auth-password"
                type="password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError(null);
                }}
                placeholder="••••••••"
                autoFocus
                className="w-full px-3 py-2.5 text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#0055D4] focus:border-transparent"
              />
            </div>

            {error && (
              <div className="flex items-start gap-2 p-2.5 bg-red-50 text-red-700 rounded-xl text-xs">
                <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={onCancel}
                className="w-1/2 py-2.5 rounded-xl border border-slate-200 text-slate-700 text-xs font-medium hover:bg-slate-50 transition-colors"
              >
                Vazgeç
              </button>
              <button
                type="submit"
                disabled={loading}
                className="w-1/2 py-2.5 rounded-xl bg-[#002B70] text-white text-xs font-bold hover:bg-[#001D4D] disabled:opacity-50 transition-colors shadow-xs"
              >
                {loading ? 'Doğrulanıyor...' : 'Onayla'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
