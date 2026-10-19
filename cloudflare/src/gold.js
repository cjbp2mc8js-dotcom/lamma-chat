import {randomInt} from 'node:crypto';
export const GOLD_STAKES=[500,1000,5000,10000,50000,100000,500000,1000000,2000000,5000000];
export const GOLD_TASKS=[{id:'login',title:'الدخول اليومي',need:0,min:100,max:500,type:'normal'},{id:'play1',title:'أكمل مباراة أونلاين',need:1,min:100,max:500,type:'normal'},{id:'play3',title:'أكمل ٣ مباريات أونلاين',need:3,min:2000,max:5000,type:'premium'}];
const ready=new WeakMap();const fail=(status,message)=>{throw Object.assign(Error(message),{status});};
// Task dates are server-owned, in the account service's Baghdad day (UTC+3).
export const goldDay=now=>new Date(now+10800000).toISOString().slice(0,10);
export async function initGold(db){
 if(!ready.has(db))ready.set(db,(async()=>{
  for(const sql of [
   'CREATE TABLE IF NOT EXISTS gold_accounts(uid TEXT PRIMARY KEY,gold INTEGER NOT NULL DEFAULT 0 CHECK(gold>=0),xp INTEGER NOT NULL DEFAULT 0,matches INTEGER NOT NULL DEFAULT 0,wins INTEGER NOT NULL DEFAULT 0)',
   'CREATE TABLE IF NOT EXISTS gold_claims(uid TEXT NOT NULL,day TEXT NOT NULL,task TEXT NOT NULL,amount INTEGER NOT NULL,created INTEGER NOT NULL,PRIMARY KEY(uid,day,task))',
   'CREATE TABLE IF NOT EXISTS gold_activity(uid TEXT NOT NULL,day TEXT NOT NULL,completed INTEGER NOT NULL DEFAULT 0,PRIMARY KEY(uid,day))',
   'CREATE TABLE IF NOT EXISTS gold_entries(match_id TEXT NOT NULL,uid TEXT NOT NULL,stake INTEGER NOT NULL CHECK(stake>=0),created INTEGER NOT NULL,PRIMARY KEY(match_id,uid))',
   'CREATE TABLE IF NOT EXISTS gold_settlements(match_id TEXT PRIMARY KEY,winner_uid TEXT,qualified INTEGER NOT NULL,day TEXT NOT NULL,created INTEGER NOT NULL)',
   `CREATE TRIGGER IF NOT EXISTS gold_entry_balance BEFORE INSERT ON gold_entries BEGIN SELECT CASE WHEN COALESCE((SELECT gold FROM gold_accounts WHERE uid=NEW.uid),0)<NEW.stake THEN RAISE(ABORT,'GOLD_INSUFFICIENT') END; END`,
   `CREATE TRIGGER IF NOT EXISTS gold_entry_debit AFTER INSERT ON gold_entries BEGIN UPDATE gold_accounts SET gold=gold-NEW.stake WHERE uid=NEW.uid; END`,
   `CREATE TRIGGER IF NOT EXISTS gold_claim_credit AFTER INSERT ON gold_claims BEGIN UPDATE gold_accounts SET gold=gold+NEW.amount WHERE uid=NEW.uid; END`,
   `CREATE TRIGGER IF NOT EXISTS gold_settle_credit AFTER INSERT ON gold_settlements BEGIN
    UPDATE gold_accounts SET gold=gold+CASE WHEN NEW.winner_uid IS NULL THEN COALESCE((SELECT stake FROM gold_entries WHERE match_id=NEW.match_id AND uid=gold_accounts.uid),0) WHEN uid=NEW.winner_uid THEN COALESCE((SELECT SUM(stake) FROM gold_entries WHERE match_id=NEW.match_id),0) ELSE 0 END,
     xp=xp+CASE WHEN NEW.qualified=1 THEN CASE WHEN uid=NEW.winner_uid THEN 100 ELSE 25 END ELSE 0 END,
     matches=matches+NEW.qualified,wins=wins+CASE WHEN NEW.qualified=1 AND uid=NEW.winner_uid THEN 1 ELSE 0 END
     WHERE uid IN (SELECT uid FROM gold_entries WHERE match_id=NEW.match_id);
    INSERT INTO gold_activity(uid,day,completed) SELECT uid,NEW.day,1 FROM gold_entries WHERE match_id=NEW.match_id AND NEW.qualified=1 ON CONFLICT(uid,day) DO UPDATE SET completed=completed+1;
   END`
  ])await db.prepare(sql).run();
  for(const table of ['game_matches','ludo_rooms'])if(!await db.prepare(`SELECT name FROM pragma_table_info('${table}') WHERE name='stake'`).first())try{await db.prepare(`ALTER TABLE ${table} ADD COLUMN stake INTEGER NOT NULL DEFAULT 0`).run();}catch(e){if(!await db.prepare(`SELECT name FROM pragma_table_info('${table}') WHERE name='stake'`).first())throw e;}
 })().catch(e=>{ready.delete(db);throw e;}));await ready.get(db);
}
export const ensureGold=(db,uid)=>db.prepare('INSERT INTO gold_accounts(uid) VALUES(?) ON CONFLICT(uid) DO NOTHING').bind(uid).run();
export function goldReservation(db,uid,stake,now){return db.prepare('INSERT INTO gold_entries(match_id,uid,stake,created) SELECT match_id,?,?,? FROM game_players WHERE uid=? ON CONFLICT(match_id,uid) DO NOTHING').bind(uid,stake,now,uid);}
export function validateStake(input){const stake=input.stake??0;if(!Number.isSafeInteger(stake)||stake!==0&&!GOLD_STAKES.includes(stake))fail(400,'اختار مبلغاً من فئات الذهب المتاحة');if(stake&&input.kind==='dare')fail(400,'التحديات للتسلية مجاناً');return stake;}
export async function settleGold(db,id,now){
 if(!id)return;
 const ludo=id.startsWith('ludo-'),table=ludo?'ludo_rooms':'game_matches';
 let m=await db.prepare(`SELECT * FROM ${table} WHERE id=?`).bind(id).first();
 if(m&&m.status!=='finished'&&now-m.updated>7200000){await db.prepare(`UPDATE ${table} SET status='finished' WHERE id=? AND updated<?`).bind(id,now-7200000).run();m=await db.prepare(`SELECT * FROM ${table} WHERE id=?`).bind(id).first();}
 if(!m||m.status!=='finished')return;
 const s=JSON.parse(m.state),players=ludo?JSON.parse(m.roster).map(p=>p.uid):[m.p0,m.p1].filter(Boolean);
 const winner=s.over&&Number.isInteger(s.winner)&&s.winner>=0&&s.winner<players.length?players[s.winner]:null;
 const qualified=s.over&&!s.reason&&s.ply>=4?1:0;
 await db.prepare('INSERT INTO gold_settlements(match_id,winner_uid,qualified,day,created) VALUES(?,?,?,?,?) ON CONFLICT(match_id) DO NOTHING').bind(id,winner,qualified,goldDay(now),now).run();
}
export async function recoverGold(db,uid,now){
 // Recover finished/expired games before showing an account balance. No orphaned holds.
 const entries=await db.prepare('SELECT match_id FROM gold_entries WHERE uid=? AND match_id NOT IN (SELECT match_id FROM gold_settlements) ORDER BY created LIMIT 50').bind(uid).all();
 for(const e of entries.results||[])await settleGold(db,e.match_id,now);
}
export async function goldSnapshot(db,uid,now){
 const a=await db.prepare('SELECT gold,xp,matches,wins FROM gold_accounts WHERE uid=?').bind(uid).first(),day=goldDay(now);
 const progress=await db.prepare('SELECT completed FROM gold_activity WHERE uid=? AND day=?').bind(uid,day).first();
 const claims=await db.prepare('SELECT task,amount FROM gold_claims WHERE uid=? AND day=?').bind(uid,day).all();
 return {...a,level:Math.floor(a.xp/1000)+1,levelXP:a.xp%1000,nextLevelXP:1000,day,stakes:GOLD_STAKES,tasks:GOLD_TASKS.map(t=>({...t,progress:Math.min(t.need,progress?.completed||0),ready:t.need<=(progress?.completed||0),claimed:(claims.results||[]).some(c=>c.task===t.id)}))};
}
export async function goldRequest({db,uid,input,now}){
 if(input.action==='gold-claim'){
  const task=GOLD_TASKS.find(t=>t.id===input.task);if(!task)fail(400,'المهمة غير موجودة');
  const day=goldDay(now),progress=await db.prepare('SELECT completed FROM gold_activity WHERE uid=? AND day=?').bind(uid,day).first();
  if(task.need>(progress?.completed||0))fail(409,'أكمل المهمة أولاً حتى تفتح الصندوق');
  await db.prepare('INSERT INTO gold_claims(uid,day,task,amount,created) VALUES(?,?,?,?,?) ON CONFLICT(uid,day,task) DO NOTHING').bind(uid,day,task.id,randomInt(task.min,task.max+1),now).run();
  const claim=await db.prepare('SELECT amount FROM gold_claims WHERE uid=? AND day=? AND task=?').bind(uid,day,task.id).first();
  return {account:await goldSnapshot(db,uid,now),reward:claim.amount,task:task.id};
 }
 return {account:await goldSnapshot(db,uid,now)};
}
