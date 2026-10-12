/**
 * Simple in-process IP-based rate limiter for serverless API routes.
 * Limits: 10 attempts per 15-minute window per IP.
 * Lockout: 30-minute lockout after exceeding attempts.
 */

interface RateLimitEntry {
  count: number;
  windowStart: number;
  lockedUntil?: number;
}

const WINDOW_MS = 15 * 60 * 1000;   // 15 minutes
const MAX_ATTEMPTS = 10;            // max attempts per window
const LOCKOUT_MS = 30 * 60 * 1000;  // 30-minute lockout
const MAX_STORE_SIZE = 5000;        // bound memory

const store = new Map<string, RateLimitEntry>();

function pruneExpired(): void {
  if (store.size < MAX_STORE_SIZE) return;
  const now = Date.now();
  for (const [key, entry] of store) {
    if (
      now > (entry.lockedUntil ?? 0) &&
      now - entry.windowStart > WINDOW_MS
    ) {
      store.delete(key);
      if (store.size < MAX_STORE_SIZE * 0.8) break;
    }
  }
}

export interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds?: number;
  attemptsRemaining?: number;
}

export function checkRateLimit(ip: string): RateLimitResult {
  pruneExpired();
  const now = Date.now();
  const entry = store.get(ip);

  // Locked out
  if (entry?.lockedUntil && now < entry.lockedUntil) {
    return {
      allowed: false,
      retryAfterSeconds: Math.ceil((entry.lockedUntil - now) / 1000),
    };
  }

  if (!entry || now - entry.windowStart > WINDOW_MS) {
    // Fresh window
    store.set(ip, { count: 1, windowStart: now });
    return { allowed: true, attemptsRemaining: MAX_ATTEMPTS - 1 };
  }

  entry.count++;

  if (entry.count > MAX_ATTEMPTS) {
    entry.lockedUntil = now + LOCKOUT_MS;
    return {
      allowed: false,
      retryAfterSeconds: Math.ceil(LOCKOUT_MS / 1000),
    };
  }

  return { allowed: true, attemptsRemaining: MAX_ATTEMPTS - entry.count };
}

/** Call on successful login to reset the counter for this IP. */
export function resetRateLimit(ip: string): void {
  store.delete(ip);
}
