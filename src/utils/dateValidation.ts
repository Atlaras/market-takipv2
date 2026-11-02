/**
 * Date and security validation utilities for ŞOK Kişisel Takip
 * Europe/Istanbul timezone rules & permission guards
 */

/**
 * Returns current date string in Europe/Istanbul timezone as YYYY-MM-DD
 */
export function getTodayDateString(): string {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Istanbul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(now);
}

/**
 * Returns current time string in Europe/Istanbul as HH:mm:ss
 */
export function getCurrentTimeString(): string {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('tr-TR', {
    timeZone: 'Europe/Istanbul',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  return formatter.format(now);
}

/**
 * Validates whether a date is in the future relative to Europe/Istanbul today.
 * Returns true if dateStr > todayStr
 */
export function isFutureDate(dateStr: string): boolean {
  if (!dateStr) return false;
  const today = getTodayDateString();
  return dateStr > today;
}

/**
 * Checks whether a date is in the past relative to Europe/Istanbul today.
 * Returns true if dateStr < todayStr
 */
export function isPastDate(dateStr: string): boolean {
  if (!dateStr) return false;
  const today = getTodayDateString();
  return dateStr < today;
}

/**
 * Formats YYYY-MM-DD date to Turkish DD.MM.YYYY
 */
export function formatTurkishDate(dateStr: string): string {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    return `${parts[2]}.${parts[1]}.${parts[0]}`;
  }
  return dateStr;
}

/**
 * Calculates remaining days until expiration (SKT)
 * Positive number = days until expiration
 * Negative number = days past expiration
 */
export function getDaysUntilExpiration(expirationDateStr: string): number {
  if (!expirationDateStr) return 0;
  const todayStr = getTodayDateString();
  const todayMs = new Date(todayStr + 'T00:00:00').getTime();
  const expMs = new Date(expirationDateStr + 'T00:00:00').getTime();
  const diffDays = Math.round((expMs - todayMs) / (1000 * 60 * 60 * 24));
  return diffDays;
}

export type ExpirationStatusCategory = 'expired' | 'critical' | 'warning' | 'normal';

export function getExpirationCategory(expirationDateStr: string): {
  category: ExpirationStatusCategory;
  daysRemaining: number;
  label: string;
} {
  const days = getDaysUntilExpiration(expirationDateStr);
  if (days < 0) {
    return {
      category: 'expired',
      daysRemaining: days,
      label: `${Math.abs(days)} gün geçti`,
    };
  } else if (days === 0) {
    return {
      category: 'critical',
      daysRemaining: 0,
      label: 'Bugün doluyor',
    };
  } else if (days <= 3) {
    return {
      category: 'critical',
      daysRemaining: days,
      label: `${days} gün kaldı`,
    };
  } else if (days <= 7) {
    return {
      category: 'warning',
      daysRemaining: days,
      label: `${days} gün kaldı`,
    };
  } else {
    return {
      category: 'normal',
      daysRemaining: days,
      label: `${days} gün kaldı`,
    };
  }
}

/**
 * Checks if password re-authentication is still valid (e.g. 15 minutes window)
 */
export function isPasswordAuthValid(lastAuthTimestamp: number | null, maxAgeMinutes: number = 15): boolean {
  if (!lastAuthTimestamp) return false;
  const now = Date.now();
  const ageMs = now - lastAuthTimestamp;
  return ageMs < maxAgeMinutes * 60 * 1000;
}
