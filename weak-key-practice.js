'use strict';

(() => {
  if (typeof WeakKeyCore === 'undefined' || typeof show !== 'function' || typeof escapeHtml !== 'function') return;

  let weakKeys = [];
  let refreshTimer = null;
  let refreshing = false;

  const css = document.createElement('style');
  css.textContent = `
    .weak-key-card{margin:20px 0 28px;padding:20px;border:1px solid var(--line);border-radius:8px;background:var(--paper)}
    .weak-key-head{display:flex;justify-content:space-between;gap:16px;align-items:flex-start}.weak-key-list{display:flex;gap:9px;flex-wrap:wrap;margin:14px 0}
    .weak-key-chip{display:grid;place-items:center;min-width:64px;padding:9px 12px;border:1px solid var(--line);border-radius:8px}.weak-key-chip strong{font:900 1.2rem ui-monospace,monospace}.weak-key-chip small{color:var(--muted)}
    .weak-key-actions{display:flex;gap:10px;align-items:end;flex-wrap:wrap}.weak-key-actions label{display:grid;gap:5px}.weak-key-privacy{color:var(--muted);font-size:.9rem;margin-bottom:0}
    @media(max-width:760px){.weak-key-head{display:block}.weak-key-actions{align-items:stretch}.weak-key-actions label,.weak-key-actions select,.weak-key-actions button{width:100%}}
  `;
  document.head.append(css);

  function ensureUI() {
    if (document.querySelector('#weak-key-practice')) return document.querySelector('#weak-key-practice');
    const section = document.createElement('section');
    section.id = 'weak-key-practice';
    section.className = 'weak-key-card';
    section.innerHTML = `<div class="weak-key-head"><div><p class="eyebrow">WEAK KEYS / 個人補強</p><h2>我的弱鍵</h2><p id="weak-key-copy">使用學生啟用碼登入後，系統會依英文測速錯鍵產生個人補強練習。</p></div><button id="weak-key-refresh" class="btn quiet" type="button">更新</button></div>
      <div id="weak-key-list" class="weak-key-list"></div>
      <div class="weak-key-actions"><label>練習時間<select id="weak-key-duration"><option value="60">1 分鐘</option><option value="120">2 分鐘</option></select></label><button id="weak-key-start" class="btn primary" type="button" disabled>開始弱鍵特訓 →</button></div>
      <p id="weak-key-status" role="status"></p><p class="weak-key-privacy">只使用你自己的聚合錯鍵資料產生練習；不讀取或保存完整輸入文章。</p>`;
    const tasks = document.querySelector('#my-tasks');
    if (tasks) tasks.insertAdjacentElement('afterend',section);
    else {
      const overview = document.querySelector('#overview');
      const recent = overview?.querySelector('.recent');
      (recent || overview?.lastElementChild)?.insertAdjacentElement('beforebegin',section);
    }
    document.querySelector('#weak-key-refresh').onclick = refreshWeakKeys;
    document.querySelector('#weak-key-start').onclick = startWeakPractice;
    return section;
  }

  async function getJson(url) {
    const response = await fetch(url,{credentials:'same-origin',cache:'no-store',signal:AbortSignal.timeout(15000)});
    const result = await response.json().catch(()=>null);
    if (!response.ok || result===null) throw Object.assign(Error(result?.error || '目前無法讀取個人弱鍵資料。'),{status:response.status});
    return result;
  }

  function renderLoggedOut() {
    ensureUI(); weakKeys=[];
    document.querySelector('#weak-key-copy').textContent='先在「我的任務」使用老師提供的一次性啟用碼登入，才能查看自己的弱鍵。';
    document.querySelector('#weak-key-list').innerHTML='';
    document.querySelector('#weak-key-start').disabled=true;
    document.querySelector('#weak-key-status').textContent='';
  }

  function renderAnalysis(result) {
    ensureUI();
    weakKeys=(result.keys||[]).slice(0,4);
    const list=document.querySelector('#weak-key-list');
    const start=document.querySelector('#weak-key-start');
    const studentName=result.student?.name ? `「${result.student.name}」` : '你';
    if (!weakKeys.length) {
      list.innerHTML='<div class="empty">目前沒有可用的英文錯鍵資料。完成幾次英文測速後，這裡會開始累積個人弱鍵。</div>';
      document.querySelector('#weak-key-copy').textContent=`${studentName}目前還沒有需要特別補強的鍵位資料。`;
      start.disabled=true;
      return;
    }
    list.innerHTML=weakKeys.map(row=>`<div class="weak-key-chip"><strong>${escapeHtml(WeakKeyCore.displayKey(row.key))}</strong><small>${row.count} 次 · ${escapeHtml(row.finger || '')}</small></div>`).join('');
    const total=result.summary?.totalMistakes||0;
    document.querySelector('#weak-key-copy').textContent=`${studentName}目前最常錯的 ${weakKeys.length} 個鍵。累積錯按 ${total} 次；練習內容會優先重複這些鍵。`;
    start.disabled=false;
  }

  async function refreshWeakKeys() {
    ensureUI();
    if (refreshing) return;
    refreshing=true;
    const status=document.querySelector('#weak-key-status');
    status.textContent='正在更新個人弱鍵…';
    try {
      const session=await getJson('/api/student-access');
      if(!session.authenticated){renderLoggedOut();return;}
      const result=await getJson('/api/mistake-analytics?view=mine');
      renderAnalysis(result);status.textContent='已更新。';
    } catch(error) {
      if(error.status===401){renderLoggedOut();return;}
      status.textContent=error.message;
      document.querySelector('#weak-key-start').disabled=true;
    } finally {refreshing=false;}
  }

  function startWeakPractice() {
    if(!weakKeys.length) return;
    const duration=Number(document.querySelector('#weak-key-duration').value)===120?120:60;
    const text=WeakKeyCore.buildPractice(weakKeys.map(row=>row.key),duration);
    if(!text){toast('目前沒有足夠的弱鍵資料可以產生練習。');return;}
    show('test');
    document.querySelector('#lang [data-value="custom"]')?.click();
    document.querySelector(`#duration [data-value="${duration}"]`)?.click();
    const editor=document.querySelector('#custom-text');
    if(editor) editor.value=text;
    document.querySelector('#apply-custom')?.click();
    const names=WeakKeyCore.normalizeTargetKeys(weakKeys.map(row=>row.key)).map(WeakKeyCore.displayKey).join('、');
    const state=document.querySelector('#test-state');
    if(state) state.textContent=`弱鍵特訓：${names}。先求準確，再慢慢加速。輸入第一個字才開始計時。`;
    document.querySelector('#test-input')?.focus();
  }

  function scheduleRefresh(delay=250){clearTimeout(refreshTimer);refreshTimer=setTimeout(refreshWeakKeys,delay);}

  ensureUI();
  refreshWeakKeys();
  document.addEventListener('click',event=>{
    const view=event.target.closest?.('[data-view]')?.dataset?.view;
    if(view==='overview') scheduleRefresh(100);
  },true);
  const overview=document.querySelector('#overview');
  if(overview){
    const observer=new MutationObserver(mutations=>{
      if(mutations.some(m=>m.target.closest?.('#my-tasks'))) scheduleRefresh(300);
    });
    observer.observe(overview,{childList:true,subtree:true,characterData:true});
  }
})();
