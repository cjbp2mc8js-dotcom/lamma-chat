import {importX509,jwtVerify} from 'jose';
const CERTS='https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';
const fail=(status,message)=>{throw Object.assign(new Error(message),{status});};
export function createIdentityVerifier(fetcher=fetch){
 let cache=null,pending=null;
 async function keys(){if(cache&&cache.until>Date.now())return cache;
  if(!pending)pending=(async()=>{const r=await fetcher(CERTS,{signal:AbortSignal.timeout(10000)});if(!r.ok)fail(503,'تعذر التحقق من تسجيل الدخول');const certs=await r.json();const age=Number(/max-age=(\d+)/.exec(r.headers.get('cache-control')||'')?.[1]||300);return cache={certs,imported:new Map(),until:Date.now()+Math.min(age,3600)*1000};})().finally(()=>{pending=null;});return pending;
 }
 return async function verify(raw,projectId){
  if(!raw||raw.length>8192)fail(401,'سجّل دخولك أولاً');
  try{const {payload}=await jwtVerify(raw,async header=>{if(header.alg!=='RS256'||typeof header.kid!=='string')throw Error('header');const set=await keys();const cert=Object.prototype.hasOwnProperty.call(set.certs,header.kid)?set.certs[header.kid]:null;if(!cert)throw Error('kid');if(!set.imported.has(header.kid))set.imported.set(header.kid,importX509(cert,'RS256'));return set.imported.get(header.kid);},{algorithms:['RS256'],audience:projectId,issuer:'https://securetoken.google.com/'+projectId});
   const now=Math.floor(Date.now()/1000);if(typeof payload.sub!=='string'||!payload.sub||payload.sub.length>128||!Number.isFinite(payload.iat)||payload.iat>now||!Number.isFinite(payload.auth_time)||payload.auth_time>now||!Number.isFinite(payload.exp)||payload.exp<=now)throw Error('claims');return payload.sub;
  }catch(e){if(e.status===503)throw e;fail(401,'انتهى تسجيل الدخول؛ سجّل دخولك من جديد');}
 };
}
export async function readRoom(projectId,roomId,idToken,fetcher=fetch){
 const r=await fetcher('https://firestore.googleapis.com/v1/projects/'+encodeURIComponent(projectId)+'/databases/(default)/documents/rooms/'+encodeURIComponent(roomId),{headers:{Authorization:'Bearer '+idToken},signal:AbortSignal.timeout(10000)});
 if(r.status===404)return null;if(r.status===401||r.status===403)fail(403,'تعذر قراءة المجلس؛ تحقق من صلاحية حسابك وقواعد Firestore');if(!r.ok)fail(503,'تعذر تحميل المجلس');
 const {fields:f={}}=await r.json();const lock=f.lockedUntil;let lockedUntil=0;if(lock)lockedUntil=lock.timestampValue?Date.parse(lock.timestampValue):Number(lock.integerValue??lock.doubleValue??NaN);
 return {ownerId:f.ownerId?.stringValue,isPublic:f.isPublic?.booleanValue===true,lockedUntil};
}
