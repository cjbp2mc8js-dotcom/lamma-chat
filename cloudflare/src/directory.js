import {accountId} from './account-id.js';
const initialized=new WeakMap();
const fail=(status,message)=>{throw Object.assign(Error(message),{status});};
async function ready(db){
 if(!initialized.has(db))initialized.set(db,(async()=>{
  await db.prepare('CREATE TABLE IF NOT EXISTS public_profiles (user_id TEXT PRIMARY KEY, name TEXT NOT NULL)').run();
  await db.prepare('CREATE TABLE IF NOT EXISTS directory_limits (user_id TEXT PRIMARY KEY, minute INTEGER NOT NULL, count INTEGER NOT NULL)').run();
 })().catch(e=>{initialized.delete(db);throw e;}));
 await initialized.get(db);
}
export function normalizePublicId(value){
 if(typeof value!=='string'&&typeof value!=='number')return '';
 return String(value).trim().replace(/[٠-٩]/g,c=>String(c.charCodeAt(0)-1632)).replace(/[۰-۹]/g,c=>String(c.charCodeAt(0)-1776));
}
export async function syncPublicProfile(db,uid,name){
 if(typeof name!=='string')return;
 const clean=name.normalize('NFC').replace(/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/g,'').trim().slice(0,40);
 if(!clean)return;
 await ready(db);
 await db.prepare('INSERT INTO public_profiles(user_id,name) VALUES (?,?) ON CONFLICT(user_id) DO UPDATE SET name=excluded.name').bind(uid,clean).run();
}
export async function directorySearch({db,uid,input,now,readCouncil}){
 const id=normalizePublicId(input?.id),scope=input?.scope||'all';
 if(!/^[1-9]\d{6,7}$/.test(id))fail(400,'اكتب آيدي صحيح من ٧ أو ٨ أرقام');
 if(!['all','people','councils'].includes(scope))fail(400,'نوع البحث غير صالح');
 await accountId(db,uid);await ready(db);
 const minute=Math.floor(now/60000);
 const quota=await db.prepare('INSERT INTO directory_limits(user_id,minute,count) VALUES (?,?,1) ON CONFLICT(user_id) DO UPDATE SET minute=excluded.minute,count=CASE WHEN directory_limits.minute=excluded.minute THEN directory_limits.count+1 ELSE 1 END RETURNING count').bind(uid,minute).first();
 if(quota.count>30)fail(429,'انتظر دقيقة وحاول البحث من جديد');
 const row=await db.prepare('SELECT a.user_id,p.name FROM account_ids a LEFT JOIN public_profiles p ON p.user_id=a.user_id WHERE a.public_id=?').bind(Number(id)).first();
 if(!row)return {id,person:null,council:null};
 let room;try{room=await readCouncil(row.user_id);}catch(e){if(e.status!==403&&e.status!==404)throw e;}
 const person=scope==='councils'?null:{id,name:row.name||'عضو لمة شات'};
 const council=scope!=='people'&&room?.isPublic===true&&room.ownerId===row.user_id?{id,roomId:row.user_id,name:typeof room.name==='string'?room.name.slice(0,35):'مجلس ملكي',lockedUntil:Number.isFinite(room.lockedUntil)?room.lockedUntil:0,canEnter:!(room.lockedUntil>now)||uid===row.user_id}:null;
 return {id,person,council};
}
