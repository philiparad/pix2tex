import {loadImage,extractCrop,clampSelection} from './image.js';
import {checkModelAssets,inspectEncoder,recognizeMath,DEFAULT_MODEL_BASE} from './onnx.js';
import {recognizeHandwriting} from './handwriting.js';
import {splitCanvasFormulas,joinFormulaLatex} from './segment.js';
const $=id=>document.getElementById(id);
let image=null, selection=null, anchor=null;
$('modelBase').value=DEFAULT_MODEL_BASE;
$('engine').addEventListener('change',()=>{
  const handwritten=$('engine').value==='handwritten';
  $('engineNote').textContent=handwritten
    ? 'Experimental MathWriting-trained model. Large download on first use. Crop exactly one handwritten expression; verify every symbol.'
    : 'Crop exactly one printed formula. Multiple expressions in a single crop may produce incorrect LaTeX.';
});
function status(message,error=false){$('status').textContent=message;$('status').classList.toggle('error',error);}
function render(){const c=$('canvas');if(!image)return;c.width=image.width;c.height=image.height;c.style.display='block';$('empty').hidden=true;const ctx=c.getContext('2d');ctx.drawImage(image,0,0);if(selection&&selection.w>3&&selection.h>3){ctx.fillStyle='#0006';ctx.fillRect(0,0,c.width,c.height);ctx.clearRect(selection.x,selection.y,selection.w,selection.h);ctx.drawImage(image,selection.x,selection.y,selection.w,selection.h,selection.x,selection.y,selection.w,selection.h);ctx.strokeStyle='#007aff';ctx.lineWidth=Math.max(2,image.width/400);ctx.strokeRect(selection.x,selection.y,selection.w,selection.h);}}
async function setImage(file){try{const newImage=await loadImage(file);image?.close();image=newImage;selection=null;$('recognize').disabled=false;render();status(`Image loaded (${image.width} × ${image.height}). Select a crop or inspect the model.`);}catch(e){status(e.message,true);}}
$('file').addEventListener('change',e=>{if(e.target.files[0])setImage(e.target.files[0]);});
const drop=$('drop');drop.addEventListener('dragover',e=>{e.preventDefault();drop.classList.add('drag');});drop.addEventListener('dragleave',()=>drop.classList.remove('drag'));
drop.addEventListener('drop',e=>{e.preventDefault();drop.classList.remove('drag');if(e.dataTransfer.files[0])setImage(e.dataTransfer.files[0]);});
document.addEventListener('paste',e=>{const file=[...e.clipboardData?.files||[]].find(f=>f.type.startsWith('image/'));if(file)setImage(file);});
const c=$('canvas');function loc(e){const box=c.getBoundingClientRect();return{x:(e.clientX-box.left)*c.width/box.width,y:(e.clientY-box.top)*c.height/box.height};}
c.addEventListener('pointerdown',e=>{if(!image)return;anchor=loc(e);c.setPointerCapture(e.pointerId);});
c.addEventListener('pointermove',e=>{if(!anchor)return;const p=loc(e);selection=clampSelection(anchor.x,anchor.y,p.x,p.y,c.width,c.height);render();});
c.addEventListener('pointerup',()=>{anchor=null;if(selection&&(selection.w<4||selection.h<4))selection=null;render();});
$('reset').onclick=()=>{selection=null;render();};
$('recognize').onclick=async()=>{const button=$('recognize');button.disabled=true;try{status('Attempting local model inference…');const source=extractCrop(image,selection);
const recognize=canvas=>$('engine').value==='handwritten'
  ? recognizeHandwriting(canvas,{onProgress:message=>status(message)})
  : recognizeMath(canvas,{base:$('modelBase').value.trim(),onProgress:message=>status(message)});
if($('splitExpressions').checked){
  const segments=splitCanvasFormulas(source);
  if(segments.length>20)throw new Error('Too many detected segments; crop a smaller region.');
  const outputs=[];
  for(let i=0;i<segments.length;i++){
    status('Recognizing expression '+(i+1)+' of '+segments.length+'…');
    outputs.push(await recognize(segments[i].canvas));
  }
  $('latex').value=joinFormulaLatex(outputs);
}else{
  $('latex').value=await recognize(source);
}updatePreview();status('Recognition completed by local browser ONNX inference. Verify the output against your source image.');}catch(e){status('Recognition failed: '+e.message,true);}finally{button.disabled=!image;}};
function updatePreview(){const value=$('latex').value.trim();const p=$('preview');p.textContent=value?`\\[${value}\\]`:'Enter LaTeX to preview.';if(value&&window.MathJax?.typesetPromise)window.MathJax.typesetPromise([p]).catch(e=>status(`MathJax: ${e.message}`,true));}
$('latex').oninput=updatePreview;
$('copy').onclick=async()=>{await navigator.clipboard.writeText($('latex').value);status('Copied LaTeX.');};
$('copyMathJax').onclick=async()=>{await navigator.clipboard.writeText(`\\(${$('latex').value}\\)`);status('Copied MathJax inline expression.');};
$('insert').onclick=()=>{const latex=$('latex').value.trim();if(!latex)return status('No LaTeX to send.',true);const receiver=window.opener||((window.parent!==window)?window.parent:null);if(!receiver)return status('Open this page from Teacher-Board to send a result; otherwise use Copy LaTeX.',true);receiver.postMessage({type:'pix2tex:result',latex,source:'pix2tex-browser-lab',version:1},window.location.origin);status('Sent result to Teacher-Board window (receiver must be configured).');};
$('checkModels').onclick=async()=>{status('Checking model assets…');try{const r=await checkModelAssets($('modelBase').value.trim());$('diagnostics').textContent=JSON.stringify(r,null,2);status('Asset diagnostics completed.');}catch(e){status(e.message,true);}};
$('inspectModel').onclick=async()=>{status('Loading ONNX Runtime Web and inspecting encoder…');try{const r=await inspectEncoder($('modelBase').value.trim());$('diagnostics').textContent=JSON.stringify(r,null,2);status('Encoder inspected.');}catch(e){status(`Model inspection failed: ${e.message}`,true);}};
