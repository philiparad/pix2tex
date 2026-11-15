/** Real handwritten-image benchmark. Requires Playwright and downloaded benchmark-fixtures. */
import {chromium} from 'playwright';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {summarize,toMarkdown} from './handwriting-metrics.mjs';

const root=process.env.BENCH_FIXTURE_DIR||'benchmark-fixtures';
const out=process.env.BENCH_RESULT_DIR||'benchmark-results';
const origin=process.env.BENCH_ORIGIN||'http://127.0.0.1:8000';
const manifest=JSON.parse(await readFile(root+'/manifest.json','utf8'));
if(manifest.split!=='test'||manifest.dataset!=='deepcopy/MathWriting-human'||!Array.isArray(manifest.items)||!manifest.items.length)
  throw new Error('A nonempty MathWriting-human TEST manifest is required');
const browser=await chromium.launch({headless:true,args:['--disable-dev-shm-usage']});
const results=[];
let coldLoadMs=null;
try{
  const page=await browser.newPage();
  page.setDefaultTimeout(120000);
  page.on('pageerror',e=>console.error('Browser exception:',e.message));
  await page.goto(origin+'/index.html',{waitUntil:'domcontentloaded'});
  const loadedAt=Date.now();
  await page.evaluate(async()=>{
    const {loadModel}=await import('/src/onnx.js');
    await loadModel();
  });
  coldLoadMs=Date.now()-loadedAt;
  console.log('Model cold-load time (including downloads):',coldLoadMs,'ms');
  for(const sample of manifest.items){
    const started=Date.now();
    const entry={id:sample.id,index:sample.index,expected:sample.latex,status:'error',predicted:'',error:null,inference_ms:null};
    try{
      const predicted=await page.evaluate(async file=>{
        const response=await fetch('/'+file);
        if(!response.ok)throw new Error('Fixture image inaccessible: '+response.status);
        const blob=await response.blob();
        const bitmap=await createImageBitmap(blob);
        const canvas=document.createElement('canvas');
        canvas.width=bitmap.width;canvas.height=bitmap.height;
        const ctx=canvas.getContext('2d',{willReadFrequently:true});
        ctx.fillStyle='white';ctx.fillRect(0,0,canvas.width,canvas.height);
        ctx.drawImage(bitmap,0,0);bitmap.close();
        const {recognizeMath}=await import('/src/onnx.js');
        return await recognizeMath(canvas,{maxTokens:128});
      },root+'/'+sample.file);
      if(typeof predicted!=='string'||!predicted.trim())throw new Error('Empty model result');
      entry.predicted=predicted;
      entry.status='ok';
    }catch(error){
      entry.error=String(error).slice(0,600);
    }
    entry.inference_ms=Date.now()-started;
    results.push(entry);
    console.log('Real handwriting row '+entry.index+': '+entry.status+' ('+entry.inference_ms+' ms)');
  }
}finally{
  await browser.close();
}
const summary=summarize(results);
const report={
  benchmark:'genuine-handwritten-math',
  dataset:manifest.dataset,split:manifest.split,config:manifest.config,
  selection:manifest.sampling, model:'browser ONNX RapidLaTeXOCR',
  run_utc:new Date().toISOString(),commit:process.env.GITHUB_SHA||'local',
  model_cold_load_ms:coldLoadMs,summary,results
};
await mkdir(out,{recursive:true});
await writeFile(out+'/handwriting-results.json',JSON.stringify(report,null,2)+'\n');
await writeFile(out+'/handwriting-summary.md',toMarkdown(report));
console.log(JSON.stringify({summary,report:out+'/handwriting-summary.md'}));
if(!summary.completed)throw new Error('Every real handwriting inference failed; benchmark is invalid');
