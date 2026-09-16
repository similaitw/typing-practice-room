const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const source=fs.readFileSync('app.js','utf8');
test('teacher ranking reads the authenticated management ranking API and ignores stale responses',async()=>{
 const nodes={'#leaderboard-language':{value:'en'},'#leaderboard':{innerHTML:''},'#leaderboard-class':{value:'',innerHTML:''},'#leaderboard-name':{value:''},'#leaderboard-limit':{value:'20'},'#leaderboard-filter-status':{},'#ranking-class-stats':{}};
 const pending=[];
 const context=vm.createContext({$:id=>nodes[id],teacherIsActive:()=>true,$$:()=>[],protectTeacherActions:()=>{},escapeHtml:String,formatDate:String,AbortSignal,fetch:url=>new Promise(resolve=>pending.push({url,resolve}))});
 vm.runInContext(fs.readFileSync('core.js','utf8') + '\nconst C = TypingCore;',context);
 vm.runInContext(source.slice(source.indexOf('let teacherRankingRequest ='),source.indexOf('async function changeRecord')),context);
 const first=context.renderTeacherRanking();
 nodes['#leaderboard-language'].value='zh';
 const second=context.renderTeacherRanking();
 assert.equal(pending[0].url,'/api/records?view=leaderboard&language=en&threshold=90&manage=1');
 assert.equal(pending[1].url,'/api/records?view=leaderboard&language=zh&threshold=90&manage=1');
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


test('ranking edit and delete target the selected record, validate input and honor cancellation',async()=>{
 const calls=[], prompts=[];
 let confirmation=false;
 const context=vm.createContext({prompt:()=>prompts.shift(),confirm:()=>confirmation,toast:()=>{},changeRecord:async(method,body)=>calls.push({method,body})});
 vm.runInContext(source.slice(source.indexOf('async function editRecord'),source.indexOf('async function changeRecord')),context);
 const record={id:'ranked-best',studentClass:'701',studentName:'同學',studentSeat:'01',speed:90,accuracy:95,unit:'WPM'};
 prompts.push('701','同學','01','80','96');
 await context.editRecord(record);
 assert.equal(calls[0].method,'PATCH');assert.equal(calls[0].body.id,'ranked-best');assert.equal(calls[0].body.speed,80);
 prompts.push(null);await context.editRecord(record);assert.equal(calls.length,1);
 prompts.push('701','同學','01','');await context.editRecord(record);assert.equal(calls.length,1);
 await context.deleteRecord(record);assert.equal(calls.length,1);
 confirmation=true;await context.deleteRecord(record);
 assert.equal(calls[1].method,'DELETE');assert.equal(calls[1].body.id,'ranked-best');
});


test('filtered teacher ranking edits the matching record and keeps full class statistics',async()=>{
 const nodes={'#leaderboard-language':{value:'en'},'#leaderboard':{},'#leaderboard-class':{value:'701'},'#leaderboard-name':{value:'明'},'#leaderboard-limit':{value:'10'},'#leaderboard-filter-status':{},'#ranking-class-stats':{}};
 const edit={dataset:{rankEdit:'0'}}, remove={dataset:{rankDelete:'0'}};
 const context=vm.createContext({$:id=>nodes[id],$$:selector=>selector==='[data-rank-edit]'?[edit]:[remove],protectTeacherActions:()=>{},escapeHtml:String,formatDate:String});
 vm.runInContext(fs.readFileSync('core.js','utf8')+'\nconst C = TypingCore;',context);
 vm.runInContext(source.slice(source.indexOf('let teacherRankingRequest ='),source.indexOf('async function editRecord')),context);
 vm.runInContext("teacherRankingRows = [{id:'other',studentClass:'702',studentName:'明',speed:100,accuracy:100},{id:'first',studentClass:'701',studentName:'安',speed:80,accuracy:96},{id:'match',studentClass:'701',studentName:'明',speed:40,accuracy:90}];",context);
 let selected;
 context.editRecord=row=>{selected=row.id;};context.deleteRecord=row=>{selected=row.id;};
 context.paintTeacherRanking();
 await edit.onclick();assert.equal(selected,'match');
 await remove.onclick();assert.equal(selected,'match');
 assert.match(nodes['#leaderboard'].innerHTML,/rank-no">2/);
 assert.match(nodes['#ranking-class-stats'].innerHTML,/<td>2<\/td><td>60<\/td>/);
});
