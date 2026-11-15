/**
 * Experimental handwriting-trained TrOCR provider.
 * Uses Transformers.js entirely within the browser (no inference API calls).
 * Source: onnx-community/latex_finetuned-ONNX, fine-tuned on MathWriting.
 * Large first-time download; keep separate from existing RapidLaTeXOCR model.
 */
export const HANDWRITING_MODEL='onnx-community/latex_finetuned-ONNX';
const LIBRARY_URL='https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1';
let pipelinePromise=null, loaderPromise=null;
export function setHandwritingLoader(loader) {
  if(typeof loader!=='function')throw new TypeError('Loader must be a function');
  loaderPromise=Promise.resolve({pipeline:loader});
  pipelinePromise=null;
}
async function getPipeline(onProgress=()=>{}) {
  if(!loaderPromise)loaderPromise=import(LIBRARY_URL);
  const {pipeline}=await loaderPromise;
  if(!pipelinePromise) {
    onProgress('Downloading handwriting-trained model (large first-time download)…');
    pipelinePromise=pipeline('image-to-text',HANDWRITING_MODEL,{
      device:'wasm',
      dtype:'q8',
      progress_callback:event=>{
        if(event?.status==='progress'&&event.file)
          onProgress('Downloading '+event.file+': '+Math.round(event.progress||0)+'%');
      }
    }).catch(error=>{pipelinePromise=null;throw error;});
  }
  return pipelinePromise;
}
export async function recognizeHandwriting(canvas,{onProgress=()=>{},maxNewTokens=128}={}) {
  if(!canvas||typeof canvas.toDataURL!=='function')throw new Error('Select a cropped image first');
  if(!Number.isInteger(maxNewTokens)||maxNewTokens<1||maxNewTokens>256)
    throw new Error('Invalid generation limit');
  const pipe=await getPipeline(onProgress);
  onProgress('Recognizing handwritten equation locally…');
  // Browser-local data URI, NOT uploaded to a remote inference service.
  const output=await pipe(canvas.toDataURL('image/png'),{max_new_tokens:maxNewTokens});
  const latex=(Array.isArray(output)?output[0]?.generated_text:output?.generated_text);
  if(typeof latex!=='string'||!latex.trim())throw new Error('Handwriting OCR produced no LaTeX');
  return latex.trim();
}
