import test from 'node:test';
import assert from 'node:assert/strict';
import {sinc,lanczosWeights,resizeGray} from '../src/lanczos.js';
test('sinc(0)=1 and zeros at integers',()=>{
  assert.equal(sinc(0),1);
  assert.ok(Math.abs(sinc(1))<1e-10);
});
test('Lanczos coefficients normalized',()=>{
  const w=lanczosWeights(16,8,2);
  assert.ok(Math.abs(w.weights.reduce((a,b)=>a+b,0)-1)<1e-10);
});
test('identity preserves grayscale raster',()=>{
  const source=Uint8ClampedArray.from([0,64,128,255]);
  assert.deepEqual(Array.from(resizeGray(source,2,2,2,2)),Array.from(source));
});
test('constant background remains constant after resizing',()=>{
  assert.deepEqual([...resizeGray(Uint8ClampedArray.from({length:100},()=>255),10,10,7,5)],Array(35).fill(255));
});
