import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {accountId} from '../src/account-id.js';
import {syncPublicProfile,normalizePublicId} from '../src/directory.js';
import {createHandler} from '../src/index.js';
function fixture(){
 const sql=new DatabaseSync(':memory:');const db={prepare(q){let args=[];return {bind(...a){args=a;return this;},async run(){return sql.prepare(q).run(...args);},async first(){return sql.prepare(q).get(...args)||null;}};}};
 const env={DB:db,FIREBASE_PROJECT_ID:'test',ALLOWED_ORIGINS:'https://site.test'};let owner='caller',now=1000,room={name:'مجلس سجاد',ownerId:'target',isPublic:true,lockedUntil:0};
 const seen=[];const handler=createHandler({verify:async token=>{if(token!=='valid')throw Object.assign(Error('invalid'),{status:401});return owner;},roomReader:async(_,id)=>{seen.push(id);return room;},clock:()=>now});
 const search=async(body,token='valid',origin='https://site.test',path='/search')=>{const r=await handler(new Request('https://worker.test'+path,{method:'POST',headers:{Origin:origin,Authorization:'Bearer '+token},body:JSON.stringify(body)}),env);return {status:r.status,data:await r.json()};};
 return {db,sql,search,seen,setRoom:r=>room=r,setUid:u=>owner=u,setTime:t=>now=t};
}
test('search normalizes Arabic/Persian digits and finds both public profile and council by exact ID beyond the discovery list',async()=>{
 const f=fixture();await accountId(f.db,'target',()=>12345678);await syncPublicProfile(f.db,'target','سجاد');
 const r=await f.search({id:' ١٢٣٤٥٦٧٨ ',scope:'all',uid:'victim'});assert.equal(r.status,200);assert.deepEqual(r.data.person,{id:'12345678',name:'سجاد'});assert.equal(r.data.council.name,'مجلس سجاد');assert.equal(r.data.council.roomId,'target');assert.deepEqual(f.seen,['target']);assert(!JSON.stringify(r.data.person).includes('target'));
 assert.equal(normalizePublicId('۱۲۳۴۵۶۷۸'),'12345678');assert.equal((await f.search({id:'1234567x'})).status,400);assert.equal((await f.search({id:'12345678 OR 1=1'})).status,400);f.sql.close();
});
test('public lookup requires authentication, approved origin and an exact ID; no email or authentication UID is returned for people',async()=>{
 const f=fixture();await accountId(f.db,'target',()=>12345678);assert.equal((await f.search({id:'12345678'},'wrong')).status,401);assert.equal((await f.search({id:'12345678'},'valid','https://evil.test')).status,403);
 for(const body of [null,{}, {id:''},{id:'123'},{id:'01234567'},{id:'12345678',scope:'emails'}])assert.equal((await f.search(body)).status,400);
 f.setRoom(null);const found=await f.search({id:'12345678'});assert.deepEqual(found.data.person,{id:'12345678',name:'عضو لمة شات'});assert.equal(found.data.council,null);assert.deepEqual((await f.search({id:'99999999'})).data,{id:'99999999',person:null,council:null});f.sql.close();
});
test('scopes filter results and private, deleted or mismatched-owner councils stay hidden; temporary lock and owner entry are respected',async()=>{
 const f=fixture();await accountId(f.db,'target',()=>12345678);
 assert.equal((await f.search({id:'12345678',scope:'people'})).data.council,null);assert.equal((await f.search({id:'12345678',scope:'councils'})).data.person,null);
 for(const room of [null,{ownerId:'target',isPublic:false},{ownerId:'other',isPublic:true}]){f.setRoom(room);assert.equal((await f.search({id:'12345678'})).data.council,null);}
 f.setRoom({ownerId:'target',isPublic:true,lockedUntil:2000});assert.equal((await f.search({id:'12345678'})).data.council.canEnter,false);f.setUid('target');assert.equal((await f.search({id:'12345678'})).data.council.canEnter,true);f.setUid('caller');f.setTime(2000);assert.equal((await f.search({id:'12345678'})).data.council.canEnter,true);f.sql.close();
});
test('account profile sync updates only the verified caller, strips control characters and preserves stable IDs',async()=>{
 const f=fixture();await accountId(f.db,'target',()=>12345678);await syncPublicProfile(f.db,'target','سجاد');
 const r=await f.search({name:'منتظر\u202e',uid:'target'},'valid','https://site.test','/account-id');assert.equal(r.status,200);assert.equal(f.sql.prepare('SELECT name FROM public_profiles WHERE user_id=?').get('caller').name,'منتظر');assert.equal(f.sql.prepare('SELECT name FROM public_profiles WHERE user_id=?').get('target').name,'سجاد');assert.equal((await f.search({name:'اسم جديد'},'valid','https://site.test','/account-id')).data.id,r.data.id);f.sql.close();
});
test('search rate limits persist per verified account and reset each minute',async()=>{
 const f=fixture();for(let i=0;i<30;i++)assert.equal((await f.search({id:'99999999'})).status,200);assert.equal((await f.search({id:'99999999'})).status,429);f.setTime(61000);assert.equal((await f.search({id:'99999999'})).status,200);f.sql.close();
});
