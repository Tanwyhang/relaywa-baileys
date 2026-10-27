# Runtime helpers

These helpers are extracted unchanged from ReVisit, not a second implementation.

| Export | Purpose |
| --- | --- |
| `createOutboundMessages({file, encode, decode, ...limits})` | Private durable retry payload/receipt store |
| `createConfirmedSender({store, authorize, prepare, relay, timeoutMs, onReceipt})` | Persist-before-send with acknowledgement confirmation |
| `outboundMessageId(scope, operation)` | Stable provider ID for one business operation |
| `verifiedInboundIdentity(key, mapping)` | Preserve original JID with authenticated alternate mapping |
| `parseWhatsAppIdentity(value)` / `recipientJid(value)` | Phone/LID parsing without guessing a phone |
| `inboundWhatsAppIdentity(key)` | Provider key identity and alternate namespace |
| `isUnsubscribe(text)` | Exact stop/unsubscribe keyword detection |
| `createSlidingWindowRateLimiter(options)` | Bounded per-key rate limiter |
| `boundedRateLimit(value, fallback, minimum, maximum)` | Safe rate-limit configuration |

See the source for exact option defaults and method signatures. Baileys itself
retains its existing TypeScript declarations; helper modules use native ESM.

Do not pass untrusted provider acknowledgement events to `receipt`. Persisted
retry data includes media encryption keys and must not be logged or committed.

Verified phone first: `senderId` prefers a provider-verified phone JID, with LID fallback. `chatId` always preserves the original inbound route, including LID, for stable replies. `verifiedAlias` contains the other namespace. Persist customer ownership under a stable internal key; learning a phone must not reset quotas or duplicate histories.
