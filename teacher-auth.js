'use strict';
let teacherSession = {authenticated:false,expiresAt:0};
let teacherExpiryTimer;
const loginDialog = document.querySelector('#teacher-login');
const loginMessage = document.querySelector('#teacher-login-message');
async function teacherRequest(body) {
  const response = await fetch('/api/teacher',{
    method:body ? 'POST' : 'GET',credentials:'same-origin',cache:'no-store',
    headers:body ? {'Content-Type':'application/json'} : {},
    ...(body ? {body:JSON.stringify(body)} : {}),signal:AbortSignal.timeout(12000)
  });
  const result = await response.json().catch(() => null);
  if (!response.ok || !result) throw Error(result?.error || '目前無法連線至教師登入服務，請使用正式網站稍後再試。');
  return result;
}
function teacherIsActive() {return teacherSession.authenticated && teacherSession.expiresAt > Date.now();}
function setTeacherSession(session) {
  teacherSession = session;
  clearTimeout(teacherExpiryTimer);
  if (teacherIsActive()) teacherExpiryTimer = setTimeout(() => {
    lockTeacher(); toast('教師登入已到期，請重新登入。');
  },Math.max(0,session.expiresAt - Date.now()));
}
function lockTeacher() {
  setTeacherSession({authenticated:false,expiresAt:0});
  document.querySelector('#teacher-password').value = '';
  document.querySelector('#teacher-change-password').reset();
  document.querySelector('#teacher-change-message').textContent = '';
  if (document.querySelector('#teacher').classList.contains('active')) show('overview');
}
function showTeacherLogin(message = '') {
  lockTeacher();
  loginMessage.textContent = message;
  if (!loginDialog.open) loginDialog.showModal();
  document.querySelector('#teacher-password').focus();
}
async function openTeacher() {
  try {
    const session = await teacherRequest();
    if (!session.authenticated) return showTeacherLogin();
    setTeacherSession(session); show('teacher',true);
  } catch (error) {showTeacherLogin(error.message);}
}
// Every teacher action rechecks the signed server session, including across tabs.
function protectTeacherActions() {
  document.querySelectorAll('#teacher button, #teacher input, #teacher select').forEach(el => {
    if (el.id === 'teacher-logout') return;
    for (const property of ['onclick','onchange']) {
      const original = el[property];
      if (!original || original.teacherProtected) continue;
      const guarded = async function(event) {
        event.preventDefault();
        try {
          const session = await teacherRequest();
          if (!session.authenticated) return showTeacherLogin('請先登入教師端再操作。');
          setTeacherSession(session);
          return await original.call(this,event);
        } catch(error) {showTeacherLogin(error.message);}
      };
      guarded.teacherProtected = true;
      el[property] = guarded;
    }
  });
}
document.querySelector('#teacher-login-form').onsubmit = async event => {
  event.preventDefault();
  const button = document.querySelector('#teacher-login-submit');
  button.disabled = true; loginMessage.textContent = '正在驗證…';
  try {
    const session = await teacherRequest({action:'login',password:document.querySelector('#teacher-password').value});
    document.querySelector('#teacher-password').value = '';
    setTeacherSession(session); loginDialog.close(); show('teacher',true);
  } catch(error) {loginMessage.textContent = error.message;}
  finally {button.disabled = false;}
};
document.querySelector('#teacher-login-cancel').onclick = () => loginDialog.close();
loginDialog.addEventListener('close',() => {document.querySelector('#teacher-password').value = '';});
document.querySelector('#teacher-logout').onclick = async () => {
  try {await teacherRequest({action:'logout'}); lockTeacher(); toast('已登出教師端。');}
  catch(error) {toast('登出未完成，請保持此頁並重試。' + error.message);}
};
document.querySelector('#teacher-change-password').onsubmit = async event => {
  event.preventDefault();
  const form = event.currentTarget, button = document.querySelector('#teacher-change-submit');
  const message = document.querySelector('#teacher-change-message');
  const newPassword = document.querySelector('#teacher-new-password').value;
  const confirmPassword = document.querySelector('#teacher-confirm-password').value;
  if (newPassword !== confirmPassword) {message.textContent = '兩次輸入的新密碼不一致。'; return;}
  button.disabled = true; message.textContent = '正在更新密碼…';
  try {
    const result = await teacherRequest({action:'change-password',currentPassword:document.querySelector('#teacher-current-password').value,newPassword,confirmPassword});
    if (!result.passwordChanged) throw Error('未收到密碼更新確認，請稍後再試。');
    form.reset();
    showTeacherLogin('密碼已更新，請使用新密碼重新登入。');
  } catch(error) {message.textContent = error.message;}
  finally {button.disabled = false;}
};
document.addEventListener('visibilitychange',() => {
  if (!document.hidden && document.querySelector('#teacher').classList.contains('active')) openTeacher();
});

