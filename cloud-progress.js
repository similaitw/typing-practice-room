'use strict';

(() => {
  if (typeof data === 'undefined' || typeof save !== 'function' || typeof renderLessons !== 'function' || typeof LESSONS === 'undefined') return;

  const CACHE_KEY = 'typingPracticeRoomLessonProgressByStudent';
  const validLessons = new Set(LESSONS.map(lesson => lesson.id));
  let legacyProgress = data.lessonProgress && typeof data.lessonProgress === 'object' ? data.lessonProgress : {};
  let studentSession = null;
  let cache = loadCache();
  let syncing = false;
  let detectTimer = null;

  function cleanProgress(progress) {
    const result = {};
    if (!progress || typeof progress !== 'object' || Array.isArray(progress)) return result;
    for (const [lessonId,done] of Object.entries(progress)) if (done === true && validLessons.has(lessonId)) result[lessonId] = true;
    return result;
  }

  function loadCache() {
    try {
      const parsed = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}');
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
      const result = {};
      for (const [studentId,progress] of Object.entries(parsed)) {
        if (typeof studentId === 'string' && studentId && studentId.length <= 100) result[studentId] = cleanProgress(progress);
      }
      return result;
    } catch { return {}; }
  }

  function saveCache() {
    try {localStorage.setItem(CACHE_KEY,JSON.stringify(cache));}
    catch {toast('個人課程進度快取無法寫入這台瀏覽器；雲端仍會嘗試同步。');}
  }

  function activeStudentProgress() {
    if (!studentSession?.authenticated) return legacyProgress;
    const studentId = studentSession.student?.id;
    if (!studentId) return {};
    cache[studentId] ||= {};
    return cache[studentId];
  }

  function setStatus(message) {
    let status = document.querySelector('#cloud-progress-status');
    if (!status) {
      status = document.createElement('p');
      status.id = 'cloud-progress-status';
      status.className = 'task-meta';
      const copy = document.querySelector('#student-session-copy');
      copy?.insertAdjacentElement('afterend',status);
    }
    if (status) status.textContent = message;
  }

  const originalSave = save;
  save = function progressAwareSave() {
    const studentProgress = studentSession?.authenticated ? activeStudentProgress() : null;
    if (studentProgress && data.lessonProgress !== studentProgress) legacyProgress = cleanProgress(data.lessonProgress);
    if (!studentProgress && data.lessonProgress !== legacyProgress) legacyProgress = data.lessonProgress;
    const visibleProgress = data.lessonProgress;
    data.lessonProgress = legacyProgress;
    try {return originalSave();}
    finally {data.lessonProgress = studentProgress || legacyProgress || visibleProgress;}
  };

  async function request(body,expectedStudentId) {
    const response = await fetch('/api/progress',{
      method:body ? 'POST' : 'GET',credentials:'same-origin',cache:'no-store',
      headers:body ? {'Content-Type':'application/json'} : {},
      ...(body ? {body:JSON.stringify(body)} : {}),signal:AbortSignal.timeout(15000)
    });
    const result = await response.json().catch(()=>null);
    if (!response.ok || !result) throw Object.assign(Error(result?.error || '目前無法同步課程進度。'),{status:response.status});
    if (expectedStudentId && result.student?.id !== expectedStudentId) throw Object.assign(Error('學生登入已切換，已停止這次進度同步。'),{status:409});
    return result;
  }

  function showCurrentProgress() {
    data.lessonProgress = activeStudentProgress();
    if (document.querySelector('#lessons')?.classList.contains('active')) renderLessons();
  }

  function summary(progress) {
    const ids = new Set(Object.keys(progress || {}).filter(id => progress[id]));
    const en = LESSONS.filter(l => l.group === 'en' && ids.has(l.id)).length;
    const zh = LESSONS.filter(l => l.group === 'zh' && ids.has(l.id)).length;
    return `英文 ${en}/7、中文 ${zh}/8`;
  }

  async function syncProgress(session) {
    studentSession = session?.authenticated ? session : null;
    showCurrentProgress();
    if (!studentSession) {setStatus('課程進度：目前使用這台瀏覽器的舊版／離線進度。'); return;}
    if (syncing) return;
    syncing = true;
    const expectedStudentId = studentSession.student.id;
    const local = cache[expectedStudentId] ||= {};
    setStatus('課程進度：正在與雲端同步…');
    try {
      const localIds = Object.keys(local).filter(id => local[id] && validLessons.has(id));
      if (localIds.length) await request({action:'merge',studentId:expectedStudentId,lessonIds:localIds},expectedStudentId);
      const cloud = await request(null,expectedStudentId);
      if (studentSession?.student?.id !== expectedStudentId) return;
      for (const row of cloud.progress || []) if (validLessons.has(row.lessonId)) local[row.lessonId] = true;
      cache[expectedStudentId] = cleanProgress(local);
      saveCache();
      showCurrentProgress();
      const legacyNote = Object.keys(cleanProgress(legacyProgress)).length ? '；這台電腦的舊版共用進度仍保留，但未自動認領' : '';
      setStatus(`課程進度：已同步（${summary(cache[expectedStudentId])}）${legacyNote}。`);
    } catch(error) {
      if (error.status === 401) {
        studentSession = null;
        showCurrentProgress();
        setStatus('課程進度：學生登入已失效，目前顯示這台瀏覽器的離線進度。');
      } else if (error.status !== 409) setStatus(`課程進度：雲端同步失敗，先使用本機快取。${error.message}`);
    } finally {
      syncing = false;
      if (studentSession?.authenticated && studentSession.student.id !== expectedStudentId) setTimeout(detectSession,0);
    }
  }

  async function detectSession() {
    try {
      const response = await fetch('/api/student-access',{credentials:'same-origin',cache:'no-store',signal:AbortSignal.timeout(12000)});
      const result = await response.json().catch(()=>null);
      if (!response.ok || !result?.authenticated) return syncProgress(null);
      await syncProgress(result);
    } catch {await syncProgress(null);}
  }

  async function recordCompletion() {
    if (!studentSession?.authenticated || !practice?.done) return;
    const lesson = LESSONS.find(item => item.id === lessonId);
    if (!lesson) return;
    const expectedStudentId = studentSession.student.id;
    const local = activeStudentProgress();
    local[lesson.id] = true;
    saveCache();
    const status = document.querySelector('#practice-status')?.textContent || '';
    const speed = Math.max(0,Math.min(10000,Number(status.match(/^(\d+)\s+(?:WPM|CPM)/)?.[1] || 0)));
    const accuracy = Math.max(90,Math.min(100,Number(status.match(/正確率\s+(\d+)%/)?.[1] || 90)));
    setStatus('課程進度：本課已完成，正在同步…');
    try {
      await request({action:'complete',studentId:expectedStudentId,lessonId:lesson.id,accuracy,speed},expectedStudentId);
      if (studentSession?.student?.id === expectedStudentId) setStatus(`課程進度：本課已同步（${summary(local)}）。`);
    } catch(error) {
      if (error.status !== 409 && studentSession?.student?.id === expectedStudentId) setStatus(`課程進度：本課已保存在這台電腦，雲端稍後再同步。${error.message}`);
    }
  }

  window.typingCloudProgress = {
    getProgress:activeStudentProgress,
    sync:detectSession
  };

  document.addEventListener('click',event => {
    if (event.target.closest?.('#complete-lesson')) setTimeout(recordCompletion,0);
  });

  window.addEventListener('online',() => studentSession?.authenticated && syncProgress(studentSession));
  window.addEventListener('typing:student-session',event => syncProgress(event.detail));

  const sessionCopy = document.querySelector('#student-session-copy');
  if (sessionCopy) {
    const observer = new MutationObserver(() => {
      clearTimeout(detectTimer);
      detectTimer = setTimeout(detectSession,250);
    });
    observer.observe(sessionCopy,{subtree:true,childList:true,characterData:true});
  }

  detectSession();
})();
