/** @typedef {{namespace:'phone',jid:string,phone:string}|{namespace:'lid',jid:string,phone:null}} WhatsAppIdentity */
/** JID namespaces are protocol data. Never turn a LID or username into a phone.
 * @param {unknown} value
 * @returns {WhatsAppIdentity|null}
 */
export function parseWhatsAppIdentity(value) {
  if (typeof value !== 'string') return null;
  const jid = value.trim();
  const match = /^([1-9][0-9]{6,19})(?::[0-9]+)?@(s\.whatsapp\.net|lid)$/.exec(jid);
  if (match) {
    if (match[2] === 's.whatsapp.net' && !/^[1-9][0-9]{7,14}$/.test(match[1])) return null;
    return { namespace: match[2] === 'lid' ? 'lid' : 'phone', jid: `${match[1]}@${match[2]}`, phone: match[2] === 'lid' ? null : `+${match[1]}` };
  }
  // Legacy phone-only gateway payloads remain valid; qualified IDs never use this path.
  if (/^\+?[1-9][0-9]{7,14}$/.test(jid)) return parseWhatsAppIdentity(`${jid.replace(/^\+/, '')}@s.whatsapp.net`);
  return null;
}
export function recipientJid(value) { return parseWhatsAppIdentity(value)?.jid || null; }
export function inboundWhatsAppIdentity(key) {
  const original = parseWhatsAppIdentity(key?.remoteJid);
  if (!original) return null;
  const alternate = parseWhatsAppIdentity(key.remoteJidAlt);
  return { senderId: original.jid, chatId: original.jid,
    // The alternate is supplied by the authenticated provider message key only.
    ...(alternate && alternate.namespace !== original.namespace ? { verifiedAlias: alternate.jid } : {}) };
}
export function isUnsubscribe(text) { return /^(stop|unsubscribe|cancel|end|quit)[.!]?$/i.test(String(text || '').trim()); }

/** Read only the provider's authenticated, persisted mapping. Never infer from digits. */
export async function verifiedInboundIdentity(key, mapping) {
  const identity = inboundWhatsAppIdentity(key);
  if (!identity || identity.verifiedAlias || !identity.senderId.endsWith('@lid') || !mapping?.getPNForLID) return identity;
  const known = parseWhatsAppIdentity(await mapping.getPNForLID(identity.senderId));
  return known?.namespace === 'phone' ? {...identity, verifiedAlias: known.jid} : identity;
}