// app.js is parsed after this file. Load optional cloud modules only after its global helpers exist.
window.addEventListener('load', () => {
  const loadReport = () => {
    if (document.querySelector('script[data-teacher-report]')) return;
    const script = document.createElement('script');
    script.src = 'report.js';
    script.dataset.teacherReport = 'true';
    script.async = false;
    script.onerror = () => console.warn('report.js could not be loaded; growth analytics and existing teacher tools remain available.');
    document.body.append(script);
  };
  const loadGrowth = () => {
    if (document.querySelector('script[data-growth-analytics]')) return loadReport();
    const script = document.createElement('script');
    script.src = 'growth-analytics.js';
    script.dataset.growthAnalytics = 'true';
    script.async = false;
    script.onload = loadReport;
    script.onerror = () => {
      console.warn('growth-analytics.js could not be loaded; existing teacher tools remain available.');
      loadReport();
    };
    document.body.append(script);
  };
  const loadWeakPractice = () => {
    const loadUI = () => {
      if (document.querySelector('script[data-weak-key-practice]')) return loadGrowth();
      const script = document.createElement('script');
      script.src = 'weak-key-practice.js';
      script.dataset.weakKeyPractice = 'true';
      script.async = false;
      script.onload = loadGrowth;
      script.onerror = () => {
        console.warn('weak-key-practice.js could not be loaded; mistake analytics remains available.');
        loadGrowth();
      };
      document.body.append(script);
    };
    if (typeof WeakKeyCore !== 'undefined' || document.querySelector('script[data-weak-key-core]')) return loadUI();
    const core = document.createElement('script');
    core.src = 'weak-key-core.js';
    core.dataset.weakKeyCore = 'true';
    core.async = false;
    core.onload = loadUI;
    core.onerror = () => {
      console.warn('weak-key-core.js could not be loaded; weak-key practice is unavailable.');
      loadGrowth();
    };
    document.body.append(core);
  };
  const loadMistakes = () => {
    if (document.querySelector('script[data-mistake-analytics]')) return loadWeakPractice();
    const script = document.createElement('script');
    script.src = 'mistake-analytics.js';
    script.dataset.mistakeAnalytics = 'true';
    script.async = false;
    script.onload = loadWeakPractice;
    script.onerror = () => {
      console.warn('mistake-analytics.js could not be loaded; typing and assignments remain available.');
      loadWeakPractice();
    };
    document.body.append(script);
  };
  const loadDashboard = () => {
    if (document.querySelector('script[data-assignment-dashboard]')) return loadMistakes();
    const script = document.createElement('script');
    script.src = 'assignment-dashboard.js';
    script.dataset.assignmentDashboard = 'true';
    script.async = false;
    script.onload = loadMistakes;
    script.onerror = () => {
      console.warn('assignment-dashboard.js could not be loaded; assignment management remains available.');
      loadMistakes();
    };
    document.body.append(script);
  };
  const loadAssignments = () => {
    if (document.querySelector('script[data-assignments]')) return loadDashboard();
    const script = document.createElement('script');
    script.src = 'assignments.js';
    script.dataset.assignments = 'true';
    script.async = false;
    script.onload = loadDashboard;
    script.onerror = () => {
      console.warn('assignments.js could not be loaded; base typing practice remains available.');
      loadDashboard();
    };
    document.body.append(script);
  };
  if (document.querySelector('script[data-cloud-students]')) return loadAssignments();
  const cloudStudentsScript = document.createElement('script');
  cloudStudentsScript.src = 'cloud-students.js';
  cloudStudentsScript.dataset.cloudStudents = 'true';
  cloudStudentsScript.async = false;
  cloudStudentsScript.onload = loadAssignments;
  cloudStudentsScript.onerror = () => {
    console.warn('cloud-students.js could not be loaded; local roster remains available.');
    loadAssignments();
  };
  document.body.append(cloudStudentsScript);
});
