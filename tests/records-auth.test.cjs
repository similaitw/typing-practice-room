const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const loginHandler = require('../api/teacher.js');

test('cloud query accepts the session issued by teacher login and rejects tampering',async()=>{
  const password='records-test-password-12345',secret='records-test-secret-'.repeat(3);
  const original={password:process.env.TEACHER_PASSWORD,secret:process.env.TEACHER_SESSION_SECRET};
  process.env.TEACHER_PASSWORD=password;process.env.TEACHER_SESSION_SECRET=secret;
  const response=()=>({headers:{},setHeader(k,v){this.headers[k]=v;},status(code){this.code=code;return this;},json(body){this.body=body;return this;}});
  try {
    const login=response();
    await loginHandler({method:'POST',headers:{host:'typing.example',origin:'https://typing.example','content-type':'application/json'},body:{action:'login',password}},login);
    assert.equal(login.code,200);
    let queries=0;
    const context=vm.createContext({module:{exports:{}},require:name=>{
      if(name==='node:crypto')return crypto;
      if(name==='@neondatabase/serverless')return {neon:()=>async()=>{queries++;return [];}};
      throw Error('Unexpected dependency');
    },Buffer,URL,process:{env:{TEACHER_PASSWORD:password,TEACHER_SESSION_SECRET:secret,POSTGRES_URL:'test-only-database'}}});
    vm.runInContext(fs.readFileSync(path.join(__dirname,'../api/records.js'),'utf8'),context);
    const handler=context.module.exports;
    const query=async cookie=>{const res=response();await handler({method:'GET',url:'/api/records',headers:{host:'typing.example',cookie}},res);return res;};
    const cookie=login.headers['Set-Cookie'].split(';')[0];
    assert.equal((await query()).code,401);
    assert.equal((await query(cookie.replace('=','=x'))).code,401);
    assert.equal(queries,0,'unauthorized requests must not query database');
    assert.equal((await query(cookie)).code,200,'a real teacher login must authorize cloud queries');
    assert.equal(queries,1);
  } finally {
    for(const [name,value] of [['TEACHER_PASSWORD',original.password],['TEACHER_SESSION_SECRET',original.secret]]) {
      if(value===undefined)delete process.env[name];else process.env[name]=value;
    }
  }
});
