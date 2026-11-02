import React, { useState } from 'react';
import { Lock, Mail, ShieldAlert, ArrowRight } from 'lucide-react';
import { authenticateUser } from '../lib/supabase';
import { UserProfile } from '../types';

interface LoginViewProps {
  onLoginSuccess: (user: UserProfile) => void;
}

export const LoginView: React.FC<LoginViewProps> = ({ onLoginSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Lütfen e-posta ve parolanızı eksiksiz giriniz.');
      return;
    }

    setLoading(true);
    setError(null);

    const { user, error: authError } = await authenticateUser(email, password);
    setLoading(false);

    if (authError || !user) {
      let msg = authError || 'Giriş bilgileri doğrulanamadı. Erişim reddedildi.';
      if (msg.toLowerCase().includes('invalid login credentials')) {
        msg = 'Giriş bilgileri hatalı veya şifre yanlış. Lütfen kontrol ediniz.';
      }
      setError(msg);
    } else {
      onLoginSuccess(user);
    }
  };

  // Hızlı doldurma yardımcısı
  const handleQuickFill = () => {
    setEmail('mehmetgemini185@gmail.com');
    setError(null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#002B70] via-[#003B95] to-[#F4F7FB] flex flex-col justify-between p-4 pt-12 pb-safe">
      <div className="max-w-md w-full mx-auto my-auto space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-gradient-to-tr from-[#FFE000] to-[#FFF066] shadow-xl p-2 border-2 border-amber-300">
            <span className="text-3xl font-black text-[#002B70] tracking-tighter">ŞOK</span>
          </div>
          <div>
            <h1 className="text-2xl font-black text-white tracking-tight">ŞOK Kişisel Takip</h1>
            <p className="text-blue-100 text-xs mt-1 font-medium">
              Vardiya, QR, Kasa ve SKT Yönetim Sistemi
            </p>
          </div>
        </div>

        {/* Login Card */}
        <div className="bg-white rounded-3xl p-6 shadow-2xl border border-slate-100 text-slate-900">
          <div className="mb-5">
            <h2 className="text-lg font-bold text-[#002B70]">Yetkili Girişi</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Devam etmek için hesap bilgilerinizi giriniz.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="login-email" className="block text-xs font-bold text-slate-700 mb-1.5">
                E-posta Adresi
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                <input
                  id="login-email"
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setError(null);
                  }}
                  placeholder="ornek@alan.com"
                  className="w-full pl-10 pr-3 py-3 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#0055D4] focus:border-transparent transition-all"
                />
              </div>
            </div>

            <div>
              <label htmlFor="login-password" className="block text-xs font-bold text-slate-700 mb-1.5">
                Parola
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                <input
                  id="login-password"
                  type="password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setError(null);
                  }}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-3 py-3 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#0055D4] focus:border-transparent transition-all"
                />
              </div>
            </div>

            {error && (
              <div className="p-3 bg-red-50 text-red-700 rounded-xl text-xs flex items-start gap-2 border border-red-100 animate-in fade-in">
                <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5 text-red-600" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-xl bg-[#002B70] text-white font-bold text-sm hover:bg-[#001D4D] active:scale-[0.99] disabled:opacity-50 transition-all flex items-center justify-center gap-2 shadow-md shadow-blue-900/10"
            >
              <span>{loading ? 'Giriş Yapılıyor...' : 'Güvenli Giriş Yap'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {/* Quick fill button */}
          <div className="mt-4 pt-4 border-t border-slate-100 text-center">
            <button
              type="button"
              onClick={handleQuickFill}
              className="text-[11px] font-semibold text-[#0055D4] hover:underline"
            >
              Hızlı Giriş Bilgilerini Doldur
            </button>
          </div>
        </div>

        {/* Security badge */}
        <div className="text-center">
          <p className="text-[11px] text-blue-200/80">
            Kişisel kullanım için şifrelenmiş oturum güvenliği
          </p>
        </div>
      </div>

      <div className="text-center text-xs text-slate-400">
        ŞOK Kişisel Takip v1.0.0
      </div>
    </div>
  );
};
