import {test} from 'node:test';
import assert from 'node:assert/strict';
import {BoardInput} from '../src/input.js';

function harness(){
 const handlers={},captured=new Set(),events=[];
 const canvas={addEventListener:(name,fn)=>handlers[name]=fn,setPointerCapture:id=>captured.add(id),hasPointerCapture:id=>captured.has(id),releasePointerCapture:id=>captured.delete(id)};
 const input=new BoardInput(canvas,{
  cellAt:e=>e.cell??-1,directionAt:e=>e.direction??null,
  selectCell:i=>events.push(['cell',i]),selectRange:(a,b)=>events.push(['range',a,b]),chooseDirection:d=>events.push(['direction',d])
 });
 const emit=(type,extra={})=>handlers[type]({button:0,isPrimary:true,pointerId:1,clientX:0,clientY:0,...extra});
 return{emit,events,captured,input};
}
test('mouse and touch drags select a range without clicking on release',()=>{
 for(const pointerType of ['mouse','touch']){const h=harness();h.emit('pointerdown',{pointerType,cell:20});h.emit('pointermove',{pointerType,clientX:40,cell:22});h.emit('pointerup',{pointerType,clientX:40,cell:22,direction:0});assert.deepEqual(h.events,[['range',20,20],['range',20,22],['range',20,22]]);assert.equal(h.captured.size,0);}
});
test('ordinary clicks still select, arrow zero commits exactly once',()=>{
 const h=harness();h.emit('pointerdown',{cell:20});h.emit('pointerup',{clientX:2,cell:20});h.emit('pointerdown',{direction:0});h.emit('pointerup',{direction:0});h.emit('pointerup',{direction:0});assert.deepEqual(h.events,[['cell',20],['direction',0]]);
});
test('long release without move events is a drag, never an arrow click',()=>{
 const h=harness();h.emit('pointerdown',{cell:20});h.emit('pointerup',{clientX:80,cell:22,direction:3});assert(h.events.every(e=>e[0]==='range'));assert.deepEqual(h.events.at(-1),['range',20,22]);
});
test('pointer cancellation and lost capture prevent phantom clicks',()=>{
 for(const kind of ['pointercancel','lostpointercapture']){const h=harness();h.emit('pointerdown',{direction:2});h.emit(kind);h.emit('pointerup',{direction:2});assert.deepEqual(h.events,[]);assert.equal(h.captured.size,0);}
});
test('secondary pointers cannot replace or end the active gesture',()=>{
 const h=harness();h.emit('pointerdown',{cell:20});h.emit('pointerdown',{isPrimary:false,pointerId:2,cell:40});h.emit('pointerup',{pointerId:2,cell:40});h.emit('pointerup',{cell:20});assert.deepEqual(h.events,[['cell',20]]);
});
test('dragging away from an arrow and returning does not play a move',()=>{
 const h=harness();h.emit('pointerdown',{direction:1});h.emit('pointermove',{clientX:50,direction:2});h.emit('pointerup',{direction:1});assert.deepEqual(h.events,[]);
});
