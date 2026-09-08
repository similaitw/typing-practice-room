const {test}=require('node:test');
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const loginHandler=require('../api/teacher.js');
const growthApi=require('../api/growth-analytics.js');
const {median,analyzeGrowth}=require('../lib/growth-analysis.js');

const response=()=>({headers:{},setHeader(k,v){this.headers[k]=v;},status(code){this.code=code;return this;},json(body){this.body=body;return this;}});

test('growth analysis compares first and recent per student without weighting frequent typists',()=>{
  const students=[
    {id:'s1',className:'701',seat:'01',name:'甲'},
    {id:'s2',className:'701',seat:'02',name:'乙'},
    {id:'s3',className:'701',seat:'03',name:'丙'}
  ];
  const records=[
    {studentId:'s1',speed:20,accuracy:100,createdAt:'2026-09-02T00:00:00.000Z'},
    {studentId:'s1',speed:10,accuracy:90,createdAt:'2026-09-01T00:00:00.000Z'},
    {studentId:'s2',speed:30,accuracy:95,createdAt:'2026-09-01T00:00:00.000Z'}
  ];
  const result=analyzeGrowth(students,records);
  assert.equal(result.summary.totalStudents,3);
  assert.equal(result.summary.studentsWithRecords,2);
  assert.equal(result.summary.participationRate,67);
  assert.equal(result.summary.averageFirst,20);
  assert.equal(result.summary.averageRecent,25);
  assert.equal(result.summary.medianRecent,25);
  assert.equal(result.summary.averageAccuracy,95);
  assert.equal(result.summary.averageImprovement,10);
  assert.equal(result.summary.averageImprovementPercent,100);
  const first=result.students.find(row=>row.id==='s1');
  assert.equal(first.firstSpeed,10);assert.equal(first.recentSpeed,20);assert.equal(first.bestSpeed,20);assert.equal(first.improvement,10);assert.equal(first.improvementPercent,100);
  assert.equal(result.students.find(row=>row.id==='s3').improvement,null);
  assert.equal(median([5,1,9,3]),4);
});

test('growth filter parser keeps language and duration separated and rejects malformed ranges',()=>{
  assert.deepEqual(growthApi.parseFilters('/api/growth-analytics?language=zh&duration=120&threshold=85&class=701','typing.example'),{
    className:'701',studentId:null,language:'zh',duration:120,threshold:85,from:null,to:null
  });
  assert.equal(growthApi.parseFilters('/api/growth-analytics?threshold=101','typing.example'),null);
  assert.equal(growthApi.parseFilters('/api/growth-analytics?from=2026-09-10&to=2026-09-01','typing.example'),null);
  const defaults=growthApi.parseFilters('/api/growth-analytics','typing.example');
  assert.equal(defaults.language,'en');assert.equal(defaults.duration,60);assert.equal(defaults.threshold,90);
});

test('growth analytics accepts real teacher login cookie and rejects tampering',async()=>{
  const password='growth-test-password-12345',secret='growth-test-secret-'.repeat(3);
  const original={password:process.env.TEACHER_PASSWORD,secret:process.env.TEACHER_SESSION_SECRET};
  process.env.TEACHER_PASSWORD=password;process.env.TEACHER_SESSION_SECRET=secret;
  try{
    const login=response();
    await loginHandler({method:'POST',headers:{host:'typing.example',origin:'https://typing.example','content-type':'application/json'},body:{action:'login',password}},login);
    assert.equal(login.code,200);
    const cookie=login.headers['Set-Cookie'].split(';')[0];
    assert.equal(growthApi.teacherSessionValid(cookie,secret,password),true);
    assert.equal(growthApi.teacherSessionValid(cookie.replace('=','=x'),secret,password),false);
    assert.equal(growthApi.teacherSessionValid('',secret,password),false);
  }finally{
    for(const [name,value] of [['TEACHER_PASSWORD',original.password],['TEACHER_SESSION_SECRET',original.secret]]){
      if(value===undefined)delete process.env[name];else process.env[name]=value;
    }
  }
});
