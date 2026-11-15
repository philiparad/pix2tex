import test from 'node:test';
import assert from 'node:assert/strict';
import {BOS,EOS,lastTokenArgmax,decodeTokens,cleanLatex,modelInputFeed} from '../src/decoder.js';
import {nextStride,constrainSize,boundsOfInk} from '../src/preprocess.js';

test('BOS/EOS match RapidLaTeXOCR',()=>{
  assert.equal(BOS,1); assert.equal(EOS,2);
});
test('decoder uses final timestep',()=>{
  assert.equal(lastTokenArgmax({dims:[1,2,3],data:Float32Array.from([9,0,0,0,1,7])}),2);
});
test('decoder rejects non-finite scores',()=>{
  assert.throws(()=>lastTokenArgmax({dims:[1,1,3],data:Float32Array.from([NaN,NaN,NaN])}),/finite/);
});
test('tokenizer strips special tokens',()=>{
  const tokenizer={model:{vocab:{'[PAD]':0,'[BOS]':1,'[EOS]':2,'\\frac':3,'{':4,'x':5,'}':6}},added_tokens:[{id:0,special:true},{id:1,special:true},{id:2,special:true}]};
  assert.equal(decodeTokens(tokenizer,[1,3,4,5,6,2]),'\\frac{x}');
});
test('ONNX feed rejects incompatible number of inputs',()=>{
  assert.throws(()=>modelInputFeed({inputNames:['tokens','mask']},[1]),/mismatch/);
});
test('strides pad to multiples of 32',()=>{
  assert.equal(nextStride(32),32);assert.equal(nextStride(33),64);
});
test('large image scaling maintains aspect ratio',()=>{
  assert.deepEqual(constrainSize(1344,384),[672,192]);
});
test('ink bounds respect transparent white and black text',()=>{
  const px=new Uint8ClampedArray(3*2*4);
  for(let i=0;i<6;i++){px[i*4]=255;px[i*4+1]=255;px[i*4+2]=255;px[i*4+3]=255;}
  px[4]=0;px[5]=0;px[6]=0;
  assert.deepEqual(boundsOfInk(px,3,2),{x:1,y:0,w:1,h:1});
});

test('OCR LaTeX cleanup removes unnecessary math token spaces',()=>{
  assert.equal(cleanLatex(String.raw`\frac { x } { 2 }`),String.raw`\frac{x}{2}`);
  assert.equal(cleanLatex('x ^ { 2 } + 1 = 0'),'x^{2}+1=0');
});
test('OCR cleanup preserves whitespace in text groups',()=>{
  assert.equal(cleanLatex(String.raw`\text{hello world} + x`),String.raw`\text{hello world}+x`);
});
