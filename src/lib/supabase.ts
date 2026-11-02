import { createClient, SupabaseClient } from '@supabase/supabase-js';
import {
  UserProfile,
  QRTransaction,
  CashShift,
  CashTransaction,
  CashCount,
  Product,
  ProductBatch,
  BatchStatusHistory,
  AppSettings,
} from '../types';
import { getTodayDateString, getCurrentTimeString } from '../utils/dateValidation';

export const ALLOWED_EMAIL = 'mehmetgemini185@gmail.com';

// Doğrudan ve zorunlu Supabase bağlantı yapılandırması
export const SUPABASE_URL = 'https://aubaqfanjbnysfeawqjd.supabase.co';
export const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF1YmFxZmFuamJueXNmZWF3cWpkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM2MTI5MjcsImV4cCI6MjEwOTE4ODkyN30.2R7oDPjd6C7yipXEqTVb7MWeq6M60DnYj0InZIoBo7I';

export const supabase: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

export function getSupabaseClient(): SupabaseClient {
  return supabase;
}

// Güvenlik: Geçmiş tarihli işlemler için parola doğrulama zaman damgası (yalnızca bellek içinde tutulur)
let inMemoryLastPasswordAuth: number | null = null;

export function getLastPasswordAuthTime(): number | null {
  return inMemoryLastPasswordAuth;
}

export function setLastPasswordAuthTime(ts: number) {
  inMemoryLastPasswordAuth = ts;
}

// ----------------------------------------------------------------------
// AUTHENTICATION (Yalnızca Supabase Auth)
// ----------------------------------------------------------------------

export async function authenticateUser(
  email: string,
  password: string
): Promise<{ user: UserProfile | null; error: string | null }> {
  const normalizedEmail = email.trim().toLowerCase();

  // Yalnızca izin verilen tek hesap erişebilir
  if (normalizedEmail !== ALLOWED_EMAIL) {
    return {
      user: null,
      error: 'Bu sisteme erişim yetkiniz bulunmamaktadır veya giriş bilgileri hatalı.',
    };
  }

  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password,
    });

    if (error) {
      return {
        user: null,
        error: error.message || 'Giriş bilgileri doğrulanamadı. Lütfen kontrol ediniz.',
      };
    }

    if (!data.user) {
      return {
        user: null,
        error: 'Oturum bilgisi alınamadı.',
      };
    }

    setLastPasswordAuthTime(Date.now());
    const user: UserProfile = {
      id: data.user.id,
      email: data.user.email || normalizedEmail,
      name: 'Mehmet',
      lastPasswordAuthAt: Date.now(),
    };
    return { user, error: null };
  } catch (err: any) {
    return {
      user: null,
      error: `Bağlantı hatası: ${err.message || 'Supabase Auth sunucusuna ulaşılamadı.'}`,
    };
  }
}

export async function getCurrentSupabaseUser(): Promise<UserProfile | null> {
  try {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error || !session?.user) return null;

    if (session.user.email?.toLowerCase() !== ALLOWED_EMAIL) {
      await supabase.auth.signOut();
      return null;
    }

    return {
      id: session.user.id,
      email: session.user.email || ALLOWED_EMAIL,
      name: 'Mehmet',
      lastPasswordAuthAt: getLastPasswordAuthTime(),
    };
  } catch {
    return null;
  }
}

export async function signOutUser(): Promise<void> {
  try {
    await supabase.auth.signOut();
  } catch (err) {
    console.error('Supabase signOut hatası:', err);
  }
  setLastPasswordAuthTime(0);
}

export async function revalidatePassword(password: string): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.email?.toLowerCase() !== ALLOWED_EMAIL) return false;

  const { error } = await supabase.auth.signInWithPassword({
    email: ALLOWED_EMAIL,
    password,
  });

  if (!error) {
    setLastPasswordAuthTime(Date.now());
    return true;
  }
  return false;
}

