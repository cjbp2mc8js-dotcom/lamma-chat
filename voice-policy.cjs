const {createHash}=require('node:crypto');
const TTL=600;
function fail(status,message){throw Object.assign(new Error(message),{status});}
function validate(body){const {action,roomId,sessionId}=body||{};if(!['join','renew','leave'].includes(action)||typeof roomId!=='string'||!/^[A-Za-z0-9_-]{1,128}$/.test(roomId)||typeof sessionId!=='string'||!/^[a-f0-9-]{36}$/.test(sessionId))fail(400,'طلب صوت غير صالح');return {action,roomId,sessionId};}
function authorize({action,uid,roomId,sessionId,room,session,now,rtcUid}){
 if(session&&(session.userId!==uid||session.roomId!==roomId||session.sessionId!==sessionId))fail(403,'جلسة غير مسموحة');
 if(action==='leave')return null;
 if(!room)fail(404,'المجلس غير موجود');
 const active=session&&session.expiresAt>now;
 if(action==='renew'&&!active)fail(403,'انتهت جلسة المجلس؛ ادخل من جديد');
 if(!active){if(room.isPublic!==true&&room.ownerId!==uid)fail(403,'المجلس غير متاح');const until=Number(room.lockedUntil||0);if(!Number.isFinite(until))fail(403,'إعداد القفل غير صالح');if(until>now&&room.ownerId!==uid)fail(403,'المجلس مغلق مؤقتاً');}
 return {userId:uid,roomId,sessionId,rtcUid:active?session.rtcUid:rtcUid,channel:'royal_'+createHash('sha256').update(roomId).digest('hex').slice(0,40),expiresAt:now+TTL*1000};
}
module.exports={TTL,validate,authorize};
