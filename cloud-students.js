'use strict';

(() => {
  if (typeof renderTeacher !== 'function' || typeof teacherIsActive !== 'function') return;

  const originalRenderTeacher = renderTeacher;
  let cloudRoster = [];
  let cloudSyncing = false;
  let cloudLoaded = false;
  let syncGeneration = 0;

  const identityKey = student => [student.className || '', student.seat || '', student.name || ''].join('\u001f');
  const toLocalStudent = student => ({
    id: student.id,
    className: student.className || '',
    seat: student.seat || '',
    name: student.name,
    createdAt: student.createdAt || new Date().toISOString()
  });

  async function studentRequest(method = 'GET', body) {
    const response = await fetch('/api/students', {
      method,
      credentials: 'same-origin',
      cache: 'no-store',
      headers: body ? {'Content-Type': 'application/json'} : {},
      ...(body ? {body: JSON.stringify(body)} : {}),
      signal: AbortSignal.timeout(15000)
    });
    const result = await response.json().catch(() => null);
    if (response.status === 401) {
      showTeacherLogin('教師登入已失效，請重新登入。');
      throw Error('教師登入已失效。');
    }
    if (!response.ok || result === null) throw Error(result?.error || '目前無法連線至雲端學生名單。');
    return result;
  }

  function cloudStatus(message, isError = false) {
    let status = document.querySelector('#cloud-roster-status');
    if (!status) {
      status = document.createElement('p');
      status.id = 'cloud-roster-status';
      status.setAttribute('role', 'status');
      const count = document.querySelector('#student-count');
      (count?.parentElement || document.querySelector('#student-list')?.parentElement)?.append(status);
    }
    if (status) {
      status.textContent = message;
      status.style.marginTop = '8px';
      status.style.fontWeight = '600';
      status.style.color = isError ? 'var(--error, #b33)' : 'var(--muted, #5f6b64)';
    }
  }

  function reconcileLocalRecords(previousStudents, activeStudents) {
    const byOldId = new Map(previousStudents.map(student => [student.id, student]));
    const byIdentity = new Map(activeStudents.map(student => [identityKey(student), student]));
    for (const record of data.testRecords) {
      if (!record.studentId) continue;
      const previous = byOldId.get(record.studentId);
      if (!previous) continue;
      const canonical = byIdentity.get(identityKey(previous));
      if (!canonical || canonical.id === record.studentId) continue;
      record.studentId = canonical.id;
      record.studentLabel = studentLabel(canonical);
      record.studentClass = canonical.className || '';
      record.studentName = canonical.name;
      record.studentSeat = canonical.seat;
    }
  }

  function renderInactiveStudents() {
    let panel = document.querySelector('#cloud-inactive-students');
    if (!panel) {
      panel = document.createElement('section');
      panel.id = 'cloud-inactive-students';
      panel.style.marginTop = '18px';
      document.querySelector('#student-list')?.insertAdjacentElement('afterend', panel);
    }
    if (!panel) return;
    const inactive = cloudRoster.filter(student => !student.active);
    panel.innerHTML = inactive.length
      ? `<details><summary><strong>已停用學生（${inactive.length}）</strong></summary><div style="margin-top:10px">${inactive.map(student => `<div class="student"><span><small>${escapeHtml(student.className || '未填班級')}</small>${escapeHtml(student.name)} ${escapeHtml(student.seat ? student.seat + '號' : '')}</span><div class="actions"><button data-cloud-restore="${escapeHtml(student.id)}">恢復</button></div></div>`).join('')}</div></details>`
      : '';
    panel.querySelectorAll('[data-cloud-restore]').forEach(button => {
      button.onclick = async () => {
        try {
          await studentRequest('PATCH', {id: button.dataset.cloudRestore, active: true});
          toast('學生已恢復到雲端名單。');
          await syncCloudStudents({importLocal: false, force: true});
        } catch (error) { toast(error.message); }
      };
    });
  }

  function patchRosterActions() {
    document.querySelectorAll('[data-edit]').forEach(button => {
      const index = Number(button.dataset.edit);
      const student = data.students[index];
      if (!student) return;
      button.onclick = async () => {
        const className = prompt('修改班級（可留空）', student.className || ''); if (className === null) return;
        const seat = prompt('修改座號（可留空）', student.seat || ''); if (seat === null) return;
        const name = prompt('修改姓名', student.name); if (name === null) return;
        const next = {id: student.id, className: className.trim(), seat: seat.trim(), name: name.trim()};
        if (next.className.length > 40 || next.seat.length > 20 || !next.name || next.name.length > 80 || /[\r\n\t]/.test(next.className + next.seat + next.name)) return toast('姓名、班級或座號格式不正確。');
        try {
          await studentRequest('PATCH', next);
          toast('學生資料已更新到雲端。');
          await syncCloudStudents({importLocal: false, force: true});
        } catch (error) { toast(error.message); }
      };
    });

    document.querySelectorAll('[data-remove]').forEach(button => {
      const index = Number(button.dataset.remove);
      const student = data.students[index];
      if (!student) return;
      button.textContent = '停用';
      button.setAttribute('aria-label', `停用 ${student.name}`);
      button.onclick = async () => {
        if (!confirm(`停用「${student.name}」？歷史成績會保留，學生不再出現在一般名單。`)) return;
        try {
          await studentRequest('PATCH', {id: student.id, active: false});
          toast('學生已停用，歷史成績仍保留。');
          await syncCloudStudents({importLocal: false, force: true});
        } catch (error) { toast(error.message); }
      };
    });

    const saveRosterButton = document.querySelector('#save-roster');
    if (saveRosterButton) saveRosterButton.onclick = async () => {
      try {
        const entries = pendingRoster || parseRoster(document.querySelector('#roster-input').value);
        if (!entries.length) return toast('請先輸入或匯入學生名單。');
        if (entries.length > 2000) throw Error('學生名單最多 2,000 位。');
        const existing = new Map([...data.students, ...cloudRoster].map(student => [identityKey(student), student]));
        const now = new Date().toISOString();
        const students = entries.map(entry => {
          const same = existing.get(identityKey(entry));
          return {
            id: same?.id || uid(),
            className: entry.className || '',
            seat: entry.seat || '',
            name: entry.name,
            active: true,
            createdAt: same?.createdAt || now
          };
        });
        for (let offset = 0; offset < students.length; offset += 200) {
          await studentRequest('POST', {students: students.slice(offset, offset + 200)});
        }
        pendingRoster = null;
        document.querySelector('#roster-input').value = '';
        toast(`已將 ${students.length} 筆名單送至雲端；相同班級、姓名與座號會自動合併。`);
        await syncCloudStudents({importLocal: false, force: true});
      } catch (error) { toast(error.message); }
    };

    renderInactiveStudents();
    protectTeacherActions();
  }

  function applyCloudRoster(rows) {
    const previousStudents = data.students.slice();
    cloudRoster = rows;
    const activeStudents = rows.filter(student => student.active).map(toLocalStudent);
    reconcileLocalRecords(previousStudents, activeStudents);
    data.students = activeStudents;
    if (!data.students.some(student => student.id === activeStudent)) activeStudent = '';
    save();
    originalRenderTeacher();
    patchRosterActions();
    fillStudents();
    stats();
    cloudStatus(`雲端名單已同步：${activeStudents.length} 位啟用、${rows.length - activeStudents.length} 位停用。換電腦登入教師端仍會載入同一份名單。`);
  }

  async function syncCloudStudents({importLocal = true, force = false} = {}) {
    if (!teacherIsActive() || cloudSyncing || (cloudLoaded && !force && !importLocal)) return;
    cloudSyncing = true;
    const generation = ++syncGeneration;
    const localSnapshot = data.students.slice();
    cloudStatus('正在同步雲端學生名單…');
    try {
      let rows = await studentRequest();
      if (generation !== syncGeneration) return;
      if (importLocal && localSnapshot.length) {
        const cloudByIdentity = new Map(rows.map(student => [identityKey(student), student]));
        const candidates = localSnapshot.map(student => {
          const same = cloudByIdentity.get(identityKey(student));
          return {
            id: same?.id || student.id,
            className: student.className || '',
            seat: student.seat || '',
            name: student.name,
            active: same?.active !== false,
            createdAt: same?.createdAt || student.createdAt
          };
        });
        for (let offset = 0; offset < candidates.length; offset += 200) {
          await studentRequest('POST', {students: candidates.slice(offset, offset + 200)});
        }
        rows = await studentRequest();
      }
      cloudLoaded = true;
      applyCloudRoster(rows);
    } catch (error) {
      cloudStatus(`雲端名單同步失敗，目前保留這台電腦的名單：${error.message}`, true);
    } finally {
      cloudSyncing = false;
    }
  }

  renderTeacher = function cloudRenderTeacher() {
    originalRenderTeacher();
    patchRosterActions();
    syncCloudStudents({importLocal: !cloudLoaded});
  };

  const clearButton = document.querySelector('#clear-data');
  if (clearButton) {
    clearButton.textContent = '清除這台瀏覽器資料';
    clearButton.onclick = async () => {
      if (!confirm('清除這台瀏覽器的課程進度、快取名單與本機成績？雲端學生名單與資料庫成績不會刪除。')) return;
      if (!confirm('再次確認：本機資料清除後，雲端名單會重新同步。仍要繼續？')) return;
      data = C.emptyData(); storageIssue = ''; activeStudent = '';
      document.querySelector('#storage-warning').hidden = true;
      document.querySelector('#threshold').value = 90;
      save(); renderLessons(); stats();
      cloudLoaded = false;
      await syncCloudStudents({importLocal: false, force: true});
      toast('這台瀏覽器資料已清除；雲端學生名單已重新載入。');
    };
  }

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && teacherIsActive() && document.querySelector('#teacher')?.classList.contains('active')) {
      syncCloudStudents({importLocal: false, force: true});
    }
  });
})();
