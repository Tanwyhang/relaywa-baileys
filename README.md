# Workflo WhatsApp engine

Reusable private Baileys transport plus the delivery and identity fixes used by ReVisit.

**Repository:** https://github.com/Tanwyhang/relaywa-baileys

## Install internally

Requires Node.js 22.19 or newer and GitHub access to this private repository.

```sh
npm install @workflo/relaywa-baileys@github:Tanwyhang/relaywa-baileys#v7.0.0-relaywa.2
```

```js
import makeWASocket, { useMultiFileAuthState } from '@workflo/relaywa-baileys';
import { createConfirmedSender, createOutboundMessages, outboundMessageId,
  verifiedInboundIdentity } from '@workflo/relaywa-baileys/runtime/index.mjs';
```

To retain existing Baileys import names in another project, install under an alias:

```sh
npm install @whiskeysockets/baileys@github:Tanwyhang/relaywa-baileys#v7.0.0-relaywa.2
```

Then keep `import ... from '@whiskeysockets/baileys'`; helpers are at
`@whiskeysockets/baileys/runtime/index.mjs`. Commit your consumer lockfile.
Private CI must authenticate GitHub without embedding a token in package.json.

## Included fixes

- Pinned QR/login compatibility patches: early notification acknowledgement,
  empty link-code notices, refreshed companion secret for new pairing QR.
- Original outbound protocol message persisted before relay, including image keys,
  so a restart/retry can resend the same message instead of a blank substitute.
- Stable operation IDs, concurrent-send deduplication, and server acknowledgement
  confirmation; local socket submission alone is not reported as delivery.
- Phone and LID namespaces preserved. Only authenticated provider mappings establish
  aliases; usernames and LID digits are never guessed into phone numbers.
- Bounded retry storage, expiry and rate-limit helpers.

The 397 compiled Baileys/WAProto runtime files are byte-for-byte identical to the
artifact currently pinned by ReVisit. Application helper files and tests are copied
unchanged, with hashes in [runtime/SOURCE.json](runtime/SOURCE.json).

## Integrate

See [the session example](examples/session.mjs) and [integration guide](docs/INTEGRATION.md).
The example reconnects without unlinking and deliberately sends nothing until you
supply application authorization. It is a starting point, not a hosted gateway.

Voucher logic, CRM, AI, tenant provisioning, consent policy, signed-media validation,
HTTP authentication and business outboxes remain in the consuming application.

## Verify

```sh
npm ci
npm run check
npm test
npm pack
```

The tests are offline and never pair a device or send a WhatsApp message.
ReVisit's production deployment is not changed by this export.

## Releases

Install the immutable Git tag above. This package is **not published to npm**.
Its manifest is ready for restricted GitHub Packages publication when authorized;
no registry token is stored here. Do not publish a public package unintentionally.

See [provenance](RELAYWA_PROVENANCE.md), [upstream documentation](docs/UPSTREAM_README.md)
and [license](LICENSE). This is an unofficial integration, not a Meta/WhatsApp product.
