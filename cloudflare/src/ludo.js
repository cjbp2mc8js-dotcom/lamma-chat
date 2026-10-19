import {goldReservation,validateStake} from './gold.js';
import {randomUUID,randomInt} from 'node:crypto';
import {createGame,applyMove,publicState} from '../../games/engine.mjs';
const ready=new WeakMap(),fail=(status,message)=>{throw Object.assign(Error(message),{status});};
export async function initLudo(db){if(!ready.has(db))ready.set(db,(async()=>{
 await db.prepare('CREATE TABLE IF NOT EXISTS ludo_rooms (id TEXT PRIMARY KEY,capacity INTEGER NOT NULL,status TEXT NOT NULL,roster TEXT NOT NULL,state TEXT NOT NULL,version INTEGER NOT NULL DEFAULT 0,created INTEGER NOT NULL,updated INTEGER NOT NULL)').run();
 await db.prepare('CREATE INDEX IF NOT EXISTS ludo_queue ON ludo_rooms(capacity,status,created)').run();
})().catch(e=>{ready.delete(db);throw e;}));await ready.get(db);}
const roster=m=>JSON.parse(m.roster),seat=(m,uid)=>roster(m).findIndex(p=>p.uid===uid);
export function ludoPayload(m,uid){const p=seat(m,uid);if(p<0)fail(403,'المباراة ليست لحسابك');const s=JSON.parse(m.state);return {id:m.id,kind:'ludo',capacity:m.capacity,stake:m.stake||0,pot:(m.stake||0)*roster(m).length,status:m.status,version:m.version,player:p,players:roster(m).map((x,i)=>({name:x.name,computer:false,left:s.departed?.includes(i)||false})),state:m.status==='waiting'?null:publicState(s,p),turnDeadline:m.status==='active'?m.updated+60000:null};}
export async function ludoMember(db,uid){await initLudo(db);return db.prepare('SELECT * FROM ludo_rooms WHERE id=(SELECT match_id FROM game_players WHERE uid=?)').bind(uid).first();}
function depart(s,p,reason){s.departed??=[];if(!s.departed.includes(p))s.departed.push(p);s.pawns[p]=[-1,-1,-1,-1];const remaining=s.pawns.map((_,i)=>i).filter(i=>!s.departed.includes(i));s.last={player:p,action:{t:'leave'},message:reason};if(remaining.length<=1){s.over=true;s.winner=remaining[0]??null;s.reason=reason;return;}if(s.turn===p){do{s.turn=(s.turn+1)%s.pawns.length;}while(s.departed.includes(s.turn));s.die=null;s.sixes=0;}}
const cleanName=n=>typeof n==='string'?(n.replace(/[\u0000-\u001f\u007f]/g,'').trim().slice(0,35)||'عضو'):'عضو';
export async function ludoRequest({db,uid,input,now=Date.now(),ctx={waitUntil(){}}}){
 await initLudo(db);const action=input.action;
 if(action==='join'){
  if(input.playerCount!==undefined&&![2,4].includes(input.playerCount))fail(400,'اختار لاعبين أو أربعة');
  const own=await ludoMember(db,uid);if(own&&own.status!=='finished'&&!JSON.parse(own.state).departed?.includes(seat(own,uid)))return ludoPayload(own,uid);if(own&&JSON.parse(own.state).departed?.includes(seat(own,uid)))await db.prepare('DELETE FROM game_players WHERE uid=? AND match_id=?').bind(uid,own.id).run();
  await db.prepare("DELETE FROM game_players WHERE uid=? AND (updated<? OR match_id IN (SELECT id FROM ludo_rooms WHERE status='finished') OR match_id IN (SELECT id FROM game_matches WHERE status='finished'))").bind(uid,now-30000).run();
  const stake=validateStake(input),id='ludo-'+randomUUID(),capacity=input.playerCount===4?4:2,person=JSON.stringify({uid,name:cleanName(input.name),seen:now}),initial=JSON.stringify(createGame('ludo',randomInt(1,2147483647),{playerCount:capacity}));
  const reservation=await db.prepare('INSERT INTO game_players(uid,match_id,updated) VALUES(?,?,?) ON CONFLICT(uid) DO NOTHING RETURNING uid').bind(uid,id,now).first();
  if(!reservation){const current=await ludoMember(db,uid);if(current)return ludoPayload(current,uid);fail(409,'عندك مباراة ثانية مفتوحة؛ أغلقها أولاً');}
  try{await db.batch([
   db.prepare("INSERT INTO ludo_rooms(id,capacity,status,roster,state,created,updated,stake) VALUES(?,?,'waiting',json_array(json(?)),?,?,?,?)").bind(id,capacity,person,initial,now,now,stake),
   db.prepare("UPDATE ludo_rooms SET roster=json_insert(roster,'$[#]',json(?)),status=CASE WHEN json_array_length(roster)+1=capacity THEN 'active' ELSE 'waiting' END,updated=?,version=version+1 WHERE id=(SELECT id FROM ludo_rooms WHERE id<>? AND capacity=? AND stake=? AND status='waiting' AND updated>? AND json_array_length(roster)<capacity ORDER BY created,id LIMIT 1) AND status='waiting' AND json_array_length(roster)<capacity").bind(person,now,id,capacity,stake,now-45000),
   db.prepare("UPDATE game_players SET match_id=COALESCE((SELECT r.id FROM ludo_rooms r,json_each(r.roster) p WHERE json_extract(p.value,'$.uid')=? AND r.id<>? AND r.status IN ('waiting','active') AND NOT EXISTS(SELECT 1 FROM json_each(r.state,'$.departed') d WHERE d.value=p.key) ORDER BY r.updated DESC LIMIT 1),?),updated=? WHERE uid=? AND match_id=?").bind(uid,id,id,now,uid,id),
   db.prepare('DELETE FROM ludo_rooms WHERE id=? AND id<>(SELECT match_id FROM game_players WHERE uid=?)').bind(id,uid),
   goldReservation(db,uid,stake,now),
  ]);const m=await ludoMember(db,uid);if(!m)fail(409,'أعد البحث عن مباراة');return ludoPayload(m,uid);}catch(e){await db.prepare('DELETE FROM game_players WHERE uid=? AND match_id=?').bind(uid,id).run();throw e;}
 }
 if(!['poll','move','leave'].includes(action))fail(400,'طلب غير صالح');
 if(typeof input.id!=='string'||!/^ludo-[-a-zA-Z0-9]{36}$/.test(input.id))fail(400,'معرف المباراة غير صالح');
 let m=await db.prepare('SELECT * FROM ludo_rooms WHERE id=?').bind(input.id).first();if(!m)fail(404,'المباراة غير موجودة');const p=seat(m,uid);if(p<0)fail(403,'المباراة ليست لحسابك');let s=JSON.parse(m.state);
 if(action==='move'&&typeof input.requestId==='string'&&roster(m)[p].requestId===input.requestId)return ludoPayload(m,uid);
 if(action==='leave'){
  if(m.status!=='finished'&&!s.departed.includes(p)){if(m.status==='waiting'){s.over=true;s.winner=null;s.reason='أُغلق البحث لأن أحد اللاعبين غادر';}else depart(s,p,'غادر أحد اللاعبين');const row=await db.prepare('UPDATE ludo_rooms SET state=?,status=?,version=version+1,updated=? WHERE id=? AND version=? RETURNING *').bind(JSON.stringify(s),s.over?'finished':'active',now,m.id,m.version).first();if(!row)fail(409,'تغيّرت المباراة؛ حاول الخروج مجدداً');}
  await db.prepare('DELETE FROM game_players WHERE uid=? AND match_id=?').bind(uid,m.id).run();return {ok:true};
 }
 // Heartbeats do not overwrite other players' heartbeats or the turn deadline.
 await db.prepare("UPDATE ludo_rooms SET roster=json_set(roster,?,?),updated=CASE WHEN status='waiting' THEN ? ELSE updated END WHERE id=?").bind('$['+p+'].seen',now,now,m.id).run();
 if(m.status==='active'){
  const people=roster(m);for(let q=0;q<people.length;q++)if(q!==p&&now-people[q].seen>90000&&!s.departed.includes(q))depart(s,q,'انقطع اتصال أحد اللاعبين');
  if(!s.over&&now-m.updated>60000&&!s.departed.includes(s.turn))depart(s,s.turn,'انتهى وقت الدور');
  if(JSON.stringify(s)!==m.state){const row=await db.prepare('UPDATE ludo_rooms SET state=?,status=?,version=version+1,updated=? WHERE id=? AND version=? RETURNING *').bind(JSON.stringify(s),s.over?'finished':'active',now,m.id,m.version).first();m=row||await db.prepare('SELECT * FROM ludo_rooms WHERE id=?').bind(m.id).first();s=JSON.parse(m.state);}
 }
 if(action==='poll')return ludoPayload(m,uid);
 if(m.status!=='active'||s.over)fail(409,'المباراة غير نشطة');if(s.departed.includes(p))fail(403,'خرجت من هذه المباراة');
 if(!Number.isSafeInteger(input.version)||typeof input.requestId!=='string'||!/^[-a-zA-Z0-9]{20,50}$/.test(input.requestId))fail(400,'طلب حركة غير صالح');if(m.version!==input.version)fail(409,'تغيّر الدور؛ جاري التحديث');if(s.turn!==p)fail(403,'انتظر دورك');
 s=applyMove(s,input.move,p);
 const row=await db.prepare('UPDATE ludo_rooms SET state=?,status=?,version=version+1,updated=?,roster=json_set(roster,?,?,?,?) WHERE id=? AND version=? RETURNING *').bind(JSON.stringify(s),s.over?'finished':'active',now,'$['+p+'].seen',now,'$['+p+'].requestId',input.requestId,m.id,m.version).first();
 if(!row)fail(409,'تغيّرت المباراة؛ جاري التحديث');return ludoPayload(row,uid);
}

