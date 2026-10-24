export function boundedRateLimit(value, fallback, minimum = 1, maximum = 10_000) {
  const parsed = Number.parseInt(String(value || ""), 10);
  return Number.isSafeInteger(parsed)
    ? Math.min(maximum, Math.max(minimum, parsed))
    : fallback;
}

export function createSlidingWindowRateLimiter({ limit, windowMs, maxKeys = 10_000 }) {
  if (!Number.isSafeInteger(limit) || limit < 1) throw new Error("rate limit must be positive");
  if (!Number.isSafeInteger(windowMs) || windowMs < 1) throw new Error("rate window must be positive");

  const buckets = new Map();

  function activeEvents(key, now) {
    const cutoff = now - windowMs;
    const active = (buckets.get(key) || []).filter((timestamp) => timestamp > cutoff);
    if (active.length) buckets.set(key, active);
    else buckets.delete(key);
    return active;
  }

  function canConsume(key, now = Date.now()) {
    return activeEvents(String(key), now).length < limit;
  }

  function record(key, now = Date.now()) {
    const normalizedKey = String(key);
    const active = activeEvents(normalizedKey, now);
    if (active.length >= limit) return false;
    if (!buckets.has(normalizedKey) && buckets.size >= maxKeys) {
      buckets.delete(buckets.keys().next().value);
    }
    buckets.set(normalizedKey, [...active, now]);
    return true;
  }

  function retryAfterSeconds(key, now = Date.now()) {
    const active = activeEvents(String(key), now);
    if (active.length < limit) return 0;
    return Math.max(1, Math.ceil((active[0] + windowMs - now) / 1_000));
  }

  return { canConsume, record, retryAfterSeconds };
}
