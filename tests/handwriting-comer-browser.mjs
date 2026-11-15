import {chromium} from 'playwright';
import {readFileSync} from 'node:fs';
const manifest=JSON.parse(readFileSync('benchmark-fixtures/manifest.json','utf8'));
if(manifest.split!=='test'||manifest.items.length<1)throw new Error('No held-out handwriting image');
const browser=await chromium.launch({headless:true,args:['--disable-dev-shm-usage']});
try{
 const page=await browser.newPage();
 page.on('pageerror',error=>console.log('PAGE_EXCEPTION',error.message));
 page.on('console',msg=>console.log('BROWSER_CONSOLE',msg.type(),msg.text()));
 await page.goto('http://127.0.0.1:8000/index.html',{waitUntil:'domcontentloaded'});
 const filename='benchmark-fixtures/'+manifest.items[0].file;
 const result=await page.evaluate(async(filename)=>{
   const image=new Image();image.src='/'+filename;await image.decode();
   const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;
   canvas.getContext('2d',{willReadFrequently:true}).drawImage(image,0,0);
   const {prepareComerRaster,recognizeComer}=await import('/src/comer.js');
   const input=prepareComerRaster(canvas);
   const t=performance.now();const progress=[];
   const latex=await recognizeComer(canvas,{onProgress:m=>progress.push(m)});
   return {latex,dims:[input.height,input.width],elapsed_ms:Math.round(performance.now()-t),progress};
 },filename);
 console.log('COMER_HANDWRITING_RESULT',JSON.stringify({expected:manifest.items[0].latex,...result}));
 if(!result.latex)throw new Error('Empty CoMER result');
}finally{await browser.close();}
