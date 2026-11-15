import {chromium} from 'playwright';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {summarize,toMarkdown} from './handwriting-metrics.mjs';
const manifest=JSON.parse(readFileSync('benchmark-fixtures/manifest.json','utf8'));
if(manifest.split!=='test'||manifest.items.length<1)throw new Error('No held-out handwriting images');
const browser=await chromium.launch({headless:true,args:['--disable-dev-shm-usage']});
const results=[];
try{
  const page=await browser.newPage();
  page.on('pageerror',error=>console.log('PAGE_EXCEPTION',error.message));
  await page.goto('http://127.0.0.1:8000/index.html',{waitUntil:'domcontentloaded'});
  for(const row of manifest.items) {
    const started=Date.now();
    const item={id:row.id,index:row.index,expected:row.latex,predicted:'',status:'error',inference_ms:null};
    try{
      const filename='benchmark-fixtures/'+row.file;
      const output=await page.evaluate(async(filename)=>{
        const image=new Image();image.src='/'+filename;await image.decode();
        const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;
        canvas.getContext('2d',{willReadFrequently:true}).drawImage(image,0,0);
        const {recognizeComer}=await import('/src/comer.js');
        return recognizeComer(canvas);
      },filename);
      item.predicted=output;
      item.status='ok';
    }catch(error){item.error=String(error);}
    item.inference_ms=Date.now()-started;
    results.push(item);
    console.log('COMER_HANDWRITING_ROW',JSON.stringify(item));
  }

  // Full application integration on actual held-out handwritten input.
  const page=await browser.newPage();
  await page.goto('http://127.0.0.1:8000/index.html',{waitUntil:'domcontentloaded'});
  await page.locator('#engine').selectOption('comer');
  const sample=manifest.items[0];
  await page.locator('#file').setInputFiles({
    name:'handwritten-equation.png',mimeType:'image/png',
    buffer:readFileSync('benchmark-fixtures/'+sample.file)
  });
  await page.locator('#recognize').click();
  await page.waitForFunction(()=>{
    const status=document.getElementById('status').textContent;
    return status.includes('Recognition completed')||status.includes('Recognition failed');
  },null,{timeout:180000});
  const status=await page.locator('#status').textContent();
  if(!status.includes('Recognition completed'))throw new Error('CoMER UI failed: '+status);
  const prediction=await page.locator('#latex').inputValue();
  if(!prediction.trim())throw new Error('CoMER UI returned empty LaTeX');
  await page.locator('#preview svg').first().waitFor({timeout:15000});
  console.log('COMER_HANDWRITING_UI_PASSED',JSON.stringify({expected:sample.latex,prediction}));
}finally{await browser.close();}
const summary=summarize(results);
const report={benchmark:'comer-onnx-official-test',dataset:manifest.dataset,split:manifest.split,summary,results};
mkdirSync('benchmark-results',{recursive:true});
writeFileSync('benchmark-results/comer-results.json',JSON.stringify(report,null,2)+'\n');
writeFileSync('benchmark-results/comer-summary.md',toMarkdown(report));
console.log('COMER_HANDWRITING_SUMMARY',JSON.stringify(summary));
if(!summary.completed)throw new Error('All CoMER inferences failed');
