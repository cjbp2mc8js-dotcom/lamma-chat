import {randomInt} from 'node:crypto';
const ready=new WeakMap();
async function initialize(db){
 if(!ready.has(db))ready.set(db,db.prepare('CREATE TABLE IF NOT EXISTS account_ids (user_id TEXT PRIMARY KEY, public_id INTEGER NOT NULL UNIQUE CHECK(public_id BETWEEN 1000000 AND 99999999))').run().catch(error=>{ready.delete(db);throw error;}));
 await ready.get(db);
}
export async function accountId(db,uid,generate=()=>randomInt(1000000,100000000)){
 await initialize(db);
 for(let attempt=0;attempt<32;attempt++){
  const existing=await db.prepare('SELECT public_id FROM account_ids WHERE user_id = ?').bind(uid).first();
  if(existing)return String(existing.public_id);
  const candidate=generate();
  if(!Number.isInteger(candidate)||candidate<1000000||candidate>99999999)throw Error('Invalid public ID');
  // Both unique constraints arbitrate concurrent registrations and random collisions.
  await db.prepare('INSERT INTO account_ids (user_id, public_id) VALUES (?, ?) ON CONFLICT DO NOTHING').bind(uid,candidate).run();
 }
 const saved=await db.prepare('SELECT public_id FROM account_ids WHERE user_id = ?').bind(uid).first();
 if(saved)return String(saved.public_id);
 throw Error('Could not allocate public ID');
}
