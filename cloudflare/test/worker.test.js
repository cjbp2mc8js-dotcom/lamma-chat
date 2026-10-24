import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {SignJWT,importPKCS8} from 'jose';
import {createHandler} from '../src/index.js';
import {createIdentityVerifier,readRoom} from '../src/firebase.js';
function dbFixture(){const sql=new DatabaseSync(':memory:');sql.exec(readFileSync(new URL('../schema.sql',import.meta.url),'utf8'));return {sql,prepare(query){let args=[];return {bind(...a){args=a;return this;},async first(){return sql.prepare(query).get(...args)||null;},async run(){return sql.prepare(query).run(...args);},async all(){return {results:sql.prepare(query).all(...args)};}};}};}
const sessionId='12345678-1234-1234-1234-123456789abc';
function fixture(){const db=dbFixture();const config={DB:db,FIREBASE_PROJECT_ID:'project',AGORA_APP_ID:'0'.repeat(32),AGORA_APP_CERTIFICATE:'1'.repeat(32),ALLOWED_ORIGINS:'https://site.test'};let time=10000,room={ownerId:'owner',isPublic:true,lockedUntil:0},identity='visitor';const calls={verify:0,room:0};const handle=createHandler({verify:async t=>{calls.verify++;if(t!=='test')throw Object.assign(Error('bad token'),{status:401});return identity;},roomReader:async()=>{calls.room++;return room;},clock:()=>time});const tasks=[];
const request=async(action='join',options={})=>{const r=await handle(new Request('https://voice.test/'+(options.chat?'council-chat':'voice-token'),{method:'POST',headers:{Origin:'https://site.test',Authorization:'Bearer test',...options.headers},body:JSON.stringify({action,roomId:'owner',sessionId,...options.body})}),config,{waitUntil:p=>tasks.push(p)});await Promise.all(tasks);return {r,data:await r.json()};};
return {db,config,request,calls,handle,setTime:t=>time=t,setRoom:r=>room=r,setUid:u=>identity=u};}
test('creates real Agora token, stable room channel and session UID on duplicate joins',async()=>{const f=fixture();const a=await f.request(),b=await f.request();assert.equal(a.r.status,200);assert.match(a.data.token,/^007/);assert.equal(a.data.uid,b.data.uid);assert.equal(a.data.channel,b.data.channel);assert.equal(f.db.sql.prepare('SELECT count(*) AS n FROM voice_sessions').get().n,1);f.db.sql.close();});
test('new visitor rejected while locked, owner admitted, exact expiry admits visitor',async()=>{const f=fixture();f.setRoom({ownerId:'owner',isPublic:true,lockedUntil:10001});assert.equal((await f.request()).r.status,403);f.setUid('owner');assert.equal((await f.request()).r.status,200);f.setUid('visitor');f.setTime(10001);assert.equal((await f.request()).r.status,200);f.db.sql.close();});
test('admitted visitor renews during lock, but cannot renew after leave or lease expiry',async()=>{const f=fixture();const a=await f.request();f.setRoom({ownerId:'owner',isPublic:true,lockedUntil:900000});const b=await f.request('renew');assert.equal(b.r.status,200);assert.equal(a.data.uid,b.data.uid);assert.equal((await f.request('leave')).r.status,200);assert.equal((await f.request('renew')).r.status,403);assert.equal((await f.request()).r.status,403);f.setRoom({ownerId:'owner',isPublic:true,lockedUntil:0});await f.request();f.setTime(610000);assert.equal((await f.request('renew')).r.status,403);f.db.sql.close();});
test('cross-account session reuse does not authenticate another user',async()=>{const f=fixture();const a=await f.request();f.setUid('other');assert.equal((await f.request('renew')).r.status,403);const b=await f.request();assert.notEqual(a.data.uid,b.data.uid);f.db.sql.close();});
test('CORS is restricted, preflight succeeds, missing bearer rejected and no secret leaks',async()=>{const f=fixture();assert.equal((await f.request('join',{headers:{Origin:'https://evil.test'}})).r.status,403);assert.equal(f.calls.verify,0);const {r}=await f.request('join',{headers:{Authorization:''}});assert.equal(r.status,401);const response=await f.handle(new Request('https://voice.test/voice-token',{method:'OPTIONS',headers:{Origin:'https://site.test'}}),f.config);assert.equal(response.status,204);assert.equal(response.headers.get('Access-Control-Allow-Origin'),'https://site.test');delete f.config.AGORA_APP_CERTIFICATE;const unready=await f.request();assert.equal(unready.r.status,503);assert(!JSON.stringify(unready.data).includes('111111'));f.db.sql.close();});
test('missing/private/deleted rooms and oversized/invalid requests fail closed',async()=>{const f=fixture();f.setRoom(null);assert.equal((await f.request()).r.status,404);f.setRoom({ownerId:'owner',isPublic:false,lockedUntil:0});assert.equal((await f.request()).r.status,403);assert.equal((await f.request('join',{body:{roomId:'../private'}})).r.status,400);assert.equal((await f.request('join',{body:{extra:'x'.repeat(3000)}})).r.status,413);f.db.sql.close();});
test('Firestore typed values converted; permissions and upstream failures rejected',async()=>{const f=async()=>new Response(JSON.stringify({fields:{ownerId:{stringValue:'owner'},isPublic:{booleanValue:true},lockedUntil:{integerValue:'123'}}}),{status:200});assert.deepEqual(await readRoom('p','r','t',f),{name:undefined,ownerId:'owner',isPublic:true,lockedUntil:123});assert.equal(await readRoom('p','r','t',async()=>new Response(null,{status:404})),null);await assert.rejects(()=>readRoom('p','r','t',async()=>new Response(null,{status:403})));await assert.rejects(()=>readRoom('p','r','t',async()=>new Response(null,{status:500})));});
test('real RSA signature validation enforces Firebase issuer, project, time and algorithm',async()=>{const dir=mkdtempSync(join(tmpdir(),'lamma-test-jwt-'));try{const keyFile=join(dir,'key.pem'),certFile=join(dir,'cert.pem');execFileSync('openssl',['req','-x509','-newkey','rsa:2048','-nodes','-keyout',keyFile,'-out',certFile,'-days','1','-subj','/CN=local-test-only'],{stdio:'ignore'});const privateKey=await importPKCS8(readFileSync(keyFile,'utf8'),'RS256');const cert=readFileSync(certFile,'utf8');let fetches=0;const verify=createIdentityVerifier(async()=>{fetches++;return new Response(JSON.stringify({test:cert}),{headers:{'Cache-Control':'max-age=3600'}})});const now=Math.floor(Date.now()/1000),base={sub:'user',aud:'project',iss:'https://securetoken.google.com/project',iat:now,auth_time:now,exp:now+3600};const sign=(p=base,head={alg:'RS256',kid:'test'})=>new SignJWT(p).setProtectedHeader(head).sign(privateKey);assert.equal(await verify(await sign(),'project'),'user');assert.equal(fetches,1);for(const patch of [{aud:'other'},{iss:'https://evil.test'},{exp:now-1},{iat:now+100},{auth_time:now+100},{sub:''}])await assert.rejects(()=>sign({...base,...patch}).then(t=>verify(t,'project')));await assert.rejects(()=>sign(base,{alg:'RS256',kid:'evil'}).then(t=>verify(t,'project')));const good=await sign();const parts=good.split('.');parts[1]=Buffer.from(JSON.stringify({...base,sub:'attacker'})).toString('base64url');await assert.rejects(()=>verify(parts.join('.'),'project'));assert.equal(fetches,1);}finally{rmSync(dir,{recursive:true,force:true});}});

