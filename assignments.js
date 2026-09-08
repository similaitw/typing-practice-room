'use strict';

(() => {
  if (typeof publishRecord !== 'function' || typeof show !== 'function') return;

  let studentSession = null;
  let currentAssignmentId = null;
  let currentAssignmentTitle = '';
  let teacherAssignments = [];
  let editingAssignmentId = null;
  let loadingTeacherAssignments = false;

  const css = document.createElement('style');
  css.textContent = `
    .my-tasks{margin:28px 0;padding:22px;border:1px solid var(--line);background:var(--paper);border-radius:8px}
    .my-tasks-head,.assignment-head{display:flex;justify-content:space-between;gap:16px;align-items:flex-start}
    .task-grid,.assignment-list{display:grid;gap:12px;margin-top:16px}
    .task-card,.assignment-row{padding:16px;border:1px solid var(--line);border-radius:8px;background:var(--paper)}
    .task-card h3,.assignment-row h3{margin:0 0 6px}.task-meta{display:flex;gap:10px;flex-wrap:wrap;color:var(--muted);font-size:.92rem}
    .task-progress{font-weight:800;color:var(--green)}.task-status{display:inline-flex;padding:3px 8px;border-radius:99px;border:1px solid var(--line);font-size:.82rem;font-weight:800}
    .task-status.completed{background:#e5f5d6}.task-status.overdue{background:#f7dfd8}.task-login{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:10px;max-width:560px}
    .task-login input{min-width:0}.assignment-banner{margin:0 0 16px;padding:12px 16px;border:1px solid var(--line);background:var(--paper);font-weight:700}
    .assignment-form-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.assignment-form-grid label{display:grid;gap:6px}
    .class-checks{display:flex;flex-wrap:wrap;gap:8px}.class-checks label{display:flex;gap:5px;align-items:center;padding:6px 9px;border:1px solid var(--line);border-radius:6px}
    .student-access-card{margin-top:20px;padding:16px;border:1px solid var(--line);border-radius:8px}.student-access-code{font:800 1.05rem ui-monospace,monospace;word-break:break-all}
    @media(max-width:760px){.assignment-form-grid{grid-template-columns:1fr}.task-login{grid-template-columns:1fr}.my-tasks-head,.assignment-head{display:block}}
  `;
  document.head.append(css);

  async function jsonRequest(url, options = {}) {
    const response = await fetch(url, {credentials:'same-origin',cache:'no-store',signal:AbortSignal.timeout(15000),...options});
    const result = await response.json().catch(() => null);
    if (!response.ok || result === null) throw Object.assign(Error(result?.error || '目前無法連線至作業服務。'), {status:response.status});
    return result;
  }

  function ensureLocalStudent(student) {
    if (!student) return;
    let person = data.students.find(s => s.id === student.id);
    if (!person) person = data.students.find(s => (s.className || '') === (student.className || '') && s.seat === student.seat && s.name === student.name);
    if (!person) {
      person = {id:student.id,className:student.className || '',seat:student.seat || '',name:student.name,createdAt:new Date().toISOString()};
      data.students.push(person);
    } else {
      person.id = student.id; person.className = student.className || ''; person.seat = student.seat || ''; person.name = student.name;
    }
    activeStudent = student.id;
    save(); fillStudents(); stats();
  }

  function ensureStudentUI() {
    if (document.querySelector('#my-tasks')) return;
    const section = document.createElement('section');
    section.id = 'my-tasks';
    section.className = 'my-tasks';
    section.innerHTML = `<div class="my-tasks-head"><div><p class="eyebrow">MY TASKS / 老師指定</p><h2>我的任務</h2><p id="student-session-copy">使用老師提供的一次性啟用碼登入，才能查看自己的指定作業。</p></div><button id="student-end-session" class="btn quiet" hidden>結束使用</button></div>
      <form id="student-code-form" class="task-login"><input id="student-code" type="password" minlength="20" maxlength="100" autocomplete="one-time-code" placeholder="輸入老師提供的學生啟用碼" required><button class="btn primary" type="submit">開啟我的任務</button></form>
      <p id="student-code-message" role="status"></p><div id="my-task-list" class="task-grid"></div>`;
    const overview = document.querySelector('#overview');
    const recent = overview?.querySelector('.recent');
    (recent || overview?.lastElementChild)?.insertAdjacentElement('beforebegin', section);

    document.querySelector('#student-code-form').onsubmit = async event => {
      event.preventDefault();
      const input = document.querySelector('#student-code');
      const message = document.querySelector('#student-code-message');
      message.textContent = '正在確認身分…';
      try {
        const result = await jsonRequest('/api/student-access',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'redeem',code:input.value.trim()})});
        input.value = '';
        studentSession = result;
        ensureLocalStudent(result.student);
        renderStudentSession();
        await loadMyTasks();
      } catch(error) {message.textContent = error.message;}
    };
    document.querySelector('#student-end-session').onclick = async () => {
      if (!confirm('結束這台電腦的學生登入？下次需要向老師取得新的啟用碼。')) return;
      try {await jsonRequest('/api/student-access',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'logout'})});}
      catch(error) {toast(error.message); return;}
      studentSession = null; currentAssignmentId = null; currentAssignmentTitle = '';
      renderStudentSession(); hideAssignmentBanner();
    };
  }

  function renderStudentSession() {
    ensureStudentUI();
    const authenticated = !!studentSession?.authenticated;
    document.querySelector('#student-code-form').hidden = authenticated;
    document.querySelector('#student-end-session').hidden = !authenticated;
    document.querySelector('#student-session-copy').textContent = authenticated
      ? `目前：${studentLabel(studentSession.student)}。學生登入最長 8 小時；共用電腦用完請按「結束使用」。`
      : '使用老師提供的一次性啟用碼登入，才能查看自己的指定作業。';
    document.querySelector('#student-code-message').textContent = '';
    if (!authenticated) document.querySelector('#my-task-list').innerHTML = '<div class="empty">尚未登入學生任務。</div>';
  }

  async function refreshStudentSession() {
    ensureStudentUI();
    try {
      const result = await jsonRequest('/api/student-access');
      studentSession = result.authenticated ? result : null;
      if (studentSession) ensureLocalStudent(studentSession.student);
      renderStudentSession();
      if (studentSession) await loadMyTasks();
    } catch {
      studentSession = null; renderStudentSession();
    }
  }

  const statusText = status => ({not_started:'未開始',in_progress:'進行中',completed:'已完成',overdue:'已逾期'})[status] || status;
  async function loadMyTasks() {
    if (!studentSession?.authenticated) return;
    const list = document.querySelector('#my-task-list');
    list.innerHTML = '<div class="empty">正在讀取老師指定作業…</div>';
    try {
      const assignments = await jsonRequest('/api/assignments?view=mine');
      list.innerHTML = assignments.length ? assignments.map(a => `<article class="task-card"><div class="assignment-head"><div><span class="task-status ${a.status}">${statusText(a.status)}</span><h3>${escapeHtml(a.title)}</h3></div><strong class="task-progress">${a.validAttempts} / ${a.requiredAttempts}</strong></div>
        <div class="task-meta"><span>${a.language === 'en' ? '英文 WPM' : '中文 CPM'}</span><span>${a.duration} 秒</span><span>正確率 ≥ ${a.minAccuracy}%</span><span>速度 ≥ ${a.minSpeed} ${a.language === 'en' ? 'WPM' : 'CPM'}</span>${a.dueAt ? `<span>截止 ${escapeHtml(new Date(a.dueAt).toLocaleString('zh-TW'))}</span>` : '<span>無截止時間</span>'}</div>
        <div class="actions"><button class="btn primary" data-start-assignment="${escapeHtml(a.id)}" ${a.status === 'completed' || a.status === 'overdue' ? 'disabled' : ''}>${a.status === 'completed' ? '已完成' : a.status === 'overdue' ? '已逾期' : '開始練習 →'}</button></div></article>`).join('') : '<div class="empty">目前沒有老師指定的作業。</div>';
      list.querySelectorAll('[data-start-assignment]').forEach(button => button.onclick = () => {
        const assignment = assignments.find(a => a.id === button.dataset.startAssignment);
        if (assignment) startAssignment(assignment);
      });
    } catch(error) {
      if (error.status === 401) {studentSession = null; renderStudentSession();}
      else list.innerHTML = `<div class="empty">${escapeHtml(error.message)}</div>`;
    }
  }

  function ensureAssignmentBanner() {
    let banner = document.querySelector('#assignment-banner');
    if (!banner) {
      banner = document.createElement('div'); banner.id = 'assignment-banner'; banner.className = 'assignment-banner'; banner.hidden = true;
      document.querySelector('#test .page-intro')?.insertAdjacentElement('afterend',banner);
    }
    return banner;
  }
  function hideAssignmentBanner() {const banner=ensureAssignmentBanner(); banner.hidden=true; banner.textContent='';}
  function startAssignment(assignment) {
    if (!studentSession?.authenticated) return;
    ensureLocalStudent(studentSession.student);
    currentAssignmentId = assignment.id; currentAssignmentTitle = assignment.title;
    test.lang = assignment.language; test.duration = assignment.duration;
    setSelected('#lang',assignment.language); setSelected('#duration',String(assignment.duration));
    show('test');
    const banner = ensureAssignmentBanner(); banner.hidden = false;
    banner.textContent = `老師指定作業：${assignment.title}｜${assignment.duration} 秒｜正確率至少 ${assignment.minAccuracy}%｜速度至少 ${assignment.minSpeed} ${assignment.language === 'en' ? 'WPM' : 'CPM'}｜完成 ${assignment.requiredAttempts} 次`;
    document.querySelector('#test-input')?.focus();
  }

  const originalPublishRecord = publishRecord;
  publishRecord = async function assignmentPublishRecord(record) {
    if (currentAssignmentId) record.assignmentId = currentAssignmentId;
    await originalPublishRecord(record);
    if (record.assignmentId && studentSession?.authenticated) setTimeout(loadMyTasks,350);
  };

  const clearAssignmentContext = () => {currentAssignmentId = null; currentAssignmentTitle = ''; hideAssignmentBanner();};
  document.querySelector('#lang')?.addEventListener('click',event => {if(event.target?.dataset?.value && currentAssignmentId) clearAssignmentContext();},true);
  document.querySelector('#duration')?.addEventListener('click',event => {if(event.target?.dataset?.value && currentAssignmentId) clearAssignmentContext();},true);
  document.querySelector('#student-select')?.addEventListener('change',() => {if(currentAssignmentId) clearAssignmentContext();},true);
  document.querySelector('#apply-custom')?.addEventListener('click',() => {if(currentAssignmentId) clearAssignmentContext();},true);

  async function assignmentRequest(method='GET',body) {
    try {
      return await jsonRequest('/api/assignments',{method,headers:body?{'Content-Type':'application/json'}:{},...(body?{body:JSON.stringify(body)}:{})});
    } catch(error) {
      if (error.status === 401) showTeacherLogin('教師登入已失效，請重新登入。');
      throw error;
    }
  }

  async function studentAccessRequest(body) {
    try {return await jsonRequest('/api/student-access',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});}
    catch(error) {if(error.status===401)showTeacherLogin('教師登入已失效，請重新登入。'); throw error;}
  }

  function classOptions() {
    return [...new Set(data.students.map(s => s.className).filter(Boolean))].sort((a,b) => a.localeCompare(b,'zh-Hant'));
  }

  function ensureTeacherAssignmentsUI() {
    if (!document.querySelector('#teacher')) return;
    let tab = document.querySelector('.tab[data-panel="assignments"]');
    if (!tab) {
      tab = document.createElement('button'); tab.className='tab'; tab.dataset.panel='assignments'; tab.textContent='作業管理';
      document.querySelector('#teacher .tabs')?.append(tab);
      const panel=document.createElement('div'); panel.id='panel-assignments'; panel.className='panel';
      panel.innerHTML=`<div class="card"><div class="card-head"><div><p class="eyebrow">ASSIGNMENTS</p><h2>建立／編輯作業</h2></div></div>
        <form id="assignment-form"><div class="assignment-form-grid"><label>作業名稱<input id="assignment-title" maxlength="120" required placeholder="例如：701 英文打字 1"></label><label>語言<select id="assignment-language"><option value="en">英文 WPM</option><option value="zh">中文 CPM</option></select></label><label>時間<select id="assignment-duration"><option value="15">15 秒</option><option value="30">30 秒</option><option value="60" selected>60 秒</option><option value="120">120 秒</option></select></label><label>最低正確率<input id="assignment-accuracy" type="number" min="0" max="100" value="90" required></label><label>最低速度<input id="assignment-speed" type="number" min="0" max="10000" value="20" required></label><label>有效次數<input id="assignment-attempts" type="number" min="1" max="20" value="3" required></label><label>開始時間（可空白）<input id="assignment-start" type="datetime-local"></label><label>截止時間（可空白）<input id="assignment-due" type="datetime-local"></label></div><fieldset><legend>指派班級</legend><div id="assignment-classes" class="class-checks"></div></fieldset><div class="actions"><button class="btn primary" type="submit" id="assignment-save">建立作業</button><button class="btn quiet" type="button" id="assignment-cancel-edit" hidden>取消編輯</button></div><p id="assignment-message" role="status"></p></form></div>
        <div class="card" style="margin-top:18px"><div class="card-head"><div><p class="eyebrow">CURRENT WORK</p><h2>目前作業</h2></div></div><div id="teacher-assignment-list" class="assignment-list"></div></div>
        <div class="student-access-card"><p class="eyebrow">STUDENT ACCESS</p><h3>學生一次性啟用碼</h3><p>選學生後產生一次性啟用碼。產生新碼會讓該學生舊 session 失效；啟用碼兌換一次後即失效。</p><div class="actions"><select id="access-student"></select><button id="issue-student-code" class="btn outline" type="button">產生啟用碼</button></div><p id="issued-code-message" role="status"></p></div>`;
      document.querySelector('#panel-backup')?.insertAdjacentElement('beforebegin',panel);

      tab.onclick=()=>{
        document.querySelectorAll('#teacher .tab').forEach(x=>{x.classList.toggle('active',x===tab);x.setAttribute('aria-pressed',x===tab);});
        document.querySelectorAll('#teacher .panel').forEach(x=>x.classList.toggle('active',x===panel));
        refreshTeacherAssignmentUI();
      };
      document.querySelector('#assignment-form').onsubmit=saveAssignment;
      document.querySelector('#assignment-cancel-edit').onclick=resetAssignmentForm;
      document.querySelector('#issue-student-code').onclick=issueStudentCode;
    }
    refreshTeacherControls();
  }

  function refreshTeacherControls() {
    const classes=classOptions(), holder=document.querySelector('#assignment-classes');
    if(holder) {
      const selected=new Set([...holder.querySelectorAll('input:checked')].map(i=>i.value));
      holder.innerHTML=classes.length?classes.map(c=>`<label><input type="checkbox" value="${escapeHtml(c)}" ${selected.has(c)?'checked':''}>${escapeHtml(c)}</label>`).join(''):'<span class="empty">請先在學生名單建立班級。</span>';
    }
    const select=document.querySelector('#access-student');
    if(select){const value=select.value;select.innerHTML='<option value="">選擇學生</option>'+data.students.map(s=>`<option value="${escapeHtml(s.id)}">${escapeHtml(studentLabel(s))}</option>`).join('');select.value=[...select.options].some(o=>o.value===value)?value:'';}
  }

  const localDateValue = iso => iso ? new Date(new Date(iso).getTime()-new Date().getTimezoneOffset()*60000).toISOString().slice(0,16) : '';
  function resetAssignmentForm(){editingAssignmentId=null;document.querySelector('#assignment-form')?.reset();if(document.querySelector('#assignment-accuracy'))document.querySelector('#assignment-accuracy').value='90';if(document.querySelector('#assignment-speed'))document.querySelector('#assignment-speed').value='20';if(document.querySelector('#assignment-attempts'))document.querySelector('#assignment-attempts').value='3';document.querySelector('#assignment-save').textContent='建立作業';document.querySelector('#assignment-cancel-edit').hidden=true;refreshTeacherControls();}
  function editAssignment(a){editingAssignmentId=a.id;document.querySelector('#assignment-title').value=a.title;document.querySelector('#assignment-language').value=a.language;document.querySelector('#assignment-duration').value=String(a.duration);document.querySelector('#assignment-accuracy').value=String(a.minAccuracy);document.querySelector('#assignment-speed').value=String(a.minSpeed);document.querySelector('#assignment-attempts').value=String(a.requiredAttempts);document.querySelector('#assignment-start').value=localDateValue(a.startAt);document.querySelector('#assignment-due').value=localDateValue(a.dueAt);refreshTeacherControls();document.querySelectorAll('#assignment-classes input').forEach(i=>i.checked=a.targetClasses.includes(i.value));document.querySelector('#assignment-save').textContent='儲存修改';document.querySelector('#assignment-cancel-edit').hidden=false;document.querySelector('#assignment-title').focus();}

  async function saveAssignment(event){event.preventDefault();const message=document.querySelector('#assignment-message');const targetClasses=[...document.querySelectorAll('#assignment-classes input:checked')].map(i=>i.value);if(!targetClasses.length){message.textContent='至少選一個班級。';return;}const body={title:document.querySelector('#assignment-title').value.trim(),language:document.querySelector('#assignment-language').value,duration:Number(document.querySelector('#assignment-duration').value),minAccuracy:Number(document.querySelector('#assignment-accuracy').value),minSpeed:Number(document.querySelector('#assignment-speed').value),requiredAttempts:Number(document.querySelector('#assignment-attempts').value),startAt:document.querySelector('#assignment-start').value?new Date(document.querySelector('#assignment-start').value).toISOString():null,dueAt:document.querySelector('#assignment-due').value?new Date(document.querySelector('#assignment-due').value).toISOString():null,targetClasses};if(editingAssignmentId)body.id=editingAssignmentId;message.textContent='正在儲存…';try{await assignmentRequest(editingAssignmentId?'PATCH':'POST',body);message.textContent=editingAssignmentId?'作業已更新。':'作業已建立。';resetAssignmentForm();await loadTeacherAssignments();}catch(error){message.textContent=error.message;}}

  async function loadTeacherAssignments(){if(!teacherIsActive()||loadingTeacherAssignments)return;loadingTeacherAssignments=true;const list=document.querySelector('#teacher-assignment-list');if(list)list.innerHTML='<div class="empty">正在載入作業…</div>';try{teacherAssignments=await assignmentRequest();if(list)list.innerHTML=teacherAssignments.length?teacherAssignments.map(a=>`<article class="assignment-row"><div class="assignment-head"><div><span class="task-status ${a.active?'':'overdue'}">${a.active?'啟用中':'已停用'}</span><h3>${escapeHtml(a.title)}</h3></div><strong>${a.targetClasses.map(escapeHtml).join('、')}</strong></div><div class="task-meta"><span>${a.language==='en'?'英文':'中文'} ${a.duration} 秒</span><span>正確率 ≥ ${a.minAccuracy}%</span><span>速度 ≥ ${a.minSpeed}</span><span>${a.requiredAttempts} 次</span>${a.dueAt?`<span>截止 ${escapeHtml(new Date(a.dueAt).toLocaleString('zh-TW'))}</span>`:''}</div><div class="actions"><button data-edit-assignment="${escapeHtml(a.id)}">編輯</button><button data-toggle-assignment="${escapeHtml(a.id)}">${a.active?'停用':'重新啟用'}</button></div></article>`).join(''):'<div class="empty">尚未建立作業。</div>';list?.querySelectorAll('[data-edit-assignment]').forEach(b=>b.onclick=()=>{const a=teacherAssignments.find(x=>x.id===b.dataset.editAssignment);if(a)editAssignment(a);});list?.querySelectorAll('[data-toggle-assignment]').forEach(b=>b.onclick=async()=>{const a=teacherAssignments.find(x=>x.id===b.dataset.toggleAssignment);if(!a)return;try{await assignmentRequest('PATCH',{id:a.id,active:!a.active});await loadTeacherAssignments();}catch(error){toast(error.message);}});protectTeacherActions();}catch(error){if(list)list.innerHTML=`<div class="empty">${escapeHtml(error.message)}</div>`;}finally{loadingTeacherAssignments=false;}}

  async function issueStudentCode(){const studentId=document.querySelector('#access-student').value,message=document.querySelector('#issued-code-message');if(!studentId){message.textContent='請先選一位學生。';return;}message.textContent='正在產生啟用碼…';try{const result=await studentAccessRequest({action:'issue',studentId});message.innerHTML=`${escapeHtml(studentLabel(result.student))}<br><span class="student-access-code">${escapeHtml(result.code)}</span><br>有效至 ${escapeHtml(new Date(result.expiresAt).toLocaleString('zh-TW'))}。請直接交給該學生；本頁不會保存明碼。`;}catch(error){message.textContent=error.message;}}

  function refreshTeacherAssignmentUI(){ensureTeacherAssignmentsUI();refreshTeacherControls();loadTeacherAssignments();}

  const previousRenderTeacher = renderTeacher;
  renderTeacher = function assignmentsRenderTeacher(){previousRenderTeacher();ensureTeacherAssignmentsUI();refreshTeacherControls();};

  ensureStudentUI();
  ensureAssignmentBanner();
  refreshStudentSession();
})();
