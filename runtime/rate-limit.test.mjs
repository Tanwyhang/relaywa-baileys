import assert from "node:assert/strict";
import test from "node:test";

import {
  boundedRateLimit,
  createSlidingWindowRateLimiter,
} from "./rate-limit.mjs";

test("sliding-window limits are isolated by sender and recover after the window", () => {
  const limiter = createSlidingWindowRateLimiter({ limit: 2, windowMs: 60_000 });
  assert.equal(limiter.record("sender-a", 1_000), true);
  assert.equal(limiter.record("sender-a", 2_000), true);
  assert.equal(limiter.record("sender-a", 3_000), false);
  assert.equal(limiter.record("sender-b", 3_000), true);
  assert.equal(limiter.retryAfterSeconds("sender-a", 3_000), 58);
  assert.equal(limiter.record("sender-a", 61_001), true);
});

test("rate-limit configuration remains inside production-safe bounds", () => {
  assert.equal(boundedRateLimit(undefined, 6, 1, 120), 6);
  assert.equal(boundedRateLimit("0", 6, 1, 120), 1);
  assert.equal(boundedRateLimit("999", 6, 1, 120), 120);
});
