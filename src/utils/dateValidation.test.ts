import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isFutureDate,
  isPastDate,
  getExpirationCategory,
  isPasswordAuthValid,
  formatTurkishDate,
  getTodayDateString,
} from './dateValidation';

test('Date validation: Future dates correctly blocked', () => {
  const today = getTodayDateString();
  const [year, month, day] = today.split('-').map(Number);
  const futureDate = `${year + 1}-01-01`;
  const pastDate = `${year - 1}-01-01`;

  assert.equal(isFutureDate(futureDate), true);
  assert.equal(isFutureDate(pastDate), false);
  assert.equal(isFutureDate(today), false);

  assert.equal(isPastDate(pastDate), true);
  assert.equal(isPastDate(today), false);
  assert.equal(isPastDate(futureDate), false);
});

test('Format Turkish Date: YYYY-MM-DD converts to DD.MM.YYYY', () => {
  assert.equal(formatTurkishDate('2026-11-02'), '02.11.2026');
  assert.equal(formatTurkishDate('2025-05-18'), '18.05.2025');
});

test('SKT Expiration status categorization', () => {
  const today = getTodayDateString();
  const todayCategory = getExpirationCategory(today);
  assert.equal(todayCategory.category, 'critical');
  assert.equal(todayCategory.daysRemaining, 0);

  // Expired in past
  const pastExpired = getExpirationCategory('2020-01-01');
  assert.equal(pastExpired.category, 'expired');
  assert.ok(pastExpired.daysRemaining < 0);

  // Far future
  const farFuture = getExpirationCategory('2099-01-01');
  assert.equal(farFuture.category, 'normal');
  assert.ok(farFuture.daysRemaining > 7);
});

test('Password Re-auth validity window', () => {
  const now = Date.now();
  // Just authed: valid
  assert.equal(isPasswordAuthValid(now), true);
  // 5 minutes ago: valid
  assert.equal(isPasswordAuthValid(now - 5 * 60 * 1000), true);
  // 20 minutes ago (exceeds 15 min): expired
  assert.equal(isPasswordAuthValid(now - 20 * 60 * 1000), false);
  // Null auth: invalid
  assert.equal(isPasswordAuthValid(null), false);
});
