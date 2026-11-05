import {moves,captureMoves,make,unmake,NEIGHBORS,DIST} from './engine.js';
export const LEVELS=[
 {name:'Découverte',ms:120,depth:1,noise:1600},
 {name:'Débutant',ms:250,depth:2,noise:500},
 {name:'Amateur',ms:600,depth:3,noise:80},
 {name:'Confirmé',ms:1500,depth:5,noise:0},
 {name:'Avancé',ms:2500,depth:8,noise:0},
 {name:'Expert',ms:4000,depth:12,noise:0},
 {name:'Expert +',ms:6000,depth:20,noise:0},
 {name:'Recherche maximale',ms:10000,depth:30,noise:0}
];
export function evaluate(b,p){
 const score=[0,0,0],num=[0,0,0];
 for(let i=0;i<61;i++){const c=b[i];if(!c)continue;num[c]++;let friends=0;
  for(const n of NEIGHBORS[i])if(n>=0&&b[n]===c)friends++;
  score[c]+=12000+(4-DIST[i])*30+friends*22-(friends===0?120:0)-(DIST[i]===4?65:0);
  // An exposed edge piece aligned with a larger opposing force is an immediate liability.
  if(DIST[i]>=3)for(let d=0;d<6;d++){
   let ahead=NEIGHBORS[i][d];if(ahead>=0&&b[ahead]!==0)continue;
   let back=NEIGHBORS[i][(d+3)%6],own=1,opp=0;
   while(back>=0&&b[back]===c&&own<3){own++;back=NEIGHBORS[back][(d+3)%6];}
   while(back>=0&&b[back]===3-c&&opp<3){opp++;back=NEIGHBORS[back][(d+3)%6];}
   if(opp>own)score[c]-=ahead<0?3200:250;
  }
 }
 if(num[p]<=8)return -1000000;if(num[3-p]<=8)return 1000000;
 return score[p]-score[3-p];
}
let seed=12345678;const rnd=()=>{seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;return seed>>>0;};
const Z=Array.from({length:61},()=>[0,rnd(),rnd()]),V=Array.from({length:61},()=>[0,rnd(),rnd()]);
function hash(b,p){let a=p===1?0x5123abcd:0xabc12453,z=p===1?0x29acf876:0xf3214567;for(let i=0;i<61;i++){a^=Z[i][b[i]];z^=V[i][b[i]];}return[a>>>0,z>>>0];}
export function search(board,player,{level=4,ms,depth,onProgress=()=>{},history=[]}={}){
 const cfg=LEVELS[level]??LEVELS[4],budget=ms??cfg.ms,limit=depth??cfg.depth,start=performance.now(),end=start+budget;
 const b=Int8Array.from(board),tt=new Map(),killers=[],hist=new Map(),line=new Set();let nodes=0,stopped=false;
 const TIMEOUT=Symbol('timeout'),original=moves(b,player);if(!original.length)return {move:null,nodes:0,depth:0,score:0,ms:0};
 let best=original[0],value=-Infinity,completed=0;
 const order=(list,ttid,ply,p)=>list.map(m=>({m,v:(m.id===ttid?1e8:0)+(m.capture?2e6:0)+m.pushed.length*2000+(killers[ply]?.includes(m.id)?1500:0)+(hist.get(p+':'+m.id)??0)+m.group.reduce((s,i)=>s+(DIST[i]-DIST[NEIGHBORS[i][m.d]])*15,0)})).sort((a,b)=>b.v-a.v).map(x=>x.m);
 function visit(p,remaining,alpha,beta,ply){
  if((++nodes&127)===0&&performance.now()>end)throw TIMEOUT;
  let score=evaluate(b,p);if(Math.abs(score)>=999000)return score>0?score-ply:score+ply;
  const [h,s]=hash(b,p),lk=h+':'+s;if(line.has(lk))return 0;
  const entry=tt.get(h),valid=entry?.s===s;const before=alpha;
  if(valid&&entry.depth>=remaining&&remaining>0){if(entry.flag===0)return entry.value;if(entry.flag===1)alpha=Math.max(alpha,entry.value);else beta=Math.min(beta,entry.value);if(alpha>=beta)return entry.value;}
  let options;
  if(remaining<=0){
   if(remaining<=-3)return score;
   if(score>=beta)return score;alpha=Math.max(alpha,score);
   options=captureMoves(b,p);if(!options.length)return score;
  }else{options=moves(b,p);if(!options.length)return -900000+ply;}
  options=order(options,valid?entry.move:-1,ply,p);line.add(lk);
  let bestScore=remaining<=0?score:-Infinity,bestId=-1,idx=0;
  try{for(const m of options){const undo=make(b,p,m);let v;
   try{
    if(idx===0)v=-visit(3-p,remaining-1,-beta,-alpha,ply+1);
    else {const reduction=remaining>=3&&idx>=8&&!m.capture&&!m.pushed.length?1:0;
     v=-visit(3-p,remaining-1-reduction,-alpha-1,-alpha,ply+1);
     if(reduction&&v>alpha)v=-visit(3-p,remaining-1,-alpha-1,-alpha,ply+1);
     if(v>alpha&&v<beta)v=-visit(3-p,remaining-1,-beta,-alpha,ply+1);
    }
   }finally{unmake(b,undo);}
   if(v>bestScore){bestScore=v;bestId=m.id;}alpha=Math.max(alpha,v);idx++;
   if(alpha>=beta){if(!m.capture){killers[ply]=[m.id,...(killers[ply]??[])].slice(0,2);hist.set(p+':'+m.id,Math.min(1000,(hist.get(p+':'+m.id)??0)+remaining*remaining));}break;}
  }}finally{line.delete(lk);}
  if(remaining>0&&tt.size<200000)tt.set(h,{s,depth:remaining,value:bestScore,move:bestId,flag:bestScore<=before?2:bestScore>=beta?1:0});
  return bestScore;
 }
 for(let d=1;d<=limit;d++){
  let local=best,localValue=-Infinity,alpha=-Infinity;const list=order(original,best.id,0,player);
  try{for(const m of list){if(performance.now()>end)throw TIMEOUT;const undo=make(b,player,m);let v;try{v=-visit(3-player,d-1,-Infinity,-alpha,1);}finally{unmake(b,undo);}
    if(cfg.noise)v+=(Math.random()-.5)*cfg.noise;
    if(history.length){const u=make(b,player,m);const k=Array.from(b).join('')+(3-player);unmake(b,u);if(history.includes(k))v-=70;}
    if(v>localValue){localValue=v;local=m;}alpha=Math.max(alpha,v);
   }
   best=local;value=localValue;completed=d;onProgress({move:best,depth:d,nodes,score:value,ms:performance.now()-start});
  }catch(e){if(e!==TIMEOUT)throw e;stopped=true;break;}
  if(Math.abs(value)>900000||performance.now()-start>budget*.7)break;
 }
 return {move:best,score:Number.isFinite(value)?value:evaluate(b,player),depth:completed,nodes,ms:performance.now()-start,stopped};
}
