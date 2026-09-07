const {test} = require('node:test');
const assert = require('node:assert/strict');
const handler = require('../api/teacher.js');
const password = 'test-only-password-123456';
process.env.TEACHER_PASSWORD = password;
process.env.TEACHER_SESSION_SECRET = 'test-only-secret-'.repeat(4);
async function request(method,body,cookie,origin='https://typing.example') {
  const result = {headers:{}};
  const res = {setHeader(k,v){result.headers[k]=v;},status(code){result.status=code;return this;},json(data){result.body=data;return this;}};
  await handler({method,body,headers:{host:'typing.example',origin,'content-type':'application/json',cookie}},res);
  return result;
}
test('unauthenticated check and unsupported methods',async()=>{
  assert.equal((await request('GET')).body.authenticated,false);
  assert.equal((await request('DELETE')).status,405);
});
test('password validation and cross-origin rejection',async()=>{
  assert.equal((await request('POST',{action:'login',password:'wrong'})).status,401);
  assert.equal((await request('POST',{action:'login',password},null,'https://other.example')).status,403);
  assert.equal((await request('POST',{action:'login',password},null,'null')).status,403);
});
test('signed session, safe cookie flags, tampering and expiry',async()=>{
  const login=await request('POST',{action:'login',password});
  assert.equal(login.body.authenticated,true);
  const cookie=login.headers['Set-Cookie'];
  for(const flag of ['HttpOnly','Secure','SameSite=Strict','Path=/']) assert(cookie.includes(flag));
  assert.equal(login.headers['Cache-Control'],'no-store');
  assert.equal((await request('GET',null,cookie)).body.authenticated,true);
  assert.equal((await request('GET',null,cookie.replace('=','=x'))).body.authenticated,false);
  const now=Date.now;
  try{Date.now=()=>now()+5*60*60*1000;assert.equal((await request('GET',null,cookie)).body.authenticated,false);}
  finally{Date.now=now;}
});
test('password rotation invalidates old sessions and logout clears cookie',async()=>{
  const login=await request('POST',{action:'login',password});
  process.env.TEACHER_PASSWORD='new-test-only-password';
  assert.equal((await request('GET',null,login.headers['Set-Cookie'])).body.authenticated,false);
  process.env.TEACHER_PASSWORD=password;
  assert((await request('POST',{action:'logout'})).headers['Set-Cookie'].includes('Max-Age=0'));
});
test('missing configuration fails closed',async()=>{
  delete process.env.TEACHER_PASSWORD;
  assert.equal((await request('GET')).status,503);
  process.env.TEACHER_PASSWORD=password;
});
