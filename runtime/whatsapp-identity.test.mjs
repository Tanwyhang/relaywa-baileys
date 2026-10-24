import test from 'node:test';
import assert from 'node:assert/strict';
import {parseWhatsAppIdentity,recipientJid,inboundWhatsAppIdentity,isUnsubscribe,verifiedInboundIdentity} from './whatsapp-identity.mjs';
test('phone, device-qualified phone and LID remain different namespaces',()=>{
 assert.deepEqual(parseWhatsAppIdentity('60123456789:12@s.whatsapp.net'),{namespace:'phone',jid:'60123456789@s.whatsapp.net',phone:'+60123456789'});
 assert.equal(parseWhatsAppIdentity('123456789012345@lid').phone,null);
 assert.equal(recipientJid('123456789012345@lid'),'123456789012345@lid');
 assert.equal(recipientJid('+60123456789'),'60123456789@s.whatsapp.net');
 for(const bad of ['@username','username','123@g.us','123456789012345@evil','wa:uuid','0@s.whatsapp.net']) assert.equal(parseWhatsAppIdentity(bad),null);
});
test('preserves original route and only a different namespace can be a provider alias',()=>{
 assert.deepEqual(inboundWhatsAppIdentity({remoteJid:'123456789012345@lid',remoteJidAlt:'60123456789@s.whatsapp.net'}),{senderId:'123456789012345@lid',chatId:'123456789012345@lid',verifiedAlias:'60123456789@s.whatsapp.net'});
 assert.equal(inboundWhatsAppIdentity({remoteJid:'60123456789@s.whatsapp.net',remoteJidAlt:'60199999999@s.whatsapp.net'}).verifiedAlias,undefined);
 assert.equal(inboundWhatsAppIdentity({remoteJid:'123@g.us'}),null);
 assert.ok(isUnsubscribe('STOP'));assert.ok(!isUnsubscribe('do not STOP here'));
});

test('reconnect reads only verified stored LID mapping and retains original route',async()=>{
 const key={remoteJid:'123456789012345@lid'};
 const known=await verifiedInboundIdentity(key,{getPNForLID:async jid=>{assert.equal(jid,key.remoteJid);return '60123456789@s.whatsapp.net';}});
 assert.equal(known.verifiedAlias,'60123456789@s.whatsapp.net');assert.equal(known.chatId,key.remoteJid);
 assert.equal((await verifiedInboundIdentity(key,{getPNForLID:async()=>null})).verifiedAlias,undefined);
 assert.equal((await verifiedInboundIdentity(key,{getPNForLID:async()=>key.remoteJid})).verifiedAlias,undefined);
});
