export interface UserProfile {
  id: string;
  email: string;
  name: string;
  avatar_url?: string;
  lastPasswordAuthAt: number | null;
}

export interface QRTransaction {
  id: string;
  owner_id: string;
  amount: number;
  description: string;
  transaction_at: string; // ISO timestamptz
  created_at: string;
  updated_at?: string;

  // Frontend helper getters
  transaction_date: string; // YYYY-MM-DD
  transaction_time: string; // HH:mm:ss
}

export interface CashShift {
  id: string;
  owner_id: string;
  shift_date: string; // YYYY-MM-DD
  opening_cash: number;
  status: 'open' | 'closed';
  ended_at?: string;
  notes?: string;
  created_at: string;
  updated_at?: string;

  // Frontend convenience getters
  shift_name: string;
  start_time: string;
  starting_cash: number;
  starting_cash_known: boolean;
  closed_at?: string;
}

export type CashTransactionType = 
  | 'cash_sale' 
  | 'card_sale' 
  | 'split_payment' 
  | 'cash_refund' 
  | 'other_in' 
  | 'other_out';

export interface CashTransaction {
  id: string;
  shift_id: string;
  owner_id: string;
  transaction_type: CashTransactionType;
  cash_amount?: number;
  card_amount?: number;
  amount: number;
  description: string;
  transaction_at: string;
  created_at: string;
  updated_at?: string;
}

export interface CashCount {
  id: string;
  shift_id: string;
  owner_id: string;
  actual_cash: number;
  counted_at: string;
  notes?: string;
  created_at: string;

  // Frontend calculation helpers
  expected_cash?: number;
  difference?: number;
  status?: 'exact' | 'surplus' | 'deficit' | 'indeterminate';
  count_breakdown?: Record<string, number>;
}

export interface Product {
  id: string;
  owner_id: string;
  product_name: string;
  name: string; // alias
  barcode?: string;
  category?: string;
  notes?: string;
  description?: string; // alias
  created_at: string;
  updated_at?: string;
}

export type BatchStatus = 'active' | 'warning' | 'expired' | 'consumed' | 'disposed';

export interface ProductBatch {
  id: string;
  product_id: string;
  owner_id: string;
  quantity: number;
  expiry_date: string; // YYYY-MM-DD
  expiration_date: string; // alias
  status: BatchStatus;
  batch_number?: string;
  notes?: string;
  created_at: string;
  updated_at?: string;
  product?: Product;
}

export interface BatchStatusHistory {
  id: string;
  batch_id: string;
  owner_id: string;
  old_status: string;
  previous_status: string; // alias
  new_status: string;
  changed_at: string;
  created_at: string; // alias
  notes?: string;
}

export interface AppSettings {
  historical_lock_enabled: boolean;
  warning_days_threshold: number;
  sound_vibration_enabled: boolean;
  default_shift_name: string;
  supabase_url?: string;
  supabase_anon_key?: string;
}
