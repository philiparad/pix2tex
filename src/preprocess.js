/**
 * RapidLaTeXOCR-inspired preprocessing, executed entirely in the browser.
 * One-channel tensor: [1,1,height,width]; channel values (pixel/255-0.7931)/0.1738.
 * Image dimensions are cropped to ink, constrained, and padded to multiples of 32.
 */
const STRIDE=32, MEAN=0.7931, STD=0.1738;
export const nextStride=(v,step=STRIDE)=>Math.ceil(v/step)*step;
export function constrainSize(w,h,maxW=672,maxH=192) {
  if(!(w>0&&h>0)) throw new Error('Invalid image size');
  const scale=Math.min(1,maxW/w,maxH/h);
  return [Math.max(1,Math.floor(w*scale)),Math.max(1,Math.floor(h*scale))];
}
export function boundsOfInk(pixels,width,height,threshold=245) {
  let left=width,top=height,right=-1,bottom=-1;
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const p=(y*width+x)*4;
    const a=pixels[p+3]/255;
    const gray=(pixels[p]*.299+pixels[p+1]*.587+pixels[p+2]*.114)*a+255*(1-a);
    if(gray<threshold){
      left=Math.min(left,x);right=Math.max(right,x);
      top=Math.min(top,y);bottom=Math.max(bottom,y);
    }
  }
  return right<left?null:{x:left,y:top,w:right-left+1,h:bottom-top+1};
}
export function preprocessCanvas(source,{maxWidth=672,maxHeight=192,targetWidth=null}={}) {
  if(!source?.width||!source?.height) throw new Error('Image required');
  const context=source.getContext('2d',{willReadFrequently:true});
  const pixels=context.getImageData(0,0,source.width,source.height);
  const ink=boundsOfInk(pixels.data,source.width,source.height);
  if(!ink) throw new Error('No dark expression pixels detected in image');
  let [width,height]=constrainSize(ink.w,ink.h,maxWidth,maxHeight);
  if(targetWidth!==null){
    if(!Number.isFinite(targetWidth)||targetWidth<32)throw new Error('Invalid resizer width');
    const ratio=targetWidth/ink.w;
    width=Math.max(1,Math.floor(Math.min(maxWidth,ink.w*ratio)));
    height=Math.max(1,Math.floor(Math.min(maxHeight,ink.h*ratio)));
  }
  const w=nextStride(Math.max(32,width)),h=nextStride(Math.max(32,height));
  const canvas=document.createElement('canvas');
  canvas.width=w;canvas.height=h;
  const ctx=canvas.getContext('2d',{willReadFrequently:true});
  ctx.fillStyle='white';ctx.fillRect(0,0,w,h);
  ctx.drawImage(source,ink.x,ink.y,ink.w,ink.h,0,0,width,height);
  const rgba=ctx.getImageData(0,0,w,h).data;
  const data=new Float32Array(w*h);
  for(let i=0;i<data.length;i++){
    const p=i*4,a=rgba[p+3]/255;
    const gray=(rgba[p]*.299+rgba[p+1]*.587+rgba[p+2]*.114)*a+255*(1-a);
    data[i]=(gray/255-MEAN)/STD;
  }
  return {data,dims:[1,1,h,w],width:w,height:h,preview:canvas};
}
