const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const source=fs.readFileSync('app.js','utf8');
test('teacher ranking reads the public ranking API and ignores stale responses',async()=>{
 const nodes={'#leaderboard-language':{value:'en'},'#leaderboard':{innerHTML:''}};
 const pending=[];
 const context=vm.createContext({$:id=>nodes[id],teacherIsActive:()=>true,escapeHtml:String,formatDate:String,AbortSignal,fetch:url=>new Promise(resolve=>pending.push({url,resolve}))});
 vm.runInContext(source.slice(source.indexOf('let teacherRankingRequest ='),source.indexOf('async function changeRecord')),context);
 const first=context.renderTeacherRanking();
 nodes['#leaderboard-language'].value='zh';
 const second=context.renderTeacherRanking();
 assert.equal(pending[0].url,'/api/records?view=leaderboard&language=en&threshold=90');
 assert.equal(pending[1].url,'/api/records?view=leaderboard&language=zh&threshold=90');
 pending[1].resolve({ok:true,json:async()=>[{studentClass:'701',studentName:'最新',studentSeat:'01',speed:80,unit:'CPM',accuracy:95,createdAt:'2026-09-15'}]});
 await second;
 pending[0].resolve({ok:true,json:async()=>[]});await first;
 assert.match(nodes['#leaderboard'].innerHTML,/最新/);
});
test('teacher details exclude browser-only pending records',()=>{
 const context=vm.createContext({$:()=>({value:''}),teacherRecords:[{id:'cloud',createdAt:'2026-09-15'}],data:{testRecords:[{id:'pending'}]}});
 vm.runInContext(source.slice(source.indexOf('function filteredRecords()'),source.indexOf('function renderScores()')),context);
 assert.equal(context.filteredRecords().length,1);
 assert.equal(context.filteredRecords()[0].id,'cloud');
});
