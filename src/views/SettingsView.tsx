import React, { useState } from 'react';
import {
  Bell,
  Info,
  LogOut,
  ChevronRight,
  ShieldCheck,
  Lock,
  Database,
  CheckCircle2,
  AlertTriangle,
  X,
  RefreshCw,
} from 'lucide-react';
import { UserProfile, AppSettings } from '../types';
import {
  SUPABASE_URL,
  supabase,
  saveAppSettings,
} from '../lib/supabase';

interface SettingsViewProps {
  user: UserProfile;
  appSettings: AppSettings;
  onSettingsUpdated: () => void;
  onLogout: () => void;
  onClose: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  user,
  appSettings,
  onSettingsUpdated,
  onLogout,
  onClose,
}) => {
  // Supabase test status
  const [isTestingDb, setIsTestingDb] = useState(false);
  const [dbTestResult, setDbTestResult] = useState<string | null>(null);

  // Historical lock toggle modal
  const [lockModalOpen, setLockModalOpen] = useState(false);
  const [lockConfirmText, setLockConfirmText] = useState('');

  // Test real Supabase connection
  const handleTestSupabase = async () => {
    setIsTestingDb(true);
    setDbTestResult(null);
    try {
      const { data, error } = await supabase.from('qr_transactions').select('id').limit(1);
      if (error && error.code !== 'PGRST116') {
        setDbTestResult(`Bağlantı yanıt verdi (RLS Korumalı): ${error.message}`);
      } else {
        setDbTestResult('Supabase PostgreSQL bağlantısı tam yetkiyle çalışıyor!');
      }
    } catch (err: any) {
      setDbTestResult(`Bağlantı hatası: ${err.message}`);
    } finally {
      setIsTestingDb(false);
    }
  };

  // Handle lock toggle
  const handleToggleLock = () => {
    if (!appSettings.historical_lock_enabled) {
      saveAppSettings({ historical_lock_enabled: true });
      onSettingsUpdated();
      alert('Geçmiş kayıt kilidi aktif edildi. Artık geçmiş tarihli kayıt eklenemez veya düzenlenemez.');
    } else {
      setLockModalOpen(true);
    }
  };

  const handleConfirmUnlock = () => {
    if (lockConfirmText.trim().toLowerCase() === 'kilidi ac') {
      saveAppSettings({ historical_lock_enabled: false });
      setLockModalOpen(false);
      setLockConfirmText('');
      onSettingsUpdated();
      alert('Geçmiş kayıt kilidi kaldırıldı.');
    } else {
      alert('Güvenlik ifadesi hatalı. Kilit kaldırılamadı.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#F4F7FB] overflow-y-auto pb-safe animate-in slide-in-from-right duration-200">
      {/* Top Bar */}
      <div className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-100 pt-safe px-4 h-14 flex items-center justify-between">
        <h2 className="text-base font-bold text-[#002B70]">Ayarlar</h2>
        <button
          onClick={onClose}
          className="text-slate-500 hover:text-slate-800 p-1 rounded-lg"
          aria-label="Kapat"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="max-w-md mx-auto p-4 space-y-4">
        {/* Profile Card */}
        <div className="bg-white rounded-3xl p-4 border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div className="flex items-center gap-3.5">
            <div className="w-13 h-13 rounded-2xl bg-[#002B70] text-white flex items-center justify-center font-black text-xl shadow-md">
              M
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-slate-900">{user.name}</h3>
              <p className="text-xs text-slate-500 font-mono mt-0.5">{user.email}</p>
              <div className="flex items-center gap-1 mt-1 text-[10px] text-emerald-600 font-semibold">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Tek Yetkili Supabase Hesabı</span>
              </div>
            </div>
          </div>
        </div>

        {/* Supabase Connection Status Card */}
        <div className="bg-white rounded-3xl p-4 border border-slate-200/80 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-blue-50 text-[#0055D4] flex items-center justify-center">
                <Database className="w-5 h-5" />
              </div>
              <div>
                <span className="font-bold text-xs text-slate-900 block">Supabase PostgreSQL</span>
                <span className="text-[10px] text-emerald-600 font-semibold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  Tek ve Zorunlu Veritabanı
                </span>
              </div>
            </div>

            <button
              onClick={handleTestSupabase}
              disabled={isTestingDb}
              className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1 transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isTestingDb ? 'animate-spin' : ''}`} />
              <span>{isTestingDb ? 'Test Ediliyor...' : 'Test Et'}</span>
            </button>
          </div>

          <p className="text-[11px] font-mono text-slate-500 bg-slate-50 p-2 rounded-xl break-all">
            {SUPABASE_URL}
          </p>

          {dbTestResult && (
            <div className="p-2.5 bg-blue-50 text-blue-900 rounded-xl text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{dbTestResult}</span>
            </div>
          )}
        </div>

        {/* List Menu Options */}
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs divide-y divide-slate-100 overflow-hidden text-xs">
          {/* Historical Lock Toggle */}
          <div className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                  appSettings.historical_lock_enabled ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'
                }`}
              >
                <Lock className="w-4 h-4" />
              </div>
              <div>
                <span className="font-bold text-slate-800 block">Geçmiş Kayıt Kilidi</span>
                <span className="text-[10px] text-slate-400">
                  {appSettings.historical_lock_enabled
                    ? 'Aktif: Geçmiş kayıt ekleme/düzenleme kilitli'
                    : 'Pasif: Parola ile geçmişe dönük işlem serbest'}
                </span>
              </div>
            </div>
            <button
              onClick={handleToggleLock}
              className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors ${
                appSettings.historical_lock_enabled ? 'bg-[#002B70]' : 'bg-slate-300'
              }`}
            >
              <div
                className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                  appSettings.historical_lock_enabled ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Notification / SKT Settings */}
          <div className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                <Bell className="w-4 h-4" />
              </div>
              <div>
                <span className="font-bold text-slate-800 block">SKT Uyarı Eşiği</span>
                <span className="text-[10px] text-slate-400">Son kullanma tarihine kaç gün kala uyarı verilsin?</span>
              </div>
            </div>
            <select
              value={appSettings.warning_days_threshold}
              onChange={(e) => {
                saveAppSettings({ warning_days_threshold: Number(e.target.value) });
                onSettingsUpdated();
              }}
              className="px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-700"
            >
              <option value="3">3 Gün</option>
              <option value="7">7 Gün</option>
              <option value="14">14 Gün</option>
              <option value="30">30 Gün</option>
            </select>
          </div>

          {/* About */}
          <div className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center">
                <Info className="w-4 h-4" />
              </div>
              <div>
                <span className="font-bold text-slate-800 block">Hakkında</span>
                <span className="text-[10px] text-slate-400">ŞOK Kişisel Takip v1.0.0 (Supabase Engine)</span>
              </div>
            </div>
            <span className="text-[10px] font-bold text-slate-400">© 2026</span>
          </div>

          {/* Logout */}
          <button
            onClick={onLogout}
            className="w-full p-4 flex items-center justify-between hover:bg-red-50/60 transition-colors text-left text-red-600"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-red-50 text-red-600 flex items-center justify-center">
                <LogOut className="w-4 h-4" />
              </div>
              <span className="font-bold">Çıkış Yap</span>
            </div>
            <ChevronRight className="w-4 h-4 text-red-400" />
          </button>
        </div>

        {/* App Version Info */}
        <div className="text-center pt-4 space-y-1">
          <p className="text-xs font-bold text-slate-400">ŞOK Kişisel Takip v1.0.0</p>
          <p className="text-[10px] text-slate-400">© 2026 ŞOK Market · Supabase PostgreSQL</p>
        </div>
      </div>

      {/* MODAL: Historical Unlock Confirmation */}
      {lockModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-sm rounded-3xl bg-white p-5 shadow-2xl border border-slate-100 text-slate-900 text-xs space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="font-bold text-red-600 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4" />
                Kilidi Açma Doğrulaması
              </h3>
              <button onClick={() => setLockModalOpen(false)} className="text-slate-400 p-1">
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-slate-600">
              Kural gereği geçmiş kayıt kilidi kolayca devre dışı bırakılamaz. Kilidi açmak için lütfen aşağıya{' '}
              <strong className="text-slate-900">kilidi ac</strong> yazınız:
            </p>

            <input
              type="text"
              value={lockConfirmText}
              onChange={(e) => setLockConfirmText(e.target.value)}
              placeholder="kilidi ac"
              className="w-full px-3 py-2 rounded-xl border border-slate-200 font-mono font-bold"
            />

            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => setLockModalOpen(false)}
                className="w-1/2 py-2.5 rounded-xl border border-slate-200"
              >
                Vazgeç
              </button>
              <button
                type="button"
                onClick={handleConfirmUnlock}
                className="w-1/2 py-2.5 rounded-xl bg-red-600 text-white font-bold"
              >
                Kilidi Kaldır
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
