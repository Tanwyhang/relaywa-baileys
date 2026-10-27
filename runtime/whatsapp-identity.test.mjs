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
 assert.deepEqual(inboundWhatsAppIdentity({remoteJid:'123456789012345@lid',remoteJidAlt:'60123456789@s.whatsapp.net'}),{senderId:'60123456789@s.whatsapp.net',chatId:'123456789012345@lid',verifiedAlias:'123456789012345@lid'});
 assert.equal(inboundWhatsAppIdentity({remoteJid:'60123456789@s.whatsapp.net',remoteJidAlt:'60199999999@s.whatsapp.net'}).verifiedAlias,undefined);
 assert.equal(inboundWhatsAppIdentity({remoteJid:'123@g.us'}),null);
 assert.ok(isUnsubscribe('STOP'));assert.ok(!isUnsubscribe('do not STOP here'));
});

test('reconnect reads only verified stored LID mapping and retains original route',async()=>{
 const key={remoteJid:'123456789012345@lid'};
 const known=await verifiedInboundIdentity(key,{getPNForLID:async jid=>{assert.equal(jid,key.remoteJid);return '60123456789@s.whatsapp.net';}});
 assert.equal(known.senderId,'60123456789@s.whatsapp.net');assert.equal(known.verifiedAlias,key.remoteJid);assert.equal(known.chatId,key.remoteJid);
 assert.equal((await verifiedInboundIdentity(key,{getPNForLID:async()=>null})).verifiedAlias,undefined);
 assert.equal((await verifiedInboundIdentity(key,{getPNForLID:async()=>key.remoteJid})).verifiedAlias,undefined);
});

test('phone-first identity and original route remain independent in both directions',async()=>{
 const pn='60123456789@s.whatsapp.net',lid='123456789012345@lid';
 assert.deepEqual(inboundWhatsAppIdentity({remoteJid:pn,remoteJidAlt:lid}),{senderId:pn,chatId:pn,verifiedAlias:lid});
 assert.deepEqual(inboundWhatsAppIdentity({remoteJid:lid}),{senderId:lid,chatId:lid});
 assert.deepEqual(await verifiedInboundIdentity({remoteJid:lid},{getPNForLID:async()=>pn}),{senderId:pn,chatId:lid,verifiedAlias:lid});
 assert.equal((await verifiedInboundIdentity({remoteJid:pn},{getPNForLID:()=>{throw Error('should not query')}})).senderId,pn);
});
