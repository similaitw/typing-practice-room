const {test}=require('node:test');
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const loginHandler=require('../api/teacher.js');
const reportApi=require('../api/report.js');
const {assignmentStatus,mistakeSummary,buildReport}=require('../lib/report-analysis.js');

const response=()=>({headers:{},setHeader(k,v){this.headers[k]=v;},status(code){this.code=code;return this;},json(body){this.body=body;return this;}});

test('assignment report status follows required attempts and due date',()=>{
  assert.equal(assignmentStatus({validAttempts:3,totalAttempts:3,requiredAttempts:3,dueAt:'2026-09-01T00:00:00.000Z'},Date.parse('2026-09-08T00:00:00Z')),'completed');
  assert.equal(assignmentStatus({validAttempts:1,totalAttempts:2,requiredAttempts:3,dueAt:null}),'in_progress');
  assert.equal(assignmentStatus({validAttempts:0,totalAttempts:0,requiredAttempts:3,dueAt:null}),'not_started');
  assert.equal(assignmentStatus({validAttempts:0,totalAttempts:0,requiredAttempts:3,dueAt:'2026-09-01T00:00:00.000Z'},Date.parse('2026-09-08T00:00:00Z')),'overdue');
});

test('report combines growth, assignment and top mistake keys per student',()=>{
  const students=[{id:'s1',className:'701',seat:'01',name:'甲'},{id:'s2',className:'701',seat:'02',name:'乙'}];
  const growthStudents=[{id:'s1',tests:2,firstSpeed:10,recentSpeed:20,bestSpeed:20,improvement:10,improvementPercent:100,averageAccuracy:95}];
  const assignment={id:'a1',title:'英文作業',requiredAttempts:3,dueAt:null};
  const assignmentRows=[{id:'s1',totalAttempts:3,validAttempts:2,bestSpeed:22,bestAccuracy:98}];
  const mistakeRows=[{studentId:'s1',mistakes:[['r','t',3],['r','e',2]]},{studentId:'s1',mistakes:[['t','r',4]]}];
  const result=buildReport({students,growthStudents,assignment,assignmentRows,mistakeRows});
  const first=result.rows[0];
  assert.equal(first.assignmentStatus,'in_progress');
  assert.equal(first.validAttempts,2);
  assert.equal(first.improvement,10);
  assert.equal(first.topKeyText,'r ×5、t ×4');
  assert.equal(result.rows[1].assignmentStatus,'not_started');
  assert.equal(result.summary.totalStudents,2);
  assert.equal(result.summary.studentsWithGrowth,1);
  assert.equal(mistakeSummary(mistakeRows).get('s1').totalMistakes,9);
});

test('report filter parser separates assignment and growth filters',()=>{
  assert.deepEqual(reportApi.parseFilters('/api/report?class=701&assignmentId=a1&language=zh&duration=120&source=all&threshold=85','typing.example'),{
    className:'701',studentId:null,assignmentId:'a1',language:'zh',duration:120,source:'all',threshold:85,from:null,to:null
  });
  const defaults=reportApi.parseFilters('/api/report','typing.example');
  assert.equal(defaults.language,'en');assert.equal(defaults.duration,60);assert.equal(defaults.source,'builtin');assert.equal(defaults.threshold,90);
  assert.equal(reportApi.parseFilters('/api/report?threshold=101','typing.example'),null);
  assert.equal(reportApi.parseFilters('/api/report?assignmentId=bad%20id','typing.example'),null);
  assert.equal(reportApi.parseFilters('/api/report?from=2026-09-10&to=2026-09-01','typing.example'),null);
});

test('report API uses real teacher session signature and rejects tampering',async()=>{
  const password='report-test-password-12345',secret='report-test-secret-'.repeat(3);
  const original={password:process.env.TEACHER_PASSWORD,secret:process.env.TEACHER_SESSION_SECRET};
  process.env.TEACHER_PASSWORD=password;process.env.TEACHER_SESSION_SECRET=secret;
  try{
    const login=response();
    await loginHandler({method:'POST',headers:{host:'typing.example',origin:'https://typing.example','content-type':'application/json'},body:{action:'login',password}},login);
    assert.equal(login.code,200);
    const cookie=login.headers['Set-Cookie'].split(';')[0];
    assert.equal(reportApi.teacherSessionValid(cookie,secret,password),true);
    assert.equal(reportApi.teacherSessionValid(cookie.replace('=','=x'),secret,password),false);
    assert.equal(reportApi.teacherSessionValid('',secret,password),false);
  }finally{
    for(const [name,value] of [['TEACHER_PASSWORD',original.password],['TEACHER_SESSION_SECRET',original.secret]]){
      if(value===undefined)delete process.env[name];else process.env[name]=value;
    }
  }
});
