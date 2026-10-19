import {createHash} from 'node:crypto';
const ready=new WeakMap();
const fail=(status,message)=>{throw Object.assign(new Error(message),{status});};
async function init(db){if(!ready.has(db))ready.set(db,(async()=>{await db.prepare('CREATE TABLE IF NOT EXISTS council_messages (id TEXT PRIMARY KEY, room_id TEXT NOT NULL, user_id TEXT NOT NULL, name TEXT NOT NULL, text TEXT NOT NULL, created_at INTEGER NOT NULL)').run();await db.prepare('CREATE INDEX IF NOT EXISTS council_messages_room ON council_messages(room_id, created_at DESC, id DESC)').run();})().catch(e=>{ready.delete(db);throw e;}));return ready.get(db);}
export async function councilChat({db,input,uid,session,now,ctx}){
 if(!session||session.userId!==uid||session.roomId!==input.roomId||session.sessionId!==input.sessionId||session.expiresAt<=now)fail(403,'ادخل المجلس من جديد حتى تتصل الدردشة');
 if(!['list','send'].includes(input.action))fail(400,'طلب دردشة غير صالح');
 let text,name,id;
 if(input.action==='send'){
  text=typeof input.text==='string'?input.text.trim():'';name=typeof input.name==='string'?input.name.trim():'';
  if(!text||text.length>500||name.length>35||typeof input.messageId!=='string'||!/^[a-f0-9-]{36}$/.test(input.messageId))fail(400,'اكتب رسالة من حرف إلى ٥٠٠ حرف');
  name=name.replace(/[\u0000-\u001f\u007f]/g,' ')||'عضو';
  id=createHash('sha256').update(uid+':'+input.roomId+':'+input.messageId).digest('hex');
 }
 await init(db);
 if(input.action==='send'){
  const old=await db.prepare('SELECT text FROM council_messages WHERE id = ?').bind(id).first();
  if(old&&old.text!==text)fail(409,'الرسالة تغيّرت؛ اكتبها من جديد');
  if(!old){
   const saved=await db.prepare('INSERT INTO council_messages (id, room_id, user_id, name, text, created_at) SELECT ?, ?, ?, ?, ?, ? WHERE NOT EXISTS (SELECT 1 FROM council_messages WHERE room_id = ? AND user_id = ? AND created_at > ?) RETURNING id').bind(id,input.roomId,uid,name,text,now,input.roomId,uid,now-1500).first();
   if(!saved)fail(429,'انتظر ثانيتين قبل الرسالة الجاية');
   ctx.waitUntil(db.prepare('DELETE FROM council_messages WHERE room_id = ? AND (created_at < ? OR id NOT IN (SELECT id FROM council_messages WHERE room_id = ? ORDER BY created_at DESC, id DESC LIMIT 200))').bind(input.roomId,now-7*86400000,input.roomId).run().catch(()=>{}));
  }
 }
 const rows=await db.prepare('SELECT id, user_id AS userId, name, text, created_at AS createdAt FROM council_messages WHERE room_id = ? AND created_at >= ? ORDER BY created_at DESC, id DESC LIMIT 60').bind(input.roomId,now-7*86400000).all();
 return {ok:true,messages:rows.results.reverse()};
}
