'use strict';

const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const progressApi = require('../api/progress.js');
const catalog = require('../lib/lesson-catalog.js');

const response = () => ({headers:{},setHeader(k,v){this.headers[k]=v;},status(code){this.code=code;return this;},json(body){this.body=body;return this;}});

test('lesson catalog contains all current English and Chinese lesson ids',()=>{
  assert.equal(Object.keys(catalog.LESSON_CATALOG).length,15);
  assert.equal(catalog.lessonLanguage('home'),'en');
  assert.equal(catalog.lessonLanguage('symbols'),'en');
  assert.equal(catalog.lessonLanguage('zh-home'),'zh');
  assert.equal(catalog.lessonLanguage('zh-long'),'zh');
  assert.equal(catalog.validLessonId('not-a-lesson'),false);
});

test('progress payload validation accepts only completed known lessons',()=>{
  assert.deepEqual(progressApi.cleanComplete({action:'complete',lessonId:'home',accuracy:95,speed:27}),{lessonId:'home',language:'en',accuracy:95,speed:27});
  assert.equal(progressApi.cleanComplete({action:'complete',lessonId:'home',accuracy:89,speed:27}),null);
  assert.equal(progressApi.cleanComplete({action:'complete',lessonId:'fake',accuracy:95,speed:27}),null);
  assert.equal(progressApi.cleanMerge({action:'merge',lessonIds:['home','home','zh-home']}).join(','),'home,zh-home');
  assert.equal(progressApi.cleanMerge({action:'merge',lessonIds:['home','fake']}),null);
});

test('progress api rejects missing student cookie before database work',async()=>{
  const old=process.env.POSTGRES_URL; process.env.POSTGRES_URL='test-only-database';
  try {
    const res=response();
    await progressApi({method:'GET',headers:{host:'typing.example'}},res);
    assert.equal(res.code,401);
  } finally {if(old===undefined)delete process.env.POSTGRES_URL;else process.env.POSTGRES_URL=old;}
});

function loadPrivateHandler() {
  const sqlCalls=[];
  const session={studentId:'student-a',student:{id:'student-a',className:'701',seat:'01',name:'甲生'}};
  const context=vm.createContext({module:{exports:{}},require:name=>{
    if(name==='@neondatabase/serverless') return {neon:()=>async(strings,...values)=>{
      sqlCalls.push({text:strings.join('?'),values});
      if(strings.join(' ').includes('RETURNING lesson_id')) return [{lesson_id:'home',language:'en',completed_at:new Date('2026-09-08T14:00:00Z'),best_accuracy:96,best_speed:30,attempts:2,updated_at:new Date('2026-09-08T14:00:00Z')}];
      return [];
    }};
    if(name==='../lib/progress-schema') return {ensureProgressSchema:async()=>{}};
    if(name==='../lib/lesson-catalog') return catalog;
    if(name==='../lib/student-session') return {readStudentSession:async()=>session,sameOrigin:()=>true,cookieValue:()=> 'token',STUDENT_COOKIE:'__Host-typing-student'};
    throw Error('Unexpected dependency: '+name);
  },URL,process:{env:{POSTGRES_URL:'test-only-database'}},Date});
  vm.runInContext(fs.readFileSync(path.join(__dirname,'../api/progress.js'),'utf8'),context);
  return {handler:context.module.exports,sqlCalls};
}

test('completion writes to session student even when body tries another student id',async()=>{
  const {handler,sqlCalls}=loadPrivateHandler();
  const res=response();
  await handler({method:'POST',headers:{host:'typing.example',cookie:'student-cookie'},body:{action:'complete',lessonId:'home',accuracy:96,speed:30,studentId:'student-b'}},res);
  assert.equal(res.code,200);
  assert.equal(res.body.progress.lessonId,'home');
  const allValues=sqlCalls.flatMap(call=>call.values);
  assert.ok(allValues.includes('student-a'));
  assert.ok(!allValues.includes('student-b'));
});
