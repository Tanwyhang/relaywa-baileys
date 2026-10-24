import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createOutboundMessages} from './outbound-messages.mjs';
import {createConfirmedSender,outboundMessageId} from './confirmed-send.mjs';

function fixture(t, overrides={}) {
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'revisit-confirm-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  const config={file:path.join(dir,'messages.json'),encode:m=>Buffer.from(JSON.stringify(m)),decode:b=>JSON.parse(b.toString())};
  const store=createOutboundMessages(config);let prepares=0, relays=0;
  const options={store,timeoutMs:20,authorize:async()=>{},prepare:async(jid,payload,id)=>{prepares++;return {key:{id,remoteJid:jid},message:payload,status:1};},relay:async()=>{relays++;},...overrides};
  return {store,config,options,counts:()=>({prepares,relays})};
}
test('a locally generated ID is not success; timeout preserves the original image for retry',async t=>{
  const f=fixture(t),sender=createConfirmedSender(f.options),id=outboundMessageId('merchant','image:one');
  await assert.rejects(sender.send('test@s.whatsapp.net',{imageMessage:{mediaKey:'same-key'}},id),/not acknowledged/);
  assert.equal(f.store.record({id}).status,1);assert.equal(f.store.get({id}).imageMessage.mediaKey,'same-key');
  const restored=createOutboundMessages(f.config);let retry;
  retry=createConfirmedSender({...f.options,store:restored,prepare:()=>assert.fail('must not re-render or re-upload'),relay:async(jid,message,messageId)=>{assert.equal(messageId,id);assert.equal(message.imageMessage.mediaKey,'same-key');retry.receipt({id},2);}});
  assert.equal((await retry.send('test@s.whatsapp.net',{},id)).status,2);
});
test('fast server acknowledgement is captured and duplicate/concurrent calls send once',async t=>{
  const f=fixture(t);let sender;
  sender=createConfirmedSender({...f.options,relay:async(jid,message,id)=>{assert.deepEqual(f.store.get({id}),message);await f.options.relay();sender.receipt({id},2);}});
  const id=outboundMessageId('merchant','image:two');
  await Promise.all(Array.from({length:10},()=>sender.send('test@s.whatsapp.net',{imageMessage:{caption:'Voucher'}},id)));
  await sender.send('test@s.whatsapp.net',{},id);
  assert.deepEqual(f.counts(),{prepares:1,relays:1});
});
test('WhatsApp rejection stays failed and carries its actual error code',async t=>{
  const f=fixture(t);let sender;sender=createConfirmedSender({...f.options,relay:async(_j,_m,id)=>sender.receipt({id},0,'479')});
  await assert.rejects(sender.send('test@s.whatsapp.net',{conversation:'test'},'reject'),/479/);
  assert.equal(f.store.record({id:'reject'}).status,0);assert.equal(f.store.metrics().outboundRejected,1);
  sender.receipt({id:'reject'},3);sender.receipt({id:'reject'},0,'479');
  assert.equal(f.store.record({id:'reject'}).status,3,'late error cannot undo confirmed device delivery');
});
test('pause, persistence failure and recipient mismatch cannot dispatch',async t=>{
  const f=fixture(t,{authorize:async()=>{throw new Error('paused');}}),sender=createConfirmedSender(f.options);
  await assert.rejects(sender.send('a@s.whatsapp.net',{},'pause'),/paused/);assert.deepEqual(f.counts(),{prepares:0,relays:0});
  const broken=createConfirmedSender({...f.options,authorize:async()=>{},store:{...f.store,put:()=>{throw new Error('disk full');}}});
  await assert.rejects(broken.send('a@s.whatsapp.net',{conversation:'test'},'disk'),/disk full/);assert.equal(f.counts().relays,0);
  f.store.put({key:{id:'bound',remoteJid:'a@s.whatsapp.net'},message:{conversation:'test'},status:2});
  const bound=createConfirmedSender({...f.options,authorize:async()=>{}});
  await assert.rejects(bound.send('b@s.whatsapp.net',{},'bound'),/recipient mismatch/);
});
test('voucher transport identity is stable, scoped and independent of image re-rendering',()=>{
  assert.equal(outboundMessageId('one','job'),outboundMessageId('one','job'));
  assert.notEqual(outboundMessageId('one','job'),outboundMessageId('two','job'));
  assert.notEqual(outboundMessageId('one','job'),outboundMessageId('one','other'));
});

test('hidden-phone image retry retains LID, media identity and truthful acknowledgement boundary',async t=>{
 const f=fixture(t),jid='123456789012345@lid',id=outboundMessageId('merchant','media:hidden');
 const first=createConfirmedSender(f.options);
 await assert.rejects(first.send(jid,{imageMessage:{mediaKey:'hidden-image'}},id),/not acknowledged/);
 assert.equal(f.store.record({id}).status,1);
 const store=createOutboundMessages(f.config);let retry;
 retry=createConfirmedSender({...f.options,store,prepare:()=>assert.fail('image must be recovered'),relay:async(to,message,messageId)=>{assert.equal(to,jid);assert.equal(message.imageMessage.mediaKey,'hidden-image');retry.receipt({id:messageId,remoteJid:jid,fromMe:true},2);retry.receipt({id:messageId,remoteJid:jid,fromMe:true},2);}});
 const accepted=await retry.send(jid,{},id);assert.equal(accepted.status,2);assert.equal(accepted.key.remoteJid,jid);
 await assert.rejects(retry.send('123456789012345@s.whatsapp.net',{},id),/recipient mismatch/);
});