const messageId='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
test('council chat persists messages for admitted members, retries do not duplicate, names and IDs cannot spoof sender',async()=>{const f=fixture();await f.request();const send=()=>f.request('send',{chat:true,body:{text:'مرحبا بالمجلس',name:'سجاد',messageId,userId:'owner'}});const a=await send();assert.equal(a.r.status,200,JSON.stringify(a.data));assert.equal(a.data.messages[0].userId,'visitor');assert.equal(a.data.messages[0].text,'مرحبا بالمجلس');assert.equal((await send()).data.messages.length,1);const b=await f.request('list',{chat:true});assert.equal(b.r.status,200);assert.equal(b.data.messages.length,1);f.db.sql.close();});
test('council chat rejects missing, expired, cross-account and cross-room leases, and deleted rooms',async()=>{const f=fixture();assert.equal((await f.request('list',{chat:true})).r.status,403);await f.request();assert.equal((await f.request('list',{chat:true,body:{roomId:'other'}})).r.status,403);f.setUid('other');assert.equal((await f.request('list',{chat:true})).r.status,403);f.setUid('visitor');f.setTime(610000);assert.equal((await f.request('list',{chat:true})).r.status,403);f.setTime(10000);f.setRoom(null);assert.equal((await f.request('list',{chat:true})).r.status,404);f.db.sql.close();});
test('chat enforces text limits and rate limits and isolates room history',async()=>{const f=fixture();await f.request();const send=(text,id=messageId)=>f.request('send',{chat:true,body:{text,name:'ضيف',messageId:id}});assert.equal((await send('')).r.status,400);assert.equal((await send('x'.repeat(501))).r.status,400);assert.equal((await send('hello')).r.status,200);assert.equal((await send('different')).r.status,409);assert.equal((await send('second','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb')).r.status,429);f.setTime(11500);assert.equal((await send('second','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb')).r.status,200);await f.request('join',{body:{roomId:'other',sessionId:'22345678-1234-1234-1234-123456789abc'}});assert.deepEqual((await f.request('list',{chat:true,body:{roomId:'other',sessionId:'22345678-1234-1234-1234-123456789abc'}})).data.messages,[]);f.setRoom({ownerId:'owner',isPublic:true,lockedUntil:900000});assert.equal((await f.request('list',{chat:true})).r.status,200);f.db.sql.close();});
test('fresh admission hides earlier messages only for the returning member; renewal preserves the current visit',async()=>{
 const f=fixture();await f.request();
 await f.request('send',{chat:true,body:{text:'قبل الخروج',name:'أول',messageId}});
 f.setUid('second');f.setTime(10000);await f.request();
 assert.equal((await f.request('list',{chat:true})).data.messages.length,1);
 f.setUid('visitor');await f.request('leave');f.setTime(12000);await f.request();
 assert.deepEqual((await f.request('list',{chat:true})).data.messages,[]);
 f.setUid('second');assert.equal((await f.request('list',{chat:true})).data.messages[0].text,'قبل الخروج');
 f.setTime(13000);await f.request('send',{chat:true,body:{text:'رسالة جديدة',name:'ثاني',messageId:'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'}});
 f.setUid('visitor');assert.deepEqual((await f.request('list',{chat:true})).data.messages.map(m=>m.text),['رسالة جديدة']);
 f.setTime(14000);await f.request('renew');assert.equal((await f.request('list',{chat:true})).data.messages.length,1);
 f.setTime(15000);await f.request('join');assert.equal((await f.request('list',{chat:true})).data.messages.length,1);
 f.db.sql.close();
});

