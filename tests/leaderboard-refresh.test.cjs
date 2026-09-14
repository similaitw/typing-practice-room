const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function setup(fetch) {
  const events = {}, intervals = [];
  const list = {innerHTML:'previous ranking'};
  const page = {active:true, classList:{contains:() => page.active}};
  const nodes = {'#player-ranking':page, '#player-ranking-list':list,
    '#player-ranking-language':{value:'en'}, '#player-ranking-rule':{textContent:''}};
  const context = vm.createContext({fetch, AbortSignal, data:{settings:{}, students:[]},
    activeStudent:'', $:selector => nodes[selector], escapeHtml:String, formatDate:String,
    navigator:{onLine:true}, document:{visibilityState:'visible', addEventListener:(name, fn) => {events[name] = fn;}},
    window:{addEventListener:(name, fn) => {events[name] = fn;}},
    setInterval:(fn, delay) => intervals.push({fn, delay})});
  const source = fs.readFileSync('app.js', 'utf8');
  vm.runInContext(source.slice(source.indexOf('let rankingRequest = 0;'), source.indexOf("$('#retry-cloud-sync').onclick")), context);
  return {context, events, intervals, list, page};
}
const response = speed => ({ok:true, json:async () => [{studentLabel:'Test student', speed, unit:'WPM', accuracy:99, createdAt:'2026-09-14'}]});

test('visible leaderboard polls remote scores and refreshes on reconnect and tab return', async () => {
  let calls = 0;
  const app = setup(async () => response(++calls));
  assert.equal(app.intervals[0].delay, 15000);
  await app.intervals[0].fn();
  assert.match(app.list.innerHTML, /<strong>1<\/strong>/);
  await app.events.online();
  await app.events.visibilitychange();
  assert.equal(calls, 3);
  app.context.document.visibilityState = 'hidden';
  await app.intervals[0].fn();
  app.context.document.visibilityState = 'visible';
  app.page.active = false;
  await app.intervals[0].fn();
  app.page.active = true;
  app.context.navigator.onLine = false;
  await app.events.online();
  assert.equal(calls, 3);
});

test('background refresh preserves rows on failure and retries without overlapping requests', async () => {
  let reject, calls = 0;
  const app = setup(() => {calls++; return new Promise((_, fail) => {reject = fail;});});
  const pending = app.intervals[0].fn();
  assert.equal(app.list.innerHTML, 'previous ranking');
  await app.events.online();
  assert.equal(calls, 1);
  reject(Error('offline'));
  await pending;
  assert.equal(app.list.innerHTML, 'previous ranking');
  app.context.fetch = async () => response(70);
  await app.intervals[0].fn();
  assert.match(app.list.innerHTML, /<strong>70<\/strong>/);
});

test('language changes supersede a pending background response', async () => {
  const pending = [];
  const app = setup(url => new Promise(resolve => pending.push({url, resolve})));
  const old = app.intervals[0].fn();
  app.context.$('#player-ranking-language').value = 'zh';
  const current = app.context.renderPlayerRanking();
  assert.match(pending[1].url, /language=zh/);
  pending[1].resolve(response(80));
  await current;
  pending[0].resolve(response(20));
  await old;
  assert.match(app.list.innerHTML, /<strong>80<\/strong>/);
});
