const {test} = require('node:test');
const assert = require('node:assert/strict');
const {cleanMistakes,baseKey,fingerForKey,aggregateMistakes} = require('../lib/mistake-analysis');

test('cleanMistakes validates, merges and sorts compact mistake pairs',()=>{
  assert.deepEqual(cleanMistakes([['r','t',2],['a','s',1],['r','t',3]],'en'),[['r','t',5],['a','s',1]]);
  assert.deepEqual(cleanMistakes(undefined,'en'),[]);
  assert.equal(cleanMistakes([['a','a',1]],'en'),null);
  assert.equal(cleanMistakes([['a','s',0]],'en'),null);
  assert.equal(cleanMistakes([['ab','s',1]],'en'),null);
  assert.equal(cleanMistakes([['a','s',1]],'zh'),null);
  assert.deepEqual(cleanMistakes([],'zh'),[]);
});

test('baseKey and fingerForKey normalize uppercase and shifted symbols',()=>{
  assert.equal(baseKey('R'),'r');
  assert.equal(baseKey('!'),'1');
  assert.equal(baseKey('?'),'/');
  assert.equal(fingerForKey('R'),'左手食指');
  assert.equal(fingerForKey('!'),'左手小指');
  assert.equal(fingerForKey('?'),'右手小指');
  assert.equal(fingerForKey(' '),'拇指');
});

test('aggregateMistakes summarizes pairs, expected keys and responsible fingers',()=>{
  const result = aggregateMistakes([
    {mistakes:[['r','t',2],['!','@',1]]},
    {mistakes:[['r','e',3],['k','l',2]]},
    {mistakes:[]},
    {mistakes:null}
  ]);
  assert.equal(result.recordsWithMistakes,2);
  assert.equal(result.totalMistakes,8);
  assert.deepEqual(result.keys[0],{key:'r',count:5,finger:'左手食指'});
  assert.equal(result.fingers.find(row=>row.finger==='左手食指').count,5);
  assert.equal(result.fingers.find(row=>row.finger==='右手中指').count,2);
  assert.deepEqual(result.pairs[0],{expected:'r',actual:'e',count:3,finger:'左手食指'});
});
