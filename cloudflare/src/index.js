import {createHash,randomInt} from 'node:crypto';
import agora from 'agora-token';
import policy from '../../voice-policy.cjs';
import {createIdentityVerifier,readRoom} from './firebase.js';
import {councilChat} from './chat.js';
import {accountId} from './account-id.js';
import {gameRequest} from './games.js';
const {TTL,validate,authorize}=policy;
const verifyIdentity=createIdentityVerifier();
const json=(value,status,headers)=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',...headers}});
const fail=(status,message)=>{throw Object.assign(new Error(message),{status});};
function issueToken(env,session){return agora.RtcTokenBuilder.buildTokenWithUid(env.AGORA_APP_ID,env.AGORA_APP_CERTIFICATE,session.channel,session.rtcUid,agora.RtcRole.PUBLISHER,TTL,TTL);}
export function createHandler({verify=verifyIdentity,roomReader=readRoom,clock=Date.now,sign=issueToken}={}){
 return async function handle(request,env,ctx={waitUntil(){}}){
  const origin=request.headers.get('Origin');const allowed=(env.ALLOWED_ORIGINS||'').split(',').map(s=>s.trim()).filter(Boolean);
  if(origin&&!allowed.includes(origin))return json({error:'الموقع غير مسموح'},403,{});
  const headers=origin?{'Access-Control-Allow-Origin':origin,'Vary':'Origin','Access-Control-Allow-Methods':'POST, OPTIONS','Access-Control-Allow-Headers':'Authorization, Content-Type','Access-Control-Max-Age':'600'}:{};
  const path=new URL(request.url).pathname;
  if(path==='/health'&&request.method==='GET')return json({ok:true,service:'lamma-royal-voice',features:['council-chat','fresh-chat-entry','numeric-account-id','online-games']},200,headers);
  if(!['/','/voice-token','/council-chat','/account-id','/games'].includes(path))return json({error:'Not found'},404,headers);
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
  if(request.method!=='POST')return json({error:'POST required'},405,headers);
  try{
   if(!env.DB||!env.FIREBASE_PROJECT_ID||(!['/account-id','/games'].includes(path)&&(!/^\w{32}$/.test(env.AGORA_APP_ID||'')||!/^\w{32}$/.test(env.AGORA_APP_CERTIFICATE||''))))fail(503,'خدمة الصوت تحتاج إكمال إعداد الخادم');
   const match=/^Bearer (.+)$/.exec(request.headers.get('Authorization')||'');if(!match)fail(401,'سجّل دخولك أولاً');
   const uid=await verify(match[1],env.FIREBASE_PROJECT_ID);
   const size=Number(request.headers.get('Content-Length')||0);if(size>2048)fail(413,'طلب كبير');
   // Read the body with a hard cap, including chunked requests.
   const reader=request.body?.getReader();let body='',bytes=0;const decoder=new TextDecoder();if(reader)while(true){const part=await reader.read();if(part.done)break;bytes+=part.value.byteLength;if(bytes>2048){await reader.cancel();fail(413,'طلب كبير');}body+=decoder.decode(part.value,{stream:true});}body+=decoder.decode();
   let parsed;try{parsed=JSON.parse(body);}catch{fail(400,'طلب غير صالح');}if(path==='/games')return json(await gameRequest({db:env.DB,uid,input:parsed,now:clock(),ctx}),200,headers);if(path==='/account-id')return json({id:await accountId(env.DB,uid)},200,headers);const chat=path==='/council-chat',input=validate(chat?{...parsed,action:'renew'}:parsed),now=clock();
   const key=createHash('sha256').update(uid+':'+input.sessionId).digest('hex');
   const stored=await env.DB.prepare('SELECT data FROM voice_sessions WHERE id = ?').bind(key).first();
   const session=stored?JSON.parse(stored.data):null;
   const room=input.action==='leave'?null:await roomReader(env.FIREBASE_PROJECT_ID,input.roomId,match[1]);
   if(chat){authorize({...input,uid,room,session,now});return json(await councilChat({db:env.DB,input:parsed,uid,session,now,ctx}),200,headers);}
   const next=authorize({...input,uid,room,session,now,rtcUid:randomInt(1,2147483647)});
   if(!next){await env.DB.prepare('DELETE FROM voice_sessions WHERE id = ?').bind(key).run();return json({ok:true},200,headers);}
   // Prove signing is configured before extending a session.
   const initialToken=sign(env,next);
   let saved;
   if(input.action==='renew')saved=await env.DB.prepare('UPDATE voice_sessions SET data = ?, expires_at = ? WHERE id = ? AND expires_at > ? RETURNING data').bind(JSON.stringify(next),next.expiresAt,key,now).first();
   else saved=await env.DB.prepare("INSERT INTO voice_sessions (id, data, expires_at) VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET data = CASE WHEN voice_sessions.expires_at > ? THEN json_set(excluded.data, '$.rtcUid', json_extract(voice_sessions.data, '$.rtcUid'), '$.joinedAt', COALESCE(json_extract(voice_sessions.data, '$.joinedAt'), 0)) ELSE excluded.data END, expires_at = excluded.expires_at RETURNING data").bind(key,JSON.stringify(next),next.expiresAt,now).first();
   if(!saved)fail(403,'انتهت جلسة المجلس؛ ادخل من جديد');
   const current=JSON.parse(saved.data),token=current.rtcUid===next.rtcUid?initialToken:sign(env,current);
   if(input.action==='join')ctx.waitUntil(env.DB.prepare('DELETE FROM voice_sessions WHERE id IN (SELECT id FROM voice_sessions WHERE expires_at <= ? LIMIT 50)').bind(now).run().catch(()=>{}));
   return json({appId:env.AGORA_APP_ID,channel:current.channel,uid:current.rtcUid,token},200,headers);
  }catch(e){return json({error:e.status?e.message:(path==='/games'?'تعذر الاتصال باللعبة. حاول مجدداً.':path==='/account-id'?'تعذر تحميل الآيدي. حاول مجدداً.':path==='/council-chat'?'تعذر تشغيل الدردشة. حاول لاحقاً.':'تعذر تشغيل خدمة الصوت. حاول لاحقاً.')},e.status||503,headers);}
 };
}
export default {fetch:createHandler()};
