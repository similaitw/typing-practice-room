const {test} = require('node:test');
const assert = require('node:assert/strict');
const {cleanAssignment} = require('../api/assignments.js');
const {cleanRecord} = require('../api/records.js');
const {hashToken, cookieValue, STUDENT_COOKIE} = require('../lib/student-session.js');

test('assignment validation accepts the phase 2 speed-test contract', () => {
  const item = cleanAssignment({
    title:'701 英文打字 1', language:'en', duration:60, minAccuracy:90,
    minSpeed:20, requiredAttempts:3, startAt:null, dueAt:'2026-09-15T12:00:00+08:00',
    active:true, targetClasses:['701','702','701']
  });
  assert.equal(item.title,'701 英文打字 1');
  assert.deepEqual(item.targetClasses,['701','702']);
  assert.equal(item.dueAt,'2026-09-15T04:00:00.000Z');
});

test('assignment validation rejects missing classes and impossible thresholds', () => {
  const base = {title:'Test',language:'en',duration:60,minAccuracy:90,minSpeed:20,requiredAttempts:3,startAt:null,dueAt:null,active:true,targetClasses:['701']};
  assert.equal(cleanAssignment({...base,targetClasses:[]}),null);
  assert.equal(cleanAssignment({...base,minAccuracy:101}),null);
  assert.equal(cleanAssignment({...base,requiredAttempts:0}),null);
  assert.equal(cleanAssignment({...base,duration:45}),null);
});

test('record validation preserves a safe assignment id and rejects whitespace ids', () => {
  const base = {id:'r1',studentId:'s1',studentLabel:'701 ｜ 王小明 ｜ 1號',studentClass:'701',studentName:'王小明',studentSeat:'01',language:'en',source:'builtin',duration:60,elapsedSeconds:60,speed:20,unit:'WPM',accuracy:90,correctChars:90,errors:10,typedLength:100,targetLength:200,createdAt:new Date().toISOString()};
  assert.equal(cleanRecord({...base,assignmentId:'a-123'}).assignmentId,'a-123');
  assert.equal(cleanRecord({...base,assignmentId:'bad id'}),null);
  assert.equal(cleanRecord(base).assignmentId,null);
});

test('student session helpers hash tokens and parse only the requested cookie', () => {
  assert.match(hashToken('secret-code'),/^[a-f0-9]{64}$/);
  assert.equal(cookieValue(`other=1; ${STUDENT_COOKIE}=abc123; next=2`,STUDENT_COOKIE),'abc123');
  assert.equal(cookieValue('other=1',STUDENT_COOKIE),'');
});

test('partial assignment edits allow active-only updates', () => {
  assert.deepEqual(cleanAssignment({active:false},true),{active:false});
  assert.equal(cleanAssignment({targetClasses:['']},true),null);
});
