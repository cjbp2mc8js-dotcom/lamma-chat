import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
import {mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {importPKCS8,SignJWT} from 'jose';
import assert from 'node:assert/strict';
const dir=mkdtempSync(join(tmpdir(),'voice-workerd-'));
let mf;
try{
 const k=join(dir,'key.pem'),c=join(dir,'cert.pem');execFileSync('openssl',['req','-x509','-newkey','rsa:2048','-nodes','-keyout',k,'-out',c,'-days','1','-subj','/CN=runtime-test'],{stdio:'ignore'});const cert=readFileSync(c,'utf8');const key=await importPKCS8(readFileSync(k,'utf8'),'RS256');const now=Math.floor(Date.now()/1000);const jwt=await new SignJWT({sub:'visitor',aud:'project',iss:'https://securetoken.google.com/project',iat:now,auth_time:now,exp:now+3600}).setProtectedHeader({alg:'RS256',kid:'test'}).sign(key);
 let lockedUntil=0;
 mf=new Miniflare(convertV4MiniflareOptions({modules:true,scriptPath:'dist/index.js',compatibilityDate:'2026-10-18',compatibilityFlags:['nodejs_compat'],d1Databases:['DB'],bindings:{FIREBASE_PROJECT_ID:'project',AGORA_APP_ID:'0'.repeat(32),AGORA_APP_CERTIFICATE:'1'.repeat(32),ALLOWED_ORIGINS:'https://site.test'},outboundService:async(req)=>{
  if(req.url.includes('www.googleapis.com/robot'))return new Response(JSON.stringify({test:cert}),{headers:{'Cache-Control':'max-age=3600'}});
  if(req.url.includes('firestore.googleapis.com'))return new Response(JSON.stringify({fields:{ownerId:{stringValue:'owner'},isPublic:{booleanValue:true},lockedUntil:{integerValue:String(lockedUntil)}}}));
  throw Error('Unexpected external request');
 }}));
 const db=await mf.getD1Database('DB');await db.exec(readFileSync('schema.sql','utf8').replaceAll('\n',' '));
 const call=async(action,id='12345678-1234-1234-1234-123456789abc')=>{const r=await mf.dispatchFetch('https://voice.test/voice-token',{method:'POST',headers:{Origin:'https://site.test',Authorization:'Bearer '+jwt},body:JSON.stringify({action,roomId:'owner',sessionId:id})});return {status:r.status,data:await r.json()};};
 const a=await call('join');assert.equal(a.status,200,JSON.stringify(a));assert.match(a.data.token,/^007/);lockedUntil=Date.now()+3600000;assert.equal((await call('renew')).status,200);assert.equal((await call('join','22345678-1234-1234-1234-123456789abc')).status,403);assert.equal((await call('leave')).status,200);assert.equal((await call('renew')).status,403);console.log('PASS: real Workers runtime, RSA verification, D1 storage, Agora token, lock, renew and leave (upstream Firebase mocked).');
}finally{if(mf)await mf.dispose();rmSync(dir,{recursive:true,force:true});}
