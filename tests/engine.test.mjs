import {test} from 'node:test';import assert from 'node:assert/strict';
import {CELLS,at,initialBoard,count,legalMove,moves,captureMoves,apply,make,unmake,lineBetween,NEIGHBORS,winner} from '../src/engine.js';
import {search,LEVELS} from '../src/search.js';
const empty=()=>new Int8Array(61),put=(b,ps,p)=>ps.forEach(([q,r])=>b[at(q,r)]=p);
test('61 cells, fourteen marbles per side, central symmetry',()=>{const b=initialBoard();assert.equal(CELLS.length,61);assert.equal(count(b,1),14);assert.equal(count(b,2),14);for(let i=0;i<61;i++){const {q,r}=CELLS[i];assert.equal(b[at(-q,-r)],b[i]?3-b[i]:0);}assert.equal(winner(b),0);});
test('single moves and own-board-edge exits',()=>{let b=empty();put(b,[[0,0]],1);assert.equal(moves(b,1).length,6);b=empty();put(b,[[4,0]],1);assert.equal(legalMove(b,1,[at(4,0)],0),null);});
test('2 versus 1 and 3 versus 2 are valid, equal forces are blocked',()=>{let b=empty();put(b,[[-2,0],[-1,0],[0,0]],1);put(b,[[1,0],[2,0]],2);assert(legalMove(b,1,[at(-2,0),at(-1,0),at(0,0)],0));assert.equal(legalMove(b,1,[at(-1,0),at(0,0)],0),null);b[at(2,0)]=0;assert(legalMove(b,1,[at(-1,0),at(0,0)],0));assert.equal(legalMove(b,1,[at(0,0)],0),null);});
test('pushing is inline only, no pushing into own marble',()=>{let b=empty();put(b,[[-1,0],[0,0],[2,0]],1);put(b,[[1,0]],2);assert.equal(legalMove(b,1,[at(-1,0),at(0,0)],0),null);b[at(2,0)]=0;put(b,[[-1,1],[0,1]],2);assert.equal(legalMove(b,1,[at(-1,0),at(0,0)],1),null);});
test('one opponent ejected, never own marble',()=>{let b=empty();put(b,[[2,0],[3,0]],1);put(b,[[4,0]],2);const m=legalMove(b,1,[at(2,0),at(3,0)],0);assert(m.capture);const n=apply(b,1,m);assert.equal(count(n,1),2);assert.equal(count(n,2),0);assert.equal(n[at(4,0)],1);});
test('selection validates adjacency, alignment, ownership and uniqueness',()=>{const b=initialBoard();assert.equal(legalMove(b,1,[45,47],4),null);assert.equal(legalMove(b,1,[45,45],4),null);assert.equal(legalMove(b,1,[0],0),null);assert.equal(legalMove(b,1,[61],0),null);assert.equal(legalMove(b,1,[45],NaN),null);assert.equal(lineBetween(at(-2,0),at(1,0)),null);});
test('all six rotated ejecting pushes are legal',()=>{for(let d=0;d<6;d++){let g=[at(0,0)],j=g[0];for(let n=0;n<4;n++){j=NEIGHBORS[j][d];g.push(j);}const b=empty();b[g[2]]=b[g[3]]=1;b[g[4]]=2;assert(legalMove(b,1,g.slice(2,4),d)?.capture);}});
test('generator produces unique moves and preserves board through undo',()=>{let b=initialBoard(),p=1;for(let turn=0;turn<100;turn++){const ms=moves(b,p);assert.equal(new Set(ms.map(m=>m.id)).size,ms.length);for(const m of ms){const old=Int8Array.from(b),undo=make(b,p,m);assert.equal(count(b,p),count(old,p));assert.equal(count(b,3-p),count(old,3-p)-(m.capture?1:0));unmake(b,undo);assert.deepEqual(b,old);}if(!ms.length||winner(b))break;b=apply(b,p,ms[(turn*7919+17)%ms.length]);p=3-p;}});
test('engine returns legal move, stays bounded and does not mutate position',()=>{const b=initialBoard(),old=Int8Array.from(b),r=search(b,1,{level:3,ms:300,depth:5});assert(moves(b,1).some(m=>m.id===r.move.id));assert(r.ms<1500);assert(r.nodes>0);assert.deepEqual(b,old);});
test('engine finds an immediate sixth capture',()=>{const b=empty();put(b,[[2,0],[3,0],[-4,0],[-4,1],[-4,2],[-4,3],[-4,4],[-3,0],[-3,1],[-3,2],[-3,3],[-3,4],[-2,0],[-2,1]],1);put(b,[[4,0],[0,-4],[1,-4],[2,-4],[3,-4],[4,-4],[-1,-3],[0,-3],[1,-3]],2);const r=search(b,1,{level:5,ms:500,depth:3});assert.equal(winner(apply(b,1,r.move)),1);assert(r.move.capture);});
test('edge-only capture generator matches all legal captures on 250 positions',()=>{
 let seed=93827,captures=0;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/2**32;};
 for(let k=0;k<250;k++){
  const cells=Array.from({length:61},(_,i)=>i);for(let j=60;j>0;j--){const n=Math.floor(random()*(j+1));[cells[j],cells[n]]=[cells[n],cells[j]];}
  const b=empty();for(let i=0;i<28;i++)b[cells[i]]=i<14?1:2;
  for(const p of [1,2]){const expected=moves(b,p).filter(m=>m.capture).sort((a,b)=>a.id-b.id),actual=captureMoves(b,p).sort((a,b)=>a.id-b.id);captures+=expected.length;assert.deepEqual(actual,expected);}
 }
 assert(captures>100,'fixtures must exercise many actual captures');
});
test('progress exposes only legal moves from completed search depths',()=>{
 const b=initialBoard(),updates=[];const result=search(b,1,{level:7,ms:1000,depth:3,onProgress:p=>updates.push(p)});
 assert.equal(result.depth,3);assert.deepEqual(updates.map(p=>p.depth),[1,2,3]);
 for(const p of updates)assert(legalMove(b,1,p.move.group,p.move.d));assert.equal(updates.at(-1).move.id,result.move.id);
});
