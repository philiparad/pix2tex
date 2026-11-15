import test from 'node:test';import assert from 'node:assert/strict';import {clampSelection} from '../src/image.js';
test('selection normalizes reverse drag',()=>assert.deepEqual(clampSelection(100,80,10,20,200,100),{x:10,y:20,w:90,h:60}));
test('selection clips to image bounds',()=>assert.deepEqual(clampSelection(-10,-2,120,50,100,40),{x:0,y:0,w:100,h:40}));
test('zero-size selection is representable',()=>assert.deepEqual(clampSelection(10,10,10,10,100,100),{x:10,y:10,w:0,h:0}));
