# RelayWA Baileys provenance

This package is Workflo's reusable, runtime-only Baileys compatibility build for RelayWA.

## Upstream

- Repository: `https://github.com/WhiskeySockets/Baileys`
- Upstream base commit: `0af2386`
- Upstream package version: `7.0.0-rc14`
- License: MIT; the upstream copyright and license are retained in `LICENSE`.

## Applied compatibility changes

The release was produced by applying these upstream pull requests to the base in order:

1. `#2608` at `bd97f0b`
2. `#2749` at `3868667`
3. `#2765` at `4f263f0`

Together they acknowledge notifications before login, tolerate empty link-code notices, and refresh the advertised companion secret when WhatsApp requests a new QR.

The original tested npm artifact is retained at:

`services/pi-whatsapp-containers/cell/pi-runtime/vendor/baileys-relaywa-canary-46e0785.tgz`

Artifact SHA-256:

`97d72132ecbc616f0963b460f49ba19fe46bf3d5db3dd37f7177c8d5256144c6`

## Scope

This directory contains the compiled runtime package used by RelayWA. It does not include Workflo UI, AI inference, approval queues, customer data, credentials, or deployment configuration.

This is an unofficial WhatsApp Web integration and is not affiliated with or supported by WhatsApp or Meta.

## ReVisit helper extraction — 2026-10-24

Release relaywa.2 adds unchanged helper modules from
https://github.com/Tanwyhang/eventflo-games/tree/586cb7d/services/whatsapp-containers/cell .
The exact file checksums, including regression tests, are recorded in runtime/SOURCE.json.
All 397 lib/ and WAProto/ files were compared byte-for-byte with the original archive;
none changed. The source gateway's auth persistence, reconnect and receipt wiring is
shown in the integration example without exporting application callbacks or secrets.
