import {search} from './search.js';
onmessage=e=>{const {board,player,level,id,history}=e.data;try{const result=search(board,player,{level,history,onProgress:p=>postMessage({type:'progress',id,...p})});postMessage({type:'result',id,...result});}catch(err){postMessage({type:'error',id,message:String(err)});}};
