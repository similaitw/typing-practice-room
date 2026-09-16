'use strict';
const KEY = 'typingPracticeRoomData';
const C = TypingCore;
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
let storageIssue = '';
function load() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? C.validateData(JSON.parse(raw)) : C.emptyData();
  } catch {
    storageIssue = '原有瀏覽器資料無法讀取，已以空白畫面啟動；請先下載原始資料以便修復。';
    return C.emptyData();
  }
}
let data = load(), lessonId = 'home', tutorialStep = 0, practice = null;
let test = {lang:'en', duration:60, text:'', started:false, finished:false, timer:null, committed:'', composing:false};
let activeStudent = '', pendingRoster = null;
const previousArticles = {};
const rankingPage = $('#player-ranking');
if (rankingPage) {
  rankingPage.classList.add('view');
  $('#test').after(rankingPage);
}
$('#overview .hero')?.insertAdjacentHTML('beforebegin', '<figure class="hand-placement homepage-placement"><div class="hand-placement-heading"><div><p class="eyebrow">START HERE / HAND POSITION</p><strong>先看懂鍵盤，再開始練習。</strong></div><a href="assets/hand-placement.svg" target="_blank" rel="noopener">開啟大圖 ↗</a></div><div class="hand-placement-scroll" tabindex="0" role="region" aria-label="首頁鍵盤與手指位置圖"><img src="assets/hand-placement.svg" width="960" height="810" alt="標準 QWERTY 鍵盤與雙手基準位置圖"></div><figcaption>和你低頭看鍵盤的方向相同。先找 F、J 的凸點，兩隻拇指輕放空白鍵。</figcaption></figure>');
const studentLabel = s => [s.className || '', s.name, s.seat ? s.seat + '號' : ''].filter(Boolean).join(' ｜ ');
function updateStudentRecords(s) {
  data.testRecords.filter(r => r.studentId === s.id).forEach(r => {r.studentLabel = studentLabel(s); r.studentClass = s.className || ''; r.studentName = s.name; r.studentSeat = s.seat;});
}
const uid = () => globalThis.crypto?.randomUUID?.() || Date.now() + '-' + Math.random().toString(16).slice(2);
const escapeHtml = v => String(v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const formatDate = v => new Date(v).toLocaleString('zh-TW', {month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'});
function toast(message) {
  $('#toast').textContent = message;
  $('#toast').classList.add('show');
  clearTimeout(toast.timeout);
  toast.timeout = setTimeout(() => $('#toast').classList.remove('show'), 4500);
}
function save() {
  if (storageIssue) {toast('請先處理上方資料還原提示；目前變更暫存在此頁，請保留此頁並下載原始資料。'); return;}
  try {localStorage.setItem(KEY, JSON.stringify(data));}
  catch {toast('瀏覽器無法儲存，請匯出 JSON 保存目前資料。');}
}
const PENDING_KEY = 'typingPracticeRoomPendingRecords';
let pendingRecords = [];
try {pendingRecords = JSON.parse(localStorage.getItem(PENDING_KEY) || '[]'); if (!Array.isArray(pendingRecords)) pendingRecords = [];} catch {}
let syncingRecords = false;
let recordSyncError = '';
function savePending() {
  try {localStorage.setItem(PENDING_KEY, JSON.stringify(pendingRecords));}
  catch {toast('待傳成績無法暫存，請保持此頁開啟並重試同步。');}
  $('#cloud-sync-status').textContent = pendingRecords.length ? `有 ${pendingRecords.length} 筆成績等待存入資料庫；連線恢復後會自動重試。` : '成績預設存入資料庫，排行榜跨裝置共用。';
  if (pendingRecords.length && recordSyncError) $('#cloud-sync-status').textContent = `有 ${pendingRecords.length} 筆成績等待存入資料庫。${recordSyncError}`;
}
async function publishRecord(record) {
  pendingRecords.push(record);
  savePending();
  await flushPendingRecords();
}
async function flushPendingRecords() {
  if (syncingRecords || !pendingRecords.length) return;
  syncingRecords = true;
  let saved = false;
  try {
    while (pendingRecords.length) {
      const record = pendingRecords[0];
      if (!C.canSaveRecord(record)) {pendingRecords.shift(); savePending(); continue;}
      const response = await fetch('/api/records', {method:'POST', headers:{'Content-Type':'application/json'}, credentials:'same-origin', body:JSON.stringify(record), signal:AbortSignal.timeout(15000)});
      if (!response.ok) {
        const detail = await response.json().catch(() => ({}));
        throw Error(`上傳失敗（HTTP ${response.status}）：${detail.error || '伺服器暫時無法處理，請稍後重試。'}`);
      }
      recordSyncError = '';
      pendingRecords.shift(); savePending(); saved = true;
    }
    if (saved) toast('成績已存入資料庫。');
  } catch (error) {
    recordSyncError = error.message?.startsWith('上傳失敗') ? error.message : '連線中斷或逾時，稍後自動重試。';
    savePending(); toast(recordSyncError);
  }
  finally {syncingRecords = false; if (saved) renderPlayerRanking();}
}
window.addEventListener('online', flushPendingRecords);
setInterval(() => {if (navigator.onLine) flushPendingRecords();}, 30000);
let teacherRecords = [];
let teacherSyncing = false;
async function syncCloudRecords() {
  try {
    const response = await fetch('/api/records', {credentials:'same-origin', cache:'no-store'});
    if (!response.ok) throw Error();
    const cloudRecords = await response.json();
    const studentsResponse = await fetch('/api/students',{credentials:'same-origin',cache:'no-store'});
    if (!studentsResponse.ok) throw Error();
    data.students = (await studentsResponse.json()).filter(student => student.active);
    teacherRecords = cloudRecords;

    const records = new Map(pendingRecords.map(record => [record.id, record]));
    cloudRecords.forEach(record => records.set(record.id, record));
    data.testRecords = [...records.values()].sort((a,b) => b.createdAt.localeCompare(a.createdAt));
    save();
    return true;
  } catch { return false; }
}
function show(view, teacherVerified = false) {
  if (view === 'teacher' && (!teacherVerified || !teacherIsActive())) {openTeacher(); return;}
  if (!document.getElementById(view)?.classList.contains('view')) return;
  if (view !== 'test') {clearInterval(test.timer); test.started = false;}
  $$('.view').forEach(x => x.classList.toggle('active', x.id === view));
  $$('.nav').forEach(x => {x.classList.toggle('active', x.dataset.view === view); x.setAttribute('aria-current', x.dataset.view === view ? 'page' : 'false');});
  if (view === 'lessons') renderLessons();
  if (view === 'test') {fillStudents(); resetTest(); renderPlayerRanking();}
  if (view === 'player-ranking') {fillStudents(); renderPlayerRanking();}
  if (view === 'teacher') renderTeacher();
  if (view === 'overview') stats();
  window.scrollTo({top:0, behavior:matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth'});
  const title = document.querySelector('#' + view + ' h1, #' + view + ' h2');
  if (title) {title.tabIndex = -1; title.focus({preventScroll:true});}
}
$$('[data-view]').forEach(el => el.addEventListener('click', e => {
  e.preventDefault();
  if (el.textContent.trim() === '開始第一課') lessonId = 'home';
  show(el.dataset.view);
}));
function renderTutorial() {
  const steps = $$('.tutorial-step');
  steps.forEach((step,i) => {step.hidden = i !== tutorialStep;});
  $('#tutorial-progress').textContent = `步驟 ${tutorialStep + 1} / ${steps.length}`;
  $('#tutorial-prev').disabled = tutorialStep === 0;
  $('#tutorial-next').hidden = tutorialStep === steps.length - 1;
  steps[tutorialStep].querySelector('h2').focus();
}
$('#tutorial-prev').onclick = () => {tutorialStep = Math.max(0, tutorialStep - 1); renderTutorial();};
$('#tutorial-next').onclick = () => {tutorialStep = Math.min($$('.tutorial-step').length - 1, tutorialStep + 1); renderTutorial();};
$('#tutorial-first-lesson').onclick = () => {lessonId = 'home'; show('lessons');};
$('#tutorial-input').oninput = e => {
  const value = e.target.value, target = 'asdf jkl;';
  $('#tutorial-feedback').textContent = !value ? '先求準確，慢慢輸入即可。' : value === target ? '✓ 全部正確！可以前往下一步。' : target.startsWith(value) ? '目前都正確，繼續慢慢輸入。' : '有字元不一致，請檢查字母、空格與半形分號，用 Backspace 修正。';
};
$('#tutorial-symbol-lesson').onclick = () => {lessonId = 'symbols'; show('lessons');};
$('#symbol-input').oninput = e => {
  const value = e.target.value, target = '! @ # $ % ^ & * ( ) { } | : " < > ?';
  $('#symbol-feedback').textContent = !value ? '先練 !，再依序輸入其他符號；這裡不計時、不存成績。' : value === target ? '✓ 全部正確！你已學會數字列與標點符號，可以前往下一步。' : target.startsWith(value) ? '目前都正確。繼續用另一手的 Shift，留意符號之間的空格。' : '有字元不一致：檢查 Shift、半形符號與空格，用 Backspace 修正。';
};
function stats() {
  const rec = data.testRecords.filter(r => r.studentId === (activeStudent || null));
  const best = lang => rec.filter(r => r.language === lang).sort(C.compareScores)[0]?.speed;
  $('#stat-wpm').textContent = best('en') ?? '--';
  $('#stat-cpm').textContent = best('zh') ?? '--';
  $('#stat-accuracy').textContent = rec.length ? Math.max(...rec.map(r => r.accuracy)) : '--';
  $('#stat-tests').textContent = rec.length;
  $('#overview-person').textContent = activeStudent ? data.students.find(s => s.id === activeStudent)?.name || '訪客' : '訪客';
  const recent = rec.slice().sort((a,b) => b.createdAt.localeCompare(a.createdAt));
  let change = '完成兩次同語言測驗，就能比較進步幅度。';
  if (recent.length) {
    const older = recent.slice(1).find(r => r.language === recent[0].language && r.duration === recent[0].duration);
    if (older) {const diff = recent[0].speed - older.speed; change = `最近一次較上次同語言、同時長測驗 ${diff >= 0 ? '+' : ''}${diff} ${recent[0].unit}；穩定練習，先求準確。`;}
  }
  $('#progress-copy').textContent = change;
  $('#recent-list').innerHTML = recent.length ? recent.slice(0,5).map(r => `<div class="recent-row"><strong>${escapeHtml(r.studentLabel)}</strong><span>${r.speed} ${r.unit}</span><span>${r.accuracy}%</span><small>${formatDate(r.createdAt)}</small></div>`).join('') : '<div class="empty">還沒有紀錄，完成一次測速後會出現在這裡。</div>';
}
function paintText(target, value, element) {
  const typed = C.chars(value);
  element.innerHTML = C.chars(target).map((c,i) => `<span class="char ${i < typed.length ? typed[i] === c ? 'correct' : 'wrong' : ''} ${i === typed.length ? 'current' : ''}">${escapeHtml(c)}</span>`).join('');
  if (element.id === 'test-prompt' || element.id === 'practice-text') {
    const current = element.querySelector('.current');
    if (current) {
      const box = element.getBoundingClientRect(), cursor = current.getBoundingClientRect();
      if (cursor.bottom > box.bottom || cursor.top < box.top) element.scrollTop += cursor.top - box.top - element.clientHeight / 2;
    } else if (typed.length) element.scrollTop = element.scrollHeight;
  }
}
const keyRows = [
  {keys:'`1234567890-=',before:'',after:'Backspace'},
  {keys:'qwertyuiop[]\\',before:'Tab',after:''},
  {keys:"asdfghjkl;'",before:'Caps Lock',after:'Enter'},
  {keys:'zxcvbnm,./',before:'Shift',after:'Shift'}
];
const shiftedKeys = Object.fromEntries(SHIFT_PAIRS.map(([key,symbol]) => [symbol,key]));
const bopomofo = Object.fromEntries(C.chars('1qaz2wsxedcrfv5tgbyhnujm8ik,9ol.0p;/-3467').map((k,i) => [k,C.chars('ㄅㄆㄇㄈㄉㄊㄋㄌㄍㄎㄏㄐㄑㄒㄓㄔㄕㄖㄗㄘㄙㄧㄨㄩㄚㄛㄜㄝㄞㄟㄠㄡㄢㄣㄤㄥㄦˇˋˊ˙')[i]]));
function fingerFor(key) {
  const groups = [['1qaz','左手小指'],['2wsx','左手無名指'],['3edc','左手中指'],['45rtfgvb','左手食指'],['67yuhjnm','右手食指'],['8ik,','右手中指'],['9ol.','右手無名指'],["0p;/-=[]\\'",'右手小指']];
  if (key === '`') return '左手小指';
  if (key === '=') return '右手小指';
  return key === ' ' ? '拇指按空白鍵' : groups.find(([keys]) => keys.includes(key.toLowerCase()))?.[1] || '請使用自己的輸入法選字／標點配置';
}
function fingerCode(key) {
  const label = fingerFor(key);
  return label.startsWith('左手') ? '左' + label.slice(2, 3) : label.startsWith('右手') ? '右' + label.slice(2, 3) : '';
}
function shiftReferenceHTML() {
  return `<div class="shift-map" aria-label="數字列與標點鍵上下層符號對照">${SHIFT_PAIRS.map(([key,symbol]) => `<div class="shift-key"><strong>${escapeHtml(symbol)}</strong><span>${escapeHtml(key)}</span></div>`).join('')}</div><p class="shift-caption">上排：按住 Shift 的結果 ／ 下排：直接按鍵的結果。例：Shift + 2 = @。不同語系鍵盤配置可能不同。</p>`;
}
function keyboardHTML(l) {
  const renderKey = k => `<span class="keyboard-key" data-key="${escapeHtml(k)}" title="${escapeHtml(k.toUpperCase())}：${escapeHtml(fingerFor(k))}${l.group === 'zh' && bopomofo[k] ? '／' + bopomofo[k] : ''}">${l.group === 'en' ? `<small class="finger-badge">${escapeHtml(fingerCode(k))}</small>` : ''}${l.group === 'en' && SHIFT_PAIRS.some(([key]) => key === k) ? `<small class="shift-symbol">${escapeHtml(SHIFT_PAIRS.find(([key]) => key === k)[1])}</small>` : ''}<b>${escapeHtml(k.toUpperCase())}</b>${l.group === 'zh' ? `<small>${escapeHtml(bopomofo[k] || '')}</small>` : ''}</span>`;
  const modifier = (label, key, width) => `<span class="keyboard-key modifier-key" style="flex:0 0 ${width}px;max-width:none" data-key="${key || ''}">${label}</span>`;
  return `<div class="virtual-keyboard" aria-label="標準 QWERTY 實體鍵盤與手指對照" style="overflow-x:auto;padding:4px 2px 8px">${keyRows.map((row,i) => `<div class="keyboard-row keyboard-row-${i + 1}" style="min-width:720px;padding-left:${[0,22,34,48][i]}px;padding-right:${[0,0,0,0][i]}px">${row.before ? modifier(row.before, row.before === 'Shift' ? 'ShiftLeft' : '', row.before === 'Shift' ? 112 : 76) : ''}${C.chars(row.keys).map(renderKey).join('')}${row.after ? modifier(row.after, row.after === 'Shift' ? 'ShiftRight' : '', row.after === 'Shift' ? 112 : 86) : ''}</div>`).join('')}<div class="keyboard-row keyboard-row-5" style="min-width:720px;padding:0 105px">${modifier('Ctrl','',58)}${modifier('Win','',58)}${modifier('Alt','',58)}<span class="keyboard-key space-key" data-key=" " style="flex:0 0 220px;max-width:none">SPACE · 拇指</span>${modifier('Alt','',58)}${modifier('Win','',58)}${modifier('Ctrl','',58)}</div></div>`;
}
function renderLessons() {
  for (const [group, target] of [['en','#lesson-list'],['zh','#zh-lesson-list']]) {
    $(target).innerHTML = LESSONS.filter(l => l.group === group).map((l,i) => `<button class="lesson-btn ${lessonId === l.id ? 'selected' : ''}" data-lesson="${l.id}" aria-pressed="${lessonId === l.id}"><em>${String(i + 1).padStart(2,'0')}</em><span><strong>${l.title}</strong><small>${l.sub}</small></span>${data.lessonProgress[l.id] ? '<span aria-label="已完成">✓</span>' : ''}</button>`).join('');
  }
  $$('[data-lesson]').forEach(b => b.onclick = () => {lessonId = b.dataset.lesson; renderLessons(); $('#lesson-title').focus();});
  renderLessonDetail();
}
function renderLessonDetail() {
  const l = LESSONS.find(l => l.id === lessonId) || LESSONS[0];
  const count = data.settings.lessonLength || 200;
  const targetText = l.group === 'en' && !l.fixedText ? (l.text.trim() + ' ').repeat(Math.ceil(count / (l.text.trim().length + 1))).slice(0, count).replace(/ $/, l.text.trim()[0]) : l.text;
  practice = {start:0, composing:false, done:false, committed:''};
  $('#lesson-detail').innerHTML = `<div class="lesson-detail"><div class="lesson-head"><div><p class="eyebrow">LESSON ${String(LESSONS.indexOf(l) + 1).padStart(2,'0')}</p><h2 id="lesson-title" tabindex="-1">${l.title} <span>${l.sub}</span></h2><p>${l.desc}</p></div><span>${data.lessonProgress[l.id] ? '✓ 已完成' : ''}</span></div><p class="goal">本課目標：${l.goal}。完整輸入且正確率至少 90% 即可完成。</p><p>${l.rawKeys ? '請切換英文輸入。本課會把標準注音實體按鍵轉成注音符號，不必用輸入法單獨選出符號。' : l.group === 'zh' ? '請切換自己的中文輸入法；選字確認後才計入輸入。' : '請切換英文輸入並關閉 Caps Lock。大寫字母使用另一手的小指按住 Shift。'}</p>${l.id === 'symbols' ? shiftReferenceHTML() : ''}${l.group === 'en' && !l.fixedText ? `<form id="lesson-length-form" class="lesson-length"><div><label for="lesson-length">練習字數</label><p id="lesson-length-help">50–2,000 字元，含空格與標點。套用後重新開始本課。</p></div><div class="actions"><input id="lesson-length" type="number" min="50" max="2000" step="1" required value="${count}" list="lesson-length-options" aria-describedby="lesson-length-help"><datalist id="lesson-length-options"><option value="100"></option><option value="200"></option><option value="500"></option><option value="1000"></option><option value="2000"></option></datalist><button type="submit" class="btn outline">套用字數</button></div></form>` : ''}${keyboardHTML(l)}<p id="finger-hint" class="finger"></p><div class="practice"><div id="practice-text" class="practice-text"></div><label for="practice-input">照著上方文字輸入（空格與標點也要一致）</label><textarea id="practice-input" class="practice-input" rows="3" autocomplete="off" autocapitalize="off" spellcheck="false"></textarea><div class="progress"><i id="lesson-progress-bar"></i></div><div class="practice-foot"><span id="practice-status"></span><div class="actions"><button id="practice-again" class="btn quiet">重新練習</button><button id="complete-lesson" class="btn primary" disabled>完成本課 →</button></div></div><p id="lesson-message" role="status"></p></div></div>`;
  if (l.group === 'en' && !l.fixedText) $('#lesson-length-form').onsubmit = e => {
    e.preventDefault();
    const lengthInput = $('#lesson-length');
    if (!lengthInput.reportValidity()) return;
    data.settings.lessonLength = Number(lengthInput.value); save();
    renderLessonDetail(); $('#practice-input').focus();
  };
  const input = $('#practice-input');
  const paint = () => {
    if (practice.composing || practice.done) return;
    if (l.rawKeys) {
      const caret = input.selectionStart;
      input.value = C.chars(input.value).map(c => bopomofo[c.toLowerCase()] || c).join('');
      input.setSelectionRange(caret, caret);
    }
    if (input.value && !practice.start) practice.start = performance.now();
    practice.committed = input.value;
    const m = C.measure(input.value, targetText, practice.start ? (performance.now() - practice.start) / 1000 : 0, l.group);
    paintText(targetText, input.value, $('#practice-text'));
    $('#practice-status').textContent = `${m.speed} ${l.group === 'en' ? 'WPM' : 'CPM'} · 正確率 ${m.accuracy}% · ${m.progress}% · 錯字 ${m.errors} · ${m.typed} / ${C.chars(targetText).length} 字元`;
    $('#lesson-progress-bar').style.width = m.progress + '%';
    const next = C.chars(targetText)[m.typed];
    const physical = l.rawKeys ? Object.keys(bopomofo).find(k => bopomofo[k] === next) || next : shiftedKeys[next] || next;
    const needsShift = l.group === 'en' && (Object.hasOwn(shiftedKeys,next) || /^[A-Z]$/.test(next || ''));
    const shiftSide = physical && fingerFor(physical).startsWith('左') ? 'Right' : 'Left';
    $$('.keyboard-key').forEach(k => k.classList.toggle('key-current', !!physical && (k.dataset.key === physical.toLowerCase() || needsShift && k.dataset.key === 'Shift' + shiftSide)));
    const fingerText = physical ? fingerFor(physical) : l.fingers;
    $('#finger-hint').textContent = next ? `下一字：${next === ' ' ? '空格' : next} ｜ ${fingerText}${physical && (l.rawKeys || needsShift) ? ' ｜ 按鍵 ' + physical.toUpperCase() : ''}${needsShift ? ` ＋ ${shiftSide === 'Right' ? '右' : '左'}手小指按住 ${shiftSide === 'Right' ? '右' : '左'} Shift` : ''}` : '已輸入到最後，檢查錯字後完成本課。';
    $('#complete-lesson').disabled = m.typed !== C.chars(targetText).length || m.accuracy < 90;
  };
  input.addEventListener('compositionstart', () => {practice.composing = true;});
  input.addEventListener('compositionend', () => {practice.composing = false; paint();});
  input.oninput = paint;
  input.onpaste = e => {e.preventDefault(); toast('練習請逐字輸入，不接受貼上。');};
  input.ondrop = e => e.preventDefault();
  $('#practice-again').onclick = () => {renderLessonDetail(); $('#practice-input').focus();};
  $('#complete-lesson').onclick = () => {
    if (practice.done) {
      const next = LESSONS[LESSONS.indexOf(l) + 1];
      if (next) {lessonId = next.id; renderLessons(); $('#lesson-title').focus();} else show('test');
      return;
    }
    const m = C.measure(input.value,targetText,1,l.group);
    if (m.typed !== C.chars(targetText).length || m.accuracy < 90) return;
    practice.done = true; input.disabled = true;
    data.lessonProgress[l.id] = true; save();
    $(`[data-lesson="${l.id}"]`).setAttribute('aria-label', `${l.title}，已完成`);
    $('#lesson-message').textContent = '✓ 課程完成！進度已記錄，繼續保持。';
    $('#complete-lesson').textContent = LESSONS[LESSONS.indexOf(l) + 1] ? '下一課 →' : '前往測速 →';
  };
  paint();
}
function setSelected(id, value) {
  $$(`${id} button`).forEach(b => {const selected = b.dataset.value === value; b.classList.toggle('sel', selected); b.setAttribute('aria-pressed', selected);});
}
function pickText() {
  if (test.lang === 'custom') {$('#test-count').textContent = '自訂文章'; return $('#custom-text').value.trim();}
  const pool = test.lang === 'zh' ? ZH_TEXTS : EN_TEXTS;
  const choices = pool.map((_,i) => i).filter(i => i !== previousArticles[test.lang]);
  const index = choices[Math.floor(Math.random() * choices.length)] ?? 0;
  previousArticles[test.lang] = index;
  $('#test-count').textContent = `題庫 ${index + 1} / ${pool.length}`;
  return pool[index];
}
function resetTest() {
  clearInterval(test.timer);
  test = {...test, started:false, finished:false, start:0, timer:null, composing:false, committed:'', text:pickText()};
  test.language = test.lang === 'custom' ? C.languageOf(test.text) : test.lang;
  $('#custom-editor').hidden = test.lang !== 'custom';
  lockIdentity(false);
  $('#timer').textContent = test.duration;
  $('#live-speed').textContent = '0'; $('#live-accuracy').textContent = '100'; $('#live-progress').textContent = '0';
  $('#live-unit').textContent = test.language === 'zh' ? 'CPM' : 'WPM';
  $('#test-state').textContent = test.text ? '準備好了，輸入第一個字才計時。' : '請先貼上自訂文章，再按「套用文章」。';
  $('#test-input').value = ''; $('#test-input').disabled = !test.text;
  $('#result-panel').hidden = true;
  paintText(test.text, '', $('#test-prompt'));
}
function updateTest() {
  const seconds = test.started ? Math.min(test.duration, (performance.now() - test.start) / 1000) : 0;
  const m = C.measure(test.committed, test.text, seconds, test.language);
  $('#timer').textContent = Math.max(0, Math.ceil(test.duration - seconds));
  $('#live-speed').textContent = m.speed; $('#live-accuracy').textContent = m.accuracy; $('#live-progress').textContent = m.progress;
  paintText(test.text, test.committed, $('#test-prompt'));
  if (test.started && (seconds >= test.duration || m.typed >= C.chars(test.text).length)) finishTest(m);
}
function onTestInput() {
  if (test.finished || test.composing || !test.text) return;
  if (test.started && performance.now() - test.start >= test.duration * 1000) {finishTest(); return;}
  test.committed = $('#test-input').value;
  if (!test.started && test.committed) {
    test.started = true; test.start = performance.now();
    test.studentId = $('#student-select').value || null;
    test.studentLabel = data.students.find(s => s.id === test.studentId);
    lockIdentity(true);
    $('#test-state').textContent = '輸入中，先求準確。選字確認後才計入字元。';
    test.timer = setInterval(updateTest, 100);
  }
  updateTest();
}
function finishTest(measured) {
  if (test.finished || !test.started) return;
  test.finished = true; clearInterval(test.timer);
  const seconds = Math.min(test.duration, (performance.now() - test.start) / 1000);
  const m = measured || C.measure(test.committed,test.text,seconds,test.language);
  $('#test-input').value = test.committed; $('#test-input').disabled = true;
  lockIdentity(false);
  const s = test.studentLabel;
  const record = {id:uid(),studentId:test.studentId,studentLabel:s ? studentLabel(s) : '訪客',studentClass:s?.className || '',studentName:s?.name || '',studentSeat:s?.seat || '',language:test.language,
    source:test.lang === 'custom' ? 'custom' : 'builtin',duration:test.duration,elapsedSeconds:Number(m.elapsed.toFixed(3)),speed:m.speed,
    unit:test.language === 'zh' ? 'CPM' : 'WPM',accuracy:m.accuracy,correctChars:m.correct,errors:m.errors,typedLength:m.typed,
    targetLength:C.chars(test.text).length,createdAt:new Date().toISOString()};
  const shouldSave = C.canSaveRecord(record);
  if (shouldSave) {data.testRecords.push(record); save(); stats(); publishRecord(record);}
  $('#player-ranking-language').value = test.language;
  renderPlayerRanking();
  $('#test-state').textContent = '測驗完成';
  const panel = $('#result-panel'); panel.hidden = false;
  panel.innerHTML = `<h2 tabindex="-1">${m.accuracy >= 90 ? '穩穩完成！' : '每次練習都算數。'}</h2><p>${shouldSave ? escapeHtml(record.studentLabel) + ' · 已記錄本次結果' : m.typed ? '自訂文章正確率未達 90%，本次不儲存或上傳成績' : '沒有輸入字元，本次不儲存成績'}</p><div class="result-stats"><div><strong>${m.speed}</strong><span>${record.unit}</span></div><div><strong>${m.accuracy}%</strong><span>正確率</span></div><div><strong>${m.errors}</strong><span>錯字</span></div></div><button id="again" class="btn">再測一次 ↻</button>`;
  $('#again').onclick = () => {resetTest(); $('#test-input').focus();};
  const rankingButton = document.createElement('button');
  rankingButton.className = 'btn'; rankingButton.textContent = '查看排行榜 ↓';
  rankingButton.onclick = () => show('player-ranking');
  panel.append(rankingButton);
  panel.querySelector('h2').focus();
}
$('#test-input').addEventListener('compositionstart', () => {test.composing = true;});
$('#test-input').addEventListener('compositionend', () => {test.composing = false; onTestInput();});
$('#test-input').oninput = onTestInput;
$('#test-input').onpaste = e => {e.preventDefault(); toast('測速請逐字輸入。自訂文章請貼到上方文章欄位。');};
$('#test-input').ondrop = e => e.preventDefault();
$('#reset-test').onclick = () => {resetTest(); $('#test-input').focus();};
$('#duration').onclick = e => {if (e.target.dataset.value) {test.duration = Number(e.target.dataset.value); setSelected('#duration',String(test.duration)); resetTest();}};
$('#lang').onclick = e => {if (e.target.dataset.value) {test.lang = e.target.dataset.value; setSelected('#lang',test.lang); resetTest();}};
$('#apply-custom').onclick = () => {resetTest(); if (test.text) $('#test-input').focus();};
$('#custom-text').oninput = () => {if (test.lang === 'custom') {clearInterval(test.timer); test.started = false; test.finished = true; $('#test-input').disabled = true; lockIdentity(false); $('#test-state').textContent = '文章已變更，請按「套用文章」重新開始。';}};
$('#student-select').onchange = e => {activeStudent = e.target.value; syncIdentity(); stats(); resetTest(); renderPlayerRanking();};
function lockIdentity(locked) {
  $('#student-select').disabled = locked;
  $('#identity-fields').disabled = locked;
}
function syncIdentity() {
  const person = data.students.find(s => s.id === activeStudent);
  $('#player-class').value = person?.className || '';
  $('#player-name').value = person?.name || '';
  $('#player-seat').value = person?.seat || '';
  $('#identity-status').textContent = person ? `目前練習者：${studentLabel(person)}。完成測速且達到正確率門檻，即可列入排行榜。` : '目前為訪客，成績不列入排行榜。';
}
$('#join-ranking').onsubmit = e => {
  e.preventDefault();
  if (test.started && !test.finished) return;
  const className = $('#player-class').value.trim();
  const name = $('#player-name').value.trim();
  let seat = $('#player-seat').value.trim();
  if (!className || className.length > 40 || !name || name.length > 80 || !/^\d{1,3}$/.test(seat) || Number(seat) < 1 || /[\r\n\t]/.test(className + name)) {
    $('#identity-status').textContent = '請填寫班級、姓名與有效座號（1–999）。班級最多 40 字、姓名最多 80 字。';
    return;
  }
  seat = seat.padStart(2,'0');
  let person = data.students.find(s => (s.className || '') === className && s.name === name && s.seat === seat);
  const previous = data.students.find(s => s.id === activeStudent);
  if (!person && previous && !previous.className && previous.name === name && previous.seat === seat) {
    person = previous; person.className = className; updateStudentRecords(person); save();
  }
  if (!person) {
    if (data.students.length >= 2000) {$('#identity-status').textContent = '名單已達 2,000 人上限，請從已有名單選擇。'; return;}
    person = {id:uid(),className,seat,name,createdAt:new Date().toISOString()};
    data.students.push(person); save();
  }
  activeStudent = person.id; fillStudents(); stats(); resetTest(); renderPlayerRanking();
  if (!$('#test-input').disabled) $('#test-input').focus();
};
let rankingRequest = 0;
let rankingLoading = false;
async function renderPlayerRanking(background = false) {
  if (background === true && rankingLoading) return;
  rankingLoading = true;
  const request = ++rankingRequest;
  const language = $('#player-ranking-language').value, threshold = data.settings.threshold ?? 90;
  $('#player-ranking-rule').textContent = `資料庫排行榜 · 個人最佳速度，最低正確率 ${threshold}%。同速先比正確率，再比紀錄時間；訪客及未填完整身分者不列入。最多顯示 2,000 位。`;
  if (background !== true) $('#player-ranking-list').innerHTML = '<div class="empty">正在讀取資料庫排行榜…</div>';
  try {
    const response = await fetch(`/api/records?view=leaderboard&language=${language}&threshold=${threshold}`, {cache:'no-store', signal:AbortSignal.timeout(15000)});
    if (!response.ok) throw Error();
    const rows = await response.json();
    if (request !== rankingRequest) return;
    const student = data.students.find(s => s.id === activeStudent);
    const isSelf = r => student && r.studentClass === student.className && r.studentName === student.name && r.studentSeat === student.seat;
    $('#player-ranking-list').innerHTML = rows.length ? rows.map((r,i) => `<div class="rank ${isSelf(r) ? 'rank-self' : ''}"><span class="rank-no">${i+1}</span><span class="rank-name"><strong>${escapeHtml(r.studentLabel)}${isSelf(r) ? '（目前練習者）' : ''}</strong><small>${formatDate(r.createdAt)}</small></span><span class="rank-speed"><strong>${escapeHtml(r.speed)}</strong><small>${escapeHtml(r.unit)}</small></span><span class="rank-accuracy">${escapeHtml(r.accuracy)}%</span></div>`).join('') : '<div class="empty">資料庫尚無符合門檻的成績。填好班級、姓名與座號，完成測速並同步後即可上榜。</div>';
  } catch {
    if (request === rankingRequest && background !== true) $('#player-ranking-list').innerHTML = '<div class="empty">暫時無法讀取資料庫排行榜，請檢查連線後按「重新同步／整理」。待傳成績尚未列入排名。</div>';
  } finally {
    if (request === rankingRequest) rankingLoading = false;
  }
}
function refreshVisibleRanking() {
  if (document.visibilityState !== 'visible' || !navigator.onLine || !$('#player-ranking').classList.contains('active')) return;
  return renderPlayerRanking(true);
}
setInterval(refreshVisibleRanking, 15000);
document.addEventListener('visibilitychange', refreshVisibleRanking);
window.addEventListener('online', refreshVisibleRanking);
$('#retry-cloud-sync').onclick = async () => {await flushPendingRecords(); renderPlayerRanking();};
savePending();
flushPendingRecords();
$('#player-ranking-language').onchange = renderPlayerRanking;
document.addEventListener('keydown', e => {if (e.ctrlKey && e.key === 'Enter' && $('#test').classList.contains('active')) {e.preventDefault(); resetTest(); $('#test-input').focus();}});
function fillStudents() {
  if (!data.students.some(s => s.id === activeStudent)) activeStudent = '';
  $('#student-select').innerHTML = '<option value="">訪客模式（不列入排行榜）</option>' + data.students.map(s => `<option value="${escapeHtml(s.id)}">${escapeHtml(studentLabel(s))}</option>`).join('');
  $('#student-select').value = activeStudent;
  syncIdentity();
}
function renderTeacher() {
  if (!teacherIsActive()) return;
  fillStudents();
  const selected = $('#filter-student').value;
  $('#filter-student').innerHTML = '<option value="">全部學生與訪客</option><option value="guest">訪客</option>' + data.students.map(s => `<option value="${escapeHtml(s.id)}">${escapeHtml(studentLabel(s))}</option>`).join('');
  $('#filter-student').value = [...$('#filter-student').options].some(o => o.value === selected) ? selected : '';
  renderScores();
  protectTeacherActions();
  refreshTeacherRecords();
}
async function refreshTeacherRecords() {
  if (!teacherIsActive() || teacherSyncing) return;
  teacherSyncing = true;
  try {
    const synced = await syncCloudRecords();
    if (!teacherIsActive()) return;
    $('#teacher-sync-status').textContent = synced ? `已同步資料庫 · ${new Date().toLocaleTimeString('zh-TW')}` : '資料同步失敗，畫面可能不是最新資料，請重新整理。';
    if (synced) {
      const selected = $('#filter-student').value;
      $('#filter-student').innerHTML = '<option value="">全部學生與訪客</option><option value="guest">訪客</option>' + data.students.map(s => `<option value="${escapeHtml(s.id)}">${escapeHtml(studentLabel(s))}</option>`).join('');
      $('#filter-student').value = [...$('#filter-student').options].some(o => o.value === selected) ? selected : '';
      renderScores();
    }
  } finally {teacherSyncing = false;}
}
function refreshVisibleTeacher() {
  if (document.visibilityState === 'visible' && navigator.onLine && $('#teacher').classList.contains('active')) refreshTeacherRecords();
}
setInterval(refreshVisibleTeacher,15000);
window.addEventListener('online',refreshVisibleTeacher);
document.addEventListener('visibilitychange',refreshVisibleTeacher);
$('#teacher-refresh').onclick = refreshTeacherRecords;
let teacherRankingRequest = 0;
let teacherRankingRows = [];
function paintTeacherRanking() {
  const className = $('#leaderboard-class').value;
  const rows = C.filterRanking(teacherRankingRows,className,$('#leaderboard-name').value);
  const limit = Number($('#leaderboard-limit').value);
  const shown = limit ? rows.slice(0,limit) : rows;
  $('#leaderboard-filter-status').textContent = `${className || '全部班級'} · 符合 ${rows.length} 人 · 顯示 ${shown.length} 筆${teacherRankingRows.length >= 2000 ? '（本次資料為全站前 2,000 名）' : ''}`;
  $('#leaderboard').innerHTML = shown.length ? shown.map((r,i) => `<div class="rank"><span class="rank-no">${r.rank}</span><span class="rank-name"><strong>${escapeHtml([r.studentClass,r.studentName,r.studentSeat ? r.studentSeat + '號' : ''].filter(Boolean).join(' ｜ '))}</strong><small>${formatDate(r.createdAt)}</small></span><span class="rank-speed"><strong>${r.speed}</strong><small>${r.unit}</small></span><span class="rank-accuracy">${r.accuracy}%</span><span class="rank-actions"><button type="button" data-rank-edit="${i}">編輯成績</button><button type="button" data-rank-delete="${i}">刪除成績</button></span></div>`).join('') : '<div class="empty">沒有符合篩選的排行榜成績。</div>';
  $$('[data-rank-edit]').forEach(button => button.onclick = () => editRecord(shown[Number(button.dataset.rankEdit)]));
  $$('[data-rank-delete]').forEach(button => button.onclick = () => deleteRecord(shown[Number(button.dataset.rankDelete)]));
  const groups = C.rankingClassStats(teacherRankingRows).filter(group => !className || group.className === className);
  const unit = $('#leaderboard-language').value === 'zh' ? 'CPM' : 'WPM';
  $('#ranking-class-stats').innerHTML = groups.length ? `<div class="record-wrap"><table class="record"><caption>班級統計 · ${unit}</caption><thead><tr><th>班級</th><th>上榜人數</th><th>平均速度</th><th>最高速度</th><th>平均正確率</th></tr></thead><tbody>${groups.map(group => `<tr><td>${escapeHtml(group.className)}</td><td>${group.count}</td><td>${group.averageSpeed}</td><td>${group.bestSpeed}</td><td>${group.averageAccuracy}%</td></tr>`).join('')}</tbody></table></div>` : '<div class="empty">目前沒有班級統計資料。</div>';
  protectTeacherActions();
}
async function renderTeacherRanking() {
  const request = ++teacherRankingRequest;
  try {
    const response = await fetch(`/api/records?view=leaderboard&language=${$('#leaderboard-language').value}&threshold=90&manage=1`,{cache:'no-store',signal:AbortSignal.timeout(15000)});
    if (!response.ok) throw Error();
    const rows = await response.json();
    if (request !== teacherRankingRequest || !teacherIsActive()) return;
    teacherRankingRows = rows;
    const select = $('#leaderboard-class'), selected = select.value;
    const classes = C.rankingClassStats(rows);
    select.innerHTML = '<option value="">全部班級</option>' + classes.map(group => `<option value="${escapeHtml(group.className)}">${escapeHtml(group.className)}</option>`).join('');
    if (selected && !classes.some(group => group.className === selected)) select.add(new Option(selected,selected));
    select.value = selected;
    paintTeacherRanking();
  } catch {
    if (request === teacherRankingRequest) {
      teacherRankingRows = [];
      paintTeacherRanking();
      $('#leaderboard-filter-status').textContent = '排行榜同步失敗，請重新整理。';
    }
  }
}
async function editRecord(record) {
  const next = {id:record.id};
  for (const [key,label] of [['studentClass','班級'],['studentName','姓名'],['studentSeat','座號'],['speed','速度'],['accuracy','正確率']]) {
    const value = prompt(`修改${label}`,record[key] ?? '');
    if (value === null) return;
    if (['speed','accuracy'].includes(key)) {
      const number = Number(value);
      if (!value.trim() || !Number.isInteger(number) || number < 0 || number > (key === 'accuracy' ? 100 : 100000)) {
        toast(key === 'accuracy' ? '正確率需為 0–100 的整數。' : '速度需為 0–100000 的整數。');
        return;
      }
      next[key] = number;
    } else next[key] = value.trim();
  }
  await changeRecord('PATCH',next);
}
async function deleteRecord(record) {
  const label = record.studentLabel || [record.studentClass,record.studentName,record.studentSeat].filter(Boolean).join(' ｜ ');
  if (confirm(`刪除 ${label} 這筆 ${record.speed} ${record.unit} 成績？無法復原；若還有其他合格成績，排行榜會顯示下一筆最佳成績。`)) await changeRecord('DELETE',{id:record.id});
}
async function changeRecord(method, body) {
  try {
    const response = await fetch('/api/records',{method,credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
    const result = await response.json();
    if (!response.ok) throw Error(result.error || '儲存失敗。');
    teacherRecords = teacherRecords.filter(r => r.id !== body.id);
    if (result.record) teacherRecords.push(result.record);
    data.testRecords = data.testRecords.filter(r => r.id !== body.id);
    pendingRecords = pendingRecords.filter(r => r.id !== body.id);
    if (result.record) data.testRecords.push(result.record);
    savePending(); save(); renderScores(); stats(); renderPlayerRanking();
    toast(method === 'DELETE' ? '成績已從資料庫刪除。' : '成績已更新至資料庫。');
  } catch (error) {toast(error.message);}
}
function filteredRecords() {
  const student = $('#filter-student').value, language = $('#filter-language').value, duration = Number($('#filter-duration').value);
  return teacherRecords.filter(r => (!student || (student === 'guest' ? r.studentId === null : r.studentId === student)) && (!language || r.language === language) && (!duration || r.duration === duration)).sort((a,b) => b.createdAt.localeCompare(a.createdAt));
}
function renderScores() {
  if (!teacherIsActive()) return;
  const records = filteredRecords(), ids = new Set(data.students.map(s => s.id));
  const classroom = records.filter(r => ids.has(r.studentId));
  const avg = (rows,k) => rows.length ? Math.round(rows.reduce((sum,r) => sum + r[k],0) / rows.length) : '--';
  $('#summary').innerHTML = [['班級人數',data.students.length],['已參與學生',new Set(classroom.map(r => r.studentId)).size],['測驗次數（含訪客）',records.length],['班級平均 WPM',avg(classroom.filter(r => r.language === 'en'),'speed')],['班級平均 CPM',avg(classroom.filter(r => r.language === 'zh'),'speed')],['班級平均正確率',avg(classroom,'accuracy') + '%']].map(([label,value]) => `<div><span>${label}</span><strong>${value}</strong></div>`).join('');
  renderTeacherRanking();
  $('#record-table').innerHTML = records.length ? `<div class="record-wrap"><table class="record"><caption>測驗明細，依日期由新到舊，共 ${records.length} 筆</caption><thead><tr><th>學生</th><th>語言</th><th>速度</th><th>正確率</th><th>設定／實際秒數</th><th>日期</th><th>操作</th></tr></thead><tbody>${records.map((r,i) => `<tr><td>${escapeHtml(r.studentLabel)}</td><td>${r.language === 'zh' ? '中文' : '英文'}</td><td>${r.speed} ${r.unit}</td><td>${r.accuracy}%</td><td>${r.duration} / ${r.elapsedSeconds}</td><td>${formatDate(r.createdAt)}</td><td><button data-edit-record="${i}">編輯</button> <button class="table-delete" data-record="${i}">刪除</button></td></tr>`).join('')}</tbody></table></div>` : '<div class="empty">沒有符合篩選的測驗紀錄。</div>';
  $$('[data-edit-record]').forEach(b => b.onclick = () => editRecord(records[Number(b.dataset.editRecord)]));
  $$('[data-record]').forEach(b => b.onclick = () => deleteRecord(records[Number(b.dataset.record)]));
  const studentRows = data.students.filter(s => !$('#filter-student').value || s.id === $('#filter-student').value).map(s => {
    const own = records.filter(r => r.studentId === s.id);
    const best = language => {const r = own.filter(r => r.language === language).sort(C.compareScores)[0]; return r ? `${r.speed} ${r.unit}` : '--';};
    const last = own[0];
    return `<tr><td>${escapeHtml(studentLabel(s))}</td><td>${best('en')}</td><td>${best('zh')}</td><td>${last ? `${last.speed} ${last.unit} · ${last.accuracy}% · ${formatDate(last.createdAt)}` : '--'}</td></tr>`;
  });
  $('#student-summary').innerHTML = `<div class="record-wrap"><table class="record"><caption>每位學生最佳與最近成績（依目前篩選，未套用排行正確率門檻）</caption><thead><tr><th>學生</th><th>最佳英文</th><th>最佳中文</th><th>最近成績</th></tr></thead><tbody>${studentRows.join('')}</tbody></table></div>`;
  protectTeacherActions();
}
$('#leaderboard-language').onchange = renderScores;
$('#leaderboard-class').onchange = paintTeacherRanking;
$('#leaderboard-name').oninput = paintTeacherRanking;
$('#leaderboard-limit').onchange = paintTeacherRanking;
['#filter-student','#filter-language','#filter-duration'].forEach(id => $(id).onchange = renderScores);
function download(name, content, type) {
  const url = URL.createObjectURL(new Blob([content],{type})), a = document.createElement('a');
  a.href = url; a.download = name; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url),1000);
}
function exportCSV() {
  const rows = [['班級','姓名','座號','學生','語言','速度','單位','正確率','正確字元','錯誤','設定秒數','實際秒數','日期'],...filteredRecords().map(r => [r.studentClass ?? data.students.find(s => s.id === r.studentId)?.className ?? '',r.studentName ?? data.students.find(s => s.id === r.studentId)?.name ?? '',r.studentSeat ?? data.students.find(s => s.id === r.studentId)?.seat ?? '',r.studentLabel,r.language === 'zh' ? '中文' : '英文',r.speed,r.unit,r.accuracy,r.correctChars,r.errors,r.duration,r.elapsedSeconds,r.createdAt])];
  download('typing-practice-room-records.csv','\uFEFF' + rows.map(row => row.map(C.csvCell).join(',')).join('\r\n'),'text/csv;charset=utf-8');
}
$('#export-csv').onclick = exportCSV;
if (storageIssue) {
  $('#storage-warning').hidden = false; $('#storage-message').textContent = storageIssue;
  $('#download-raw').onclick = () => {try {download('typing-practice-room-recovery.txt',localStorage.getItem(KEY) || '', 'text/plain');} catch {toast('瀏覽器禁止讀取儲存空間。');}};
}
$$('.shift-reference').forEach(el => {el.innerHTML = shiftReferenceHTML();});
setSelected('#lang','en'); setSelected('#duration','60');
fillStudents(); stats(); renderLessons(); protectTeacherActions();