// ----------------------------------------------------------------------
// CRUD: QR İŞLEMLERİ (Supabase qr_transactions: owner_id, amount, description, transaction_at)
// ----------------------------------------------------------------------

function mapQRRow(row: any): QRTransaction {
  const txAt = row.transaction_at || row.created_at || new Date().toISOString();
  return {
    id: row.id,
    owner_id: row.owner_id,
    amount: Number(row.amount) || 0,
    description: row.description || '',
    transaction_at: txAt,
    transaction_date: txAt.slice(0, 10),
    transaction_time: txAt.slice(11, 19),
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export async function getQRTransactions(userId: string): Promise<QRTransaction[]> {
  const { data, error } = await supabase
    .from('qr_transactions')
    .select('*')
    .eq('owner_id', userId)
    .order('transaction_at', { ascending: false });

  if (error) {
    console.error('Supabase getQRTransactions hatası:', error);
    throw new Error(`QR işlemleri alınamadı: ${error.message}`);
  }

  return (data || []).map(mapQRRow);
}

export interface SaveQRTransactionInput {
  id?: string;
  user_id?: string;
  owner_id?: string;
  amount: number;
  description?: string;
  transaction_at?: string;
  transaction_date?: string;
  transaction_time?: string;
}

export async function saveQRTransaction(
  tx: SaveQRTransactionInput
): Promise<QRTransaction> {
  const now = new Date().toISOString();
  const ownerId = tx.owner_id || tx.user_id;
  if (!ownerId) throw new Error('Kullanıcı kimliği bulunamadı.');

  // ISO timestamp from date and time
  let txAt = tx.transaction_at;
  if (!txAt && tx.transaction_date) {
    const timePart = tx.transaction_time || getCurrentTimeString();
    txAt = new Date(`${tx.transaction_date}T${timePart}`).toISOString();
  }
  if (!txAt) txAt = now;

  if (tx.id) {
    const { data, error } = await supabase
      .from('qr_transactions')
      .update({
        amount: Number(tx.amount),
        description: tx.description || '',
        transaction_at: txAt,
        updated_at: now,
      })
      .eq('id', tx.id)
      .eq('owner_id', ownerId)
      .select()
      .single();

    if (error) {
      console.error('Supabase saveQRTransaction güncelleme hatası:', error);
      throw new Error(`QR işlemi güncellenemedi: ${error.message}`);
    }
    return mapQRRow(data);
  } else {
    const { data, error } = await supabase
      .from('qr_transactions')
      .insert({
        owner_id: ownerId,
        amount: Number(tx.amount),
        description: tx.description || '',
        transaction_at: txAt,
      })
      .select()
      .single();

    if (error) {
      console.error('Supabase saveQRTransaction ekleme hatası:', error);
      throw new Error(`QR işlemi kaydedilemedi: ${error.message}`);
    }
    return mapQRRow(data);
  }
}

export async function deleteQRTransaction(id: string, userId: string): Promise<boolean> {
  const { error } = await supabase
    .from('qr_transactions')
    .delete()
    .eq('id', id)
    .eq('owner_id', userId);

  if (error) {
    console.error('Supabase deleteQRTransaction hatası:', error);
    throw new Error(`QR işlemi silinemedi: ${error.message}`);
  }
  return true;
}

// ----------------------------------------------------------------------
// CRUD: KASA VARDİYALARI (Supabase cash_shifts: owner_id, shift_date, opening_cash, status, ended_at, notes)
// ----------------------------------------------------------------------

function mapShiftRow(row: any): CashShift {
  return {
    id: row.id,
    owner_id: row.owner_id,
    shift_date: row.shift_date || (row.created_at || '').slice(0, 10),
    opening_cash: Number(row.opening_cash) || 0,
    status: row.status || 'open',
    ended_at: row.ended_at,
    notes: row.notes || '',
    created_at: row.created_at,
    updated_at: row.updated_at,

    // Frontend convenience
    shift_name: row.notes || 'Vardiya',
    start_time: (row.created_at || '').slice(11, 16) || '08:30',
    starting_cash: Number(row.opening_cash) || 0,
    starting_cash_known: row.opening_cash !== null && row.opening_cash !== undefined,
    closed_at: row.ended_at,
  };
}

export async function getActiveShift(userId: string): Promise<CashShift | null> {
  const { data, error } = await supabase
    .from('cash_shifts')
    .select('*')
    .eq('owner_id', userId)
    .eq('status', 'open')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('Supabase getActiveShift hatası:', error);
    throw new Error(`Aktif vardiya bilgisi alınamadı: ${error.message}`);
  }

  return data ? mapShiftRow(data) : null;
}

export async function getShifts(userId: string): Promise<CashShift[]> {
  const { data, error } = await supabase
    .from('cash_shifts')
    .select('*')
    .eq('owner_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Supabase getShifts hatası:', error);
    throw new Error(`Vardiyalar alınamadı: ${error.message}`);
  }

  return (data || []).map(mapShiftRow);
}

