import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../games/live.mjs',import.meta.url),'utf8').replace('export class LiveMatch','class LiveMatch')+'\nglobalThis.LiveMatch=LiveMatch;';
function fixture(api=async()=>({ticket:'opaque-ticket'})){
 let now=1000,next=0;const timers=new Map(),sockets=[],states=[],changes=[];
 const surface=()=>{const listeners=new Map();return {listeners,addEventListener(k,fn){if(!listeners.has(k))listeners.set(k,new Set());listeners.get(k).add(fn);},removeEventListener(k,fn){listeners.get(k)?.delete(fn);},emit(k){for(const fn of listeners.get(k)||[])fn();}};};
 const window={...surface(),LAMMA_VOICE_ENDPOINT:'https://worker.test',navigator:{onLine:true}};
 const document={...surface(),visibilityState:'visible'};
 class WebSocket{constructor(url){this.url=url;this.readyState=0;this.sent=[];sockets.push(this);}close(){this.closed=true;this.readyState=3;}send(m){this.sent.push(JSON.parse(m));}open(){this.readyState=1;this.onopen?.();}state(id='match'){this.onmessage?.({data:JSON.stringify({type:'state',data:{id}})});}}
 const schedule=(fn,ms,interval=false)=>{const id=++next;timers.set(id,{fn,ms,interval});return id;};
 const env={window,document,WebSocket,URL,Date:{now:()=>now},setTimeout:(fn,ms)=>schedule(fn,ms),setInterval:(fn,ms)=>schedule(fn,ms,true),clearTimeout:id=>timers.delete(id),clearInterval:id=>timers.delete(id)};
 vm.runInNewContext(source,env);
 const live=new env.LiveMatch({id:'match',api,onState:s=>states.push(s),onChange:()=>changes.push(true)});
 return {live,window,document,sockets,states,changes,timers,tick(ms){now+=ms;for(const [id,t]of [...timers])if(t.ms===ms){if(!t.interval)timers.delete(id);t.fn();}}};
}
const flush=async()=>{for(let i=0;i<6;i++)await Promise.resolve();};
test('live status requires a matching snapshot and the URL contains only an opaque ticket',async()=>{
 const f=fixture();await flush();const s=f.sockets[0];assert.equal(s.url.protocol,'wss:');assert.equal(s.url.searchParams.get('ticket'),'opaque-ticket');assert.equal(s.url.searchParams.has('token'),false);
 s.open();assert.equal(f.live.ready,false);s.state('another-match');assert.equal(f.states.length,0);assert.equal(f.live.ready,false);s.state();assert.equal(f.live.ready,true);assert.equal(f.live.status,'live');assert.equal(f.states.length,1);f.live.stop();assert.equal(f.timers.size,0);
});
test('opened sockets with no valid initial state time out and reconnect',async()=>{
 const f=fixture();await flush();f.sockets[0].open();f.tick(12000);assert.equal(f.sockets[0].closed,true);assert.equal(f.live.status,'retrying');f.tick(1000);await flush();assert.equal(f.sockets.length,2);f.live.stop();
});
test('silent live sockets lose live status and recover instead of remaining falsely connected',async()=>{
 const f=fixture();await flush();const s=f.sockets[0];s.open();s.state();f.tick(20000);assert.equal(s.sent.length,1);f.tick(20000);s.state();f.tick(20000);assert.equal(f.live.ready,true);f.tick(20000);f.tick(20000);assert.equal(f.live.ready,false);assert.equal(s.closed,true);assert.equal(f.live.status,'retrying');f.live.stop();
});
test('offline suspends reconnects and online resumes immediately with a new snapshot',async()=>{
 const f=fixture();await flush();f.sockets[0].open();f.sockets[0].state();f.window.navigator.onLine=false;f.window.emit('offline');assert.equal(f.live.status,'offline');assert.equal(f.timers.size,0);assert.equal(f.sockets[0].closed,true);
 f.window.navigator.onLine=true;f.window.emit('online');await flush();assert.equal(f.sockets.length,2);assert.equal(f.live.ready,false);f.sockets[1].open();f.sockets[1].state();assert.equal(f.live.ready,true);f.live.stop();
});
test('retired sockets and late tickets cannot change a newer connection or a stopped game',async()=>{
 const tickets=[];const f=fixture(()=>new Promise(resolve=>tickets.push(resolve)));f.window.emit('online');assert.equal(tickets.length,2);tickets[0]({ticket:'old'});await flush();assert.equal(f.sockets.length,0);tickets[1]({ticket:'new'});await flush();const s=f.sockets[0];const late=s.onmessage;f.live.restart();late({data:JSON.stringify({type:'state',data:{id:'match'}})});assert.equal(f.states.length,0);f.live.stop();tickets[2]({ticket:'after-stop'});await flush();assert.equal(f.sockets.length,1);assert.equal(f.timers.size,0);for(const target of [f.window,f.document])for(const listeners of target.listeners.values())assert.equal(listeners.size,0);
});
test('returning to a disconnected game retries immediately without opening duplicate sockets',async()=>{
 const f=fixture();await flush();f.sockets[0].onclose();assert.equal(f.live.status,'retrying');f.document.emit('visibilitychange');await flush();assert.equal(f.sockets.length,2);f.sockets[1].open();f.sockets[1].state();f.document.emit('visibilitychange');await flush();assert.equal(f.sockets.length,2);assert.equal(f.sockets[1].sent.length,1);f.live.stop();
});
