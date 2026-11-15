/** Pure, reproducible handwritten-math OCR metrics. No model-specific dependencies. */
export function normalizeLatex(value) {
  if (typeof value !== 'string') throw new TypeError('LaTeX must be a string');
  // Conservative canonicalization: remove insignificant spacing but preserve
  // literal contents of text-like commands and command boundaries.
  const protectedText=[];
  const masked=value.trim().replace(/\\(?:text|operatorname|mathrm|mathbf)\s*\{[^{}]*\}/g, match=>{
    const id=protectedText.push(match)-1;
    return '¤'+id+'¤';
  });
  const compact=masked.replace(/\s+/g,'')
    .replace(/¤(\d+)¤/g,(_,id)=>protectedText[Number(id)].replace(/\s*\{/,'{'));
  return compact;
}
export function editDistance(a,b) {
  const x=Array.from(a),y=Array.from(b);
  let prev=Array.from({length:y.length+1},(_,i)=>i);
  for (let i=1;i<=x.length;i++) {
    const current=[i];
    for(let j=1;j<=y.length;j++)
      current[j]=Math.min(prev[j]+1,current[j-1]+1,prev[j-1]+(x[i-1]===y[j-1]?0:1));
    prev=current;
  }
  return prev[y.length];
}
const quantile=(values,q)=>{
  if(!values.length)return null;
  const sorted=[...values].sort((a,b)=>a-b);
  const pos=(sorted.length-1)*q,lo=Math.floor(pos),hi=Math.ceil(pos);
  return sorted[lo]+(sorted[hi]-sorted[lo])*(pos-lo);
};
export function summarize(results) {
  if(!Array.isArray(results)||results.length===0) throw new Error('Benchmark requires at least one real sample');
  const total=results.length;
  let matched=0, completed=0, edits=0, chars=0;
  const durations=[];
  for(const item of results) {
    if(typeof item.expected!=='string'||!item.expected.trim())throw new Error('Missing reference LaTeX for '+item.id);
    const expected=normalizeLatex(item.expected);
    const observed=item.status==='ok'?normalizeLatex(item.predicted):'';
    if(item.status==='ok') {
      completed++;
      if(Number.isFinite(item.inference_ms))durations.push(item.inference_ms);
    }
    if(observed===expected)matched++;
    edits+=editDistance(expected,observed);
    chars+=Array.from(expected).length;
  }
  return {
    samples:total, completed, failed:total-completed,
    exact_matches:matched,
    exact_accuracy:matched/total,
    recognition_success_rate:completed/total,
    character_error_rate:chars?edits/chars:null,
    median_inference_ms:quantile(durations,0.5),
    p95_inference_ms:quantile(durations,0.95)
  };
}
export function toMarkdown(report) {
  const s=report.summary;
  const pct=n=>(100*n).toFixed(1)+'%';
  const ms=n=>n===null?'n/a':n.toFixed(0)+' ms';
  const lines=[
    '# Handwritten Math OCR — Real-image benchmark',
    '',
    '> Small deterministic test sample; not a general accuracy claim.',
    '',
    '| Metric | Result |','| --- | --- |',
    '| Actual human-written test images | '+s.samples+' |',
    '| Inference completed | '+s.completed+'/'+s.samples+' |',
    '| Exact expression accuracy | '+pct(s.exact_accuracy)+' |',
    '| Recognition success rate | '+pct(s.recognition_success_rate)+' |',
    '| Character error rate | '+pct(s.character_error_rate??0)+' |',
    '| Median recognition time | '+ms(s.median_inference_ms)+' |',
    '| P95 recognition time | '+ms(s.p95_inference_ms)+' |',
    '',
    '## Per-image transcription',
    '',
    '| Row index | Result | Reference LaTeX | Recognized LaTeX |',
    '| --- | --- | --- | --- |'
  ];
  const safe=v=>String(v??'').replaceAll('|','\\|').replaceAll('\n',' ');
  for(const x of report.results)lines.push('| '+x.index+' | '+(x.status==='ok'?(normalizeLatex(x.expected)===normalizeLatex(x.predicted)?'Correct':'Incorrect'):'Error')+' | `'+safe(x.expected)+'` | `'+safe(x.predicted??x.error)+'` |');
  return lines.join('\n')+'\n';
}
