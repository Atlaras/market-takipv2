/**
 * Cash register and shift calculation utilities for ŞOK Kişisel Takip
 * Strictly follows business rules:
 * - Expected Cash = Starting Cash + Cash Sales - Cash Refunds + Other Cash In - Other Cash Out
 * - Card sales are strictly EXCLUDED from cash calculations.
 * - Change returned is NOT deducted a second time.
 * - If starting cash is unknown, exact surplus/deficit calculation cannot be confirmed.
 * - Each shift is strictly independent.
 */

export interface CashTransactionItem {
  id?: string;
  transaction_type: 'cash_sale' | 'card_sale' | 'split_payment' | 'cash_refund' | 'other_in' | 'other_out';
  amount: number; // total amount of transaction
  cash_amount?: number; // for split payments or cash portion
  card_amount?: number; // for split payments or card portion
  description?: string;
  created_at?: string;
}

export interface ShiftSummary {
  startingCash: number;
  startingCashKnown: boolean;
  totalCashSales: number;
  totalCardSales: number;
  totalCashRefunds: number;
  totalOtherCashIn: number;
  totalOtherCashOut: number;
  expectedCash: number;
  totalRevenue: number; // Cash sales + Card sales
  transactionCount: number;
}

export interface CashCountResult {
  actualCash: number;
  expectedCash: number;
  difference: number;
  status: 'exact' | 'surplus' | 'deficit' | 'indeterminate';
  formattedDifference: string;
}

/**
 * Calculates net cash for a cash sale given amount received and change returned
 * Net Cash = cashReceived - changeGiven
 */
export function calculateNetCashSale(cashReceived: number, changeGiven: number = 0): {
  netCash: number;
  isValid: boolean;
  error?: string;
} {
  const received = Number(cashReceived) || 0;
  const change = Number(changeGiven) || 0;

  if (received <= 0) {
    return { netCash: 0, isValid: false, error: 'Alınan nakit tutarı sıfırdan büyük olmalıdır.' };
  }

  if (change < 0) {
    return { netCash: 0, isValid: false, error: 'Para üstü negatif olamaz.' };
  }

  if (change >= received) {
    return { netCash: 0, isValid: false, error: 'Para üstü alınan nakitten büyük veya eşit olamaz.' };
  }

  const netCash = Math.round((received - change) * 100) / 100;
  return { netCash, isValid: true };
}

/**
 * Calculates split payment amounts
 * Net Cash = cashReceived - changeGiven
 * Total Sale = netCash + cardAmount
 */
export function calculateSplitPayment(
  cashReceived: number,
  cardAmount: number,
  changeGiven: number = 0
): {
  netCash: number;
  cardAmount: number;
  totalSale: number;
  isValid: boolean;
  error?: string;
} {
  const received = Number(cashReceived) || 0;
  const card = Number(cardAmount) || 0;
  const change = Number(changeGiven) || 0;

  if (received <= 0 && card <= 0) {
    return { netCash: 0, cardAmount: 0, totalSale: 0, isValid: false, error: 'Nakit veya kart tutarı girilmelidir.' };
  }

  if (change < 0) {
    return { netCash: 0, cardAmount: 0, totalSale: 0, isValid: false, error: 'Para üstü negatif olamaz.' };
  }

  if (received > 0 && change >= received) {
    return { netCash: 0, cardAmount: 0, totalSale: 0, isValid: false, error: 'Para üstü alınan nakitten büyük veya eşit olamaz.' };
  }

  const netCash = received > 0 ? Math.round((received - change) * 100) / 100 : 0;
  const validCard = Math.round(card * 100) / 100;
  const totalSale = Math.round((netCash + validCard) * 100) / 100;

  return {
    netCash,
    cardAmount: validCard,
    totalSale,
    isValid: true,
  };
}

/**
 * Calculates shift totals according to strict business logic
 */
export function calculateShiftTotals(
  startingCash: number,
  startingCashKnown: boolean,
  transactions: CashTransactionItem[]
): ShiftSummary {
  let totalCashSales = 0;
  let totalCardSales = 0;
  let totalCashRefunds = 0;
  let totalOtherCashIn = 0;
  let totalOtherCashOut = 0;

  for (const tx of transactions) {
    const amt = Number(tx.amount) || 0;
    switch (tx.transaction_type) {
      case 'cash_sale':
        totalCashSales += amt;
        break;
      case 'card_sale':
        // Card sales are purely tracked for total revenue, NEVER added to cash register
        totalCardSales += amt;
        break;
      case 'split_payment': {
        const cashPortion = Number(tx.cash_amount) || 0;
        const cardPortion = Number(tx.card_amount) || (amt - cashPortion);
        totalCashSales += cashPortion;
        totalCardSales += cardPortion;
        break;
      }
      case 'cash_refund':
        totalCashRefunds += amt;
        break;
      case 'other_in':
        totalOtherCashIn += amt;
        break;
      case 'other_out':
        totalOtherCashOut += amt;
        break;
    }
  }

  // Expected Cash formula:
  // Expected Cash = Starting Cash + Cash Sales - Cash Refunds + Other Cash In - Other Cash Out
  const effectiveStartingCash = startingCashKnown ? (Number(startingCash) || 0) : 0;
  const expectedCash = effectiveStartingCash + totalCashSales - totalCashRefunds + totalOtherCashIn - totalOtherCashOut;
  const totalRevenue = totalCashSales + totalCardSales;

  return {
    startingCash: effectiveStartingCash,
    startingCashKnown,
    totalCashSales,
    totalCardSales,
    totalCashRefunds,
    totalOtherCashIn,
    totalOtherCashOut,
    expectedCash: Math.round(expectedCash * 100) / 100,
    totalRevenue: Math.round(totalRevenue * 100) / 100,
    transactionCount: transactions.length,
  };
}

/**
 * Evaluates physical count against expected cash
 */
export function evaluateCashCount(
  actualCash: number,
  expectedCash: number,
  startingCashKnown: boolean
): CashCountResult {
  const actual = Number(actualCash) || 0;
  
  if (!startingCashKnown) {
    return {
      actualCash: actual,
      expectedCash,
      difference: 0,
      status: 'indeterminate',
      formattedDifference: 'Başlangıç nakdi bilinmediği için hesaplanamaz',
    };
  }

  const diff = Math.round((actual - expectedCash) * 100) / 100;

  let status: 'exact' | 'surplus' | 'deficit' = 'exact';
  if (diff > 0.009) {
    status = 'surplus';
  } else if (diff < -0.009) {
    status = 'deficit';
  }

  const sign = diff > 0 ? '+' : '';
  const formattedDifference = `${sign}${formatCurrency(diff)}`;

  return {
    actualCash: actual,
    expectedCash,
    difference: diff,
    status,
    formattedDifference,
  };
}

/**
 * Currency formatter for Turkish Lira
 */
export function formatCurrency(amount: number): string {
  const val = Number(amount) || 0;
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: 'TRY',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(val);
}