export async function createShift(
  userId: string,
  shiftName: string,
  startTime: string,
  startingCash: number,
  startingCashKnown: boolean,
  notes?: string
): Promise<CashShift> {
  const combinedNotes = shiftName ? (notes ? `${shiftName} - ${notes}` : shiftName) : (notes || '');

  const { data, error } = await supabase
    .from('cash_shifts')
    .insert({
      owner_id: userId,
      shift_date: getTodayDateString(),
      opening_cash: startingCashKnown ? Number(startingCash) : null,
      status: 'open',
      notes: combinedNotes,
    })
    .select()
    .single();

  if (error) {
    console.error('Supabase createShift hatası:', error);
    throw new Error(`Vardiya başlatılamadı: ${error.message}`);
  }

  return mapShiftRow(data);
}

export async function closeShift(shiftId: string, userId: string, notes?: string): Promise<CashShift> {
  const now = new Date().toISOString();
  const updatePayload: any = {
    status: 'closed',
    ended_at: now,
    updated_at: now,
  };
  if (notes) updatePayload.notes = notes;

  const { data, error } = await supabase
    .from('cash_shifts')
    .update(updatePayload)
    .eq('id', shiftId)
    .eq('owner_id', userId)
    .select()
    .single();

  if (error) {
    console.error('Supabase closeShift hatası:', error);
    throw new Error(`Vardiya kapatılamadı: ${error.message}`);
  }

  return mapShiftRow(data);
}

// ----------------------------------------------------------------------
// CRUD: KASA HAREKETLERİ (Supabase cash_transactions: shift_id, owner_id, transaction_type, cash_amount, card_amount, description, transaction_at)
// ----------------------------------------------------------------------

