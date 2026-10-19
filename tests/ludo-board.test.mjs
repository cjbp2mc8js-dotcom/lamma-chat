import {test}from'node:test';import assert from'node:assert/strict';import {LUDO_PATH,ludoPosition,ludoBoardHTML}from'../games/ludo-board.mjs';import{createGame}from'../games/engine.mjs';
test('classic cross board has 52 unique track squares within the 15×15 grid',()=>{assert.equal(LUDO_PATH.length,52);assert.equal(new Set(LUDO_PATH.map(p=>p.join(','))).size,52);for(const[r,c]of LUDO_PATH){assert(r>=0&&r<15&&c>=0&&c<15);assert(r>=6&&r<=8||c>=6&&c<=8);assert(!(r>=6&&r<=8&&c>=6&&c<=8));}});
test('red and yellow have opposing bases and every pawn position stays on board',()=>{for(let p=0;p<2;p++)for(let i=0;i<4;i++)for(let v=-1;v<=57;v++){const pos=ludoPosition(p,i,v);assert(pos.left>0&&pos.left<100);assert(pos.top>0&&pos.top<100);}const red=ludoPosition(0,0,-1),yellow=ludoPosition(1,0,-1);assert(red.left<40&&red.top>60);assert(yellow.left>60&&yellow.top<40);assert.equal(LUDO_PATH[0][1],6);assert.equal(LUDO_PATH[26][1],8);});
test('only current player legal pieces can be selected; all eight pawns remain visible',()=>{const s=createGame('ludo',1);let html=ludoBoardHTML(s,0,true,[]);assert.equal((html.match(/data-pawn-key=/g)||[]).length,8);assert.equal((html.match(/class="ludo-pawn[^\"]*playable/g)||[]).length,0);html=ludoBoardHTML(s,0,true,[{t:'pawn',i:2}]);assert.equal((html.match(/class="ludo-pawn[^\"]*playable/g)||[]).length,1);assert(html.includes('data-pawn-key="0-2"'));assert(html.includes('aria-label="الحجر 3 — أنت"'));});


test('every online seat sees its own base at bottom left with correctly aligned seats',async()=>{
 const {ludoPerspective,ludoSeats,ludoColorIndex}=await import('../games/ludo-board.mjs');
 for(const count of [2,4])for(let viewer=0;viewer<count;viewer++){
  const s=createGame('ludo',1,{playerCount:count});
  const own=ludoPerspective(ludoPosition(viewer,0,-1,count,2),viewer,count);
  assert(own.left<40&&own.top>60,`seat ${viewer}/${count}`);
  const seats=ludoSeats(viewer,count);assert.equal(seats.bottom[0],viewer);
  const order=[...seats.top,...seats.bottom];assert.equal(new Set(order).size,count);
  for(let p=0;p<count;p++)for(let v=0;v<=56;v++){
   const pos=ludoPerspective(ludoPosition(p,0,v,count,2),viewer,count);
   assert(pos.left>0&&pos.left<100&&pos.top>0&&pos.top<100);
  }
  const html=ludoBoardHTML(s,viewer,true,[]);
  assert(html.includes(`rotate(${-90*ludoColorIndex(viewer,count)} 300 300)`));
  const tag=html.match(new RegExp(`data-pawn-key="${viewer}-0"[^>]+`))[0];
  const rendered=tag.match(/left:([\d.]+)%;top:([\d.]+)%/);
  assert(Math.abs(Number(rendered[1])-own.left)<1e-8);assert(Math.abs(Number(rendered[2])-own.top)<1e-8);
 }
});
