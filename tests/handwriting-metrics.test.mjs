import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeLatex,editDistance,summarize,toMarkdown} from './handwriting-metrics.mjs';

test('conservative whitespace normalization',()=>{
  assert.equal(normalizeLatex('\\frac { x } { 2 }'), '\\frac{x}{2}');
  assert.equal(normalizeLatex('\\text{hello world} + x'),'\\text{hello world}+x');
  assert.notEqual(normalizeLatex('x+1'),'x-1');
});
test('Levenshtein counts substitutions, insertions and deletions',()=>{
  assert.equal(editDistance('x+1','x-1'),1);
  assert.equal(editDistance('abc','ab'),1);
  assert.equal(editDistance('','abc'),3);
  assert.equal(editDistance('',''),0);
});
test('handwriting success is distinct from correctness',()=>{
  const summary=summarize([
    {id:'a',expected:'x+1',predicted:'x+1',status:'ok',inference_ms:100},
    {id:'b',expected:'x=2',predicted:'x=3',status:'ok',inference_ms:200},
    {id:'c',expected:'a',status:'error',error:'model failed'},
  ]);
  assert.equal(summary.samples,3);
  assert.equal(summary.completed,2);
  assert.equal(summary.exact_matches,1);
  assert.equal(summary.exact_accuracy,1/3);
  assert.equal(summary.recognition_success_rate,2/3);
  assert.equal(summary.character_error_rate,2/7);
  assert.equal(summary.median_inference_ms,150);
});
test('empty results and missing references are rejected',()=>{
  assert.throws(()=>summarize([]),/at least one/);
  assert.throws(()=>summarize([{id:1,status:'ok',predicted:'x'}]),/reference/);
});
test('report contains each sample without claiming all correct',()=>{
  const result=[{id:'1',index:0,status:'ok',expected:'x=1',predicted:'x=2',inference_ms:42}];
  const report=toMarkdown({summary:summarize(result),results:result});
  assert.match(report,/0\.0%/);
  assert.match(report,/Incorrect/);
});
