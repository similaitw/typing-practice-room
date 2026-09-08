const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
test('public leaderboard uses database identity ranking and returns only display fields',async()=>{
 let statement='', values;
 const context=vm.createContext({module:{exports:{}},require:name=>{
  if(name==='node:crypto')return require(name);
  if(name==='../lib/teacher-credentials')return {readCredentials:()=>{throw Error('must not require teacher login');}};
  return {neon:()=>async(strings,...params)=>{statement=strings.join('?');values=params;return [{student_class:'701',student_name:'甲',student_seat:'01',speed:50,unit:'WPM',accuracy:98,created_at:'2026-09-08T00:00:00Z',student_id:'private',id:'private'}];}};
 },Buffer,URL,process:{env:{POSTGRES_URL:'mock',TEACHER_PASSWORD:'long-test-password',TEACHER_SESSION_SECRET:'s'.repeat(32)}}});
 vm.runInContext(fs.readFileSync('api/records.js','utf8'),context);
 const res={setHeader(){},status(code){this.code=code;return this;},json(body){this.body=body;return this;}};
 await context.module.exports({method:'GET',url:'/api/records?view=leaderboard&language=zh&threshold=95',headers:{host:'test'}},res);
 assert.equal(res.code,200); assert.deepEqual(values,['zh',95]);
 assert.match(statement,/PARTITION BY student_class, student_name, student_seat/);
 assert.match(statement,/position = 1/);assert.match(statement,/student_id IS NOT NULL/);
 assert.equal(res.body[0].studentName,'甲');assert.equal(res.body[0].id,undefined);assert.equal(res.body[0].studentId,undefined);
});
