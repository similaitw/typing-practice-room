const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const loginHandler = require('../api/teacher.js');

const response = () => ({
  headers:{},
  setHeader(k,v){this.headers[k]=v;},
  status(code){this.code=code;return this;},
  json(body){this.body=body;return this;}
});

function loadStudentsHandler({password, secret, queries}) {
  const context = vm.createContext({
    module:{exports:{}},
    require:name => {
      if (name === 'node:crypto') return crypto;
      if (name === '@neondatabase/serverless') return {neon:() => async (strings) => {
        const sql = Array.isArray(strings) ? strings.join('?') : String(strings);
        queries.push(sql);
        if (sql.includes('SELECT * FROM typing_students ORDER BY')) return [{
          id:'student-1', student_class:'701', student_seat:'01', student_name:'測試學生', active:true,
          created_at:'2026-09-08T12:00:00.000Z', updated_at:'2026-09-08T12:00:00.000Z'
        }];
        return [];
      }};
      if (name === '../lib/teacher-credentials') return {readCredentials:async()=>({sessionKey:password})};
      throw Error('Unexpected dependency: ' + name);
    },
    Buffer, URL, process:{env:{TEACHER_PASSWORD:password,TEACHER_SESSION_SECRET:secret,POSTGRES_URL:'test-only-database'}}
  });
  vm.runInContext(fs.readFileSync(path.join(__dirname,'../api/students.js'),'utf8'),context);
  return context.module.exports;
}

test('student validation accepts existing roster shape and rejects malformed fields', () => {
  const password='students-test-password-12345', secret='students-test-secret-'.repeat(3), queries=[];
  const handler = loadStudentsHandler({password,secret,queries});
  const clean = handler.cleanStudent({id:'student-1',className:'701',seat:'01',name:'王小明',active:true,createdAt:'2026-09-08T12:00:00Z'});
  assert.equal(clean.className,'701');
  assert.equal(clean.seat,'01');
  assert.equal(clean.name,'王小明');
  assert.equal(clean.active,true);
  assert.equal(handler.cleanStudent({id:'bad id',className:'701',seat:'01',name:'王小明'}),null);
  assert.equal(handler.cleanStudent({id:'student-2',className:'701',seat:'01',name:''}),null);
  assert.equal(handler.cleanStudent({id:'student-3',className:'701\n702',seat:'01',name:'王小明'}),null);
});

test('cloud roster requires a real teacher session before touching its tables', async () => {
  const password='students-auth-password-12345', secret='students-auth-secret-'.repeat(3), queries=[];
  const original={password:process.env.TEACHER_PASSWORD,secret:process.env.TEACHER_SESSION_SECRET};
  process.env.TEACHER_PASSWORD=password; process.env.TEACHER_SESSION_SECRET=secret;
  try {
    const login=response();
    await loginHandler({method:'POST',headers:{host:'typing.example',origin:'https://typing.example','content-type':'application/json'},body:{action:'login',password}},login);
    assert.equal(login.code,200);
    const cookie=login.headers['Set-Cookie'].split(';')[0];
    const handler=loadStudentsHandler({password,secret,queries});

    const unauthorized=response();
    await handler({method:'GET',url:'/api/students',headers:{host:'typing.example'}},unauthorized);
    assert.equal(unauthorized.code,401);
    assert.equal(queries.length,0,'unauthorized roster reads must not query roster tables');

    const authorized=response();
    await handler({method:'GET',url:'/api/students',headers:{host:'typing.example',cookie}},authorized);
    assert.equal(authorized.code,200);
    assert.equal(authorized.body.length,1);
    assert.deepEqual(JSON.parse(JSON.stringify(authorized.body[0])),{
      id:'student-1',className:'701',seat:'01',name:'測試學生',active:true,
      createdAt:'2026-09-08T12:00:00.000Z',updatedAt:'2026-09-08T12:00:00.000Z'
    });
    assert.ok(queries.some(sql=>sql.includes('CREATE TABLE IF NOT EXISTS typing_students')));
  } finally {
    for(const [name,value] of [['TEACHER_PASSWORD',original.password],['TEACHER_SESSION_SECRET',original.secret]]) {
      if(value===undefined) delete process.env[name]; else process.env[name]=value;
    }
  }
});
