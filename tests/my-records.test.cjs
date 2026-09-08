const {test}=require('node:test');
const assert=require('node:assert/strict');
const api=require('../api/my-records.js');
const {analyzeStudentHistory,mistakeRate}=require('../lib/student-history.js');

const response=()=>({headers:{},setHeader(k,v){this.headers[k]=v;},status(code){this.code=code;return this;},json(body){this.body=body;return this;}});

const row=(id,speed,accuracy,createdAt,mistakes=[],typedLength=100)=>({
  id,studentId:'s1',language:'en',source:'builtin',duration:60,speed,unit:'WPM',accuracy,typedLength,mistakes,createdAt
});

test('student history calculates first recent best growth and limits trend to recent 20',()=>{
  const records=[];
  for(let i=0;i<25;i++)records.push(row('r'+i,10+i,90+i%10,new Date(Date.UTC(2026,8,1,i)).toISOString()));
  const result=analyzeStudentHistory(records);
  assert.equal(result.summary.tests,25);
  assert.equal(result.summary.firstSpeed,10);
  assert.equal(result.summary.recentSpeed,34);
  assert.equal(result.summary.bestSpeed,34);
  assert.equal(result.summary.improvement,24);
  assert.equal(result.summary.improvementPercent,240);
  assert.equal(result.trend.length,20);
  assert.equal(result.trend[0].id,'r5');
  assert.equal(result.recent[0].id,'r24');
});

test('weak-key trend uses mistake events per 100 typed chars',()=>{
  const records=[
    row('a',20,90,'2026-09-01T00:00:00.000Z',[['r','t',10]],100),
    row('b',21,91,'2026-09-02T00:00:00.000Z',[['r','t',10]],100),
    row('c',22,92,'2026-09-03T00:00:00.000Z',[['r','t',5]],100),
    row('d',23,93,'2026-09-04T00:00:00.000Z',[['r','t',5]],100)
  ];
  assert.equal(mistakeRate(records.slice(0,2)),10);
  const result=analyzeStudentHistory(records);
  assert.equal(result.mistakeTrend.earlyRate,10);
  assert.equal(result.mistakeTrend.recentRate,5);
  assert.equal(result.mistakeTrend.reductionPercent,50);
  assert.equal(result.mistakes.keys[0].key,'r');
  assert.equal(result.mistakes.keys[0].count,30);
});

test('my-records filters keep language duration source and threshold separate and ignore studentId query',()=>{
  assert.deepEqual(api.parseFilters('/api/my-records?language=zh&duration=120&source=all&threshold=90&studentId=someone-else','typing.example'),{
    language:'zh',duration:120,source:'all',threshold:90
  });
  assert.deepEqual(api.parseFilters('/api/my-records','typing.example'),{language:'en',duration:60,source:'builtin',threshold:0});
  assert.equal(api.parseFilters('/api/my-records?threshold=101','typing.example'),null);
});

test('my-records rejects missing student cookie before database access',async()=>{
  const res=response();
  await api({method:'GET',url:'/api/my-records',headers:{host:'typing.example',cookie:''}},res);
  assert.equal(res.code,401);
  assert.match(res.body.error,/啟用碼登入/);
});
