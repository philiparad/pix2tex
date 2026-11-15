/**
 * Lanczos-3 resampling for grayscale formula images.
 * Pillow uses LANCZOS for downscaling in RapidLaTeXOCR.
 * Canvas imageSmoothingQuality='high' is browser-dependent and is not
 * numerically equivalent to Pillow's Lanczos filter.
 */
export function sinc(x) {
  if(Math.abs(x)<1e-10)return 1;
  const px=Math.PI*x;
  return Math.sin(px)/px;
}
export function lanczosWeights(input,output,index){
  const scale=input/output;
  const support=Math.max(1,scale);
  const radius=3*support;
  const center=(index+0.5)*scale-0.5;
  let begin=Math.max(0,Math.ceil(center-radius));
  let end=Math.min(input-1,Math.floor(center+radius));
  const weights=[];let sum=0;
  for(let i=begin;i<=end;i++){
    const x=(i-center)/support;
    const w=Math.abs(x)<3?sinc(x)*sinc(x/3):0;
    weights.push(w);sum+=w;
  }
  if(Math.abs(sum)<1e-10)throw new Error('Invalid Lanczos kernel');
  return {begin,weights:weights.map(w=>w/sum)};
}
export function resizeGray(data,sourceWidth,sourceHeight,targetWidth,targetHeight){
  if(data.length!==sourceWidth*sourceHeight)throw new Error('Source image buffer mismatch');
  if(![sourceWidth,sourceHeight,targetWidth,targetHeight].every(v=>Number.isInteger(v)&&v>0))throw new Error('Invalid resize dimensions');
  const tmp=new Float64Array(targetWidth*sourceHeight);
  const horizontal=Array.from({length:targetWidth},(_,x)=>lanczosWeights(sourceWidth,targetWidth,x));
  const vertical=Array.from({length:targetHeight},(_,y)=>lanczosWeights(sourceHeight,targetHeight,y));
  for(let y=0;y<sourceHeight;y++)for(let x=0;x<targetWidth;x++){
    const {begin,weights}=horizontal[x];let sum=0;
    for(let k=0;k<weights.length;k++)sum+=data[y*sourceWidth+begin+k]*weights[k];
    tmp[y*targetWidth+x]=sum;
  }
  const result=new Uint8ClampedArray(targetWidth*targetHeight);
  for(let y=0;y<targetHeight;y++)for(let x=0;x<targetWidth;x++){
    const {begin,weights}=vertical[y];let sum=0;
    for(let k=0;k<weights.length;k++)sum+=tmp[(begin+k)*targetWidth+x]*weights[k];
    result[y*targetWidth+x]=Math.max(0,Math.min(255,Math.round(sum)));
  }
  return result;
}
export function resizeLanczosCanvas(source,w,h) {
  const pixels=source.getContext('2d',{willReadFrequently:true}).getImageData(0,0,source.width,source.height).data;
  const gray=new Uint8ClampedArray(source.width*source.height);
  for(let i=0;i<gray.length;i++)gray[i]=Math.round(.299*pixels[4*i]+.587*pixels[4*i+1]+.114*pixels[4*i+2]);
  const resized=resizeGray(gray,source.width,source.height,w,h);
  const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;
  const ctx=canvas.getContext('2d',{willReadFrequently:true});
  const img=ctx.createImageData(w,h);
  for(let i=0;i<resized.length;i++){
    img.data[4*i]=resized[i];img.data[4*i+1]=resized[i];img.data[4*i+2]=resized[i];img.data[4*i+3]=255;
  }
  ctx.putImageData(img,0,0);
  return canvas;
}
