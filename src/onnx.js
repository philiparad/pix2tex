/** Diagnostics only. Inference is intentionally blocked until correct preprocessing and autoregressive decoding are validated. */
const FILENAMES=['image_resizer.onnx','encoder.onnx','decoder.onnx','tokenizer.json'];
export function modelPaths(base) {
  const prefix=base.endsWith('/')?base:base+'/';
  return FILENAMES.map(name=>({name,url:new URL(prefix+name,document.baseURI).href}));
}
export async function checkModelAssets(base) {
  const files=modelPaths(base); const results=[];
  for(const file of files){
    try {
      const response=await fetch(file.url,{method:'HEAD',cache:'no-store'});
      results.push({file:file.name,ok:response.ok,http:response.status,bytes:response.headers.get('content-length')});
    }catch(e){results.push({file:file.name,ok:false,error:String(e)});}
  }
  return results;
}
export async function inspectEncoder(base) {
  const {default:ort}=await import('https://cdn.jsdelivr.net/npm/onnxruntime-web@1.22.0/+esm');
  const file=modelPaths(base).find(x=>x.name==='encoder.onnx');
  const session=await ort.InferenceSession.create(file.url,{executionProviders:['wasm']});
  return {inputs:session.inputNames,outputs:session.outputNames};
}
export async function recognizeMath(_canvas) {
  throw new Error('ONNX inference not implemented yet: encoder preprocessing, resizer output, autoregressive decoder inputs, tokenizer mapping and EOS handling require model-specific verification. No fake recognition output is returned.');
}
