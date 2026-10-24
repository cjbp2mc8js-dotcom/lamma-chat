import {accountId} from './account-id.js';
import {normalizePublicId} from './directory.js';
const initialized=new WeakMap();
const fail=(status,message)=>{throw Object.assign(Error(message),{status});};
async function ready(db){
 if(!initialized.has(db))initialized.set(db,(async()=>{
  for(const sql of [
   'CREATE TABLE IF NOT EXISTS public_profiles(user_id TEXT PRIMARY KEY,name TEXT NOT NULL)',
   "CREATE TABLE IF NOT EXISTS friendships(low_uid TEXT NOT NULL,high_uid TEXT NOT NULL,sender_uid TEXT NOT NULL,status TEXT NOT NULL CHECK(status IN ('pending','accepted')),created INTEGER NOT NULL,updated INTEGER NOT NULL,PRIMARY KEY(low_uid,high_uid),CHECK(low_uid<high_uid),CHECK(sender_uid=low_uid OR sender_uid=high_uid))",
   'CREATE INDEX IF NOT EXISTS friendships_low ON friendships(low_uid,status,updated)',
   'CREATE INDEX IF NOT EXISTS friendships_high ON friendships(high_uid,status,updated)',
   'CREATE TABLE IF NOT EXISTS friend_lookup_limits(uid TEXT PRIMARY KEY,minute INTEGER NOT NULL,count INTEGER NOT NULL)',
   'CREATE TABLE IF NOT EXISTS friend_send_limits(uid TEXT PRIMARY KEY,hour INTEGER NOT NULL,count INTEGER NOT NULL)'
  ])await db.prepare(sql).run();
 })().catch(e=>{initialized.delete(db);throw e;}));await initialized.get(db);
}
const relation=(row,uid)=>!row?'none':row.status==='accepted'?'friends':row.sender_uid===uid?'outgoing':'incoming';
async function list(db,uid){
 const results={};for(const type of ['incoming','outgoing','friends']){
  const condition=type==='friends'?"f.status='accepted'":`f.status='pending' AND f.sender_uid${type==='outgoing'?'=':'<>'}?`;
  const args=type==='friends'?[uid,uid]:[uid,uid,uid];
  const where=`(f.low_uid=? OR f.high_uid=?) AND ${condition}`;
  const count=await db.prepare(`SELECT COUNT(*) AS n FROM friendships f WHERE ${where}`).bind(...args).first();
  const rows=await db.prepare(`SELECT a.public_id AS id,p.name,f.updated FROM friendships f JOIN account_ids a ON a.user_id=CASE WHEN f.low_uid=? THEN f.high_uid ELSE f.low_uid END LEFT JOIN public_profiles p ON p.user_id=a.user_id WHERE ${where} ORDER BY f.updated DESC,a.public_id ASC LIMIT 100`).bind(uid,...args).all();
  results[type]={count:count.n,people:(rows.results||[]).map(r=>({id:String(r.id),name:r.name||'عضو لمة شات'}))};
 }
 results.recent={count:0,people:[]};
 const history=await db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name IN ('gold_entries','gold_settlements','gold_accounts')").all();
 if(history.results?.length===3){
  const rows=await db.prepare(`SELECT a.public_id AS id,p.name,MAX(s.created) AS playedAt,CAST(g.xp/1000 AS INTEGER)+1 AS level,f.status,f.sender_uid FROM gold_entries mine JOIN gold_settlements s ON s.match_id=mine.match_id AND s.qualified=1 JOIN gold_entries peer ON peer.match_id=mine.match_id AND peer.uid<>mine.uid JOIN account_ids a ON a.user_id=peer.uid LEFT JOIN public_profiles p ON p.user_id=peer.uid LEFT JOIN gold_accounts g ON g.uid=peer.uid LEFT JOIN friendships f ON (f.low_uid=mine.uid AND f.high_uid=peer.uid) OR (f.high_uid=mine.uid AND f.low_uid=peer.uid) WHERE mine.uid=? GROUP BY peer.uid ORDER BY playedAt DESC,a.public_id ASC LIMIT 100`).bind(uid).all();
  results.recent={count:rows.results.length,people:rows.results.map(r=>({id:String(r.id),name:r.name||'عضو لمة شات',playedAt:r.playedAt,level:r.level,relationship:relation(r.status?{status:r.status,sender_uid:r.sender_uid}:null,uid)}))};
 }
 return results;
}
export async function friendsRequest({db,uid,input,now}){
 if(!input||typeof input!=='object'||Array.isArray(input))fail(400,'طلب غير صالح');
 if(!['list','lookup','send','accept','reject','cancel'].includes(input.action))fail(400,'إجراء غير صالح');
 await accountId(db,uid);await ready(db);
 if(input.action==='list')return list(db,uid);
 const id=normalizePublicId(input.id);if(!/^[1-9]\d{6,7}$/.test(id))fail(400,'اكتب آيدي من ٧ أو ٨ أرقام');
 if(input.action==='lookup'){const minute=Math.floor(now/60000);const q=await db.prepare('INSERT INTO friend_lookup_limits(uid,minute,count) VALUES(?,?,1) ON CONFLICT(uid) DO UPDATE SET minute=excluded.minute,count=CASE WHEN friend_lookup_limits.minute=excluded.minute THEN friend_lookup_limits.count+1 ELSE 1 END RETURNING count').bind(uid,minute).first();if(q.count>30)fail(429,'انتظر دقيقة وحاول البحث مجدداً');}
 const person=await db.prepare('SELECT a.user_id,p.name FROM account_ids a LEFT JOIN public_profiles p ON p.user_id=a.user_id WHERE a.public_id=?').bind(Number(id)).first();
 if(!person)fail(404,'ماكو حساب بهذا الآيدي');
 if(person.user_id===uid)fail(400,'هذا آيدي حسابك');
 const [low,high]=[uid,person.user_id].sort();
 const read=()=>db.prepare('SELECT sender_uid,status FROM friendships WHERE low_uid=? AND high_uid=?').bind(low,high).first();
 let row=await read();
 if(input.action==='send'&&!row){
  const hour=Math.floor(now/3600000);const quota=await db.prepare('INSERT INTO friend_send_limits(uid,hour,count) VALUES(?,?,1) ON CONFLICT(uid) DO UPDATE SET hour=excluded.hour,count=CASE WHEN friend_send_limits.hour=excluded.hour THEN friend_send_limits.count+1 ELSE 1 END RETURNING count').bind(uid,hour).first();
  if(quota.count>20)fail(429,'وصلت حد طلبات الصداقة؛ حاول بعد ساعة');
  await db.prepare("INSERT INTO friendships(low_uid,high_uid,sender_uid,status,created,updated) VALUES(?,?,?,'pending',?,?) ON CONFLICT(low_uid,high_uid) DO NOTHING").bind(low,high,uid,now,now).run();
 }else if(input.action==='accept'){
  if(!row||row.status!=='accepted'&&row.sender_uid===uid)fail(409,'ماكو طلب وارد من هذا الشخص');
  await db.prepare("UPDATE friendships SET status='accepted',updated=? WHERE low_uid=? AND high_uid=? AND status='pending' AND sender_uid<>?").bind(now,low,high,uid).run();
 }else if(input.action==='reject'||input.action==='cancel'){
  if(row?.status==='accepted')fail(409,'هذا الشخص ضمن أصدقائك');
  if(row&&((input.action==='reject')===(row.sender_uid===uid)))fail(403,'هذا الإجراء غير مسموح');
  await db.prepare("DELETE FROM friendships WHERE low_uid=? AND high_uid=? AND status='pending' AND sender_uid"+(input.action==='cancel'?'=':'<>')+'?').bind(low,high,uid).run();
 }
 row=await read();return {person:{id,name:person.name||'عضو لمة شات'},relationship:relation(row,uid)};
}
