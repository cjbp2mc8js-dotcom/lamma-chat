const {test}=require('node:test');const assert=require('node:assert/strict');const vm=require('node:vm');const fs=require('node:fs');
function fixture(fetch){const values=[{textContent:''}],copies=[{}],retries=[{}];const context={URL,AbortController,setTimeout,clearTimeout,fetch,document:{querySelectorAll:s=>s==='[data-account-id]'?values:s==='[data-copy-account-id]'?copies:retries}};context.window=context;context.LAMMA_VOICE_ENDPOINT='https://voice.test/voice-token';vm.runInNewContext(fs.readFileSync('implementation/account-id.js','utf8'),context);return {context,values,copies,retries};}
const user=uid=>({uid,getIdToken:async()=>uid});
test('public ID loads once, copies only when ready and never leaks a previous account on switching',async()=>{
 const waits=[];const f=fixture((url,options)=>new Promise(resolve=>waits.push({resolve,url,options})));
 f.context.setLammaAccountUser(user('first'));const first=f.context.loadLammaAccountId();assert.equal(f.context.loadLammaAccountId(),first);await new Promise(setImmediate);assert.equal(waits.length,1);assert.equal(f.copies[0].disabled,true);
 f.context.setLammaAccountUser(user('second'));const second=f.context.loadLammaAccountId();await new Promise(setImmediate);
 waits[0].resolve({ok:true,status:200,json:async()=>({id:'1234567'})});await first;assert.equal(f.context.lammaPublicId,null);
 waits[1].resolve({ok:true,status:200,json:async()=>({id:'87654321'})});await second;assert.equal(f.values[0].textContent,'87654321');assert.equal(f.copies[0].disabled,false);assert.equal(waits[1].options.headers.Authorization,'Bearer second');
 f.context.setLammaAccountUser(null);assert.equal(f.context.lammaPublicId,null);assert.equal(f.copies[0].disabled,true);
});
test('failure has retry and no UID fallback; token expiry refreshes before retrying',async()=>{
 let calls=0;const f=fixture(async()=>{calls++;return calls===1?{status:401}:calls===2?{status:503,ok:false,json:async()=>({})}:{status:200,ok:true,json:async()=>({id:'12345678'})};});
 const refresh=[];f.context.setLammaAccountUser({uid:'private-firebase-uid',getIdToken:async force=>{refresh.push(force);return 'token';}});await f.context.loadLammaAccountId();assert.deepEqual(refresh,[false,true]);assert.equal(f.retries[0].hidden,false);assert.equal(f.context.lammaPublicId,null);await f.context.loadLammaAccountId();assert.equal(f.context.lammaPublicId,'12345678');assert.equal(f.retries[0].hidden,true);
});
