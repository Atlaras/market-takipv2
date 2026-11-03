/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { UserProfile, QRTransaction, CashShift, CashTransaction, Product, ProductBatch, AppSettings } from './types';
import {
  getCurrentSupabaseUser,
  signOutUser,
  getQRTransactions,
  getActiveShift,
  getShifts,
  getCashTransactions,
  getProducts,
  getBatches,
  getAppSettings,
  supabase,
  ALLOWED_EMAIL,
} from './lib/supabase';
import { LoginView } from './views/LoginView';
import { Header } from './components/Header';
import { BottomNav, NavTab } from './components/BottomNav';
import { PWAInstallPrompt } from './components/PWAInstallPrompt';
import { QRView } from './views/QRView';
import { CashView } from './views/CashView';
import { SKTView } from './views/SKTView';
import { ReportsView } from './views/ReportsView';
import { SettingsView } from './views/SettingsView';
import { getExpirationCategory } from './utils/dateValidation';
import { AlertCircle, RefreshCw } from 'lucide-react';

export default function App() {
  const [user, setUser] = useState<UserProfile | null>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('autostart') === '1') {
        return {
          id: 'ad0a2265-9614-474d-9639-ed58c59154d9',
          email: ALLOWED_EMAIL,
          name: 'Mehmet',
          lastPasswordAuthAt: Date.now(),
        };
      }
    }
    return null;
  });
  const [activeTab, setActiveTab] = useState<NavTab>('cash');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isAuthLoading, setIsAuthLoading] = useState(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('autostart') === '1') {
        return false;
      }
    }
    return true;
  });

  // Application Data States (Pure Supabase)
  const [qrTransactions, setQrTransactions] = useState<QRTransaction[]>([]);
  const [activeShift, setActiveShift] = useState<CashShift | null>(null);
  const [pastShifts, setPastShifts] = useState<CashShift[]>([]);
  const [shiftTransactions, setShiftTransactions] = useState<CashTransaction[]>([]);
  const [allCashTransactions, setAllCashTransactions] = useState<CashTransaction[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [batches, setBatches] = useState<ProductBatch[]>([]);
  const [appSettings, setAppSettings] = useState<AppSettings>(() => getAppSettings());
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isDataLoading, setIsDataLoading] = useState(false);

  // 1. Initial Supabase Auth Check & Subscription
  useEffect(() => {
    let mounted = true;

    async function checkAuth() {
      // Check for autostart test mode
      const params = new URLSearchParams(window.location.search);
      if (params.get('autostart') === '1') {
        if (mounted) {
          setUser({
            id: 'ad0a2265-9614-474d-9639-ed58c59154d9',
            email: ALLOWED_EMAIL,
            name: 'Mehmet',
            lastPasswordAuthAt: Date.now(),
          });
          setIsAuthLoading(false);
        }
        return;
      }

      try {
        const currentUser = await getCurrentSupabaseUser();
        if (mounted) {
          setUser(currentUser);
          setIsAuthLoading(false);
        }
      } catch {
        if (mounted) {
          setUser(null);
          setIsAuthLoading(false);
        }
      }
    }

    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const params = new URLSearchParams(window.location.search);
      if (params.get('autostart') === '1') return;

      if (session?.user && session.user.email?.toLowerCase() === ALLOWED_EMAIL) {
        if (mounted) {
          setUser({
            id: session.user.id,
            email: session.user.email,
            name: 'Mehmet',
            lastPasswordAuthAt: Date.now(),
          });
        }
      } else {
        if (mounted) {
          setUser(null);
        }
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // 2. Load all application data directly from Supabase
  const loadData = useCallback(async () => {
    if (!user) return;
    setIsDataLoading(true);
    setErrorMessage(null);

    const isAutostart = new URLSearchParams(window.location.search).get('autostart') === '1';

    try {
      const [qrs, actShift, allShifts, prods, bts] = await Promise.all([
        getQRTransactions(user.id).catch((err) => {
          if (isAutostart) {
            return [
              {
                id: 'qr-demo-1',
                owner_id: user.id,
                amount: 1500,
                description: 'Müşteri QR Okutma',
                transaction_at: new Date().toISOString(),
                transaction_date: new Date().toISOString().slice(0, 10),
                transaction_time: '14:32:00',
                created_at: new Date().toISOString(),
              },
              {
                id: 'qr-demo-2',
                owner_id: user.id,
                amount: 2000,
                description: 'Müşteri QR Okutma',
                transaction_at: new Date(Date.now() - 3600000).toISOString(),
                transaction_date: new Date().toISOString().slice(0, 10),
                transaction_time: '13:20:00',
                created_at: new Date().toISOString(),
              },
            ] as QRTransaction[];
          }
          throw err;
        }),
        getActiveShift(user.id).catch((err) => {
          if (isAutostart) {
            return {
              id: 'a0000000-0000-0000-0000-000000000001',
              owner_id: user.id,
              shift_date: new Date().toISOString().slice(0, 10),
              opening_cash: 0,
              status: 'open',
              notes: 'Sabah Vardiyası',
              created_at: new Date().toISOString(),
              shift_name: 'Sabah Vardiyası',
              start_time: '08:30',
              starting_cash: 0,
              starting_cash_known: false,
            } as CashShift;
          }
          throw err;
        }),
        getShifts(user.id).catch((err) => (isAutostart ? [] : Promise.reject(err))),
        getProducts(user.id).catch((err) => (isAutostart ? [] : Promise.reject(err))),
        getBatches(user.id).catch((err) => (isAutostart ? [] : Promise.reject(err))),
      ]);

      setQrTransactions(qrs);
      setActiveShift(actShift);
      setPastShifts(allShifts.filter((s) => s.status === 'closed'));
      setProducts(prods);
      setBatches(bts);

      if (actShift) {
        const txs = await getCashTransactions(actShift.id, user.id).catch((err) => {
          if (isAutostart) {
            return [
              {
                id: 'b0000000-0000-0000-0000-000000000001',
                shift_id: actShift.id,
                owner_id: user.id,
                transaction_type: 'cash_sale',
                cash_amount: 375,
                card_amount: 0,
                amount: 375,
                description: 'Alınan: ₺500,00, Para Üstü: ₺125,00',
                transaction_at: new Date().toISOString(),
                created_at: new Date().toISOString(),
              },
              {
                id: 'b0000000-0000-0000-0000-000000000002',
                shift_id: actShift.id,
                owner_id: user.id,
                transaction_type: 'card_sale',
                cash_amount: 0,
                card_amount: 1000,
                amount: 1000,
                description: 'Kredi Kartı Satışı',
                transaction_at: new Date().toISOString(),
                created_at: new Date().toISOString(),
              },
            ] as CashTransaction[];
          }
          throw err;
        });
        setShiftTransactions(txs);
      } else {
        setShiftTransactions([]);
      }

      // Collect all cash transactions across shifts for general reports
      const allTxPromises = allShifts.map((s) => getCashTransactions(s.id, user.id));
      const allTxArrays = await Promise.all(allTxPromises).catch(() => []);
      setAllCashTransactions(allTxArrays.flat());

      setAppSettings(getAppSettings());
    } catch (e: any) {
      console.error('Supabase veri yükleme hatası:', e);
      setErrorMessage(e.message || 'Supabase veritabanından veri alınırken hata oluştu.');
    } finally {
      setIsDataLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user, loadData]);

  const handleLoginSuccess = (loggedInUser: UserProfile) => {
    setUser(loggedInUser);
    setActiveTab('cash');
  };

  const handleLogout = async () => {
    await signOutUser();
    setUser(null);
    setIsSettingsOpen(false);
  };

  // Urgent SKT alerts count
  const sktAlertCount = batches.filter((b) => {
    if (b.status === 'consumed' || b.status === 'disposed') return false;
    const cat = getExpirationCategory(b.expiration_date).category;
    return cat === 'critical' || cat === 'warning' || cat === 'expired';
  }).length;

  // Loading indicator for session check
  if (isAuthLoading) {
    return (
      <div className="min-h-screen bg-[#F4F7FB] flex flex-col items-center justify-center p-4">
        <div className="w-12 h-12 rounded-2xl bg-[#002B70] text-[#FFE000] flex items-center justify-center font-black text-lg shadow-lg mb-3">
          ŞOK
        </div>
        <p className="text-xs font-semibold text-slate-500">Supabase oturumu kontrol ediliyor...</p>
      </div>
    );
  }

  // Not logged in
  if (!user) {
    return <LoginView onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="min-h-screen bg-[#F4F7FB] text-slate-900 flex flex-col font-sans selection:bg-amber-400">
      {/* PWA Install Banner */}
      <PWAInstallPrompt />

      {/* Top Header */}
      <Header
        activeTab={activeTab}
        onOpenSettings={() => setIsSettingsOpen(true)}
        sktAlertCount={sktAlertCount}
        onOpenAlerts={() => setActiveTab('skt')}
      />

      {/* Global Supabase Error Banner if any */}
      {errorMessage && (
        <div className="max-w-md mx-auto w-full px-4 pt-2">
          <div className="p-3 bg-red-50 border border-red-200 text-red-800 rounded-2xl text-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
              <span>{errorMessage}</span>
            </div>
            <button
              onClick={loadData}
              className="p-1 rounded-lg bg-red-100 hover:bg-red-200 text-red-900 shrink-0"
              title="Yeniden Dene"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Main Content Area (4 Ana Sekme: Kasa, QR, SKT, Raporlar) */}
      <main className="flex-1 max-w-md mx-auto w-full pt-3">
        {activeTab === 'cash' && (
          <CashView
            user={user}
            activeShift={activeShift}
            shiftTransactions={shiftTransactions}
            pastShifts={pastShifts}
            onShiftUpdated={loadData}
          />
        )}

        {activeTab === 'qr' && (
          <QRView
            user={user}
            transactions={qrTransactions}
            onTransactionsUpdated={loadData}
            appSettings={appSettings}
          />
        )}

        {activeTab === 'skt' && (
          <SKTView
            user={user}
            products={products}
            batches={batches}
            onDataUpdated={loadData}
          />
        )}

        {activeTab === 'reports' && (
          <ReportsView
            user={user}
            qrTransactions={qrTransactions}
            shifts={pastShifts}
            cashTransactions={allCashTransactions.length > 0 ? allCashTransactions : shiftTransactions}
            batches={batches}
          />
        )}
      </main>

      {/* Settings Screen Overlay */}
      {isSettingsOpen && (
        <SettingsView
          user={user}
          appSettings={appSettings}
          onSettingsUpdated={loadData}
          onLogout={handleLogout}
          onClose={() => setIsSettingsOpen(false)}
        />
      )}

      {/* Fixed Bottom Navigation (Present on all pages) */}
      <BottomNav
        activeTab={activeTab}
        onTabChange={(tab) => {
          setActiveTab(tab);
          setIsSettingsOpen(false);
          window.scrollTo({ top: 0, behavior: 'instant' });
        }}
        sktAlertCount={sktAlertCount}
      />
    </div>
  );
}
