/** Image-to-canvas adapter. All image processing stays on the user's device. */
export async function loadImage(file) {
  if (!(file instanceof Blob) || !/^image\/(png|jpeg|webp)$/.test(file.type)) throw new Error('Please provide a PNG, JPEG or WebP image.');
  if (file.size > 20 * 1024 * 1024) throw new Error('Image exceeds the 20 MB size limit.');
  const bmp = await createImageBitmap(file);
  if (bmp.width * bmp.height > 30_000_000) {bmp.close();throw new Error('Image exceeds the 30 megapixel safety limit.');}
  return bmp;
}
export function extractCrop(source, rect) {
  if (!source) throw new Error('Select an image first.');
  const box = rect || {x:0,y:0,w:source.width,h:source.height};
  const x = Math.max(0, Math.min(source.width-1, Math.floor(box.x)));
  const y = Math.max(0, Math.min(source.height-1, Math.floor(box.y)));
  const w = Math.max(1, Math.min(source.width-x, Math.ceil(box.w)));
  const h = Math.max(1, Math.min(source.height-y, Math.ceil(box.h)));
  const c=document.createElement('canvas');c.width=w;c.height=h;
  const ctx=c.getContext('2d',{willReadFrequently:true});ctx.fillStyle='white';ctx.fillRect(0,0,w,h);
  ctx.drawImage(source,x,y,w,h,0,0,w,h);return c;
}
export function clampSelection(x1,y1,x2,y2,width,height) {
  const ax=Math.min(width,Math.max(0,Math.min(x1,x2))), bx=Math.min(width,Math.max(0,Math.max(x1,x2)));
  const ay=Math.min(height,Math.max(0,Math.min(y1,y2))), by=Math.min(height,Math.max(0,Math.max(y1,y2)));
  return {x:ax,y:ay,w:bx-ax,h:by-ay};
}
/** RGB normalized to [0,1], CHW layout for use with ONNX model adapters. */
export function toCHW(canvas) {
  const {width:w,height:h}=canvas, rgba=canvas.getContext('2d',{willReadFrequently:true}).getImageData(0,0,w,h).data;
  const d=new Float32Array(3*w*h);
  for(let i=0;i<w*h;i++)for(let c=0;c<3;c++)d[c*w*h+i]=rgba[4*i+c]/255;
  return {data:d,dims:[1,3,h,w]};
}
