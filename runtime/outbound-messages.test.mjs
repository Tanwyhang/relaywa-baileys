import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createOutboundMessages} from './outbound-messages.mjs';

const fixture=(t,options={})=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'revisit-outbound-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  return {file:path.join(dir,'messages.json'),encode:value=>Buffer.from(JSON.stringify(value)),decode:bytes=>JSON.parse(bytes.toString()),...options};
};
test('restarts recover the original image payload and missing messages stay missing',t=>{
  const config=fixture(t),store=createOutboundMessages(config);
  const message={imageMessage:{url:'https://example.test/media',mediaKey:'original-key',caption:'Voucher'}};
  store.put({key:{id:'ABC123'},message});
  const restored=createOutboundMessages(config);
  assert.deepEqual(restored.get({id:'ABC123',fromMe:true}),message);
  assert.equal(restored.get({id:'missing'}),undefined);
  assert.equal(restored.get({id:'ABC123',fromMe:false}),undefined);
  assert.equal(fs.statSync(config.file).mode&0o777,0o600);
});
test('receipt progress is monotonic and persists independently of image contents',t=>{
  const config=fixture(t),store=createOutboundMessages(config);
  store.put({key:{id:'receipt'},message:{conversation:'Acknowledged'}});
  store.update({id:'receipt'},3);store.update({id:'receipt'},2);
  const restored=createOutboundMessages(config);assert.equal(restored.metrics().outboundDeviceAcknowledged,1);
  assert.deepEqual(restored.get({id:'receipt'}),{conversation:'Acknowledged'});
});
test('retention and size limits bound private message storage',t=>{
  let now=1000;const config=fixture(t,{now:()=>now,ttlMs:100,maxEntries:2}),store=createOutboundMessages(config);
  for(const id of ['one','two','three']){store.put({key:{id},message:{conversation:id}});now++;}
  assert.equal(store.get({id:'one'}),undefined);assert.equal(store.metrics().outboundTracked,2);
  now+=100;assert.equal(store.get({id:'three'}),undefined);assert.equal(store.metrics().outboundTracked,0);
});
test('a damaged store is reported and never returns fabricated empty messages',t=>{
  const errors=[];const config=fixture(t,{onError:error=>errors.push(error)});fs.writeFileSync(config.file,'not json');
  const store=createOutboundMessages(config);assert.equal(errors.length,1);assert.equal(store.get({id:'missing'}),undefined);
});
