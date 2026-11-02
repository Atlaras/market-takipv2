import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateShiftTotals,
  evaluateCashCount,
  calculateNetCashSale,
  calculateSplitPayment,
  CashTransactionItem,
} from './cashCalculations';

test('Shift calculations: Starting cash + cash sales - cash refunds + other in - other out', () => {
  const transactions: CashTransactionItem[] = [
    { transaction_type: 'cash_sale', amount: 500 },
    { transaction_type: 'cash_sale', amount: 250 },
    { transaction_type: 'card_sale', amount: 1200 }, // MUST NOT be added to cash
    { transaction_type: 'cash_refund', amount: 100 },
    { transaction_type: 'other_in', amount: 50 },
    { transaction_type: 'other_out', amount: 30 },
  ];

  const summary = calculateShiftTotals(350, true, transactions);

  // Expected Cash = 350 + 750 - 100 + 50 - 30 = 1020
  assert.equal(summary.expectedCash, 1020);
  assert.equal(summary.totalCashSales, 750);
  // Card sales are tracked separately
  assert.equal(summary.totalCardSales, 1200);
  assert.equal(summary.totalCashRefunds, 100);
  assert.equal(summary.totalOtherCashIn, 50);
  assert.equal(summary.totalOtherCashOut, 30);
  // Total revenue is cash sales + card sales = 750 + 1200 = 1950
  assert.equal(summary.totalRevenue, 1950);
});

test('Shift calculations: Split payments add only cash part to cash register', () => {
  const transactions: CashTransactionItem[] = [
    {
      transaction_type: 'split_payment',
      amount: 1000,
      cash_amount: 400,
      card_amount: 600,
    },
  ];

  const summary = calculateShiftTotals(200, true, transactions);

  // Expected Cash = 200 + 400 = 600
  assert.equal(summary.expectedCash, 600);
  assert.equal(summary.totalCashSales, 400);
  assert.equal(summary.totalCardSales, 600);
  assert.equal(summary.totalRevenue, 1000);
});

test('Shift calculations: Starting cash unknown prevents false assumptions', () => {
  const transactions: CashTransactionItem[] = [
    { transaction_type: 'cash_sale', amount: 300 },
  ];

  const summary = calculateShiftTotals(0, false, transactions);
  assert.equal(summary.startingCashKnown, false);

  const countResult = evaluateCashCount(500, summary.expectedCash, false);
  assert.equal(countResult.status, 'indeterminate');
});

test('Evaluate Cash Count: Surplus and Deficit detection', () => {
  // Expected 1000, counted 1050 -> 50 surplus
  const surplus = evaluateCashCount(1050, 1000, true);
  assert.equal(surplus.status, 'surplus');
  assert.equal(surplus.difference, 50);

  // Expected 1000, counted 950 -> 50 deficit
  const deficit = evaluateCashCount(950, 1000, true);
  assert.equal(deficit.status, 'deficit');
  assert.equal(deficit.difference, -50);

  // Expected 1000, counted 1000 -> exact
  const exact = evaluateCashCount(1000, 1000, true);
  assert.equal(exact.status, 'exact');
  assert.equal(exact.difference, 0);
});

test('Net Cash Sale: 500 TL received - 125 TL change = 375 TL net cash', () => {
  const result = calculateNetCashSale(500, 125);
  assert.equal(result.isValid, true);
  assert.equal(result.netCash, 375);

  // If change >= received, it should be marked invalid
  const invalid = calculateNetCashSale(100, 120);
  assert.equal(invalid.isValid, false);
});

test('Split Payment: 600 TL received - 200 TL change = 400 TL cash + 500 TL card = 900 TL total', () => {
  const result = calculateSplitPayment(600, 500, 200);
  assert.equal(result.isValid, true);
  assert.equal(result.netCash, 400);
  assert.equal(result.cardAmount, 500);
  assert.equal(result.totalSale, 900);
});

test('Card Sale Isolation: 1000 TL card sale does not alter cash drawer', () => {
  const transactions: CashTransactionItem[] = [
    { transaction_type: 'card_sale', amount: 1000 },
  ];
  const summary = calculateShiftTotals(500, true, transactions);
  assert.equal(summary.startingCash, 500);
  assert.equal(summary.expectedCash, 500); // completely untouched
  assert.equal(summary.totalCashSales, 0);
  assert.equal(summary.totalCardSales, 1000);
  assert.equal(summary.totalRevenue, 1000);
});

