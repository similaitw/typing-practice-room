const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');

test('public leaderboard only includes active cloud students', async () => {
  let statement = '';
  const rows = [{student_class:'701', student_name:'小明', student_seat:'01', speed:45, unit:'WPM', accuracy:98, created_at:'2026-09-14T00:00:00Z'}];
  const sql = async strings => {
    statement = strings.join('?');
    return rows;
  };
  const context = vm.createContext({module:{exports:{}}, Buffer, URL,
    process:{env:{POSTGRES_URL:'mock', TEACHER_PASSWORD:'test-password-long', TEACHER_SESSION_SECRET:'s'.repeat(32)}},
    require:name => {
      if (name === 'node:crypto') return crypto;
      if (name === '@neondatabase/serverless') return {neon:() => sql};
      if (name === '../lib/teacher-credentials') return {readCredentials:async()=>({sessionKey:'unused'})};
      if (name === '../lib/student-session') return {readStudentSession:async()=>null, sameOrigin:()=>true};
      if (name === '../lib/mistake-analysis') return {cleanMistakes:value=>Array.isArray(value)?value:[]};
      throw Error('Unexpected dependency: ' + name);
    }});
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../api/records.js'), 'utf8'), context);
  const res = {headers:{}, setHeader(k,v){this.headers[k]=v;}, status(code){this.code=code;return this;}, json(body){this.body=body;return this;}};
  await context.module.exports({method:'GET', url:'/api/records?view=leaderboard&language=en&threshold=90', headers:{host:'typing.example'}}, res);

  assert.equal(res.code, 200);
  assert.match(statement, /JOIN typing_students s ON s\.id = r\.student_id AND s\.active = true/);
  assert.match(statement, /FROM typing_records r/);
  assert.equal(res.body.length, 1);
  assert.equal(res.body[0].studentLabel, '701 ｜ 小明 ｜ 01號');
});
