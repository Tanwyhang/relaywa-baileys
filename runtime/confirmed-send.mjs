import { createHash } from 'node:crypto';

// A transport retry must retain the identity of the original voucher image.
export function outboundMessageId(scope, operation) {
  return '3EB0' + createHash('sha256').update(`${scope}\n${operation}`).digest('hex').slice(0, 18).toUpperCase();
}

export function createConfirmedSender({store, authorize, prepare, relay, timeoutMs = 12000, onReceipt = () => {}}) {
  const flights = new Map(), waiting = new Map();
  function receipt(key, status, errorCode) {
    if (!key?.id || key.fromMe === false || !Number.isInteger(status) || status < 0 || status > 5 || status === 1) return;
    store.update(key, status, errorCode);
    const saved = store.record(key);
    if (!saved) return;
    onReceipt({id:key.id, status:saved.status, errorCode:saved.errorCode});
    const waiter = waiting.get(key.id);
    if (!waiter) return;
    if (saved.status === 0) waiter.reject(new Error(`WhatsApp rejected the message${saved.errorCode ? ` (${saved.errorCode})` : ''}. Delivery will retry.`));
    else if (saved.status >= 2) waiter.resolve();
  }
  async function perform(chatId, payload, messageId) {
    await authorize();
    let saved = store.record({id:messageId});
    if (saved?.remoteJid && saved.remoteJid !== chatId) throw new Error('Outbound message recipient mismatch');
    if (saved?.status >= 2) return {key:{id:messageId, remoteJid:chatId, fromMe:true}, status:saved.status};
    let message = store.get({id:messageId, fromMe:true});
    if (!message) {
      const generated = await prepare(chatId, payload, messageId);
      if (generated?.key?.id !== messageId || !generated.message) throw new Error('WhatsApp message preparation failed');
      // Persist before relay: a fast retry request can arrive during transmission.
      if (!store.put(generated)) throw new Error('WhatsApp retry message could not be saved');
      message = generated.message;
    }
    await authorize();
    let timer;
    const confirmed = new Promise((resolve, reject) => {
      waiting.set(messageId, {resolve, reject});
      timer = setTimeout(() => reject(new Error('WhatsApp has not acknowledged this message. Delivery will retry.')), timeoutMs);
    });
    // A socket error may precede relay completion. Keep that rejection handled.
    void confirmed.catch(() => {});
    try {
      await relay(chatId, message, messageId);
      await confirmed;
      return {key:{id:messageId, remoteJid:chatId, fromMe:true}, status:store.record({id:messageId})?.status};
    } finally {clearTimeout(timer);waiting.delete(messageId);}
  }
  return {
    receipt,
    send(chatId, payload, messageId) {
      const existing = flights.get(messageId);
      if (existing) {
        if (existing.chatId !== chatId) return Promise.reject(new Error('Outbound message recipient mismatch'));
        return existing.promise;
      }
      const promise = perform(chatId, payload, messageId).finally(() => flights.delete(messageId));
      flights.set(messageId, {chatId, promise});return promise;
    },
  };
}