test('account IDs are authenticated, stable across devices, unique and independent of Agora or room leases',async()=>{
 const f=fixture();delete f.config.AGORA_APP_CERTIFICATE;
 const call=(token='test',body={})=>f.handle(new Request('https://voice.test/account-id',{method:'POST',headers:{Origin:'https://site.test',Authorization:'Bearer '+token},body:JSON.stringify(body)}),f.config);
 assert.equal((await call('invalid')).status,401);
 const responses=await Promise.all(Array.from({length:12},()=>call('test',{userId:'victim',id:1234567}).then(r=>r.json())));
 const id=responses[0].id;assert.match(id,/^\d{7,8}$/);assert(responses.every(r=>r.id===id));
 f.setUid('other');const other=await (await call()).json();assert.notEqual(other.id,id);
 f.setUid('visitor');assert.equal((await (await call()).json()).id,id);
 assert.equal(f.calls.room,0);assert.equal(f.db.sql.prepare('SELECT count(*) n FROM account_ids').get().n,2);f.db.sql.close();
});
test('numeric ID collisions retry without overwriting another account',async()=>{
 const {accountId}=await import('../src/account-id.js');const db=dbFixture();
 assert.equal(await accountId(db,'one',()=>1234567),'1234567');
 let calls=0;assert.equal(await accountId(db,'two',()=>++calls<3?1234567:99999999),'99999999');
 assert.equal(await accountId(db,'one',()=>{throw Error('must not generate');}),'1234567');
 db.sql.close();
});
