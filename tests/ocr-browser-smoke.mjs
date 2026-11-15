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

  // Additional real-model quality probes. Record outputs without asserting
  // exact LaTeX spelling until the corpus and equivalence rules are validated.
  for(const formula of ['x^{2}+1=0',String.raw`\frac{x}{2}`,String.raw`\sqrt{x+1}`]){
    await page.evaluate(formula=>{
      document.getElementById('golden-formula').replaceChildren(MathJax.tex2svg(formula));
    },formula);
    const png=await page.locator('#golden-formula').screenshot();
    const observed=await page.evaluate(async base64=>{
      const {recognizeMath}=await import('/src/onnx.js');
      const img=new Image();img.src='data:image/png;base64,'+base64;await img.decode();
      const c=document.createElement('canvas');c.width=img.width;c.height=img.height;
      c.getContext('2d',{willReadFrequently:true}).drawImage(img,0,0);
      return recognizeMath(c,{maxTokens:100});
    },png.toString('base64'));
    console.log('OCR quality probe:',JSON.stringify({formula,observed}));
    const normalize=value=>value.replace(/\s+/g,'');
    if(normalize(observed)!==normalize(formula))throw new Error('OCR mismatch: '+formula+' => '+observed);
  }

  // Full UI round-trip: real file upload -> Recognize button -> editable
  // LaTeX field -> rendered MathJax preview. Uses cached ONNX sessions.
  await page.locator('#file').setInputFiles({name:'equation.png',mimeType:'image/png',buffer:bytes});
  await page.locator('#recognize').click();
  await page.waitForFunction(()=>{
    const status=document.getElementById('status').textContent;
    return status.includes('Recognition completed') || status.includes('Recognition failed');
  },null,{timeout:180000});
  const uiStatus=await page.locator('#status').textContent();
  if(!uiStatus.includes('Recognition completed'))throw new Error('UI recognition failed: '+uiStatus);
  const uiLatex=await page.locator('#latex').inputValue();
  if(uiLatex.replace(/\s+/g,'')!=='x+1=2')throw new Error('UI OCR regression: '+uiLatex);
  await page.locator('#preview svg').first().waitFor({timeout:30000});
  console.log('UI round-trip passed:',JSON.stringify({uiLatex,mathJaxRendered:true}));


  // Multiple formulas in one image: segment rows rather than decode all
  // together as a single expression (regression for screenshot issue).
  await page.evaluate(()=>{
    const block=document.getElementById('golden-formula');
    block.replaceChildren();
    for(const formula of ['x+1=2','x^{2}+1=0',String.raw`\frac{x}{2}`,String.raw`\sqrt{x+1}`]){
      const div=document.createElement('div');
      div.style.cssText='margin:0 0 30px 0;padding:0';
      div.appendChild(MathJax.tex2svg(formula));
      block.appendChild(div);
    }
  });
  const groupPng=await page.locator('#golden-formula').screenshot();
  await page.locator('#file').setInputFiles({name:'four-math-expressions.png',mimeType:'image/png',buffer:groupPng});
  await page.locator('#splitExpressions').check();
  await page.locator('#recognize').click();
  await page.waitForFunction(()=>{
    const s=document.getElementById('status').textContent;
    return s.includes('Recognition completed')||s.includes('Recognition failed');
  },null,{timeout:180000});
  const grouped=await page.locator('#latex').inputValue();
  const clean=value=>value.replace(/\s+/g,'');
  for(const expected of ['x+1=2','x^{2}+1=0',String.raw`\frac{x}{2}`,String.raw`\sqrt{x+1}`]){
    if(!clean(grouped).includes(clean(expected)))
      throw new Error('Multi-expression OCR lost '+expected+': '+grouped);
  }
  if(!grouped.includes('\\begin{gathered}'))
    throw new Error('Multiple formulas must be grouped in valid LaTeX');
  console.log('MULTI_EXPRESSION_UI_PASSED',JSON.stringify({grouped}));
  await page.locator('#splitExpressions').uncheck();

  // Integration contract: a same-origin Teacher-Board-like opener receives
  // an explicit pix2tex:result message only after the user clicks Send.
  await page.evaluate(()=>{
    window.__lastPix2texMessage=null;
    window.addEventListener('message',event=>{
      if(event.origin===location.origin && event.data?.type==='pix2tex:result')
        window.__lastPix2texMessage=event.data;
    });
  });
  const popupReady=page.waitForEvent('popup');
  await page.evaluate(()=>window.open('./index.html','_blank'));
  const popup=await popupReady;
  await popup.waitForLoadState('domcontentloaded');
  await popup.locator('#latex').fill('x+1=2');
  await popup.locator('#insert').click();
  await page.waitForFunction(()=>window.__lastPix2texMessage!==null,null,{timeout:10000});
  const posted=await page.evaluate(()=>window.__lastPix2texMessage);
  if(posted.latex!=='x+1=2'||posted.type!=='pix2tex:result')
    throw new Error('Teacher-Board message contract mismatch: '+JSON.stringify(posted));
  console.log('Teacher-Board messaging contract passed:',JSON.stringify(posted));
  await popup.close();
}finally{await browser.close();}
