// Run from a consumer project after installing this package. No credentials in Git.
import fs from 'node:fs';
import path from 'node:path';
import makeWASocket, { Browsers, DisconnectReason, generateWAMessage, proto, useMultiFileAuthState } from '@workflo/relaywa-baileys';
import pino from 'pino';
import { createOutboundMessages, createConfirmedSender, outboundMessageId, verifiedInboundIdentity } from '@workflo/relaywa-baileys/runtime/index.mjs';

const directory = path.resolve(process.env.SESSION_DIR || './private-session');
fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
const logger = pino({ level: 'warn' });
const store = createOutboundMessages({
  file: path.join(directory, 'outbound.json'),
  encode: message => proto.Message.encode(message).finish(),
  decode: bytes => proto.Message.decode(bytes),
  onError: () => { throw new Error('Retry storage unavailable; repair storage before sending'); },
});
let socket, reconnectTimer, stopping = false, starting = false;
const sender = createConfirmedSender({
  store,
  // Integrate your application's permission, consent and rate-limit checks here.
  // This example sends nothing automatically; the default prevents any outbound send.
  authorize: async () => { throw new Error('Configure application send authorization first'); },
  prepare: (jid, payload, id) => generateWAMessage(jid, payload, { userJid: socket.user.id, messageId: id, logger }),
  relay: (jid, message, id) => socket.relayMessage(jid, message, { messageId: id }),
});
async function connect() {
  if (stopping || starting) return;
  starting = true;
  try {
    const { state, saveCreds } = await useMultiFileAuthState(directory);
    const current = makeWASocket({
      auth: state, logger, browser: Browsers.macOS('Google Chrome'),
      printQRInTerminal: false, syncFullHistory: false, markOnlineOnConnect: false,
      // In production also recheck automation authorization before protocol retries.
      getMessage: async () => undefined, // fail closed until authorization is integrated
    });
    socket = current;
    current.ev.on('creds.update', saveCreds);
    current.ev.on('messages.update', updates => {
      for (const { key, update } of updates) sender.receipt(key, update.status, update.messageStubParameters?.[0]);
    });
    current.ws.on('CB:ack,class:message', ({ attrs }) => sender.receipt({ id: attrs.id, fromMe: true }, attrs.error ? 0 : 2, attrs.error));
    current.ev.on('messages.upsert', async ({ messages }) => {
      for (const message of messages) {
        if (message.key.fromMe) continue;
        const identity = await verifiedInboundIdentity(message.key, current.signalRepository?.lidMapping);
        // Pass identity + message to your app; never infer a phone from a LID/username.
        if (identity) console.log('Inbound direct message received');
      }
    });
    current.ev.on('connection.update', update => {
      if (socket !== current || stopping) return;
      if (update.qr) console.log('Pairing required: render update.qr in a private operator UI.');
      if (update.connection !== 'close') return;
      const reason = update.lastDisconnect?.error?.output?.statusCode;
      if (reason === DisconnectReason.loggedOut) {
        stopping = true;
        console.error('Linked device logged out. Operator relink required; auth files retained.');
        return;
      }
      if (!reconnectTimer) reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        void connect().catch(error => { console.error(error.message); process.exitCode = 1; });
      }, reason === DisconnectReason.restartRequired ? 1000 : 3000 + Math.floor(Math.random() * 1000));
    });
  } finally { starting = false; }
}
// After integrating authorization, use a stable operation ID across retries:
// await sender.send(jid, { text: 'Your requested message' }, outboundMessageId('tenant-id', 'operation-id'));
// For getMessage: authorize first, then return store.get(key), not an empty placeholder.
process.once('SIGINT', stop);
process.once('SIGTERM', stop);
function stop() {
  stopping = true;
  clearTimeout(reconnectTimer);
  socket?.end(undefined); // Do not logout/unlink when stopping a process.
}
await connect();
