/**
 * Pure decoder helpers. Unit-testable without a browser or model download.
 * Tokens follow RapidLaTeXOCR: BOS=1, EOS=2, maximum output length 512.
 */
export const BOS = 1;
export const EOS = 2;
export const MAX_TOKENS = 512;

export function lastTokenArgmax(tensor) {
  const dims=tensor.dims;
  if (dims.length < 2) throw new Error('Decoder logits must have rank >= 2');
  const vocab=dims[dims.length-1];
  if (!Number.isInteger(vocab)||vocab<3) throw new Error('Invalid vocabulary dimension');
  const data=tensor.data;
  if(data.length<vocab) throw new Error('Decoder logits array is incomplete');
  let best=-Infinity,index=-1;
  const offset=data.length-vocab;
  for(let i=0;i<vocab;i++){
    const value=Number(data[offset+i]);
    if(Number.isFinite(value)&&value>best){best=value;index=i;}
  }
  if(index<0) throw new Error('Decoder returned no finite logits');
  return index;
}

export function decodeTokens(tokenizerJson, ids) {
  const vocab=tokenizerJson?.model?.vocab;
  if(!vocab||typeof vocab!=='object') throw new Error('Unsupported tokenizer: model.vocab missing');
  const inverse=[];
  for(const [token,id] of Object.entries(vocab)) inverse[id]=token;
  const special=new Set([BOS,EOS,0]);
  for(const entry of tokenizerJson.added_tokens||[]) if(entry.special) special.add(entry.id);
  const words=ids.filter(id=>!special.has(id)).map(id=>{
    if(inverse[id]===undefined) throw new Error('Unknown token id: '+id);
    return inverse[id];
  });
  // RapidLaTeXOCR's tokenizers decode joins BPE pieces with spaces,
  // then removes spaces, with explicit Ġ mapped to a literal space.
  return words.join('').replaceAll('Ġ',' ').replaceAll('▁',' ')
    .replace(/\[(?:EOS|BOS|PAD)\]/g,'').trim();
}

export function cleanLatex(text) {
  // Keep whitespace inside text-like commands while removing tokenization
  // spaces around mathematical punctuation.
  const protectedGroups=[];
  let value=String(text).replace(/\\(?:operatorname|mathrm|text|mathbf)\*?\s*\{[^{}]*\}/g,
    match=>{
      const index=protectedGroups.push(match)-1;
      return 'Ⓢ'+index+'Ⓢ';
    });
  value=value.replace(/\s*([{}^_=+\-*\/(),])\s*/g,'$1')
    .replace(/(\\[A-Za-z]+)\s+(?=\{)/g,'$1')
    .replace(/([0-9])\s+([A-Za-z])/g,'$1$2')
    .replace(/\s+/g,' ').trim();
  return value.replace(/Ⓢ(\d+)Ⓢ/g,(_,index)=>protectedGroups[Number(index)]);
}

export function ensureTensor(tensor, label) {
  if(!tensor || !Array.isArray(tensor.dims) || !tensor.data)
    throw new Error('Missing tensor: '+label);
  return tensor;
}

export function modelInputFeed(session, tensors) {
  const names=session.inputNames;
  if(names.length!==tensors.length)
    throw new Error('ONNX input mismatch: expected '+tensors.length+', got '+names.length+' ('+names.join(', ')+')');
  return Object.fromEntries(names.map((name,i)=>[name,tensors[i]]));
}
