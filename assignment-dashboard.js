'use strict';

(() => {
  if (typeof teacherIsActive !== 'function' || typeof escapeHtml !== 'function') return;

  let currentAssignmentId = null;
  let currentData = null;
  let loading = false;
  let pollTimer = null;
  let projectionTimer = null;
  let projectionClass = '';

  const css = document.createElement('style');
  css.textContent = `
    .assignment-dashboard{margin-top:18px}.dashboard-controls{display:flex;gap:10px;align-items:end;flex-wrap:wrap}.dashboard-controls label{display:grid;gap:5px}
    .dashboard-summary{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:10px;margin:16px 0}.dashboard-summary div{padding:14px;border:1px solid var(--line);border-radius:8px}.dashboard-summary span{display:block;color:var(--muted);font-size:.86rem}.dashboard-summary strong{font-size:1.45rem}
    .dashboard-table-wrap{overflow:auto}.dashboard-table{width:100%;border-collapse:collapse;min-width:780px}.dashboard-table th,.dashboard-table td{padding:9px 10px;border-bottom:1px solid var(--line);text-align:left;white-space:nowrap}.dashboard-table th{font-size:.82rem;color:var(--muted)}
    .dashboard-status{display:inline-flex;padding:3px 8px;border:1px solid var(--line);border-radius:99px;font-size:.8rem;font-weight:800}.dashboard-status.completed{background:#e5f5d6}.dashboard-status.in_progress{background:#fff0c9}.dashboard-status.overdue{background:#f7dfd8}.dashboard-status.not_started{background:#f2f2ee}
    .projection-dialog{width:min(1100px,96vw);max-width:none;height:min(92vh,900px);padding:0;border:0;border-radius:12px;background:var(--paper)}.projection-dialog::backdrop{background:rgba(0,0,0,.72)}
    .projection-shell{height:100%;box-sizing:border-box;padding:26px;display:flex;flex-direction:column;gap:18px}.projection-top{display:flex;justify-content:space-between;gap:16px;align-items:flex-start}.projection-top h2{font-size:clamp(1.7rem,4vw,3rem);margin:0}.projection-progress{font-size:clamp(1.6rem,5vw,4rem);font-weight:900}.projection-meta{color:var(--muted)}
    .projection-seats{display:grid;grid-template-columns:repeat(auto-fit,minmax(74px,1fr));gap:12px;overflow:auto;padding:4px}.projection-seat{min-height:72px;border:2px solid var(--line);border-radius:10px;display:grid;place-items:center;font-size:1.5rem;font-weight:900}.projection-seat.completed{background:#e5f5d6}.projection-seat.in_progress{background:#fff0c9}.projection-seat.overdue{background:#f7dfd8}.projection-seat.not_started{background:#f2f2ee}.projection-seat small{display:block;font-size:.68rem;font-weight:700}
    @media(max-width:760px){.dashboard-summary{grid-template-columns:repeat(2,minmax(0,1fr))}.projection-shell{padding:16px}.projection-top{display:block}.projection-top .actions{margin-top:12px}}
  `;
  document.head.append(css);

  async function dashboardRequest(id, className='') {
    const params = new URLSearchParams({id});
    if (className) params.set('class',className);
    const response = await fetch(`/api/assignment-dashboard?${params}`,{credentials:'same-origin',cache:'no-store',signal:AbortSignal.timeout(15000)});
    const result = await response.json().catch(() => null);
    if (response.status === 401) {
      showTeacherLogin('教師登入已失效，請重新登入。');
      throw Error('教師登入已失效。');
    }
    if (!response.ok || result === null) throw Error(result?.error || '目前無法讀取作業完成度。');
    return result;
  }

  const statusText = status => ({not_started:'未開始',in_progress:'進行中',completed:'已完成',overdue:'已逾期'})[status] || status;
  const formatTime = value => value ? new Date(value).toLocaleString('zh-TW') : '—';

  function ensureDashboardUI() {
    if (document.querySelector('#assignment-dashboard-card')) return;
    const list = document.querySelector('#teacher-assignment-list');
    const anchor = list?.closest('.card');
    if (!anchor) return;
    const card = document.createElement('section');
    card.id = 'assignment-dashboard-card';
    card.className = 'card assignment-dashboard';
    card.hidden = true;
    card.innerHTML = `<div class="card-head"><div><p class="eyebrow">CLASS PROGRESS</p><h2 id="dashboard-title">作業完成度</h2><p id="dashboard-rule"></p></div><button id="dashboard-close" class="btn quiet">關閉</button></div>
      <div class="dashboard-controls"><label>班級<select id="dashboard-class"><option value="">全部指派班級</option></select></label><button id="dashboard-refresh" class="btn outline">重新整理</button><button id="dashboard-project" class="btn primary">課堂投影模式</button><span id="dashboard-updated" role="status"></span></div>
      <div id="dashboard-summary" class="dashboard-summary"></div><div id="dashboard-students"></div>`;
    anchor.insertAdjacentElement('afterend',card);
    document.querySelector('#dashboard-close').onclick = closeDashboard;
    document.querySelector('#dashboard-refresh').onclick = () => loadDashboard(currentAssignmentId,document.querySelector('#dashboard-class').value,true);
    document.querySelector('#dashboard-class').onchange = event => loadDashboard(currentAssignmentId,event.target.value,true);
    document.querySelector('#dashboard-project').onclick = openProjection;
  }

  function ensureProjectionUI() {
    if (document.querySelector('#assignment-projection')) return;
    const dialog = document.createElement('dialog');
    dialog.id = 'assignment-projection';
    dialog.className = 'projection-dialog';
    dialog.innerHTML = `<div class="projection-shell"><div class="projection-top"><div><p class="eyebrow">CLASSROOM MODE</p><h2 id="projection-title">作業進度</h2><p id="projection-meta" class="projection-meta"></p></div><div class="actions"><label>班級 <select id="projection-class"></select></label><button id="projection-fullscreen" class="btn outline">全螢幕</button><button id="projection-close" class="btn quiet">關閉</button></div></div><div id="projection-progress" class="projection-progress"></div><div id="projection-seats" class="projection-seats"></div></div>`;
    document.body.append(dialog);
    document.querySelector('#projection-close').onclick = () => dialog.close();
    document.querySelector('#projection-fullscreen').onclick = async () => {
      try {if (!document.fullscreenElement) await dialog.requestFullscreen(); else await document.exitFullscreen();} catch {toast('這個瀏覽器目前無法切換全螢幕。');}
    };
    document.querySelector('#projection-class').onchange = event => {projectionClass=event.target.value; loadProjection();};
    dialog.addEventListener('close',() => {clearInterval(projectionTimer);projectionTimer=null;if(document.fullscreenElement===dialog)document.exitFullscreen().catch(()=>{});});
  }

  function renderSummary(data) {
    const s=data.summary;
    document.querySelector('#dashboard-summary').innerHTML = [
      ['班級人數',s.total],['已完成',s.completed],['進行中',s.inProgress],['未開始',s.notStarted],['完成率',`${s.completionRate}%`]
    ].map(([label,value])=>`<div><span>${label}</span><strong>${value}</strong></div>`).join('');
  }

  function renderStudents(data) {
    const unit=data.assignment.language==='en'?'WPM':'CPM';
    const rows=data.students.map(student=>`<tr><td>${escapeHtml(student.className)}</td><td>${escapeHtml(student.seat || '—')}</td><td>${escapeHtml(student.name)}</td><td><span class="dashboard-status ${student.status}">${statusText(student.status)}</span></td><td>${student.validAttempts} / ${data.assignment.requiredAttempts}</td><td>${student.totalAttempts}</td><td>${student.bestSpeed==null?'—':`${student.bestSpeed} ${unit}`}</td><td>${student.bestAccuracy==null?'—':`${student.bestAccuracy}%`}</td><td>${formatTime(student.lastAttemptAt)}</td></tr>`).join('');
    document.querySelector('#dashboard-students').innerHTML = data.students.length ? `<div class="dashboard-table-wrap"><table class="dashboard-table"><thead><tr><th>班級</th><th>座號</th><th>姓名</th><th>狀態</th><th>達標次數</th><th>總嘗試</th><th>最佳速度</th><th>最佳正確率</th><th>最近練習</th></tr></thead><tbody>${rows}</tbody></table></div>` : '<div class="empty">這個範圍目前沒有啟用中的學生。</div>';
  }

  function renderDashboard(data) {
    currentData=data;
    const select=document.querySelector('#dashboard-class');
    const selected=data.selectedClass || '';
    select.innerHTML='<option value="">全部指派班級</option>'+data.classes.map(c=>`<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');
    select.value=selected;
    document.querySelector('#dashboard-title').textContent=`${data.assignment.title}｜完成度`;
    document.querySelector('#dashboard-rule').textContent=`${data.assignment.language==='en'?'英文':'中文'} ${data.assignment.duration} 秒 · 正確率 ≥ ${data.assignment.minAccuracy}% · 速度 ≥ ${data.assignment.minSpeed} ${data.assignment.language==='en'?'WPM':'CPM'} · ${data.assignment.requiredAttempts} 次達標`;
    document.querySelector('#dashboard-updated').textContent=`更新 ${new Date(data.generatedAt).toLocaleTimeString('zh-TW')}`;
    renderSummary(data); renderStudents(data);
  }

  async function loadDashboard(id,className='',showLoading=false) {
    if (!id || loading || !teacherIsActive()) return;
    currentAssignmentId=id; loading=true; ensureDashboardUI();
    const card=document.querySelector('#assignment-dashboard-card'); card.hidden=false;
    if(showLoading) document.querySelector('#dashboard-updated').textContent='正在更新…';
    try {renderDashboard(await dashboardRequest(id,className)); schedulePoll();}
    catch(error){document.querySelector('#dashboard-students').innerHTML=`<div class="empty">${escapeHtml(error.message)}</div>`;}
    finally{loading=false;}
  }

  function schedulePoll() {
    clearInterval(pollTimer);
    pollTimer=setInterval(()=>{
      const card=document.querySelector('#assignment-dashboard-card');
      const panel=document.querySelector('#panel-assignments');
      if(currentAssignmentId && card && !card.hidden && panel?.classList.contains('active') && teacherIsActive()) loadDashboard(currentAssignmentId,document.querySelector('#dashboard-class')?.value || '');
    },12000);
  }

  function closeDashboard() {
    currentAssignmentId=null; currentData=null; clearInterval(pollTimer);pollTimer=null;
    const card=document.querySelector('#assignment-dashboard-card'); if(card)card.hidden=true;
  }

  async function openProjection() {
    if(!currentAssignmentId)return;
    ensureProjectionUI();
    const classes=currentData?.classes || [];
    const preferred=document.querySelector('#dashboard-class')?.value || '';
    projectionClass=preferred || classes[0] || '';
    const select=document.querySelector('#projection-class');
    select.innerHTML=classes.map(c=>`<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');
    select.value=projectionClass;
    const dialog=document.querySelector('#assignment-projection');
    if(!dialog.open)dialog.showModal();
    await loadProjection();
    clearInterval(projectionTimer);projectionTimer=setInterval(loadProjection,12000);
  }

  async function loadProjection() {
    if(!currentAssignmentId || !projectionClass || !document.querySelector('#assignment-projection')?.open)return;
    try {
      const data=await dashboardRequest(currentAssignmentId,projectionClass);
      document.querySelector('#projection-title').textContent=data.assignment.title;
      document.querySelector('#projection-meta').textContent=`${projectionClass} · ${data.assignment.language==='en'?'英文':'中文'} ${data.assignment.duration} 秒 · 每 12 秒自動更新`;
      document.querySelector('#projection-progress').textContent=`${data.summary.completed} / ${data.summary.total} 已完成　${data.summary.completionRate}%`;
      document.querySelector('#projection-seats').innerHTML=data.students.length?data.students.map(student=>`<div class="projection-seat ${student.status}" title="${statusText(student.status)}"><div>${escapeHtml(student.seat || '—')}<small>${statusText(student.status)}</small></div></div>`).join(''):'<div class="empty">這個班級目前沒有啟用中的學生。</div>';
    } catch(error){document.querySelector('#projection-seats').innerHTML=`<div class="empty">${escapeHtml(error.message)}</div>`;}
  }

  function enhanceAssignmentRows() {
    ensureDashboardUI();
    const list=document.querySelector('#teacher-assignment-list');
    if(!list)return;
    list.querySelectorAll('[data-edit-assignment]').forEach(editButton=>{
      const id=editButton.dataset.editAssignment;
      const actions=editButton.parentElement;
      if(!actions || actions.querySelector(`[data-dashboard-assignment="${CSS.escape(id)}"]`))return;
      const button=document.createElement('button');
      button.type='button';button.dataset.dashboardAssignment=id;button.textContent='完成度';
      button.onclick=()=>loadDashboard(id,'',true);
      actions.prepend(button);
    });
  }

  const observer=new MutationObserver(enhanceAssignmentRows);
  function start() {
    ensureDashboardUI();ensureProjectionUI();enhanceAssignmentRows();
    const list=document.querySelector('#teacher-assignment-list');if(list)observer.observe(list,{childList:true,subtree:true});
  }
  start();
})();
