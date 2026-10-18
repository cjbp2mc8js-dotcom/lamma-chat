const {onRequest}=require('firebase-functions/v2/https');
const {defineSecret,defineString}=require('firebase-functions/params');
const {initializeApp}=require('firebase-admin/app');
const {getAuth}=require('firebase-admin/auth');
const {getFirestore,Timestamp}=require('firebase-admin/firestore');
const {RtcTokenBuilder,RtcRole}=require('agora-token');
const {randomInt,createHash}=require('node:crypto');
const {TTL,validate,authorize}=require('./policy');
initializeApp();
const certificate=defineSecret('AGORA_APP_CERTIFICATE');
const appId=defineString('AGORA_APP_ID',{default:'d8e6d522c0fb4f4682669a92ff60b5eb'});
exports.voiceToken=onRequest({region:'us-central1',cors:true,secrets:[certificate],maxInstances:3,timeoutSeconds:30},async(req,res)=>{
 res.set('Cache-Control','no-store');
 if(req.method!=='POST')return res.status(405).json({error:'POST required'});
 try{
  const match=/^Bearer (.+)$/.exec(req.headers.authorization||'');if(!match)return res.status(401).json({error:'سجّل دخولك أولاً'});
  let decoded;try{decoded=await getAuth().verifyIdToken(match[1],true);}catch{return res.status(401).json({error:'انتهى تسجيل الدخول؛ سجّل دخولك من جديد'});}
  const input=validate(req.body),db=getFirestore(),uid=decoded.uid;
  const key=createHash('sha256').update(uid+':'+input.sessionId).digest('hex');
  const sr=db.collection('voiceSessions').doc(key),rr=db.collection('rooms').doc(input.roomId);
  const issued=await db.runTransaction(async tx=>{
   const [room,session]=await Promise.all([tx.get(rr),tx.get(sr)]);
   const next=authorize({...input,uid,room:room.exists?room.data():null,session:session.exists?session.data():null,now:Date.now(),rtcUid:randomInt(1,2147483647)});
   if(!next){tx.delete(sr);return null;}
   const token=RtcTokenBuilder.buildTokenWithUid(appId.value(),certificate.value(),next.channel,next.rtcUid,RtcRole.PUBLISHER,TTL,TTL);
   tx.set(sr,{...next,purgeAt:Timestamp.fromMillis(next.expiresAt)});return {appId:appId.value(),channel:next.channel,uid:next.rtcUid,token};
  });
  return res.json(issued||{ok:true});
 }catch(e){return res.status(e.status||500).json({error:e.status?e.message:'تعذر تشغيل خدمة الصوت. حاول لاحقاً.'});}
});
