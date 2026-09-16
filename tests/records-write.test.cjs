const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

test('record uploads use existing tables without requiring schema creation privileges', async () => {
  const statements = [];
  const sql = async strings => {
    const statement = strings.join('?');
    statements.push(statement);
    if (/\b(CREATE|ALTER)\b/i.test(statement)) throw Error('permission denied for schema public');
    return [];
  };
  const context = vm.createContext({module:{exports:{}}, Buffer, URL,
    process:{env:{POSTGRES_URL:'mock', TEACHER_PASSWORD:'test-password-long', TEACHER_SESSION_SECRET:'s'.repeat(32)}},
    require:name => {
      if (name === '@neondatabase/serverless') return {neon:() => sql};
      return require(name);
    }});
  vm.runInContext(fs.readFileSync('api/records.js', 'utf8'), context);
  const body = {id:'test-record', studentId:null, studentLabel:'Guest', language:'en', source:'builtin',
    duration:60, elapsedSeconds:60, speed:1, unit:'WPM', accuracy:100, correctChars:5,
    errors:0, typedLength:5, targetLength:100, mistakes:[], createdAt:'2026-09-14T00:00:00Z'};
  const res = {setHeader(){}, status(code){this.code = code; return this;}, json(body){this.body = body; return this;}};
  await context.module.exports({method:'POST', headers:{host:'test'}, body}, res);
  assert.equal(res.code, 201);
  assert.equal(statements.length, 1);
  assert.match(statements[0], /INSERT INTO typing_records/);
  assert.equal(res.body.saved, true);
  for (const [correctChars, expectedStatus] of [[0,422],[179,422],[180,201],[200,201]]) {
    statements.length = 0;
    await context.module.exports({method:'POST', headers:{host:'test'}, body:{...body,
      source:'custom', correctChars, errors:200-correctChars, typedLength:200, targetLength:200,
      accuracy:100}}, res);
    assert.equal(res.code, expectedStatus, 'use character counts even if reported accuracy is forged');
    assert.equal(statements.length, expectedStatus === 201 ? 1 : 0);
  }
  statements.length = 0;
  await context.module.exports({method:'POST', headers:{host:'test'}, body:{...body, assignmentId:'assignment'}}, res);
  assert.equal(res.code, 401);
  assert.equal(statements.length, 0, 'assignments still require a student session');
});
