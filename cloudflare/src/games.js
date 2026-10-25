import {initGold,ensureGold,goldReservation,validateStake,settleGold,recoverGold,goldSnapshot,goldRequest} from './gold.js';
import {randomUUID,randomInt} from 'node:crypto';
import {initLudo,ludoMember,ludoPayload,ludoRequest} from './ludo.js';
import {createGame,applyMove,botMove,publicState,catalog} from '../../games/engine.mjs';
const ready=new WeakMap();const fail=(status,message)=>{throw Object.assign(Error(message),{status});};
async function init(db){if(!ready.has(db))ready.set(db,(async()=>{await db.prepare("CREATE TABLE IF NOT EXISTS game_matches (id TEXT PRIMARY KEY,kind TEXT NOT NULL,status TEXT NOT NULL,p0 TEXT NOT NULL,p1 TEXT,n0 TEXT NOT NULL,n1 TEXT,state TEXT NOT NULL,version INTEGER NOT NULL DEFAULT 0,created INTEGER NOT NULL,updated INTEGER NOT NULL,seen0 INTEGER NOT NULL,seen1 INTEGER NOT NULL DEFAULT 0,req0 TEXT,req1 TEXT)").run();await db.prepare('CREATE INDEX IF NOT EXISTS game_match_queue ON game_matches(kind,status,created)').run();await db.prepare('CREATE TABLE IF NOT EXISTS game_players (uid TEXT PRIMARY KEY,match_id TEXT NOT NULL,updated INTEGER NOT NULL)').run();})().catch(e=>{ready.delete(db);throw e;}));await ready.get(db);}
const cleanName=n=>typeof n==='string'?(n.replace(/[\u0000-\u001f\u007f]/g,'').trim().slice(0,35)||'عضو'):'عضو';
const seat=(m,uid)=>m.p0===uid?0:m.p1===uid?1:-1;
const payload=(m,uid)=>{const p=seat(m,uid);if(p<0)fail(403,'المباراة ليست لحسابك');return {id:m.id,kind:m.kind,status:m.status,stake:m.stake||0,pot:(m.stake||0)*(m.p1?2:1),version:m.version,player:p,players:[{name:m.n0,computer:false},m.p1?{name:m.n1,computer:false}:null],state:m.status==='waiting'?null:publicState(JSON.parse(m.state),p)};};
async function member(db,uid){const own=await db.prepare('SELECT match_id,updated FROM game_players WHERE uid=?').bind(uid).first();if(!own)return null;return db.prepare('SELECT * FROM game_matches WHERE id=?').bind(own.match_id).first();}
function withBots(state){let s=state;for(let i=0;i<12&&!s.over&&s.kind==='jackaroo'&&s.turn>=2;i++){const a=botMove(s);if(!a)break;s=applyMove(s,a);}return s;}
async function coreGameRequest({db,uid,input,now=Date.now(),ctx={waitUntil(){}}}){
 await init(db);if(!input||typeof input!=='object'||Array.isArray(input))fail(400,'طلب غير صالح');const action=input.action;
 await initLudo(db);
 if(action==='join'){const old=await member(db,uid);if(old&&old.status!=='finished'&&now-old.updated<7200000)return payload(old,uid);const current=await ludoMember(db,uid);if(current&&current.status!=='finished'){if(now-current.updated>=7200000)await db.prepare("UPDATE ludo_rooms SET status='finished',state=json_set(state,'$.over',json('true'),'$.winner',NULL,'$.reason','انتهت صلاحية المباراة') WHERE id=?").bind(current.id).run();else if(!JSON.parse(current.state).departed?.includes(JSON.parse(current.roster).findIndex(p=>p.uid===uid)))return ludoPayload(current,uid);else await db.prepare('DELETE FROM game_players WHERE uid=? AND match_id=?').bind(uid,current.id).run();}}
 if(action==='join'&&input.kind==='ludo'||typeof input.id==='string'&&input.id.startsWith('ludo-'))return ludoRequest({db,uid,input,now,ctx});
 if(action==='join'){ctx.waitUntil(db.batch([db.prepare("DELETE FROM game_matches WHERE id IN (SELECT id FROM game_matches WHERE ((status='finished' AND updated<?) OR (status='waiting' AND updated<?)) AND NOT EXISTS(SELECT 1 FROM gold_entries e WHERE e.match_id=game_matches.id AND NOT EXISTS(SELECT 1 FROM gold_settlements g WHERE g.match_id=e.match_id)) LIMIT 50)").bind(now-86400000,now-7200000),db.prepare('DELETE FROM game_players WHERE updated<? AND match_id NOT IN (SELECT id FROM game_matches) AND match_id NOT IN (SELECT id FROM ludo_rooms)').bind(now-30000)]).catch(()=>{}));
  if(!catalog.some(g=>g.id===input.kind))fail(400,'اللعبة غير موجودة');
  const existing=await member(db,uid);
  if(existing&&existing.status!=='finished'&&now-existing.updated<7200000)return payload(existing,uid);if(existing&&existing.status!=='finished')await db.prepare("UPDATE game_matches SET status='finished' WHERE id=?").bind(existing.id).run();
  // Recover incomplete reservations after crashes; never displace a live reservation.
  await db.prepare('DELETE FROM game_players WHERE uid=? AND (updated<? OR match_id IN (SELECT id FROM game_matches WHERE status=\'finished\') OR match_id IN (SELECT id FROM ludo_rooms WHERE status=\'finished\'))').bind(uid,now-30000).run();
  const stake=validateStake(input),id=randomUUID(),name=cleanName(input.name),reservation=await db.prepare('INSERT INTO game_players(uid,match_id,updated) VALUES(?,?,?) ON CONFLICT(uid) DO NOTHING RETURNING uid').bind(uid,id,now).first();
  if(!reservation){const current=await member(db,uid);if(current)return payload(current,uid);fail(409,'جاري تجهيز مباراتك؛ حاول مجدداً');}
  try{
   const initial=JSON.stringify(createGame(input.kind,randomInt(1,2147483647)));
   // D1 batch is a transaction. New entrants claim committed waiting rows,
   // so simultaneous joins cannot pair the same person into two matches.
   await db.batch([
    db.prepare('INSERT INTO game_matches(id,kind,status,p0,n0,state,created,updated,seen0,stake) VALUES(?,?,\'waiting\',?,?,?,?,?,?,?)').bind(id,input.kind,uid,name,initial,now,now,now,stake),
    db.prepare("UPDATE game_matches SET p1=?,n1=?,status='active',seen1=?,updated=?,version=version+1 WHERE id=(SELECT id FROM game_matches WHERE kind=? AND stake=? AND status='waiting' AND p0<>? AND updated>? ORDER BY created,id LIMIT 1) AND status='waiting'").bind(uid,name,now,now,input.kind,stake,uid,now-45000),
    db.prepare("UPDATE game_players SET match_id=COALESCE((SELECT id FROM game_matches WHERE p1=? AND status='active' ORDER BY updated DESC LIMIT 1),?),updated=? WHERE uid=? AND match_id=?").bind(uid,id,now,uid,id),
    db.prepare('DELETE FROM game_matches WHERE id=? AND id<>(SELECT match_id FROM game_players WHERE uid=?)').bind(id,uid),
    goldReservation(db,uid,stake,now),
   ]);
   return payload(await member(db,uid),uid);
  }catch(e){await db.prepare('DELETE FROM game_players WHERE uid=? AND match_id=?').bind(uid,id).run();throw e;}
 }
 if(!['poll','move','leave'].includes(action))fail(400,'طلب غير صالح');
 if(typeof input.id!=='string'||!/^[-a-zA-Z0-9]{20,50}$/.test(input.id))fail(400,'معرف المباراة غير صالح');
 let m=await db.prepare('SELECT * FROM game_matches WHERE id=?').bind(input.id).first();if(!m)fail(404,'المباراة غير موجودة');const p=seat(m,uid);if(p<0)fail(403,'المباراة ليست لحسابك');
 let s=JSON.parse(m.state);
 if(action==='leave'){
  if(m.status!=='finished'){s.over=true;s.winner=m.status==='active'?1-p:2;s.reason='غادر اللاعب المباراة';await db.prepare("UPDATE game_matches SET status='finished',state=?,version=version+1,updated=? WHERE id=? AND version=?").bind(JSON.stringify(s),now,m.id,m.version).run();}
  await db.prepare('DELETE FROM game_players WHERE uid=? AND match_id=?').bind(uid,m.id).run();return {ok:true};
 }
 // An inactive opponent forfeits only after they have actually joined.
 if(m.status==='active'&&now-(p===0?m.seen1:m.seen0)>90000){s.over=true;s.winner=p;s.reason='انقطع اتصال اللاعب الآخر';const ended=await db.prepare("UPDATE game_matches SET status='finished',state=?,version=version+1,updated=? WHERE id=? AND version=? RETURNING *").bind(JSON.stringify(s),now,m.id,m.version).first();if(ended)m=ended;else m=await db.prepare('SELECT * FROM game_matches WHERE id=?').bind(m.id).first();s=JSON.parse(m.state);}
 if(m.status==='active'&&now-m.updated>120000){s.over=true;s.winner=1-(s.turn%2);s.reason='انتهى وقت الدور';const ended=await db.prepare("UPDATE game_matches SET status='finished',state=?,version=version+1,updated=? WHERE id=? AND version=? RETURNING *").bind(JSON.stringify(s),now,m.id,m.version).first();m=ended||await db.prepare('SELECT * FROM game_matches WHERE id=?').bind(m.id).first();s=JSON.parse(m.state);}
 if(action==='poll'){
  await db.prepare(`UPDATE game_matches SET seen${p}=?,updated=CASE WHEN status='waiting' THEN ? ELSE updated END WHERE id=?`).bind(now,now,m.id).run();
  return payload(m,uid);
 }
 if(m.status!=='active'||s.over)fail(409,'المباراة غير نشطة');
 if(!Number.isSafeInteger(input.version)||typeof input.requestId!=='string'||!/^[-a-zA-Z0-9]{20,50}$/.test(input.requestId))fail(400,'طلب حركة غير صالح');
 if(m['req'+p]===input.requestId)return payload(m,uid);
 if(m.version!==input.version)fail(409,'تغيّر الدور؛ جاري تحديث المباراة');
 if(s.turn!==p)fail(403,'انتظر دورك');
 const updated=withBots(applyMove(s,input.move,p,{roll:()=>randomInt(1,7)}));
 const row=await db.prepare(`UPDATE game_matches SET state=?,status=?,version=version+1,updated=?,seen${p}=?,req${p}=? WHERE id=? AND version=? RETURNING *`).bind(JSON.stringify(updated),updated.over?'finished':'active',now,now,input.requestId,m.id,m.version).first();
 if(!row)fail(409,'الحركة وصلت مسبقاً أو تغيّر الدور');return payload(row,uid);
}


// Account balances and results are authoritative; clients never post rewards or XP.
export async function gameRequest(options){
 const {db,uid,input,now=Date.now()}=options;
 await init(db);await initLudo(db);await initGold(db);await ensureGold(db,uid);
 if(!input||typeof input!=='object'||Array.isArray(input))fail(400,'طلب غير صالح');
 await recoverGold(db,uid,now);
 if(['gold-status','gold-claim'].includes(input.action))return goldRequest({db,uid,input,now});
 if(input.action==='join')validateStake(input);
 let r;try{r=await coreGameRequest({...options,now});}catch(e){if(String(e.message).includes('GOLD_INSUFFICIENT'))fail(409,'ذهبك ما يكفي لهذه الطاولة؛ افتح صناديق المهام أو اختار مبلغاً أقل');throw e;}
 await settleGold(db,r.id||input.id,now);
 return {...r,account:await goldSnapshot(db,uid,now)};
}
