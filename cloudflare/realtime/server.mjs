// Optional Node deployment: Socket.IO gateway to the existing authoritative API.
import http from 'node:http';
import {Server} from 'socket.io';
const origin=process.env.APP_ORIGIN,backend=process.env.GAME_API;
if(!origin||!backend||!backend.startsWith('https://'))throw Error('Set APP_ORIGIN and HTTPS GAME_API');
const server=http.createServer((req,res)=>{res.writeHead(req.url==='/health'?200:404,{'Content-Type':'application/json'});res.end(JSON.stringify({ok:req.url==='/health'}));});
const io=new Server(server,{cors:{origin,methods:['GET','POST']},allowRequest:(req,cb)=>cb(null,req.headers.origin===origin),maxHttpBufferSize:4096});
async function api(token,input){const r=await fetch(backend,{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(input),signal:AbortSignal.timeout(12000)});const data=await r.json();if(!r.ok)throw Object.assign(Error(data.error||'Game service unavailable'),{status:r.status});return data;}
io.use(async(socket,next)=>{try{const token=socket.handshake.auth?.token;if(typeof token!=='string'||token.length>8192)throw Error('Authentication required');await api(token,{action:'gold-status'});socket.data.token=token;next();}catch{next(Error('Authentication required'));}});
async function snapshot(socket){if(!socket.data.matchId)return;const r=await api(socket.data.token,{action:'poll',id:socket.data.matchId});socket.emit('state_updated',r);return r;}
async function broadcast(id){await Promise.allSettled([...await io.in(id).fetchSockets()].map(snapshot));}
io.on('connection',socket=>{
 let queue=Promise.resolve(),closed=false,count=0,pending=0,polling=false,windowStart=Date.now();
 function handle(name,fn){socket.on(name,(data,ack)=>{if(Date.now()-windowStart>10000){count=0;windowStart=Date.now();}if(++count>30||pending>=8){if(typeof ack==='function')ack({ok:false,error:'Too many requests'});return;}pending++;queue=queue.then(async()=>{try{if(closed)return;const result=await fn(data||{});if(typeof ack==='function')ack({ok:true,result});}catch(e){if(typeof ack==='function')ack({ok:false,error:e.message,status:e.status||503});if(e.status===401)socket.disconnect(true);}finally{pending--;}});});}
 handle('join_match',async data=>{const r=await api(socket.data.token,{action:'join',kind:'ludo',variant:data.variant||'classic',playerCount:data.playerCount,stake:data.stake,name:data.name});if(closed)return;if(socket.data.matchId)await socket.leave(socket.data.matchId);socket.data.matchId=r.id;await socket.join(r.id);socket.emit('state_updated',r);await broadcast(r.id);return r;});
 handle('resume_match',async data=>{const r=await api(socket.data.token,{action:'poll',id:data.matchId});if(r.kind!=='ludo')throw Error('Ludo match required');if(closed)return;if(socket.data.matchId)await socket.leave(socket.data.matchId);socket.data.matchId=r.id;await socket.join(r.id);socket.emit('state_updated',r);return r;});
 async function move(data,action){const id=socket.data.matchId;if(!id)throw Error('Join a match first');const r=await api(socket.data.token,{action:'move',id,version:data.version,requestId:data.requestId,move:action});await broadcast(id);return r;}
 handle('roll_dice',data=>move(data,{t:'roll'}));
 handle('move_piece',data=>{if(!Number.isInteger(data.pieceId)||data.pieceId<0||data.pieceId>3)throw Error('Invalid piece');return move(data,{t:'pawn',i:data.pieceId});});
 handle('sync_match',()=>snapshot(socket));
 handle('leave_match',async()=>{const id=socket.data.matchId;if(!id)return;const r=await api(socket.data.token,{action:'leave',id});socket.data.matchId=null;await socket.leave(id);await broadcast(id);return r;});
 // Polling bridge covers updates from existing HTTP clients; this is not a DO deployment.
 const timer=setInterval(()=>{if(!closed&&socket.data.matchId&&!polling&&pending===0){polling=true;queue=queue.then(()=>closed?undefined:snapshot(socket)).catch(e=>{if(e.status===401)socket.disconnect(true);}).finally(()=>polling=false);}},2500);
 socket.on('disconnect',()=>{closed=true;clearInterval(timer);});
});
server.listen(Number(process.env.PORT||3000));
function shutdown(){io.close(()=>server.close());setTimeout(()=>process.exit(0),10000).unref();}
process.on('SIGTERM',shutdown);process.on('SIGINT',shutdown);
