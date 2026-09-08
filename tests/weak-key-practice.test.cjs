const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const crypto=require('node:crypto');
const WeakKeyCore=require('../weak-key-core.js');
const mistakeCore=require('../lib/mistake-analysis');

const response=()=>({headers:{},setHeader(k,v){this.headers[k]=v;},status(code){this.code=code;return this;},json(body){this.body=body;return this;}});

function loadAnalytics({session,rows=[]}){
  let recordQueries=0,lastValues=[];
  const context=vm.createContext({module:{exports:{}},require:name=>{
    if(name==='node:crypto')return crypto;
    if(name==='@neondatabase/serverless')return {neon:()=>async(strings,...values)=>{recordQueries++;lastValues=values;return rows;}};
    if(name==='../lib/teacher-credentials')return {readCredentials:async()=>{throw Error('teacher credentials must not be read for student view');}};
    if(name==='../lib/typing-schema')return {ensureAssignmentSchema:async()=>{}};
    if(name==='../lib/mistake-analysis')return mistakeCore;
    if(name==='../lib/student-session')return {readStudentSession:async()=>session};
    throw Error('Unexpected dependency: '+name);
  },Buffer,URL,process:{env:{POSTGRES_URL:'test-only-database'}}});
  vm.runInContext(fs.readFileSync(path.join(__dirname,'../api/mistake-analytics.js'),'utf8'),context);
  return {handler:context.module.exports,getQueries:()=>recordQueries,getValues:()=>lastValues};
}

test('weak-key generator normalizes targets and builds one/two minute drills',()=>{
  assert.deepEqual(WeakKeyCore.normalizeTargetKeys(['R','r','T','?','B','N']),['r','t','?','b']);
  const one=WeakKeyCore.buildPractice(['r','t'],60);
  const two=WeakKeyCore.buildPractice(['?','b'],120);
  assert.ok(one.length>300&&one.length<=420);
  assert.ok(two.length>600&&two.length<=760);
  assert.match(one,/r/);assert.match(one,/t/);assert.match(two,/\?/);assert.match(two,/b/);
  assert.equal(WeakKeyCore.displayKey(' '),'Space');
});

test('student mine analytics ignores attacker-supplied student and class filters',async()=>{
  const own={studentId:'student-a',student:{id:'student-a',className:'701',seat:'01',name:'甲生'}};
  const rows=[{student_id:'student-a',student_class:'701',student_name:'甲生',student_seat:'01',mistakes:[['r','t',3]],created_at:new Date().toISOString()}];
  const {handler,getQueries,getValues}=loadAnalytics({session:own,rows});
  const res=response();
  await handler({method:'GET',url:'/api/mistake-analytics?view=mine&studentId=student-b&class=999',headers:{host:'typing.example',cookie:'student-cookie'}},res);
  assert.equal(res.code,200);
  assert.equal(res.body.scope.mine,true);
  assert.equal(res.body.scope.studentId,'student-a');
  assert.equal(res.body.scope.className,null);
  assert.equal(res.body.student.id,'student-a');
  assert.equal(res.body.keys[0].key,'r');
  assert.equal(getQueries(),1);
  assert.ok(getValues().includes('student-a'));
  assert.ok(!getValues().includes('student-b'));
  assert.ok(!getValues().includes('999'));
});

test('student mine analytics rejects missing student session before record query',async()=>{
  const {handler,getQueries}=loadAnalytics({session:null});
  const res=response();
  await handler({method:'GET',url:'/api/mistake-analytics?view=mine',headers:{host:'typing.example'}},res);
  assert.equal(res.code,401);
  assert.equal(getQueries(),0);
});
