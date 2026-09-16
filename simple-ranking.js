'use strict';

(() => {
  const LIMITS = [10, 20, 30, 50, 100];
  const PUBLIC_LIMIT_KEY = 'typingSimpleRankingLimit';
  const TEACHER_LIMIT_KEY = 'typingSimpleTeacherRankingLimit';
  let publicRows = [];
  let teacherRows = [];
  let publicRequest = 0;
  let teacherRequest = 0;
  let publicLoading = false;
  let teacherLoading = false;

  const byId = id => document.getElementById(id);
  const text = value => String(value ?? '').trim();
  const normalizedName = value => text(value).toLocaleLowerCase('zh-TW');
  const safeLimit = value => LIMITS.includes(Number(value)) ? Number(value) : 20;
  const readLimit = key => {
    try { return safeLimit(localStorage.getItem(key)); }
    catch { return 20; }
  };
  const writeLimit = (key, value) => {
    try { localStorage.setItem(key, String(safeLimit(value))); }
    catch {}
  };
  const identityLabel = row => [row.studentClass || '', row.studentName || '', row.studentSeat ? row.studentSeat + '號' : ''].filter(Boolean).join(' ｜ ');

  async function requestRanking(language) {
    const response = await fetch(`/api/records?view=leaderboard&language=${language === 'zh' ? 'zh' : 'en'}&threshold=90`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(15000)
    });
    if (!response.ok) throw Error('排行榜目前無法讀取。');
    const rows = await response.json();
    return Array.isArray(rows) ? rows : [];
  }

  function renderRows(container, rows, limit, currentStudent) {
    if (!container) return;
    const shown = rows.slice(0, safeLimit(limit));
    if (!shown.length) {
      container.innerHTML = '<div class="empty">目前還沒有排行榜成績。</div>';
      return;
    }
    const isSelf = row => currentStudent && row.studentClass === currentStudent.className && row.studentName === currentStudent.name && row.studentSeat === currentStudent.seat;
    container.innerHTML = shown.map((row, index) => `
      <div class="rank simple-rank ${isSelf(row) ? 'rank-self' : ''}">
        <span class="rank-no">${row.rank || index + 1}</span>
        <span class="rank-name"><strong>${escapeHtml(identityLabel(row))}${isSelf(row) ? '（我）' : ''}</strong></span>
        <span class="rank-speed"><strong>${escapeHtml(row.speed)}</strong><small>${escapeHtml(row.unit)}</small></span>
      </div>`).join('');
  }

  function renderSearchResult(rows, input, output) {
    if (!input || !output) return;
    const query = normalizedName(input.value);
    if (!query) {
      output.textContent = '輸入姓名即可查詢目前名次。';
      return;
    }
    const matches = rows.map((row, index) => ({row, rank: row.rank || index + 1})).filter(item => normalizedName(item.row.studentName).includes(query));
    if (!matches.length) {
      output.textContent = `找不到「${text(input.value)}」的排行榜成績。`;
      return;
    }
    output.textContent = matches.map(item => `${identityLabel(item.row)}：目前第 ${item.rank} 名`).join('　／　');
  }

  function attachSearch(input, button, rowsGetter, output) {
    const run = () => renderSearchResult(rowsGetter(), input, output);
    if (button) button.onclick = run;
    if (input) input.onkeydown = event => {
      if (event.key === 'Enter') {
        event.preventDefault();
        run();
      }
    };
  }

  function injectStyles() {
    if (document.querySelector('style[data-simple-ranking]')) return;
    const style = document.createElement('style');
    style.dataset.simpleRanking = 'true';
    style.textContent = `
      .simple-ranking-controls{display:flex;flex-wrap:wrap;gap:12px;align-items:end;margin:18px 0 14px}
      .simple-ranking-controls label{display:grid;gap:6px;min-width:140px}
      .simple-ranking-controls input,.simple-ranking-controls select{min-height:44px}
      .simple-ranking-search{flex:1 1 220px}
      .simple-ranking-result{min-height:28px;font-weight:700;color:var(--ink,#173f33);margin:10px 0 18px}
      .simple-rank{grid-template-columns:54px minmax(0,1fr) 96px!important}
      .simple-rank .rank-name small,.simple-rank .rank-accuracy{display:none!important}
      .simple-ranking-note{color:var(--muted,#69736d);margin-top:12px}
      .simple-ranking-compat{display:none!important}
      @media(max-width:640px){.simple-ranking-controls>*{flex:1 1 100%}.simple-rank{grid-template-columns:44px minmax(0,1fr) 78px!important}}
    `;
    document.head.append(style);
  }

  function simplifyIdentity() {
    const select = byId('student-select');
    if (select?.closest('label')) select.closest('label').hidden = true;
    const form = byId('join-ranking');
    if (!form) return;
    const legend = form.querySelector('legend');
    const intro = form.querySelector('fieldset > p');
    const submit = form.querySelector('button[type="submit"]');
    if (legend) legend.textContent = '輸入班級、姓名、座號，登錄排行榜';
    if (intro) intro.textContent = '第一次填寫會建立排行榜身分；之後使用相同班級、姓名與座號即可沿用。';
    if (submit) submit.textContent = '登錄排行榜 →';
    const lastTutorial = document.querySelector('.tutorial-step:last-of-type ol li:first-child');
    if (lastTutorial) lastTutorial.textContent = '進入「打字測速」，輸入班級、姓名與座號登錄排行榜。';
  }

  function publicMarkup() {
    const card = byId('player-ranking');
    if (!card) return;
    const currentLanguage = byId('player-ranking-language')?.value === 'zh' ? 'zh' : 'en';
    card.innerHTML = `
      <div class="card-head"><div><p class="eyebrow">LEADERBOARD</p><h2 id="player-ranking-title" tabindex="-1">排行榜</h2></div></div>
      <div class="simple-ranking-controls">
        <label>語言<select id="player-ranking-language"><option value="en">英文 WPM</option><option value="zh">中文 CPM</option></select></label>
        <label>班級<select id="player-ranking-class"><option value="">全部班級</option></select></label>
        <label>顯示<select id="player-ranking-limit">${LIMITS.map(value => `<option value="${value}">前 ${value} 名</option>`).join('')}</select></label>
        <label class="simple-ranking-search">姓名查詢<input id="player-ranking-search" type="search" maxlength="80" autocomplete="off" placeholder="輸入姓名"></label>
        <button id="player-ranking-search-btn" class="btn outline" type="button">查詢名次</button>
        <button id="retry-cloud-sync" class="btn outline" type="button">重新整理</button>
      </div>
      <p id="player-ranking-search-result" class="simple-ranking-result" role="status">輸入姓名即可查詢目前名次。</p>
      <div id="player-ranking-list"></div>
      <p class="simple-ranking-note">正確率至少 90%，依個人最佳速度排序。選班級後顯示班內名次；姓名篩選保留原名次。</p>
      <p id="cloud-sync-status" hidden></p><p id="player-ranking-rule" hidden></p>`;
    byId('player-ranking-language').value = currentLanguage;
    byId('player-ranking-limit').value = String(readLimit(PUBLIC_LIMIT_KEY));
    byId('player-ranking-language').onchange = () => simpleRenderPlayerRanking();
    byId('player-ranking-limit').onchange = event => {
      writeLimit(PUBLIC_LIMIT_KEY, event.target.value);
      paintPublicRanking();
    };
    byId('retry-cloud-sync').onclick = async () => {
      await flushPendingRecords();
      await simpleRenderPlayerRanking();
    };
    byId('player-ranking-class').onchange = paintPublicRanking;
    byId('player-ranking-search').oninput = paintPublicRanking;
    byId('player-ranking-search-btn').onclick = paintPublicRanking;
  }

  function paintPublicRanking() {
    const className = byId('player-ranking-class').value;
    const rows = C.filterRanking(publicRows,className,byId('player-ranking-search').value);
    renderRows(byId('player-ranking-list'),rows,byId('player-ranking-limit').value,data.students.find(student => student.id === activeStudent));
    byId('player-ranking-search-result').textContent = `${className || '全部班級'} · 符合 ${rows.length} 人 · 顯示前 ${Math.min(rows.length,safeLimit(byId('player-ranking-limit').value))} 筆${publicRows.length >= 2000 ? '（本次資料為全站前 2,000 名）' : ''}`;
  }

  async function simpleRenderPlayerRanking(background = false) {
    if (background && publicLoading) return;
    const list = byId('player-ranking-list');
    const language = byId('player-ranking-language')?.value === 'zh' ? 'zh' : 'en';
    const request = ++publicRequest;
    publicLoading = true;
    if (!background && list) list.innerHTML = '<div class="empty">正在讀取排行榜…</div>';
    try {
      const rows = await requestRanking(language);
      if (request !== publicRequest) return;
      publicRows = rows;
      const select = byId('player-ranking-class'), selected = select.value;
      const classes = C.rankingClassStats(rows);
      select.innerHTML = '<option value="">全部班級</option>' + classes.map(group => `<option value="${escapeHtml(group.className)}">${escapeHtml(group.className)}</option>`).join('');
      if (selected && !classes.some(group => group.className === selected)) select.add(new Option(selected,selected));
      select.value = selected;
      paintPublicRanking();
    } catch (error) {
      if (request === publicRequest && !background && list) list.innerHTML = `<div class="empty">${escapeHtml(error.message)}</div>`;
    } finally {
      if (request === publicRequest) publicLoading = false;
    }
  }

  function teacherMarkup() {
    const tab = document.querySelector('.tab[data-panel="scores"]');
    if (tab) tab.textContent = '排行榜';
    const panel = byId('panel-scores');
    if (!panel) return;
    panel.innerHTML = `
      <div class="simple-ranking-compat" hidden>
        <select id="filter-student"><option value=""></option></select>
        <select id="filter-language"><option value=""></option></select>
        <select id="filter-duration"><option value=""></option></select>
        <input id="threshold" type="hidden" value="90">
        <button id="export-csv" type="button"></button>
        <div id="student-summary"></div><div id="summary"></div><div id="record-table"></div>
      </div>
      <div class="card">
        <div class="card-head"><div><p class="eyebrow">LEADERBOARD</p><h2>排行榜</h2></div></div>
        <div class="simple-ranking-controls">
          <label>語言<select id="leaderboard-language"><option value="en">英文 WPM</option><option value="zh">中文 CPM</option></select></label>
          <label>顯示<select id="teacher-ranking-limit">${LIMITS.map(value => `<option value="${value}">前 ${value} 名</option>`).join('')}</select></label>
          <label class="simple-ranking-search">姓名查詢<input id="teacher-ranking-search" type="search" maxlength="80" autocomplete="off" placeholder="輸入姓名"></label>
          <button id="teacher-ranking-search-btn" class="btn outline" type="button">查詢名次</button>
          <button id="teacher-ranking-refresh" class="btn outline" type="button">重新整理</button>
        </div>
        <p id="teacher-ranking-result" class="simple-ranking-result" role="status">輸入姓名即可查詢目前名次。</p>
        <div id="leaderboard"></div>
      </div>`;
    byId('teacher-ranking-limit').value = String(readLimit(TEACHER_LIMIT_KEY));
    byId('leaderboard-language').onchange = () => simpleRenderScores();
    byId('teacher-ranking-limit').onchange = event => {
      writeLimit(TEACHER_LIMIT_KEY, event.target.value);
      renderRows(byId('leaderboard'), teacherRows, event.target.value, null);
      renderSearchResult(teacherRows, byId('teacher-ranking-search'), byId('teacher-ranking-result'));
    };
    byId('teacher-ranking-refresh').onclick = () => simpleRenderScores();
    attachSearch(byId('teacher-ranking-search'), byId('teacher-ranking-search-btn'), () => teacherRows, byId('teacher-ranking-result'));
  }

  async function simpleRenderScores() {
    if (typeof teacherIsActive === 'function' && !teacherIsActive()) return;
    if (teacherLoading) return;
    const list = byId('leaderboard');
    if (!list) return;
    const language = byId('leaderboard-language')?.value === 'zh' ? 'zh' : 'en';
    const request = ++teacherRequest;
    teacherLoading = true;
    list.innerHTML = '<div class="empty">正在讀取排行榜…</div>';
    try {
      const rows = await requestRanking(language);
      if (request !== teacherRequest) return;
      teacherRows = rows;
      renderRows(list, rows, byId('teacher-ranking-limit')?.value, null);
      renderSearchResult(rows, byId('teacher-ranking-search'), byId('teacher-ranking-result'));
    } catch (error) {
      if (request === teacherRequest) list.innerHTML = `<div class="empty">${escapeHtml(error.message)}</div>`;
    } finally {
      if (request === teacherRequest) teacherLoading = false;
    }
    if (typeof protectTeacherActions === 'function') protectTeacherActions();
  }

  async function registerIdentity(event) {
    event.preventDefault();
    if (test.started && !test.finished) return;
    const className = text(byId('player-class')?.value);
    const name = text(byId('player-name')?.value);
    const rawSeat = text(byId('player-seat')?.value);
    const status = byId('identity-status');
    const button = byId('join-ranking')?.querySelector('button[type="submit"]');
    if (!className || className.length > 40 || !name || name.length > 80 || !/^\d{1,3}$/.test(rawSeat) || Number(rawSeat) < 1 || Number(rawSeat) > 999) {
      if (status) status.textContent = '請填寫班級、姓名與有效座號（1–999）。';
      return;
    }
    const seat = rawSeat.padStart(2, '0');
    if (button) button.disabled = true;
    if (status) status.textContent = '正在登錄排行榜…';
    try {
      const response = await fetch('/api/ranking-register', {
        method: 'POST',
        credentials: 'same-origin',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({className, name, seat}),
        signal: AbortSignal.timeout(15000)
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.student?.id) throw Error(result?.error || '排行榜登錄失敗，請稍後重試。');
      const cloud = result.student;
      let person = data.students.find(student => student.className === cloud.className && student.name === cloud.name && student.seat === cloud.seat);
      const canonical = data.students.find(student => student.id === cloud.id);
      if (person && canonical && person !== canonical) {
        const oldId = person.id;
        data.students = data.students.filter(student => student !== person);
        data.testRecords.forEach(record => { if (record.studentId === oldId) record.studentId = canonical.id; });
        person = canonical;
      }
      if (!person) {
        person = canonical || {id: cloud.id, className: cloud.className, name: cloud.name, seat: cloud.seat, createdAt: new Date().toISOString()};
        if (!canonical) data.students.push(person);
      }
      const oldId = person.id;
      if (oldId !== cloud.id) {
        data.testRecords.forEach(record => { if (record.studentId === oldId) record.studentId = cloud.id; });
      }
      person.id = cloud.id;
      person.className = cloud.className;
      person.name = cloud.name;
      person.seat = cloud.seat;
      updateStudentRecords(person);
      activeStudent = person.id;
      save();
      fillStudents();
      stats();
      resetTest();
      if (status) status.textContent = `已登錄：${studentLabel(person)}。完成測速後會自動更新排行榜。`;
      await simpleRenderPlayerRanking();
      if (!byId('test-input')?.disabled) byId('test-input').focus();
    } catch (error) {
      if (status) status.textContent = error.message;
    } finally {
      if (button) button.disabled = false;
    }
  }

  injectStyles();
  simplifyIdentity();
  publicMarkup();

  renderPlayerRanking = simpleRenderPlayerRanking;

  const joinForm = byId('join-ranking');
  if (joinForm) joinForm.onsubmit = registerIdentity;
  if (byId('player-ranking')?.classList.contains('active')) simpleRenderPlayerRanking();
  if (byId('teacher')?.classList.contains('active')) renderScores();
})();
