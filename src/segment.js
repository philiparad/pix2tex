/**
 * Detect vertically separated formulas from pixel rows.
 * Conservative whitespace splitting: never split on an ordinary single
 * row gap inside a fraction, radical or superscript.
 */
export function segmentInkRows(rgba,width,height,{threshold=238,minGap=14,padding=5,minInk=5}={}) {
  if(!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1||
     rgba.length!==width*height*4)throw new Error('Invalid RGBA image');
  const rowInk=new Uint32Array(height);
  for(let y=0;y<height;y++)for(let x=0;x<width;x++) {
    const i=(y*width+x)*4,alpha=rgba[i+3]/255;
    const luminance=(.299*rgba[i]+.587*rgba[i+1]+.114*rgba[i+2])*alpha+255*(1-alpha);
    if(luminance<threshold)rowInk[y]++;
  }
  const blocks=[];
  let top=-1,last=-1,count=0;
  function commit(){
    if(top>=0 && count>=minInk)blocks.push({
      y:Math.max(0,top-padding),
      h:Math.min(height,last+1+padding)-Math.max(0,top-padding),
      inkPixels:count
    });
  }
  for(let y=0;y<height;y++) {
    if(rowInk[y]===0)continue;
    if(top<0){top=y;count=0;}
    else if(y-last-1>=minGap){commit();top=y;count=0;}
    last=y;count+=rowInk[y];
  }
  commit();
  // Padding may cause zones to touch. Merge rather than double-recognize.
  const merged=[];
  for(const item of blocks) {
    const prev=merged[merged.length-1];
    if(prev && prev.y+prev.h>item.y){
      prev.h=Math.max(prev.y+prev.h,item.y+item.h)-prev.y;
      prev.inkPixels+=item.inkPixels;
    }else merged.push({...item});
  }
  return merged;
}
export function splitCanvasFormulas(canvas,options) {
  if(!canvas?.width||!canvas?.height)throw new Error('Select an image first');
  const context=canvas.getContext('2d',{willReadFrequently:true});
  const rgba=context.getImageData(0,0,canvas.width,canvas.height).data;
  const rows=segmentInkRows(rgba,canvas.width,canvas.height,options);
  if(!rows.length)throw new Error('No mathematical content detected');
  return rows.map(row=>{
    const crop=document.createElement('canvas');
    crop.width=canvas.width;crop.height=row.h;
    const ctx=crop.getContext('2d');
    ctx.fillStyle='white';ctx.fillRect(0,0,crop.width,crop.height);
    ctx.drawImage(canvas,0,row.y,canvas.width,row.h,0,0,canvas.width,row.h);
    return {canvas:crop,bounds:row};
  });
}
export function joinFormulaLatex(expressions) {
  if(!Array.isArray(expressions)||!expressions.length||
     expressions.some(x=>typeof x!=='string'||!x.trim()))throw new Error('Invalid expression list');
  if(expressions.length===1)return expressions[0].trim();
  return '\\begin{gathered}'+expressions.map(x=>x.trim()).join(' \\\\ ')+'\\end{gathered}';
}
