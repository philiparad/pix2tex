import {BOS,EOS,MAX_TOKENS,lastTokenArgmax,decodeTokens,cleanLatex,ensureTensor,modelInputFeed} from './decoder.js';
import {preprocessCanvas} from './preprocess.js';

// Re-hosted unmodified RapidLaTeXOCR weights, pinned to a public revision.
// This URL is configurable in the UI; image contents are NEVER uploaded here.
export const DEFAULT_MODEL_BASE='https://huggingface.co/inYourOwnBrowser/rapid-latex-ocr-onnx/resolve/0d0a23977b50433b07cdf95513ed7b7e45d3a761/';
const FILENAMES=['image_resizer.onnx','encoder.onnx','decoder.onnx','tokenizer.json'];
let loaded=null, loadedBase='';
let ortPromise=null;

export function modelPaths(base=DEFAULT_MODEL_BASE) {
  const prefix=base.endsWith('/')?base:base+'/';
  return FILENAMES.map(name=>({name,url:new URL(name,new URL(prefix,document.baseURI)).href}));
}
function getOrt(){
  ortPromise ??= import('https://cdn.jsdelivr.net/npm/onnxruntime-web@1.22.0/+esm')
    .then(module=>module.default||module);
  return ortPromise;
}
async function readAsset(url){
  const response=await fetch(url,{mode:'cors'});
  if(!response.ok)throw new Error('Failed downloading '+url+' (HTTP '+response.status+')');
  return response.arrayBuffer();
}
async function readJson(url) {
  const response=await fetch(url,{mode:'cors'});
  if(!response.ok)throw new Error('Failed downloading tokenizer (HTTP '+response.status+')');
  return response.json();
}
export async function checkModelAssets(base=DEFAULT_MODEL_BASE) {
  const results=[];
  for(const file of modelPaths(base)){
    try{
      // GET with Range is more compatible with model stores than HEAD; do not
      // download a large model just to check that it exists.
      const response=await fetch(file.url,{method:'HEAD',mode:'cors'});
      results.push({file:file.name,ok:response.ok,http:response.status,bytes:response.headers.get('content-length')});
    }catch(error){results.push({file:file.name,ok:false,error:String(error)});}
  }
  return results;
}
async function createSession(ort,url) {
  const bytes=await readAsset(url);
  try {
    return await ort.InferenceSession.create(bytes,{executionProviders:['wasm'],graphOptimizationLevel:'all'});
  }catch(error){
    throw new Error('Cannot initialize ONNX '+url.split('/').pop()+': '+error.message);
  }
}
export async function inspectEncoder(base=DEFAULT_MODEL_BASE){
  const ort=await getOrt();
  const file=modelPaths(base).find(item=>item.name==='encoder.onnx');
  const session=await createSession(ort,file.url);
  return {inputs:session.inputNames,outputs:session.outputNames,inputMetadata:session.inputMetadata,outputMetadata:session.outputMetadata};
}
export async function loadModel(base=DEFAULT_MODEL_BASE,onProgress=()=>{}){
  if(loaded && base===loadedBase) return loaded;
  const ort=await getOrt();
  const urls=Object.fromEntries(modelPaths(base).map(item=>[item.name,item.url]));
  onProgress('Loading ONNX size predictor…');
  const resizer=await createSession(ort,urls['image_resizer.onnx']);
  onProgress('Loading vision encoder (large download on first use)…');
  const encoder=await createSession(ort,urls['encoder.onnx']);
  onProgress('Loading autoregressive LaTeX decoder…');
  const decoder=await createSession(ort,urls['decoder.onnx']);
  onProgress('Loading tokenizer…');
  const tokenizer=await readJson(urls['tokenizer.json']);
  loaded={ort,resizer,encoder,decoder,tokenizer};
  loadedBase=base;
  return loaded;
}
function firstOutput(session,outputs) {
  return ensureTensor(outputs[session.outputNames[0]],session.outputNames[0]);
}
export async function recognizeMath(canvas,{base=DEFAULT_MODEL_BASE,onProgress=()=>{},maxTokens=MAX_TOKENS,diagnosticWidth=null}={}) {
  if(!canvas) throw new Error('Choose an image first.');
  const {ort,resizer,encoder,decoder,tokenizer}=await loadModel(base,onProgress);
  onProgress('Preparing formula image…');
  let normalized=preprocessCanvas(canvas);
  if(resizer.inputNames.length!==1)throw new Error('Unsupported resizer input signature');
  // Reference RapidLaTeXOCR: preserve the original padded image, then
  // resize from that fixed image on EACH predictor iteration. The previous
  // implementation repeatedly cropped the raw input, changing model scale.
  const base=normalized.preview;
  let width=base.width,height=base.height,ratio=1;
  for(let attempt=0;diagnosticWidth===null&&attempt<10;attempt++){
    height=Math.max(1,Math.floor(height*ratio));
    const scaled=document.createElement('canvas');
    scaled.width=Math.max(1,width);scaled.height=height;
    const ctx=scaled.getContext('2d',{willReadFrequently:true});
    ctx.imageSmoothingEnabled=true;
    ctx.imageSmoothingQuality=ratio<1?'high':'medium';
    ctx.fillStyle='white';ctx.fillRect(0,0,scaled.width,scaled.height);
    ctx.drawImage(base,0,0,scaled.width,scaled.height);
    normalized=preprocessCanvas(scaled);
    const sizeInput=new ort.Tensor('float32',normalized.data,normalized.dims);
    const sizeOutputs=await resizer.run({[resizer.inputNames[0]]:sizeInput});
    const scores=firstOutput(resizer,sizeOutputs);
    const predictedWidth=(lastTokenArgmax(scores)+1)*32;
    onProgress('Size iteration '+(attempt+1)+': '+predictedWidth+'px (tensor '+normalized.width+'×'+normalized.height+')');
    width=Math.min(672,Math.max(32,predictedWidth));
    if(predictedWidth===normalized.width)break;
    ratio=width/normalized.width;
  }
  if(diagnosticWidth!==null)normalized=preprocessCanvas(canvas,{targetWidth:diagnosticWidth});
  const input=new ort.Tensor('float32',normalized.data,normalized.dims);
  if(encoder.inputNames.length!==1) throw new Error('Unsupported encoder input signature: '+encoder.inputNames.join(', '));
  onProgress('Encoding image…');
  const encoderOutputs=await encoder.run({[encoder.inputNames[0]]:input});
  const context=firstOutput(encoder,encoderOutputs);
  const ids=[BOS];
  if(decoder.inputNames.length!==3) throw new Error('Unsupported decoder signature: '+decoder.inputNames.join(', '));
  for(let step=0;step<maxTokens;step++){
    const n=ids.length;
    const tokens=new ort.Tensor('int64',BigInt64Array.from(ids,BigInt),[1,n]);
    const mask=new ort.Tensor('bool',new Uint8Array(n).fill(1),[1,n]);
    // Match upstream order: tokens, attention mask, encoder context.
    const feeds=modelInputFeed(decoder,[tokens,mask,context]);
    const result=await decoder.run(feeds);
    const next=lastTokenArgmax(firstOutput(decoder,result));
    if(next===EOS)break;
    ids.push(next);
    if(step%8===0){
      onProgress('Decoding LaTeX: '+(step+1)+' tokens…');
      // Allow UI to paint while synchronous WASM inference is running.
      await new Promise(resolve=>setTimeout(resolve,0));
    }
    if(step===maxTokens-1)throw new Error('Maximum LaTeX length reached before EOS; try cropping a smaller formula.');
  }
  const expression=cleanLatex(decodeTokens(tokenizer,ids.slice(1)));
  if(!expression)throw new Error('Model produced an empty LaTeX expression.');
  return expression;
}
