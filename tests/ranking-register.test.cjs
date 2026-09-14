const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const crypto = require('node:crypto');

function load(state = {}) {
  const statements = [];
  const sql = async (strings, ...values) => {
    const statement = strings.join('?');
    statements.push({statement, values});
    if (/SELECT id, student_class/.test(statement)) return state.existing ? [state.existing] : [];
    if (/SELECT COUNT/.test(statement)) return [{count: state.count || 0}];
    if (/INSERT INTO typing_students/.test(statement)) {
      if (state.conflict) return [];
      return [{id:'new-id',student_class:values[1],student_seat:values[2],student_name:values[3],active:true}];
    }
    return [];
  };
  const context = vm.createContext({
    module:{exports:{}}, Buffer, URL,
    process:{env:{POSTGRES_URL:'mock'}},
    require:name => {
      if (name === 'node:crypto') return {...crypto, randomUUID:() => 'new-id'};
      if (name === '@neondatabase/serverless') return {neon:() => sql};
      if (name === '../lib/student-session') return {sameOrigin:() => true};
      return require(name);
    }
  });
  vm.runInContext(fs.readFileSync('api/ranking-register.js','utf8'), context);
  return {handler:context.module.exports, statements};
}

const response = () => ({headers:{}, setHeader(key,value){this.headers[key]=value;}, status(code){this.code=code;return this;}, json(body){this.body=body;return this;}});

test('ranking identity requires class name and numeric seat and normalizes seat', () => {
  const {handler} = load();
  const identity = handler.cleanIdentity({className:' 715 ',name:' 陳冠宏 ',seat:'7'});
  assert.equal(identity.className, '715');
  assert.equal(identity.name, '陳冠宏');
  assert.equal(identity.seat, '07');
  assert.equal(handler.cleanIdentity({className:'715',name:'',seat:'7'}), null);
  assert.equal(handler.cleanIdentity({className:'715',name:'陳冠宏',seat:'0'}), null);
  assert.equal(handler.cleanIdentity({className:'715',name:'陳冠宏',seat:'A7'}), null);
});

test('existing active identity reuses the same cloud student id', async () => {
  const {handler, statements} = load({existing:{id:'student-1',student_class:'715',student_name:'陳冠宏',student_seat:'27',active:true}});
  const res = response();
  await handler({method:'POST',headers:{host:'typing.example'},body:{className:'715',name:'陳冠宏',seat:'27'}},res);
  assert.equal(res.code,200);
  assert.equal(res.body.student.id,'student-1');
  assert.equal(res.body.created,false);
  assert.equal(statements.filter(item => /INSERT INTO/.test(item.statement)).length,0);
});

test('inactive identity cannot self-reactivate and new identity can register', async () => {
  const inactive = load({existing:{id:'student-2',student_class:'715',student_name:'停用生',student_seat:'08',active:false}});
  const blocked = response();
  await inactive.handler({method:'POST',headers:{host:'typing.example'},body:{className:'715',name:'停用生',seat:'8'}},blocked);
  assert.equal(blocked.code,403);

  const fresh = load();
  const created = response();
  await fresh.handler({method:'POST',headers:{host:'typing.example'},body:{className:'716',name:'新同學',seat:'3'}},created);
  assert.equal(created.code,201);
  assert.equal(created.body.student.id,'new-id');
  assert.equal(created.body.student.seat,'03');
  assert.equal(created.body.created,true);
});
