import {CELLS,NEIGHBORS,DIRS} from './engine.js';
const TAU=Math.PI*2;
export class BoardView{
 constructor(canvas,onCell,onDirection){this.canvas=canvas;this.ctx=canvas.getContext('2d');this.onCell=onCell;this.onDirection=onDirection;this.hits=[];this.state=null;this.animation=null;this.frame=0;this.resize=new ResizeObserver(()=>this.draw());this.resize.observe(canvas);
 canvas.addEventListener('pointerdown',e=>{if(e.button!==0)return;this.down={x:e.clientX,y:e.clientY};canvas.setPointerCapture(e.pointerId);});
 canvas.addEventListener('pointerup',e=>{if(!this.down)return;const delta=Math.hypot(e.clientX-this.down.x,e.clientY-this.down.y);this.down=null;if(delta>20)return;const rect=canvas.getBoundingClientRect(),x=e.clientX-rect.left,y=e.clientY-rect.top;
  for(const h of this.hits)if(Math.hypot(x-h.x,y-h.y)<h.r){onDirection(h.d);return;}
  let nearest=-1,dist=Infinity;this.points.forEach((p,i)=>{const dd=Math.hypot((x-p.x),(y-p.y));if(dd<dist){dist=dd;nearest=i;}});if(dist<this.unit*.55)onCell(nearest);
 });canvas.addEventListener('contextmenu',e=>e.preventDefault());canvas.addEventListener('pointercancel',()=>this.down=null);
 }
 update(state){this.state=state;this.draw();}
 animate(old,move,player,done){if(this.state.reduced){done();return;}this.animation={old,move,player,start:performance.now(),done};this.draw();}
 project(q,r){const turn=this.state?.color===2?-1:1;return{x:this.cx+turn*(q+r*.5)*this.unit,y:this.cy+turn*r*Math.sqrt(3)/2*this.unit*this.tilt};}
 polygon(points,offset=0){const c=this.ctx;c.beginPath();points.forEach((p,i)=>i?c.lineTo(p.x,p.y+offset):c.moveTo(p.x,p.y+offset));c.closePath();}
 sphere(x,y,r,player,alpha=1){const c=this.ctx;c.save();c.globalAlpha=alpha;
  c.fillStyle='rgba(15,25,16,.20)';c.beginPath();c.ellipse(x+r*.13,y+r*.5,r*.96,r*.41,0,0,TAU);c.fill();
  let g=c.createRadialGradient(x-r*.32,y-r*.43,r*.02,x+r*.05,y+r*.1,r*1.05);
  if(player===1){g.addColorStop(0,'#879486');g.addColorStop(.24,'#526c56');g.addColorStop(.52,'#2c4936');g.addColorStop(.85,'#1c3224');g.addColorStop(1,'#152a1b');}
  else{g.addColorStop(0,'#fffef4');g.addColorStop(.35,'#fbf8e8');g.addColorStop(.74,'#e1dcca');g.addColorStop(1,'#b9b69e');}
  c.fillStyle=g;c.beginPath();c.arc(x,y,r,0,TAU);c.fill();c.strokeStyle=player===1?'#15291c88':'#b8b59c88';c.lineWidth=.7;c.stroke();
  c.beginPath();c.ellipse(x-r*.26,y-r*.43,r*.32,r*.14,-.4,0,TAU);c.fillStyle=player===1?'#e3f0d921':'#ffffff80';c.fill();c.restore();
 }
 draw(){
  if(!this.state)return;const c=this.ctx,rect=this.canvas.getBoundingClientRect(),w=rect.width,h=rect.height;if(!w||!h)return;
  const dpi=Math.min(devicePixelRatio||1,2.5);if(this.canvas.width!==Math.round(w*dpi)||this.canvas.height!==Math.round(h*dpi)){this.canvas.width=Math.round(w*dpi);this.canvas.height=Math.round(h*dpi);}c.setTransform(dpi,0,0,dpi,0,0);c.clearRect(0,0,w,h);
  this.tilt=this.state.flat?1:.78;this.unit=Math.min(w/10.7,h/(9.8*this.tilt));this.cx=w/2;this.cy=h/2+this.unit*.12;const u=this.unit,r=u*.365;
  this.points=CELLS.map(p=>{const v=this.project(p.q,p.r);return {...v,y:v.y-r*.3};});
  const corners=[[0,-5],[5,-5],[5,0],[0,5],[-5,5],[-5,0]].map(([q,t])=>this.project(q,t));
  c.save();c.shadowColor='#263b263d';c.shadowBlur=u*.6;c.shadowOffsetY=u*.4;this.polygon(corners,u*.2);c.fillStyle='#303d2d';c.fill();c.restore();
  let rim=c.createLinearGradient(0,this.cy-u*4,0,this.cy+u*4);rim.addColorStop(0,'#5d694b');rim.addColorStop(.6,'#404e35');rim.addColorStop(1,'#243621');this.polygon(corners,u*.19);c.fillStyle=rim;c.fill();
  this.polygon(corners);c.fillStyle='#748263';c.fill();c.lineWidth=1;c.strokeStyle='#889579';c.stroke();
  const inner=corners.map(p=>({x:this.cx+(p.x-this.cx)*.965,y:this.cy+(p.y-this.cy)*.965}));this.polygon(inner);let wood=c.createLinearGradient(0,this.cy-u*4,0,this.cy+u*4);wood.addColorStop(0,'#7a8664');wood.addColorStop(.5,'#94a17b');wood.addColorStop(1,'#7c8c67');c.fillStyle=wood;c.fill();
  // Fine, deterministic grain stays quiet under the playing pieces.
  c.save();this.polygon(inner);c.clip();for(let k=0;k<80;k++){const y=this.cy-u*5+k*u*.13;c.beginPath();c.moveTo(0,y);c.bezierCurveTo(w*.3,y+Math.sin(k*2)*3,w*.7,y-2,w,y+1);c.strokeStyle=k%2?'#e1e8c408':'#31472509';c.lineWidth=.65;c.stroke();}c.restore();
  const selected=this.state.selected??[],preview=this.state.preview;
  for(let i=0;i<61;i++){const p=this.project(CELLS[i].q,CELLS[i].r);let g=c.createRadialGradient(p.x,p.y+u*.08,0,p.x,p.y,u*.44);g.addColorStop(0,'#596a46');g.addColorStop(.65,'#627550');g.addColorStop(.92,'#48613b');g.addColorStop(1,'#a7b58a');c.beginPath();c.ellipse(p.x,p.y,u*.423,u*.423*this.tilt,0,0,TAU);c.fillStyle=g;c.fill();
   if(selected.includes(i)){c.beginPath();c.ellipse(p.x,p.y,u*.45,u*.45*this.tilt,0,0,TAU);c.strokeStyle='#f7e6a4';c.lineWidth=2.4;c.stroke();}
  }
  let animation=this.animation,t=animation?Math.min(1,(performance.now()-animation.start)/320):1;const ease=t*t*(3-2*t);const board=animation?animation.old:this.state.board;
  const marbles=[];
  for(let i=0;i<61;i++)if(board[i]){let p={...this.points[i]},alpha=1;if(animation&&(animation.move.group.includes(i)||animation.move.pushed.includes(i))){const d=DIRS[animation.move.d],target=this.project(CELLS[i].q+d[0],CELLS[i].r+d[1]);p.x+=(target.x-p.x)*ease;p.y+=(target.y-r*.3-p.y)*ease;if(NEIGHBORS[i][animation.move.d]<0){p.y+=u*.35*ease;alpha=1-ease;}}marbles.push({i,p,alpha,player:board[i]});}
  marbles.sort((a,b)=>a.p.y-b.p.y);for(const {i,p,alpha,player} of marbles){this.sphere(p.x,p.y-(selected.includes(i)&&!animation?u*.055:0),r,player,alpha);if(this.state.last?.group.includes(i)&&!selected.includes(i)){c.beginPath();c.arc(p.x,p.y+r*.7,2,0,TAU);c.fillStyle='#ead398';c.fill();}}
  if(preview&&!animation){for(const i of preview.group){const j=NEIGHBORS[i][preview.d],p=this.points[j];this.sphere(p.x,p.y,r,this.state.turn,.5);c.beginPath();c.arc(p.x,p.y,r*1.05,0,TAU);c.strokeStyle='#fff0b9';c.lineWidth=1.5;c.stroke();}}
  this.hits=[];
  if(selected.length&&!animation){const mid=selected.reduce((a,i)=>({x:a.x+this.points[i].x/selected.length,y:a.y+this.points[i].y/selected.length}),{x:0,y:0});
   for(const m of this.state.legal??[]){const [dq,dr]=DIRS[m.d],p=this.project(dq,dr),dx=p.x-this.cx,dy=p.y-this.cy,len=Math.hypot(dx,dy),distance=u*(selected.length===3?1.67:1.23),x=Math.max(17,Math.min(w-17,mid.x+dx/len*distance)),y=Math.max(17,Math.min(h-17,mid.y+dy/len*distance)),hr=Math.max(15,u*.27);
    this.hits.push({x,y,r:hr+5,d:m.d});c.beginPath();c.arc(x,y,hr,0,TAU);c.fillStyle=preview?.d===m.d?'#f5e4aa':'#f5f3e6e8';c.shadowColor='#22332233';c.shadowBlur=5;c.fill();c.shadowBlur=0;c.strokeStyle='#526947';c.lineWidth=1.6;c.lineCap='round';const a=Math.atan2(dy,dx);c.save();c.translate(x,y);c.rotate(a);c.beginPath();c.moveTo(-5,0);c.lineTo(5,0);c.moveTo(1,-4);c.lineTo(5,0);c.lineTo(1,4);c.stroke();c.restore();
   }
  }
  if(animation){if(t<1){cancelAnimationFrame(this.frame);this.frame=requestAnimationFrame(()=>this.draw());}else{this.animation=null;animation.done();}}
 }
}
