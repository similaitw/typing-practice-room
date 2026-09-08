'use strict';

const {test} = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const loginHandler = require('../api/teacher.js');
const dashboard = require('../api/assignment-dashboard.js');

const response = () => ({headers:{},setHeader(k,v){this.headers[k]=v;},status(code){this.code=code;return this;},json(body){this.body=body;return this;}});

test('dashboard status distinguishes not started, in progress, completed and overdue', () => {
  const now = Date.parse('2026-09-08T12:00:00Z');
  assert.equal(dashboard.dashboardStatus({validAttempts:0,totalAttempts:0,requiredAttempts:3,dueAt:null},now),'not_started');
  assert.equal(dashboard.dashboardStatus({validAttempts:0,totalAttempts:2,requiredAttempts:3,dueAt:null},now),'in_progress');
  assert.equal(dashboard.dashboardStatus({validAttempts:3,totalAttempts:4,requiredAttempts:3,dueAt:'2026-09-01T00:00:00Z'},now),'completed');
  assert.equal(dashboard.dashboardStatus({validAttempts:2,totalAttempts:5,requiredAttempts:3,dueAt:'2026-09-01T00:00:00Z'},now),'overdue');
});

test('dashboard validates assignment and class query values', () => {
  assert.equal(dashboard.validId('abc-123'),true);
  assert.equal(dashboard.validId(''),false);
  assert.equal(dashboard.validId('bad id'),false);
  assert.equal(dashboard.validClass('701'),true);
  assert.equal(dashboard.validClass('七年一班'),true);
  assert.equal(dashboard.validClass('701\n702'),false);
});

test('dashboard accepts a real teacher login session and rejects tampering', async () => {
  const password='dashboard-test-password-12345',secret='dashboard-test-secret-'.repeat(3);
  const original={password:process.env.TEACHER_PASSWORD,secret:process.env.TEACHER_SESSION_SECRET};
  process.env.TEACHER_PASSWORD=password; process.env.TEACHER_SESSION_SECRET=secret;
  try {
    const login=response();
    await loginHandler({method:'POST',headers:{host:'typing.example',origin:'https://typing.example','content-type':'application/json'},body:{action:'login',password}},login);
    assert.equal(login.code,200);
    const cookie=login.headers['Set-Cookie'].split(';')[0];
    assert.equal(dashboard.teacherSessionValid(cookie,secret,password),true);
    assert.equal(dashboard.teacherSessionValid(cookie.replace('=','=x'),secret,password),false);
    assert.equal(dashboard.teacherSessionValid('',secret,password),false);
  } finally {
    for(const [name,value] of [['TEACHER_PASSWORD',original.password],['TEACHER_SESSION_SECRET',original.secret]]) {
      if(value===undefined)delete process.env[name];else process.env[name]=value;
    }
  }
});
