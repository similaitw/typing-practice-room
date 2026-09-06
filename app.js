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
    storageIssue = '原有瀏覽器資料無法讀取，已以空白畫面啟動；請先下載原始資料或還原有效備份。';
    return C.emptyData();
  }
}
let data = load(), lessonId = 'home', tutorialStep = 0, practice = null;
let test = {lang:'en', duration:60, text:'', started:false, finished:false, timer:null, committed:'', composing:false};
let activeStudent = '', pendingRoster = null;
const previousArticles = {};
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
  if (storageIssue) {toast('請先處理上方資料還原提示；目前變更暫存在此頁，請匯出 JSON 備份。'); return;}
  try {localStorage.setItem(KEY, JSON.stringify(data));}
  catch {toast('瀏覽器無法儲存，請匯出 JSON 保存目前資料。');}
}
function show(view) {
  if (!document.getElementById(view)?.classList.contains('view')) return;
  if (view !== 'test') {clearInterval(test.timer); test.started = false;}
  $$('.view').forEach(x => x.classList.toggle('active', x.id === view));
  $$('.nav').forEach(x => {x.classList.toggle('active', x.dataset.view === view); x.setAttribute('aria-current', x.dataset.view === view ? 'page' : 'false');});
  if (view === 'lessons') renderLessons();
  if (view === 'test') {fillStudents(); resetTest();}
  if (view === 'teacher') renderTeacher();
  if (view === 'overview') stats();
  window.scrollTo({top:0, behavior:matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth'});
  const title = document.querySelector('#' + view + ' h1');
  title.tabIndex = -1; title.focus({preventScroll:true});
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
  if (element.id === 'test-prompt') {
    const current = element.querySelector('.current');
    if (current) {
      const box = element.getBoundingClientRect(), cursor = current.getBoundingClientRect();
      if (cursor.bottom > box.bottom || cursor.top < box.top) element.scrollTop += cursor.top - box.top - element.clientHeight / 2;
    } else if (typed.length) element.scrollTop = element.scrollHeight;
  }
}
const keyRows = ['1234567890-','qwertyuiop','asdfghjkl;','zxcvbnm,./'];
const bopomofo = Object.fromEntries(C.chars('1qaz2wsxedcrfv5tgbyhnujm8ik,9ol.0p;/-3467').map((k,i) => [k,C.chars('ㄅㄆㄇㄈㄉㄊㄋㄌㄍㄎㄏㄐㄑㄒㄓㄔㄕㄖㄗㄘㄙㄧㄨㄩㄚㄛㄜㄝㄞㄟㄠㄡㄢㄣㄤㄥㄦˇˋˊ˙')[i]]));
function fingerFor(key) {
  const groups = [['1qaz','左手小指'],['2wsx','左手無名指'],['3edc','左手中指'],['45rtfgvb','左手食指'],['67yuhjnm','右手食指'],['8ik,','右手中指'],['9ol.','右手無名指'],['0p;/-','右手小指']];
  return key === ' ' ? '拇指按空白鍵' : groups.find(([keys]) => keys.includes(key.toLowerCase()))?.[1] || '請使用自己的輸入法選字／標點配置';
}
function keyboardHTML(l) {
  return `<div class="virtual-keyboard" aria-label="實體鍵盤與手指對照">${keyRows.map(row => `<div class="keyboard-row">${C.chars(row).map(k => `<span class="keyboard-key" data-key="${k}" title="${k.toUpperCase()}：${fingerFor(k)}${l.group === 'zh' && bopomofo[k] ? '／' + bopomofo[k] : ''}"><b>${k.toUpperCase()}</b>${l.group === 'zh' ? `<small>${bopomofo[k] || ''}</small>` : ''}</span>`).join('')}</div>`).join('')}<div class="keyboard-row"><span class="keyboard-key space-key" data-key=" ">SPACE · 拇指</span></div></div>`;
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
  practice = {start:0, composing:false, done:false, committed:''};
  $('#lesson-detail').innerHTML = `<div class="lesson-detail"><div class="lesson-head"><div><p class="eyebrow">LESSON ${String(LESSONS.indexOf(l) + 1).padStart(2,'0')}</p><h2 id="lesson-title" tabindex="-1">${l.title} <span>${l.sub}</span></h2><p>${l.desc}</p></div><span>${data.lessonProgress[l.id] ? '✓ 已完成' : ''}</span></div><p class="goal">本課目標：${l.goal}。完整輸入且正確率至少 90% 即可完成。</p><p>${l.rawKeys ? '請切換英文輸入。本課會把標準注音實體按鍵轉成注音符號，不必用輸入法單獨選出符號。' : l.group === 'zh' ? '請切換自己的中文輸入法；選字確認後才計入輸入。' : '請切換英文輸入並關閉 Caps Lock。大寫字母使用另一手的小指按住 Shift。'}</p>${keyboardHTML(l)}<p id="finger-hint" class="finger"></p><div class="practice"><div id="practice-text" class="practice-text"></div><label for="practice-input">照著上方文字輸入（空格與標點也要一致）</label><textarea id="practice-input" class="practice-input" rows="3" autocomplete="off" autocapitalize="off" spellcheck="false"></textarea><div class="progress"><i id="lesson-progress-bar"></i></div><div class="practice-foot"><span id="practice-status"></span><div class="actions"><button id="practice-again" class="btn quiet">重新練習</button><button id="complete-lesson" class="btn primary" disabled>完成本課 →</button></div></div><p id="lesson-message" role="status"></p></div></div>`;
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
    const m = C.measure(input.value, l.text, practice.start ? (performance.now() - practice.start) / 1000 : 0, l.group);
    paintText(l.text, input.value, $('#practice-text'));
    $('#practice-status').textContent = `${m.speed} ${l.group === 'en' ? 'WPM' : 'CPM'} · 正確率 ${m.accuracy}% · ${m.progress}% · 錯字 ${m.errors}`;
    $('#lesson-progress-bar').style.width = m.progress + '%';
    const next = C.chars(l.text)[m.typed];
    const physical = l.rawKeys ? Object.keys(bopomofo).find(k => bopomofo[k] === next) || next : next;
    $$('.keyboard-key').forEach(k => k.classList.toggle('key-current', !!physical && k.dataset.key === physical.toLowerCase()));
    $('#finger-hint').textContent = next ? `下一字：${next === ' ' ? '空格' : next} ｜ ${physical ? fingerFor(physical) : l.fingers}${l.rawKeys && physical ? ' ｜ 按鍵 ' + physical.toUpperCase() : ''}` : '已輸入到最後，檢查錯字後完成本課。';
    $('#complete-lesson').disabled = m.typed !== C.chars(l.text).length || m.accuracy < 90;
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
    const m = C.measure(input.value,l.text,1,l.group);
    if (m.typed !== C.chars(l.text).length || m.accuracy < 90) return;
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
  $('#student-select').disabled = false;
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
    $('#student-select').disabled = true;
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
  $('#student-select').disabled = false;
  const s = test.studentLabel;
  const record = {id:uid(),studentId:test.studentId,studentLabel:s ? `${s.seat} ${s.name}`.trim() : '訪客',language:test.language,
    source:test.lang === 'custom' ? 'custom' : 'builtin',duration:test.duration,elapsedSeconds:Number(m.elapsed.toFixed(3)),speed:m.speed,
    unit:test.language === 'zh' ? 'CPM' : 'WPM',accuracy:m.accuracy,correctChars:m.correct,errors:m.errors,typedLength:m.typed,
    targetLength:C.chars(test.text).length,createdAt:new Date().toISOString()};
  if (m.typed) {data.testRecords.push(record); save(); stats();}
  $('#test-state').textContent = '測驗完成';
  const panel = $('#result-panel'); panel.hidden = false;
  panel.innerHTML = `<h2 tabindex="-1">${m.accuracy >= 90 ? '穩穩完成！' : '每次練習都算數。'}</h2><p>${m.typed ? escapeHtml(record.studentLabel) + ' · 已記錄本次結果' : '沒有輸入字元，本次不儲存成績'}</p><div class="result-stats"><div><strong>${m.speed}</strong><span>${record.unit}</span></div><div><strong>${m.accuracy}%</strong><span>正確率</span></div><div><strong>${m.correct}</strong><span>正確字元</span></div><div><strong>${m.errors}</strong><span>錯字</span></div></div><button id="again" class="btn">再測一次 ↻</button>`;
  $('#again').onclick = () => {resetTest(); $('#test-input').focus();};
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
$('#custom-text').oninput = () => {if (test.lang === 'custom') {clearInterval(test.timer); test.started = false; test.finished = true; $('#test-input').disabled = true; $('#student-select').disabled = false; $('#test-state').textContent = '文章已變更，請按「套用文章」重新開始。';}};
$('#student-select').onchange = e => {activeStudent = e.target.value; stats(); resetTest();};
document.addEventListener('keydown', e => {if (e.ctrlKey && e.key === 'Enter' && $('#test').classList.contains('active')) {e.preventDefault(); resetTest(); $('#test-input').focus();}});
function fillStudents() {
  if (!data.students.some(s => s.id === activeStudent)) activeStudent = '';
  $('#student-select').innerHTML = '<option value="">訪客模式（不列入排行榜）</option>' + data.students.map(s => `<option value="${escapeHtml(s.id)}">${escapeHtml((s.seat + ' ' + s.name).trim())}</option>`).join('');
  $('#student-select').value = activeStudent;
}
function parseRoster(raw) {
  return raw.split(/\r?\n/).map(x => x.trim()).filter(Boolean).map(line => {
    const m = line.match(/^(\d+)\s+(.+)$/);
    const seat = m ? m[1].padStart(2,'0') : '', name = (m ? m[2] : line).trim();
    if (name.length > 80 || seat.length > 20) throw Error('姓名最多 80 字、座號最多 20 字。');
    return {seat,name};
  });
}
function mergeRoster(entries) {
  if (entries.length + data.students.length > 2000) throw Error('學生名單最多 2000 位。');
  let added = 0;
  for (const entry of entries) {
    if (!data.students.some(s => s.seat === entry.seat && s.name === entry.name)) {
      data.students.push({...entry,id:uid(),createdAt:new Date().toISOString()}); added++;
    }
  }
  return added;
}
function renderTeacher() {
  fillStudents();
  $('#student-count').textContent = `${data.students.length} 人`;
  $('#student-list').innerHTML = data.students.length ? data.students.map((s,i) => `<div class="student"><span><small>${escapeHtml(s.seat)}</small>${escapeHtml(s.name)}</span><div class="actions"><button data-edit="${i}" aria-label="編輯 ${escapeHtml(s.name)}">編輯</button><button data-remove="${i}" aria-label="刪除 ${escapeHtml(s.name)}">刪除</button></div></div>`).join('') : '<div class="empty">還沒有學生名單。</div>';
  $$('[data-edit]').forEach(b => b.onclick = () => {
    const s = data.students[Number(b.dataset.edit)];
    const seat = prompt('修改座號（可留空）',s.seat); if (seat === null) return;
    const name = prompt('修改姓名',s.name); if (name === null) return;
    if (!name.trim() || name.trim().length > 80 || seat.trim().length > 20 || /[\r\n]/.test(name + seat)) return toast('姓名或座號格式不正確。');
    if (data.students.some(other => other.id !== s.id && other.name === name.trim() && other.seat === seat.trim())) return toast('已有相同座號與姓名的學生。');
    s.seat = seat.trim(); s.name = name.trim();
    data.testRecords.filter(r => r.studentId === s.id).forEach(r => {r.studentLabel = `${s.seat} ${s.name}`.trim();});
    save(); renderTeacher(); stats();
  });
  $$('[data-remove]').forEach(b => b.onclick = () => {
    const s = data.students[Number(b.dataset.remove)];
    if (!confirm(`刪除「${s.name}」？歷史成績會保留，但不再列入班級排行榜。`)) return;
    data.students = data.students.filter(x => x.id !== s.id); save(); renderTeacher(); stats();
  });
  const selected = $('#filter-student').value;
  $('#filter-student').innerHTML = '<option value="">全部學生與訪客</option><option value="guest">訪客</option>' + data.students.map(s => `<option value="${escapeHtml(s.id)}">${escapeHtml((s.seat + ' ' + s.name).trim())}</option>`).join('');
  $('#filter-student').value = [...$('#filter-student').options].some(o => o.value === selected) ? selected : '';
  renderScores();
}
function filteredRecords() {
  const student = $('#filter-student').value, language = $('#filter-language').value, duration = Number($('#filter-duration').value);
  return data.testRecords.filter(r => (!student || (student === 'guest' ? r.studentId === null : r.studentId === student)) && (!language || r.language === language) && (!duration || r.duration === duration)).sort((a,b) => b.createdAt.localeCompare(a.createdAt));
}
function renderScores() {
  const records = filteredRecords(), ids = new Set(data.students.map(s => s.id));
  const classroom = records.filter(r => ids.has(r.studentId));
  const avg = (rows,k) => rows.length ? Math.round(rows.reduce((sum,r) => sum + r[k],0) / rows.length) : '--';
  $('#summary').innerHTML = [['班級人數',data.students.length],['已參與學生',new Set(classroom.map(r => r.studentId)).size],['測驗次數（含訪客）',records.length],['班級平均 WPM',avg(classroom.filter(r => r.language === 'en'),'speed')],['班級平均 CPM',avg(classroom.filter(r => r.language === 'zh'),'speed')],['班級平均正確率',avg(classroom,'accuracy') + '%']].map(([label,value]) => `<div><span>${label}</span><strong>${value}</strong></div>`).join('');
  const lang = $('#leaderboard-language').value, threshold = Number($('#threshold').value);
  const rows = C.rank(records,lang,threshold,data.students);
  $('#leaderboard').innerHTML = rows.length ? rows.map((r,i) => `<div class="rank"><span class="rank-no">${i + 1}</span><span class="rank-name"><strong>${escapeHtml(r.studentLabel)}</strong><small>${formatDate(r.createdAt)}</small></span><span class="rank-speed"><strong>${r.speed}</strong><small>${r.unit}</small></span><span class="rank-accuracy">${r.accuracy}%</span></div>`).join('') : '<div class="empty">目前沒有符合篩選與門檻的成績。</div>';
  $('#record-table').innerHTML = records.length ? `<div class="record-wrap"><table class="record"><caption>測驗明細，依日期由新到舊，共 ${records.length} 筆</caption><thead><tr><th>學生</th><th>語言</th><th>速度</th><th>正確率</th><th>設定／實際秒數</th><th>日期</th><th>操作</th></tr></thead><tbody>${records.map((r,i) => `<tr><td>${escapeHtml(r.studentLabel)}</td><td>${r.language === 'zh' ? '中文' : '英文'}</td><td>${r.speed} ${r.unit}</td><td>${r.accuracy}%</td><td>${r.duration} / ${r.elapsedSeconds}</td><td>${formatDate(r.createdAt)}</td><td><button class="table-delete" data-record="${i}">刪除</button></td></tr>`).join('')}</tbody></table></div>` : '<div class="empty">沒有符合篩選的測驗紀錄。</div>';
  $$('[data-record]').forEach(b => b.onclick = () => {const r = records[Number(b.dataset.record)]; if (!confirm(`刪除 ${r.studentLabel} 這筆測驗紀錄？`)) return; data.testRecords = data.testRecords.filter(x => x.id !== r.id); save(); renderScores(); stats();});
  const studentRows = data.students.filter(s => !$('#filter-student').value || s.id === $('#filter-student').value).map(s => {
    const own = records.filter(r => r.studentId === s.id);
    const best = language => {const r = own.filter(r => r.language === language).sort(C.compareScores)[0]; return r ? `${r.speed} ${r.unit}` : '--';};
    const last = own[0];
    return `<tr><td>${escapeHtml((s.seat + ' ' + s.name).trim())}</td><td>${best('en')}</td><td>${best('zh')}</td><td>${last ? `${last.speed} ${last.unit} · ${last.accuracy}% · ${formatDate(last.createdAt)}` : '--'}</td></tr>`;
  });
  $('#student-summary').innerHTML = `<div class="record-wrap"><table class="record"><caption>每位學生最佳與最近成績（依目前篩選，未套用排行正確率門檻）</caption><thead><tr><th>學生</th><th>最佳英文</th><th>最佳中文</th><th>最近成績</th></tr></thead><tbody>${studentRows.join('')}</tbody></table></div>`;
}
$('#save-roster').onclick = () => {
  try {const added = mergeRoster(pendingRoster || parseRoster($('#roster-input').value)); pendingRoster = null; $('#roster-input').value = ''; save(); renderTeacher(); toast(`新增 ${added} 位學生，已略過相同座號與姓名。`);}
  catch (e) {toast(e.message);}
};
$('#roster-input').oninput = () => {pendingRoster = null;};
$('#fill-roster').onclick = () => {pendingRoster = null; $('#roster-input').value = '01 練習同學甲\n02 練習同學乙\n03 練習同學丙';};
$('#leaderboard-language').onchange = renderScores;
$('#threshold').value = data.settings.threshold ?? 90;
$('#threshold').onchange = () => {const value = Number($('#threshold').value); $('#threshold').value = Math.max(0,Math.min(100,Number.isFinite(value) ? value : 90)); data.settings.threshold = Number($('#threshold').value); save(); renderScores();};
['#filter-student','#filter-language','#filter-duration'].forEach(id => $(id).onchange = renderScores);
function download(name, content, type) {
  const url = URL.createObjectURL(new Blob([content],{type})), a = document.createElement('a');
  a.href = url; a.download = name; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url),1000);
}
$('#export-json').onclick = () => download('typing-practice-room-backup.json',JSON.stringify(data,null,2),'application/json;charset=utf-8');
function exportCSV() {
  const rows = [['學生','語言','速度','單位','正確率','正確字元','錯誤','設定秒數','實際秒數','日期'],...filteredRecords().map(r => [r.studentLabel,r.language === 'zh' ? '中文' : '英文',r.speed,r.unit,r.accuracy,r.correctChars,r.errors,r.duration,r.elapsedSeconds,r.createdAt])];
  download('typing-practice-room-records.csv','\uFEFF' + rows.map(row => row.map(C.csvCell).join(',')).join('\r\n'),'text/csv;charset=utf-8');
}
$('#export-csv').onclick = exportCSV;
async function readImport(input, maxBytes, extension) {
  const file = input.files[0]; if (!file) return null;
  if (!file.name.toLowerCase().endsWith(extension) || file.size > maxBytes) throw Error(`請選擇 ${extension} 檔案，大小上限 ${maxBytes / 1024 / 1024} MB。`);
  return file.text();
}
$('#csv-input').onchange = async e => {
  try {const text = await readImport(e.target,1024 * 1024,'.csv'); if (text === null) return; const entries = C.rosterCSV(text); if (entries.length > 2000) throw Error('名單最多 2000 位。'); pendingRoster = entries; $('#roster-input').value = entries.map(s => `${s.seat} ${s.name}`.trim()).join('\n'); toast('CSV 已讀取，請確認名單再按「儲存名單」。');}
  catch (error) {toast(error.message);} finally {e.target.value = '';}
};
$('#json-input').onchange = async e => {
  try {
    const text = await readImport(e.target,20 * 1024 * 1024,'.json'); if (text === null) return;
    const restored = C.validateData(JSON.parse(text));
    if (!confirm(`將以備份的 ${restored.students.length} 位學生、${restored.testRecords.length} 筆成績取代目前資料。確定還原？`)) return;
    data = restored; storageIssue = ''; $('#storage-warning').hidden = true; activeStudent = '';
    $('#threshold').value = data.settings.threshold ?? 90;
    save(); stats(); renderTeacher(); renderLessons(); toast('資料已還原。');
  } catch (error) {toast(error instanceof SyntaxError ? 'JSON 格式不正確，原有資料未變更。' : error.message);} finally {e.target.value = '';}
};
$('#clear-data').onclick = () => {
  if (!confirm('確定清除所有學生、課程進度與測驗紀錄？建議先匯出備份。')) return;
  if (!confirm('再次確認：清除後無法復原，仍要繼續？')) return;
  data = C.emptyData(); storageIssue = ''; $('#storage-warning').hidden = true; activeStudent = '';
  $('#threshold').value = 90; save(); renderTeacher(); renderLessons(); stats(); toast('全部資料已清除。');
};
$$('.tab').forEach(t => t.onclick = () => {
  $$('.tab').forEach(x => {x.classList.toggle('active',x === t); x.setAttribute('aria-pressed',x === t);});
  $$('.panel').forEach(x => x.classList.toggle('active',x.id === 'panel-' + t.dataset.panel));
  if (t.dataset.panel === 'scores') renderScores();
});
if (storageIssue) {
  $('#storage-warning').hidden = false; $('#storage-message').textContent = storageIssue;
  $('#download-raw').onclick = () => {try {download('typing-practice-room-recovery.txt',localStorage.getItem(KEY) || '', 'text/plain');} catch {toast('瀏覽器禁止讀取儲存空間。');}};
}
setSelected('#lang','en'); setSelected('#duration','60');
fillStudents(); stats(); renderLessons(); renderTeacher();
