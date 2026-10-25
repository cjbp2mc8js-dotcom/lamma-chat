import {gameRequest} from './games.js';
const reply=(x,status=200)=>Response.json(x,{status,headers:{'Cache-Control':'no-store'}});
export class GameLiveRoom{
 constructor(ctx,env){this.ctx=ctx;this.env=env;}
 async fetch(req){const path=new URL(req.url).pathname;
  if(path==='/ticket'){const {uid,id,until}=await req.json();if(typeof uid!=='string'||typeof id!=='string')return reply({error:'Invalid ticket'},400);const token=crypto.randomUUID();await this.ctx.storage.put('ticket:'+uid,{uid,id,token,expires:Date.now()+30000,until});return reply({ticket:token});}
  if(path==='/notify'){await this.broadcast();return reply({ok:true});}
  if(req.headers.get('Upgrade')?.toLowerCase()!=='websocket')return reply({error:'WebSocket required'},426);
  const token=new URL(req.url).searchParams.get('ticket');if(!token||token.length>60)return reply({error:'Invalid ticket'},401);
  const found=await this.ctx.storage.transaction(async tx=>{for(const[key,value]of await tx.list({prefix:'ticket:'})){if(value.expires<Date.now()){await tx.delete(key);continue;}if(value.token===token){await tx.delete(key);return value;}}});
  if(!found||found.until<=Date.now())return reply({error:'Expired ticket'},401);
  const old=this.ctx.getWebSockets().filter(s=>s.deserializeAttachment()?.uid===found.uid);if(old.length>=2)old[0].close(1000,'Replaced by new session');
  const pair=new WebSocketPair(),client=pair[0],socket=pair[1];this.ctx.acceptWebSocket(socket);socket.serializeAttachment({...found,token:undefined,lastSync:0});
  await this.snapshot(socket);return new Response(null,{status:101,webSocket:client});
 }
 async snapshot(socket){const a=socket.deserializeAttachment();if(!a||a.until<=Date.now()){socket.close(1008,'Session expired');return;}try{const data=await gameRequest({db:this.env.DB,uid:a.uid,input:{action:'poll',id:a.id}});socket.send(JSON.stringify({type:'state',data}));}catch{socket.close(1008,'Match unavailable');}}
 async broadcast(){await Promise.allSettled(this.ctx.getWebSockets().map(s=>this.snapshot(s)));}
 async webSocketMessage(socket,message){if(typeof message!=='string'||message.length>200){socket.close(1009,'Message too large');return;}let m;try{m=JSON.parse(message);}catch{socket.close(1008,'Invalid message');return;}const a=socket.deserializeAttachment();if(m.type!=='sync'||!a){socket.close(1008,'Unsupported message');return;}if(Date.now()-a.lastSync<2000)return;a.lastSync=Date.now();socket.serializeAttachment(a);await this.snapshot(socket);}
 webSocketClose(socket,code){socket.close(code===1005?1000:code);}
 webSocketError(socket){socket.close(1011,'Connection error');}
}
