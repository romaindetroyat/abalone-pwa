// Pure rules shared by the UI, search worker and regression suite.
export const DIRS = [[1,0],[0,1],[-1,1],[-1,0],[0,-1],[1,-1]];
export const CELLS=[];
for(let r=-4;r<=4;r++) for(let q=-4;q<=4;q++) if(Math.abs(q+r)<=4) CELLS.push({q,r});
const coord=new Map(CELLS.map((c,i)=>[`${c.q},${c.r}`,i]));
export const at=(q,r)=>coord.get(`${q},${r}`)??-1;
export const NEIGHBORS=CELLS.map(c=>DIRS.map(([q,r])=>at(c.q+q,c.r+r)));
export const DIST=CELLS.map(c=>Math.max(Math.abs(c.q),Math.abs(c.r),Math.abs(c.q+c.r)));
export function initialBoard(){return Int8Array.from(CELLS,c=>c.r>=3||(c.r===2&&c.q>=-2&&c.q<=0)?1:c.r<=-3||(c.r===-2&&c.q>=0&&c.q<=2)?2:0);}
export const count=(b,p)=>b.reduce((n,v)=>n+(v===p),0);
export function winner(b){return count(b,1)<=8?2:count(b,2)<=8?1:0;}
export function lineBetween(a,b){
  if(a===b)return [a];
  for(let d=0;d<6;d++){let n=a,arr=[a];for(let k=0;k<2;k++){n=NEIGHBORS[n]?.[d]??-1;if(n<0)break;arr.push(n);if(n===b)return arr;}}
  return null;
}
export function lineAxis(group){
  if(group.length===1)return -1;
  const set=new Set(group);if(set.size!==group.length)return -2;
  for(let d=0;d<3;d++)for(const i of group){let j=i,seen=1;while(seen<group.length&&set.has(NEIGHBORS[j][d])){j=NEIGHBORS[j][d];seen++;}if(seen===group.length)return d;}
  return -2;
}
export function legalMove(board,player,group,d,knownAxis){
  if(!Array.isArray(group)||group.length<1||group.length>3||!Number.isInteger(d)||d<0||d>5||![1,2].includes(player))return null;
  if(group.some(i=>!Number.isInteger(i)||i<0||i>=61||board[i]!==player))return null;
  const axis=knownAxis??lineAxis(group);if(axis===-2)return null;
  const inline=group.length===1||d%3===axis;
  let pushed=[],capture=false;
  if(inline){
    const front=group.find(i=>!group.includes(NEIGHBORS[i][d]));let next=NEIGHBORS[front][d];
    if(next<0)return null;
    while(next>=0&&board[next]===3-player){pushed.push(next);if(pushed.length>=group.length)return null;next=NEIGHBORS[next][d];}
    if(next>=0&&board[next]!==0)return null;
    capture=next<0;
  }else{if(group.some(i=>NEIGHBORS[i][d]<0||board[NEIGHBORS[i][d]]!==0))return null;}
  const sorted=[...group].sort((a,b)=>a-b);
  return {group:sorted,d,pushed,capture,id:(((sorted[0]*62+(sorted[1]??61))*62+(sorted[2]??61))*6+d)};
}
export function moves(board,player){
  const out=[];
  function add(g,a){for(let d=0;d<6;d++){const m=legalMove(board,player,g,d,a);if(m)out.push(m);}}
  for(let i=0;i<61;i++)if(board[i]===player){add([i],-1);for(let a=0;a<3;a++){let j=NEIGHBORS[i][a];if(j>=0&&board[j]===player){add([i,j],a);let k=NEIGHBORS[j][a];if(k>=0&&board[k]===player)add([i,j,k],a);}}}
  return out;
}
// An ejection must end at an exposed edge. Trace only those rays instead of
// generating every quiet move at each leaf of the search tree.
const EXIT_RAYS=NEIGHBORS.flatMap((ns,i)=>ns.flatMap((n,d)=>n<0?[[i,d]]:[]));
export function captureMoves(board,player){
  const out=[];
  for(const [edge,d] of EXIT_RAYS){
    if(board[edge]!==3-player)continue;
    const back=(d+3)%6;let n=edge,enemies=0;
    while(n>=0&&board[n]===3-player&&enemies<3){enemies++;n=NEIGHBORS[n][back];}
    if(enemies>2)continue;
    const group=[];
    while(n>=0&&board[n]===player&&group.length<3){
      group.push(n);n=NEIGHBORS[n][back];
      if(group.length>enemies){const m=legalMove(board,player,group,d);if(m)out.push(m);}
    }
  }
  return out;
}
export function make(board,player,m){
  const changes=new Map();for(const i of [...m.group,...m.pushed]){changes.set(i,board[i]);const j=NEIGHBORS[i][m.d];if(j>=0)changes.set(j,board[j]);}
  for(const i of [...m.group,...m.pushed])board[i]=0;
  for(const i of m.group)board[NEIGHBORS[i][m.d]]=player;
  for(const i of m.pushed){const j=NEIGHBORS[i][m.d];if(j>=0)board[j]=3-player;}
  return changes;
}
export function unmake(board,changes){for(const [i,v]of changes)board[i]=v;}
export function apply(board,player,m){const next=Int8Array.from(board);make(next,player,m);return next;}
export const positionKey=(b,p)=>Array.from(b).join('')+p;
export const cellName=i=>String.fromCharCode(69-CELLS[i].r)+(CELLS[i].q+5);
export const notation=m=>m.group.map(cellName).join('–')+' '+['→','↘','↙','←','↖','↗'][m.d]+(m.capture?' ×':'');
