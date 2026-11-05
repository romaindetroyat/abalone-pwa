// Pointer capture keeps a selection gesture continuous, even outside the canvas.
// A drag only selects: it can never activate an arrow on release.
export class BoardInput {
 constructor(canvas,{cellAt,directionAt,selectCell,selectRange,chooseDirection}) {
  this.canvas=canvas;this.callbacks={cellAt,directionAt,selectCell,selectRange,chooseDirection};this.down=null;
  canvas.addEventListener('pointerdown',e=>this.start(e));
  canvas.addEventListener('pointermove',e=>this.move(e));
  canvas.addEventListener('pointerup',e=>this.end(e));
  canvas.addEventListener('pointercancel',e=>this.cancel(e));
  canvas.addEventListener('lostpointercapture',e=>this.cancel(e));
  canvas.addEventListener('contextmenu',e=>e.preventDefault());
 }
 start(e) {
  if(e.button!==0||e.isPrimary===false||this.down)return;
  const {cellAt,directionAt}=this.callbacks;
  this.down={id:e.pointerId,x:e.clientX,y:e.clientY,cell:cellAt(e),direction:directionAt(e),dragged:false};
  this.canvas.setPointerCapture(e.pointerId);
 }
 move(e) {
  const d=this.down;if(!d||d.id!==e.pointerId)return;
  if(!d.dragged&&Math.hypot(e.clientX-d.x,e.clientY-d.y)<6)return;
  if(!d.dragged){d.dragged=true;if(d.direction==null&&d.cell>=0)this.callbacks.selectRange(d.cell,d.cell);}
  if(d.direction==null&&d.cell>=0)this.callbacks.selectRange(d.cell,this.callbacks.cellAt(e));
 }
 end(e) {
  const d=this.down;if(!d||d.id!==e.pointerId)return;
  this.move(e);this.cancel(e);
  if(d.dragged)return;
  if(d.direction!=null){if(this.callbacks.directionAt(e)===d.direction)this.callbacks.chooseDirection(d.direction);}
  else if(d.cell>=0&&this.callbacks.cellAt(e)===d.cell)this.callbacks.selectCell(d.cell);
 }
 cancel(e) {
  if(!this.down||e&&this.down.id!==e.pointerId)return;
  const id=this.down.id;this.down=null;
  if(this.canvas.hasPointerCapture(id))this.canvas.releasePointerCapture(id);
 }
}
