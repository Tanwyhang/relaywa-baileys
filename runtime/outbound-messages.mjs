import fs from 'node:fs';
import path from 'node:path';

// Store the original protocol message (including image keys), never a blank
// substitute, so WhatsApp retry requests can resend the same message identity.
// One store belongs to one merchant cell and expires after a bounded interval.
export function createOutboundMessages({file,encode,decode,now=Date.now,maxEntries=500,maxBytes=8*1024*1024,ttlMs=24*60*60*1000,onError=()=>{}}) {
  const messages=new Map();
  const validId=id=>typeof id==='string'&&/^[a-zA-Z0-9_-]{1,128}$/.test(id);
  const prune=()=>{
    for(const [id,item] of messages)if(now()-item.createdAt>=ttlMs)messages.delete(id);
    let bytes=[...messages.values()].reduce((n,item)=>n+item.data.length,0);
    for(const [id,item] of [...messages].sort((a,b)=>a[1].createdAt-b[1].createdAt)) {
      if(messages.size<=maxEntries&&bytes<=maxBytes)break;
      messages.delete(id);bytes-=item.data.length;
    }
  };
  try {
    if(fs.existsSync(file)) {
      if(fs.statSync(file).size>maxBytes*2)throw new Error('Outbound retry store exceeds limit');
      const stored=JSON.parse(fs.readFileSync(file,'utf8'));
      if(!Array.isArray(stored))throw new Error('Invalid outbound retry store');
      for(const [id,item] of stored)if(validId(id)&&typeof item?.data==='string'&&Number.isFinite(item.createdAt)&&item.createdAt<=now()+60000)messages.set(id,item);
      prune();
    }
  } catch(error) {onError(error);}
  const save=()=>{
    prune();fs.mkdirSync(path.dirname(file),{recursive:true,mode:0o700});
    const temporary=file+'.tmp';fs.writeFileSync(temporary,JSON.stringify([...messages]),{mode:0o600});fs.renameSync(temporary,file);
  };
  return {
    put(sent) {
      if(!validId(sent?.key?.id)||!sent.message)return false;
      const data=Buffer.from(encode(sent.message)).toString('base64');
      if(data.length>maxBytes)throw new Error('Outbound retry message exceeds limit');
      messages.set(sent.key.id,{data,createdAt:now(),remoteJid:sent.key.remoteJid,status:sent.status??1});save();return true;
    },
    get(key) {
      if(key?.fromMe===false)return undefined;
      const item=messages.get(key?.id);if(!item||now()-item.createdAt>=ttlMs)return undefined;
      try{return decode(Buffer.from(item.data,'base64'));}catch(error){onError(error);return undefined;}
    },
    record(key) {
      const item=messages.get(key?.id);
      if(!item||now()-item.createdAt>=ttlMs)return undefined;
      return {status:item.status,remoteJid:item.remoteJid,errorCode:item.errorCode,createdAt:item.createdAt,updatedAt:item.updatedAt};
    },
    update(key,status,errorCode) {
      const item=messages.get(key?.id);
      if(!item||!Number.isInteger(status)||status<0||status>5||status===1)return;
      if(status===0 && item.status>=3)return;
      if(status!==0 && status<=item.status)return;
      item.status=status;item.updatedAt=now();
      item.errorCode=status===0 ? String(errorCode||'rejected').replace(/[^a-zA-Z0-9_-]/g,'').slice(0,40) : undefined;
      save();
    },
    metrics() {
      prune();const rows=[...messages.values()];
      return {outboundTracked:rows.length,outboundServerAcknowledged:rows.filter(item=>item.status>=2).length,outboundDeviceAcknowledged:rows.filter(item=>item.status>=3).length,outboundRejected:rows.filter(item=>item.status===0).length,outboundAwaitingAck:rows.filter(item=>item.status===1).length};
    },
  };
}
