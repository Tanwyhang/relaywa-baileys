# Integration and session preservation

## Required wiring

1. Use one durable, private auth directory and one retry-store file per tenant.
   Run exactly one process per session; shared-file multi-process access is unsupported.
   Multi-file auth matches the existing deployment; a distributed service needs its own
   transactional auth/key adapter.
2. Persist `creds.update` through `saveCreds`. Never clear auth or call `logout()` on
   restart. Stop/fence the old process before reusing an existing session directory.
3. Create `createOutboundMessages` with `proto.Message.encode(m).finish()` and
   `proto.Message.decode(bytes)`. Protect storage and encrypted backups like credentials.
4. Configure socket `getMessage` to check current send authorization and return
   `store.get(key)`. Return undefined when absent or unauthorized; never fabricate a
   placeholder protocol message. The sample defaults to undefined until wired.
5. Create `createConfirmedSender` with your `authorize` callback,
   `generateWAMessage(jid, payload, { userJid, messageId, logger })` as prepare, and
   `socket.relayMessage(jid, message, { messageId })` as relay. Authorization must check
   current tenant permissions, consent, kill switch and rate limits, including retries.
6. Forward `messages.update` status and `CB:ack,class:message` acknowledgement events
   to `sender.receipt`, as in the example. Accepted by server does not mean delivered
   to the handset. Keep delivery receipts separate from business ownership/status.
7. Send through `sender.send(jid, payload, outboundMessageId(tenantId, operationId))`.
   Persist the business operation ID and reuse it after timeouts. Never reuse an ID
   for different content. Handle timeouts as pending/retry, not proof of no send.
8. Use `verifiedInboundIdentity(message.key, socket.signalRepository?.lidMapping)`.
   Reply to the original JID. Identity mapping is provider evidence, not a username
   lookup API; a display name does not establish phone ownership.
9. Reconnect on transient disconnects with backoff; restart-required gets a fresh
   socket. Logged-out requires operator relinking. Do not repeatedly auto-pair.

## Before migrating another project

- Pin this release and preserve your existing auth/key-store schema.
- Snapshot auth and spool while the old worker is stopped; never clone a live session.
- Integrate your outbox, storage failure handling and authorization before enabling send.
- Test pairing with a dedicated account, restart persistence, reconnect, inbound LID,
  requested text/image delivery, acknowledgement timeout and same-ID retry.
- Verify on a real handset. Offline tests cannot prove a new account/session works.
- Roll back code with compatible state if needed; do not unlink the working device.

## Guarantees and boundaries

Retry records are bounded to 500 entries / 8 MiB / 24 hours by default. Deduplication
is bounded by retention and one worker; this is not unlimited exactly-once delivery.
An expired record can no longer protect against a new application retry. The app's
outbox must enforce its own durable terminal state and retention policy.

Full hosted gateway, pairing UI, deployment volume encryption, spool recovery,
webhook authentication and business compliance are not supplied by this library.
Do not remove those controls when replacing a transport dependency.
