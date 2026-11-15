import { writeFileSync } from 'node:fs';
// Real browser ONNX smoke test. Runs separately from fast unit checks.
// This test downloads actual model weights. It does NOT establish accuracy.
import { chromium } from 'playwright';
const browser=await chromium.launch({headless:true,args:['--disable-dev-shm-usage']});
const page=await browser.newPage();
page.on('console',m=>console.log('Browser console:',m.type(),m.text()));
page.on('pageerror',e=>console.error('Browser error:',e.message));
try{
  await page.goto('http://127.0.0.1:8000/',{waitUntil:'domcontentloaded'});
  // Use an actual mathematical typesetting fixture, not merely browser text.
  await page.waitForFunction(()=>typeof window.MathJax?.tex2svg==='function',{timeout:30000});
  await page.evaluate(()=>{
    const target=document.createElement('div');target.id='golden-formula';
    target.style.cssText='display:inline-block;background:white;color:black;padding:16px;font-size:36px';
    target.appendChild(MathJax.tex2svg('x+1=2'));
    document.body.prepend(target);
  });
  const bytes=await page.locator('#golden-formula').screenshot();
  writeFileSync('/tmp/pix2tex-benchmark.png',bytes);
  const base64=bytes.toString('base64');
  const result=await page.evaluate(async(base64)=>{
    const {recognizeMath}=await import('/src/onnx.js');
    const {preprocessCanvas}=await import('/src/preprocess.js');
    const image=new Image();image.src='data:image/png;base64,'+base64;
    await image.decode();
    const c=document.createElement('canvas');c.width=image.width;c.height=image.height;
    const x=c.getContext('2d',{willReadFrequently:true});x.fillStyle='white';x.fillRect(0,0,c.width,c.height);
    x.drawImage(image,0,0);
    const progress=[];
    const latex=await recognizeMath(c,{maxTokens:80,onProgress:message=>{if(progress.length<24)progress.push(message)}});
    const tensor=preprocessCanvas(c,{targetWidth:64});
    const initial=preprocessCanvas(c);
    return {latex,progress,tensor:{dims:tensor.dims,data:Array.from(tensor.data)},initial:{dims:initial.dims,mean:initial.data.reduce((a,b)=>a+b,0)/initial.data.length}};
  },base64);
  writeFileSync('/tmp/pix2tex-browser-tensor.json',JSON.stringify(result.tensor));
  console.log('Browser initial tensor:',result.initial);
  console.log('Browser tensor shape:',result.tensor.dims,'first 8 values:',result.tensor.data.slice(0,8));
  console.log('Actual model OCR result:',JSON.stringify({latex:result.latex,progress:result.progress}));
  if(!result.latex||typeof result.latex!=='string')throw new Error('Empty OCR result');
  if(result.latex.replace(/\s+/g,'')!=='x+1=2')throw new Error('OCR correctness regression: expected x+1=2, got '+result.latex);
}finally{await browser.close();}
