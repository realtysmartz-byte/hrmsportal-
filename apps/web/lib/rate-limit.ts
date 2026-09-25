/**
 * In-memory rate limiter for authentication endpoints.
 * Tracks failed attempts per identifier (e.g., lowercase email).
 * Limit: 5 failed attempts within 15 minutes leads to lockout for 15 minutes.
 */

interface AttemptRecord {
  count: number;
  firstAttemptAt: number;
  lockedUntil: number | null;
}

const MAX_FAILED_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const LOCKOUT_MS = 15 * 60 * 1000; // 15 minutes lockout

const attempts = new Map<string, AttemptRecord>();

// Periodic cleanup of stale records every 10 minutes
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    for (const [key, record] of attempts.entries()) {
      if (
        record.lockedUntil && record.lockedUntil < now &&
        now - record.firstAttemptAt > WINDOW_MS
      ) {
        attempts.delete(key);
      } else if (!record.lockedUntil && now - record.firstAttemptAt > WINDOW_MS) {
        attempts.delete(key);
      }
    }
  }, 10 * 60 * 1000).unref?.();
}

export function checkRateLimit(identifier: string): {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
} {
  const key = identifier.toLowerCase().trim();
  const record = attempts.get(key);
  const now = Date.now();

  if (!record) {
    return { allowed: true, remaining: MAX_FAILED_ATTEMPTS, retryAfterSeconds: 0 };
  }

  // Check if locked out
  if (record.lockedUntil) {
    if (now < record.lockedUntil) {
      const retryAfterSeconds = Math.ceil((record.lockedUntil - now) / 1000);
      return { allowed: false, remaining: 0, retryAfterSeconds };
    }
    // Lockout expired, reset record
    attempts.delete(key);
    return { allowed: true, remaining: MAX_FAILED_ATTEMPTS, retryAfterSeconds: 0 };
  }

  // Check if window expired
  if (now - record.firstAttemptAt > WINDOW_MS) {
    attempts.delete(key);
    return { allowed: true, remaining: MAX_FAILED_ATTEMPTS, retryAfterSeconds: 0 };
  }

  const remaining = Math.max(0, MAX_FAILED_ATTEMPTS - record.count);
  return { allowed: remaining > 0, remaining, retryAfterSeconds: 0 };
}

export function recordFailedAttempt(identifier: string): {
  locked: boolean;
  remaining: number;
  retryAfterSeconds: number;
} {
  const key = identifier.toLowerCase().trim();
  const now = Date.now();
  const record = attempts.get(key);

  if (!record || now - record.firstAttemptAt > WINDOW_MS) {
    attempts.set(key, {
      count: 1,
      firstAttemptAt: now,
      lockedUntil: null,
    });
    return { locked: false, remaining: MAX_FAILED_ATTEMPTS - 1, retryAfterSeconds: 0 };
  }

  record.count += 1;

  if (record.count >= MAX_FAILED_ATTEMPTS) {
    record.lockedUntil = now + LOCKOUT_MS;
    const retryAfterSeconds = Math.ceil(LOCKOUT_MS / 1000);
    return { locked: true, remaining: 0, retryAfterSeconds };
  }

  const remaining = MAX_FAILED_ATTEMPTS - record.count;
  return { locked: false, remaining, retryAfterSeconds: 0 };
}

export function resetRateLimit(identifier: string): void {
  const key = identifier.toLowerCase().trim();
  attempts.delete(key);
}
