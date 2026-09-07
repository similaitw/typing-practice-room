const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const context = vm.createContext({});
vm.runInContext(fs.readFileSync(require('node:path').join(__dirname,'../core.js'),'utf8') + '\nglobalThis.core = TypingCore;',context);
const C = context.core;
const plain = value => JSON.parse(JSON.stringify(value));
const student = {id:'s1',seat:'01',name:'測試同學',createdAt:'2026-09-07T00:00:00.000Z'};
const record = {id:'r1',studentId:'s1',studentLabel:'01 測試同學',language:'en',source:'builtin',duration:60,
  elapsedSeconds:60,speed:40,unit:'WPM',accuracy:100,correctChars:200,errors:0,typedLength:200,targetLength:300,createdAt:'2026-09-07T00:00:00.000Z'};
test('English WPM, Chinese CPM, correction, empty input and Unicode',() => {
  assert.equal(C.measure('a'.repeat(200),'a'.repeat(200),60,'en').speed,40);
  assert.equal(C.measure('中'.repeat(60),'中'.repeat(60),30,'zh').speed,120);
  assert.equal(C.measure('ax','abc',10,'en').accuracy,50);
  assert.equal(C.measure('a','abc',10,'en').accuracy,100);
  assert.equal(C.measure('','abc',0,'en').speed,0);
  assert.equal(C.measure('𠮷中','𠮷文',60,'zh').correct,1);
  assert.equal(C.languageOf('hello 中文'),'zh');
  assert.equal(C.languageOf('abc'),'en');
});
test('ranking excludes guests/deleted students and uses accuracy then most recent tie',() => {
  const rows = [record,{...record,id:'r2',createdAt:'2026-09-07T01:00:00.000Z'},
    {...record,id:'r3',studentId:null,speed:999}, {...record,id:'r4',studentId:'deleted',speed:999},
    {...record,id:'r5',speed:50,accuracy:89}];
  assert.equal(C.rank(rows,'en',90,[student]).length,1);
  assert.equal(C.rank(rows,'en',90,[student])[0].id,'r2');
  assert.equal(C.rank(rows,'zh',90,[student]).length,0);
});
test('CSV supports BOM, reordered columns, commas and quotes, rejects malformed rows',() => {
  assert.deepEqual(plain(C.rosterCSV('\uFEFF姓名,座號\r\n"測試,甲",1\r\n"測試""乙",2')), [{name:'測試,甲',seat:'01'},{name:'測試"乙',seat:'02'}]);
  assert.throws(() => C.rosterCSV('name,seat\na,1'));
  assert.throws(() => C.parseCSV('"unfinished'));
  assert.throws(() => C.parseCSV('"a"x,b'));
  assert.equal(C.csvCell('=1+1'),'"\'=1+1"');
});
test('backup round-trip and strict corrupt record rejection',() => {
  const data = {...C.emptyData(),students:[student],testRecords:[record]};
  assert.deepEqual(plain(C.validateData(plain(data))),plain(data));
  for (const bad of [null,{...data,version:2},{...data,students:[null]},
    {...data,testRecords:[{...record,speed:-1}]},{...data,testRecords:[{...record,unit:'CPM'}]},
    {...data,testRecords:[{...record,typedLength:10}]},{...data,testRecords:[record,record]}]) assert.throws(() => C.validateData(bad));
});
test('lesson and passage coverage',() => {
  vm.runInContext(fs.readFileSync(require('node:path').join(__dirname,'../data.js'),'utf8') + '\nglobalThis.coverage = {en:LESSONS.filter(l=>l.group==="en").length,zh:LESSONS.filter(l=>l.group==="zh").length,texts:ZH_TEXTS.length,minLength:Math.min(...ZH_TEXTS.map(t=>t.length))};',context);
  assert.equal(context.coverage.en,7); assert.equal(context.coverage.zh,8);
  assert.equal(context.coverage.texts,15); assert(context.coverage.minLength >= 500);
});
test('class, name and seat survive backup round-trip and optional CSV class column',()=>{
  const withClass={...student,className:'701'};
  const detailed={...record,studentClass:'701',studentName:student.name,studentSeat:'01'};
  const data={...C.emptyData(),students:[withClass],testRecords:[detailed]};
  assert.deepEqual(plain(C.validateData(plain(data))),plain(data));
  assert.deepEqual(plain(C.rosterCSV('班級,姓名,座號\n701,同名學生,1\n702,同名學生,1')),
    [{className:'701',name:'同名學生',seat:'01'},{className:'702',name:'同名學生',seat:'01'}]);
  assert.throws(()=>C.validateData({...data,students:[{...withClass,className:'a'.repeat(41)}]}));
});
