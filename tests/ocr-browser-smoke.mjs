// Real browser ONNX smoke test. Runs separately from fast unit checks.
// This test downloads actual model weights. It does NOT establish accuracy.
import { chromium } from 'playwright';
const browser=await chromium.launch({headless:true,args:['--disable-dev-shm-usage']});
const page=await browser.newPage();
page.on('console',m=>console.log('Browser console:',m.type(),m.text()));
page.on('pageerror',e=>console.error('Browser error:',e.message));
try{
  await page.goto('http://127.0.0.1:8000/',{waitUntil:'domcontentloaded'});
  const result=await page.evaluate(async()=>{
    const {recognizeMath}=await import('/src/onnx.js');
    const c=document.createElement('canvas');c.width=330;c.height=90;
    const x=c.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,330,90);
    x.fillStyle='#000';x.font='56px serif';x.fillText('x+1=2',15,65);
    const progress=[];
    const latex=await recognizeMath(c,{maxTokens:80,onProgress:message=>{if(progress.length<20)progress.push(message)}});
    return {latex,progress};
  },{timeout:600000});
  console.log('Actual model OCR result:',JSON.stringify(result));
  if(!result.latex||typeof result.latex!=='string')throw new Error('Empty OCR result');
}finally{await browser.close();}