function mapCashTxRow(row: any): CashTransaction {
  const cashAmt = row.cash_amount !== null ? Number(row.cash_amount) : 0;
  const cardAmt = row.card_amount !== null ? Number(row.card_amount) : 0;
  const totalAmt = cashAmt + cardAmt;

  return {
    id: row.id,
    shift_id: row.shift_id,
    owner_id: row.owner_id,
    transaction_type: row.transaction_type,
    cash_amount: cashAmt,
    card_amount: cardAmt,
    amount: totalAmt,
    description: row.description || '',
    transaction_at: row.transaction_at || row.created_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export async function getCashTransactions(shiftId: string, userId: string): Promise<CashTransaction[]> {
  const { data, error } = await supabase
    .from('cash_transactions')
    .select('*')
    .eq('shift_id', shiftId)
    .eq('owner_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Supabase getCashTransactions hatası:', error);
    throw new Error(`Kasa hareketleri alınamadı: ${error.message}`);
  }

  return (data || []).map(mapCashTxRow);
}

export interface AddCashTransactionInput {
  shift_id: string;
  user_id?: string;
  owner_id?: string;
  transaction_type: CashTransaction['transaction_type'];
  amount: number;
  cash_amount?: number;
  card_amount?: number;
  description?: string;
  transaction_at?: string;
}

export async function addCashTransaction(
  tx: AddCashTransactionInput
): Promise<CashTransaction> {
  const ownerId = tx.owner_id || tx.user_id;
  if (!ownerId) throw new Error('Kullanıcı kimliği bulunamadı.');

  let cashAmt = 0;
  let cardAmt = 0;
  const amt = Number(tx.amount) || 0;

  if (tx.transaction_type === 'cash_sale' || tx.transaction_type === 'other_in') {
    cashAmt = amt;
  } else if (tx.transaction_type === 'card_sale') {
    cardAmt = amt;
  } else if (tx.transaction_type === 'cash_refund' || tx.transaction_type === 'other_out') {
    cashAmt = amt;
  } else if (tx.transaction_type === 'split_payment') {
    cashAmt = Number(tx.cash_amount) || 0;
    cardAmt = Number(tx.card_amount) || (amt - cashAmt);
  }

  const { data, error } = await supabase
    .from('cash_transactions')
    .insert({
      shift_id: tx.shift_id,
      owner_id: ownerId,
      transaction_type: tx.transaction_type,
      cash_amount: cashAmt,
      card_amount: cardAmt,
      description: tx.description || '',
      transaction_at: tx.transaction_at || new Date().toISOString(),
    })
    .select()
    .single();

  if (error) {
    console.error('Supabase addCashTransaction hatası:', error);
    throw new Error(`Kasa hareketi kaydedilemedi: ${error.message}`);
  }

  return mapCashTxRow(data);
}

export async function deleteCashTransaction(id: string, userId: string): Promise<boolean> {
  const { error } = await supabase
    .from('cash_transactions')
    .delete()
    .eq('id', id)
    .eq('owner_id', userId);

  if (error) {
    console.error('Supabase deleteCashTransaction hatası:', error);
    throw new Error(`Kasa hareketi silinemedi: ${error.message}`);
  }

  return true;
}

export interface UpdateCashTransactionInput {
  id: string;
  shift_id?: string;
  user_id?: string;
  owner_id?: string;
  transaction_type: CashTransaction['transaction_type'];
  amount: number;
  cash_amount?: number;
  card_amount?: number;
  description?: string;
}

export async function updateCashTransaction(
  tx: UpdateCashTransactionInput
): Promise<CashTransaction> {
  const ownerId = tx.owner_id || tx.user_id;
  if (!ownerId) throw new Error('Kullanıcı kimliği bulunamadı.');

  let cashAmt = 0;
  let cardAmt = 0;
  const amt = Number(tx.amount) || 0;

  if (tx.transaction_type === 'cash_sale' || tx.transaction_type === 'other_in') {
    cashAmt = amt;
  } else if (tx.transaction_type === 'card_sale') {
    cardAmt = amt;
  } else if (tx.transaction_type === 'cash_refund' || tx.transaction_type === 'other_out') {
    cashAmt = amt;
  } else if (tx.transaction_type === 'split_payment') {
    cashAmt = Number(tx.cash_amount) || 0;
    cardAmt = Number(tx.card_amount) || (amt - cashAmt);
  }

  const { data, error } = await supabase
    .from('cash_transactions')
    .update({
      transaction_type: tx.transaction_type,
      cash_amount: cashAmt,
      card_amount: cardAmt,
      description: tx.description || '',
      updated_at: new Date().toISOString(),
    })
    .eq('id', tx.id)
    .eq('owner_id', ownerId)
    .select()
    .single();

  if (error) {
    console.error('Supabase updateCashTransaction hatası:', error);
    throw new Error(`Kasa hareketi güncellenemedi: ${error.message}`);
  }

  return mapCashTxRow(data);
}

// ----------------------------------------------------------------------
// CRUD: FİİLÎ KASA SAYIMI (Supabase cash_counts: shift_id, owner_id, actual_cash, counted_at, notes)
// ----------------------------------------------------------------------

export interface SaveCashCountInput {
  shift_id: string;
  user_id?: string;
  owner_id?: string;
  actual_cash: number;
  counted_at?: string;
  notes?: string;
  expected_cash?: number;
  difference?: number;
  status?: 'exact' | 'surplus' | 'deficit' | 'indeterminate';
  count_breakdown?: Record<string, number>;
}

export async function saveCashCount(
  count: SaveCashCountInput
): Promise<CashCount> {
  const ownerId = count.owner_id || count.user_id;
  if (!ownerId) throw new Error('Kullanıcı kimliği bulunamadı.');

  const { data, error } = await supabase
    .from('cash_counts')
    .insert({
      shift_id: count.shift_id,
      owner_id: ownerId,
      actual_cash: Number(count.actual_cash),
      counted_at: new Date().toISOString(),
      notes: count.notes || '',
    })
    .select()
    .single();

  if (error) {
    console.error('Supabase saveCashCount hatası:', error);
    throw new Error(`Fiilî kasa sayımı kaydedilemedi: ${error.message}`);
  }

  return {
    id: data.id,
    shift_id: data.shift_id,
    owner_id: data.owner_id,
    actual_cash: Number(data.actual_cash),
    counted_at: data.counted_at,
    notes: data.notes,
    created_at: data.created_at,
    expected_cash: count.expected_cash,
    difference: count.difference,
    status: count.status,
    count_breakdown: count.count_breakdown,
  };
}

export async function getLatestCashCount(shiftId: string, userId: string): Promise<CashCount | null> {
  const { data, error } = await supabase
    .from('cash_counts')
    .select('*')
    .eq('shift_id', shiftId)
    .eq('owner_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('Supabase getLatestCashCount hatası:', error);
    throw new Error(`Kasa sayımı bilgisi alınamadı: ${error.message}`);
  }

  if (!data) return null;

  return {
    id: data.id,
    shift_id: data.shift_id,
    owner_id: data.owner_id,
    actual_cash: Number(data.actual_cash),
    counted_at: data.counted_at,
    notes: data.notes,
    created_at: data.created_at,
  };
}

// ----------------------------------------------------------------------
// CRUD: ÜRÜN VE SKT PARTİLERİ (Supabase products & product_batches)
// products: id, owner_id, product_name, barcode, category, notes, created_at, updated_at
// product_batches: id, product_id, owner_id, quantity, expiry_date, status, notes, created_at, updated_at
// ----------------------------------------------------------------------

function mapProductRow(row: any): Product {
  return {
    id: row.id,
    owner_id: row.owner_id,
    product_name: row.product_name,
    name: row.product_name,
    barcode: row.barcode || undefined,
    category: row.category || undefined,
    notes: row.notes || undefined,
    description: row.notes || undefined,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export async function getProducts(userId: string): Promise<Product[]> {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('owner_id', userId)
    .order('product_name', { ascending: true });

  if (error) {
    console.error('Supabase getProducts hatası:', error);
    throw new Error(`Ürünler alınamadı: ${error.message}`);
  }

  return (data || []).map(mapProductRow);
}

export async function saveProduct(
  product: { id?: string; user_id?: string; owner_id?: string; name: string; barcode?: string; category?: string; description?: string; notes?: string }
): Promise<Product> {
  const ownerId = product.owner_id || product.user_id;
  if (!ownerId) throw new Error('Kullanıcı kimliği bulunamadı.');

  const pName = product.name.trim();
  const pNotes = (product.notes || product.description || '').trim() || null;
  const pBarcode = (product.barcode || '').trim() || null;
  const pCategory = (product.category || '').trim() || null;

  if (product.id) {
    const { data, error } = await supabase
      .from('products')
      .update({
        product_name: pName,
        barcode: pBarcode,
        category: pCategory,
        notes: pNotes,
        updated_at: new Date().toISOString(),
      })
      .eq('id', product.id)
      .eq('owner_id', ownerId)
      .select()
      .single();

    if (error) {
      console.error('Supabase saveProduct güncelleme hatası:', error);
      throw new Error(`Ürün güncellenemedi: ${error.message}`);
    }
    return mapProductRow(data);
  } else {
    const { data, error } = await supabase
      .from('products')
      .insert({
        owner_id: ownerId,
        product_name: pName,
        barcode: pBarcode,
        category: pCategory,
        notes: pNotes,
      })
      .select()
      .single();

    if (error) {
      console.error('Supabase saveProduct ekleme hatası:', error);
      throw new Error(`Ürün kaydedilemedi: ${error.message}`);
    }
    return mapProductRow(data);
  }
}

export async function deleteProduct(id: string, userId: string): Promise<boolean> {
  await supabase.from('product_batches').delete().eq('product_id', id).eq('owner_id', userId);
  const { error } = await supabase.from('products').delete().eq('id', id).eq('owner_id', userId);

  if (error) {
    console.error('Supabase deleteProduct hatası:', error);
    throw new Error(`Ürün silinemedi: ${error.message}`);
  }

  return true;
}

function mapBatchRow(row: any, prodMap: Map<string, Product>): ProductBatch {
  const expDate = row.expiry_date || '';
  const match = (row.notes || '').match(/\[Parti:\s*([^\]]+)\]/);
  const batchNum = match ? match[1] : undefined;
  // Clean notes from [Parti: xxx] prefix for display if desired, or keep as is
  const cleanedNotes = row.notes ? row.notes.replace(/\[Parti:\s*([^\]]+)\]\s*/, '') : undefined;

  return {
    id: row.id,
    product_id: row.product_id,
    owner_id: row.owner_id,
    quantity: Number(row.quantity) || 1,
    expiry_date: expDate,
    expiration_date: expDate,
    status: row.status || 'active',
    batch_number: batchNum,
    notes: cleanedNotes || row.notes || undefined,
    created_at: row.created_at,
    updated_at: row.updated_at,
    product: prodMap.get(row.product_id),
  };
}

export async function getBatches(userId: string): Promise<ProductBatch[]> {
  const [batchesRes, productsRes] = await Promise.all([
    supabase
      .from('product_batches')
      .select('*')
      .eq('owner_id', userId)
      .order('expiry_date', { ascending: true }),
    supabase.from('products').select('*').eq('owner_id', userId),
  ]);

  if (batchesRes.error) {
    console.error('Supabase getBatches hatası:', batchesRes.error);
    throw new Error(`SKT partileri alınamadı: ${batchesRes.error.message}`);
  }

  const prodMap = new Map((productsRes.data || []).map((p: any) => [p.id, mapProductRow(p)]));
  return (batchesRes.data || []).map((b: any) => mapBatchRow(b, prodMap));
}

export interface SaveBatchInput {
  id?: string;
  product_id: string;
  user_id?: string;
  owner_id?: string;
  batch_number?: string;
  quantity: number;
  expiration_date?: string;
  expiry_date?: string;
  status: any;
  notes?: string;
}

export async function saveBatch(batch: SaveBatchInput): Promise<ProductBatch> {
  const ownerId = batch.owner_id || batch.user_id;
  if (!ownerId) throw new Error('Kullanıcı kimliği bulunamadı.');

  const expDate = batch.expiry_date || batch.expiration_date;
  if (!expDate) throw new Error('Son kullanma tarihi girilmelidir.');

  let composedNotes = (batch.notes || '').trim();
  if (batch.batch_number?.trim()) {
    const pTag = `[Parti: ${batch.batch_number.trim()}]`;
    if (!composedNotes.includes(pTag)) {
      composedNotes = composedNotes ? `${pTag} ${composedNotes}` : pTag;
    }
  }

  const finalNotes = composedNotes || null;

  if (batch.id) {
    const { data, error } = await supabase
      .from('product_batches')
      .update({
        product_id: batch.product_id,
        quantity: Number(batch.quantity) || 1,
        expiry_date: expDate,
        status: batch.status,
        notes: finalNotes,
        updated_at: new Date().toISOString(),
      })
      .eq('id', batch.id)
      .eq('owner_id', ownerId)
      .select()
      .single();

    if (error) {
      console.error('Supabase saveBatch güncelleme hatası:', error);
      throw new Error(`Parti güncellenemedi: ${error.message}`);
    }

    const { data: prodData } = await supabase.from('products').select('*').eq('id', data.product_id).maybeSingle();
    const prodMap = new Map();
    if (prodData) prodMap.set(prodData.id, mapProductRow(prodData));
    return mapBatchRow(data, prodMap);
  } else {
    const { data, error } = await supabase
      .from('product_batches')
      .insert({
        product_id: batch.product_id,
        owner_id: ownerId,
        quantity: Number(batch.quantity) || 1,
        expiry_date: expDate,
        status: batch.status,
        notes: finalNotes,
      })
      .select()
      .single();

    if (error) {
      console.error('Supabase saveBatch ekleme hatası:', error);
      throw new Error(`Parti kaydedilemedi: ${error.message}`);
    }

    const { data: prodData } = await supabase.from('products').select('*').eq('id', data.product_id).maybeSingle();
    const prodMap = new Map();
    if (prodData) prodMap.set(prodData.id, mapProductRow(prodData));
    return mapBatchRow(data, prodMap);
  }
}

export async function deleteBatch(id: string, userId: string): Promise<boolean> {
  const { error } = await supabase
    .from('product_batches')
    .delete()
    .eq('id', id)
    .eq('owner_id', userId);

  if (error) {
    console.error('Supabase deleteBatch hatası:', error);
    throw new Error(`Parti silinemedi: ${error.message}`);
  }
  return true;
}

export async function getBatchStatusHistory(batchId: string): Promise<BatchStatusHistory[]> {
  const { data, error } = await supabase
    .from('batch_status_history')
    .select('*')
    .eq('batch_id', batchId)
    .order('changed_at', { ascending: false });

  if (error) {
    console.error('Supabase getBatchStatusHistory hatası:', error);
    throw new Error(`Parti durum geçmişi alınamadı: ${error.message}`);
  }

  return (data || []).map((row: any) => ({
    id: row.id,
    batch_id: row.batch_id,
    owner_id: row.owner_id,
    old_status: row.old_status,
    previous_status: row.old_status,
    new_status: row.new_status,
    changed_at: row.changed_at,
    created_at: row.changed_at,
    notes: row.notes,
  }));
}

// ----------------------------------------------------------------------
// ARAYÜZ AYARLARI (Yalnızca zararsız yerel UI tercihleri)
// ----------------------------------------------------------------------

const APP_SETTINGS_LOCAL_KEY = 'sok_ui_preferences';

export function getAppSettings(): AppSettings {
  const defaultSettings: AppSettings = {
    historical_lock_enabled: false,
    warning_days_threshold: 7,
    sound_vibration_enabled: true,
    default_shift_name: 'Sabah Vardiyası (08:30 - 15:00)',
    supabase_url: SUPABASE_URL,
    supabase_anon_key: SUPABASE_ANON_KEY,
  };

  try {
    const raw = localStorage.getItem(APP_SETTINGS_LOCAL_KEY);
    if (!raw) return defaultSettings;
    return { ...defaultSettings, ...JSON.parse(raw) };
  } catch {
    return defaultSettings;
  }
}

export function saveAppSettings(settings: Partial<AppSettings>) {
  const current = getAppSettings();
  const updated = { ...current, ...settings };
  localStorage.setItem(APP_SETTINGS_LOCAL_KEY, JSON.stringify(updated));
}
