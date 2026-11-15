/**
 * Experimental CoMER INT8 handwriting recognition in pure browser JS.
 * Models and algorithm: kimseungdae/ink-on (Apache-2.0 code; upstream CoMER
 * weights require attribution and independent license review).
 * Model revision pinned to 2585994ee11fe2ed98065c555c4aae8ee9096209.
 */
export const COMER_REVISION='2585994ee11fe2ed98065c555c4aae8ee9096209';
export const COMER_MODEL_BASE='https://cdn.jsdelivr.net/gh/kimseungdae/ink-on@'+COMER_REVISION+'/public/models/comer/';
let initialized=null;
let loadCore=()=>import('https://esm.sh/ink-on@0.1.0/core?bundle');

export function setComerCoreLoader(loader) {
  if(typeof loader!=='function')throw new TypeError('A loader function is required');
  loadCore=loader;
  initialized=null;
}
export function prepareComerRaster(canvas) {
  if(!canvas?.width||!canvas?.height)throw new Error('Provide a cropped image');
  const {width,height}=canvas;
  if(width*height>30_000_000)throw new Error('Image too large');
  const rgba=canvas.getContext('2d',{willReadFrequently:true})
    .getImageData(0,0,width,height).data;
  let left=width,right=-1,top=height,bottom=-1;
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const p=(y*width+x)*4,a=rgba[p+3]/255;
    const gray=(.299*rgba[p]+.587*rgba[p+1]+.114*rgba[p+2])*a+255*(1-a);
    if(gray<235){left=Math.min(left,x);right=Math.max(right,x);
      top=Math.min(top,y);bottom=Math.max(bottom,y);}
  }
  if(right<left||bottom<top)throw new Error('No visible handwriting detected');
  const pad=16;
  const inkW=right-left+1,inkH=bottom-top+1;
  const rawW=inkW+2*pad,rawH=inkH+2*pad;
  const scale=Math.min(128/rawH,1024/rawW);
  const scaledW=Math.max(1,Math.round(rawW*scale));
  const scaledH=Math.max(1,Math.round(rawH*scale));
  const targetW=Math.min(1024,Math.max(128,Math.ceil((scaledW+pad)/64)*64));
  const H=256;
  const raw=document.createElement('canvas');raw.width=rawW;raw.height=rawH;
  const ctx=raw.getContext('2d',{willReadFrequently:true});
  ctx.fillStyle='black';ctx.fillRect(0,0,rawW,rawH);
  // Convert dark source ink to white on black; preserve grayscale variation.
  const raster=ctx.createImageData(rawW,rawH);
  for(let y=0;y<inkH;y++)for(let x=0;x<inkW;x++){
    const sourceIndex=((top+y)*width+left+x)*4;
    const a=rgba[sourceIndex+3]/255;
    const gray=(.299*rgba[sourceIndex]+.587*rgba[sourceIndex+1]+.114*rgba[sourceIndex+2])*a+255*(1-a);
    const value=Math.round(255-gray);
    const k=((y+pad)*rawW+x+pad)*4;
    raster.data[k]=raster.data[k+1]=raster.data[k+2]=value;
    raster.data[k+3]=255;
  }
  for(let i=0;i<raster.data.length;i+=4)raster.data[i+3]=255;
  ctx.putImageData(raster,0,0);
  const target=document.createElement('canvas');target.width=targetW;target.height=H;
  const out=target.getContext('2d',{willReadFrequently:true});
  out.fillStyle='black';out.fillRect(0,0,targetW,H);
  out.drawImage(raw,0,0,scaledW,scaledH);
  const data=out.getImageData(0,0,targetW,H).data;
  const tensor=new Float32Array(H*targetW),mask=new Uint8Array(H*targetW);
  for(let y=0;y<H;y++)for(let x=0;x<targetW;x++){
    const i=y*targetW+x,k=4*i;
    tensor[i]=(.299*data[k]+.587*data[k+1]+.114*data[k+2])/255;
    mask[i]=y<scaledH&&x<scaledW?0:1;
  }
  return {tensor,mask,height:H,width:targetW,maskHeight:H,maskWidth:targetW};
}
async function getEngine(onProgress) {
  if(!initialized)initialized=(async()=>{
    onProgress('Loading CoMER framework-independent core…');
    const {InferenceEngine,loadVocab}=await loadCore();
    const vocab=await loadVocab(COMER_MODEL_BASE+'vocab.json');
    onProgress('Loading CoMER INT8 browser ONNX models (~7.2 MB)…');
    const engine=new InferenceEngine({
      encoderUrl:COMER_MODEL_BASE+'encoder_int8.onnx',
      decoderUrl:COMER_MODEL_BASE+'decoder_int8.onnx',
      beamWidth:2,maxDecodeSteps:96,executionProvider:'wasm'
    });
    await engine.init();
    return {engine,vocab};
  })().catch(error=>{initialized=null;throw error;});
  return initialized;
}
export async function recognizeComer(canvas,{onProgress=()=>{}}={}) {
  const prepared=prepareComerRaster(canvas);
  const {engine,vocab}=await getEngine(onProgress);
  onProgress('Recognizing handwriting using CoMER…');
  const response=await engine.recognize(prepared,vocab,'auto');
  if(typeof response?.latex!=='string'||!response.latex.trim())
    throw new Error('CoMER returned an empty mathematical expression');
  return response.latex.trim();
}
