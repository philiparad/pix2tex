import test from 'node:test';
import assert from 'node:assert/strict';
import {segmentInkRows,joinFormulaLatex} from '../src/segment.js';
const make=(width,height,rects)=>{
 const rgba=new Uint8ClampedArray(width*height*4);
 for(let i=0;i<width*height;i++){rgba[i*4]=255;rgba[i*4+1]=255;rgba[i*4+2]=255;rgba[i*4+3]=255;}
 for(const {x,y,w,h} of rects)for(let py=y;py<y+h;py++)for(let px=x;px<x+w;px++){
   const i=(py*width+px)*4;rgba[i]=rgba[i+1]=rgba[i+2]=0;
 }
 return rgba;
};
test('four separated equations are detected in top-down order',()=>{
 const rects=[{x:4,y:4,w:25,h:9},{x:5,y:39,w:25,h:9},{x:6,y:75,w:17,h:13},{x:5,y:110,w:24,h:10}];
 const bands=segmentInkRows(make(50,130,rects),50,130);
 assert.equal(bands.length,4);
 assert.ok(bands.every((b,i)=>i===0||b.y>bands[i-1].y));
});
test('fraction numerator, bar, denominator stay grouped when gaps are short',()=>{
 const bands=segmentInkRows(make(40,60,[{x:7,y:9,w:10,h:4},{x:7,y:19,w:22,h:2},{x:7,y:28,w:10,h:5}]),40,60);
 assert.equal(bands.length,1);
});
test('transparent white background does not register as black ink',()=>{
 const blank=make(15,15,[]);
 assert.deepEqual(segmentInkRows(blank,15,15),[]);
});
test('multi-formula output uses MathJax aligned display',()=>{
 assert.equal(joinFormulaLatex(['x+1=2']), 'x+1=2');
 assert.equal(joinFormulaLatex(['x+1=2','x^{2}+1=0']),
   String.raw`\begin{gathered}x+1=2 \\ x^{2}+1=0\end{gathered}`);
});
