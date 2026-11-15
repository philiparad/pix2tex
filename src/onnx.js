import {BOS,EOS,MAX_TOKENS,lastTokenArgmax,decodeTokens,cleanLatex,ensureTensor,modelInputFeed} from './decoder.js';
import {preprocessCanvas} from './preprocess.js';
import {resizeLanczosCanvas} from './lanczos.js';

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
  const baseImage=normalized.preview;
  let width=baseImage.width,height=baseImage.height,ratio=1;
  for(let attempt=0;diagnosticWidth===null&&attempt<10;attempt++){
    height=Math.max(1,Math.floor(height*ratio));
    const scaled=resizeLanczosCanvas(baseImage,Math.max(1,width),height);
    normalized=preprocessCanvas(scaled);
    const sizeInput=new ort.Tensor('float32',normalized.data,normalized.dims);
    const sizeOutputs=await resizer.run({[resizer.inputNames[0]]:sizeInput});
    const scores=firstOutput(resizer,sizeOutputs);
    const predictedWidth=(lastTokenArgmax(scores)+1)*32;
    onProgress('Size iteration '+(attempt+1)+': '+predictedWidth+'px (tensor '+normalized.width+'×'+normalized.height+', mean '+(normalized.data.reduce((a,b)=>a+b,0)/normalized.data.length).toFixed(4)+')');
    width=Math.min(672,Math.max(32,predictedWidth));
    if(predictedWidth===normalized.width)break;
    ratio=width/normalized.width;
  }
  if(diagnosticWidth!==null)normalized=preprocessCanvas(canvas,{targetWidth:diagnosticWidth});
  if(encoder.inputNames.length!==1) throw new Error('Unsupported encoder input signature: '+encoder.inputNames.join(', '));
  if(decoder.inputNames.length!==3) throw new Error('Unsupported decoder signature: '+decoder.inputNames.join(', '));

  async function infer(prepared,label) {
    const input=new ort.Tensor('float32',prepared.data,prepared.dims);
    onProgress('Encoding '+label+' ('+prepared.width+'×'+prepared.height+')…');
    const encoderOutputs=await encoder.run({[encoder.inputNames[0]]:input});
    const context=firstOutput(encoder,encoderOutputs);
    const ids=[BOS];
    let sumLogProb=0, tokenCount=0;
    let terminated=false;
    for(let step=0;step<maxTokens;step++){
      const n=ids.length;
      const tokens=new ort.Tensor('int64',BigInt64Array.from(ids,BigInt),[1,n]);
      const mask=new ort.Tensor('bool',new Uint8Array(n).fill(1),[1,n]);
      const feeds=modelInputFeed(decoder,[tokens,mask,context]);
      const outputs=await decoder.run(feeds);
      const logits=firstOutput(decoder,outputs);
      const next=lastTokenArgmax(logits);
      const vocab=logits.dims[logits.dims.length-1];
      const offset=logits.data.length-vocab;
      let denominator=0,peak=Number(logits.data[offset+next]);
      for(let k=0;k<vocab;k++)denominator+=Math.exp(Number(logits.data[offset+k])-peak);
      sumLogProb-=Math.log(denominator);
      tokenCount++;
      if(next===EOS){terminated=true;break;}
      ids.push(next);
      if(step%12===0){
        onProgress('Decoding '+label+': '+(step+1)+' tokens…');
        await new Promise(resolve=>setTimeout(resolve,0));
      }
    }
    if(!terminated)throw new Error('Decoder reached the token limit before EOS at '+label);
    const expression=cleanLatex(decodeTokens(tokenizer,ids.slice(1)));
    if(!expression)throw new Error('Empty LaTeX from '+label);
    return {expression,confidence:sumLogProb/tokenCount,width:prepared.width};
  }

  const firstWidth=normalized.width;
  const widths=[firstWidth];
  // Local multi-scale comparison mitigates small preprocessing differences
  // between browser Canvas and PIL which can shift the resize classifier.
  // A maximum of three nearby widths bounds on-device compute.
  if(diagnosticWidth===null){
    if(firstWidth>64)widths.push(firstWidth-32);
    if(firstWidth>96)widths.push(firstWidth-64);
  }
  const candidates=[];
  const errors=[];
  for(const width of widths){
    try{
      const prepared=width===firstWidth?normalized:preprocessCanvas(canvas,{targetWidth:width});
      const candidate=await infer(prepared,'width '+width);
      candidates.push(candidate);
      onProgress('Width '+width+': score '+candidate.confidence.toFixed(4));
    }catch(error){errors.push('width '+width+': '+error.message);}
  }
  if(!candidates.length)throw new Error('All model candidates failed: '+errors.join('; '));
  candidates.sort((a,b)=>b.confidence-a.confidence);
  onProgress('Selected '+candidates[0].width+'px (confidence '+candidates[0].confidence.toFixed(4)+')');
  return candidates[0].expression;
}
