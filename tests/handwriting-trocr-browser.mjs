import {chromium} from 'playwright';
import {readFileSync} from 'node:fs';
const manifest=JSON.parse(readFileSync('benchmark-fixtures/manifest.json','utf8'));
if(manifest.split!=='test'||manifest.items.length<1)throw new Error('Missing real human handwriting test image');
const browser=await chromium.launch({headless:true,args:['--disable-dev-shm-usage']});
try{
 const page=await browser.newPage();
 page.on('console',m=>console.log('Browser:',m.type(),m.text()));
 page.on('pageerror',e=>console.log('Page error:',e.message));
 await page.goto('http://127.0.0.1:8000/',{waitUntil:'domcontentloaded'});
 const file='benchmark-fixtures/'+manifest.items[0].file;
 const output=await page.evaluate(async filename=>{
   const image=new Image();image.src='/'+filename;await image.decode();
   const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;
   canvas.getContext('2d').drawImage(image,0,0);
   const {recognizeHandwriting}=await import('/src/handwriting.js');
   const progress=[];
   const start=performance.now();
   const latex=await recognizeHandwriting(canvas,{maxNewTokens:80,onProgress:message=>{if(progress.length<40)progress.push(message)}});
   return {latex,elapsed_ms:Math.round(performance.now()-start),progress};
 },file);
 console.log('HANDWRITING_TROCR_RESULT',JSON.stringify({expected:manifest.items[0].latex,...output}));
 if(!output.latex.trim())throw new Error('TrOCR returned empty LaTeX');
} finally {await browser.close();}
