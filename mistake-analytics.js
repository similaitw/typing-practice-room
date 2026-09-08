'use strict';

(() => {
  if (typeof publishRecord !== 'function' || typeof fingerFor !== 'function' || typeof escapeHtml !== 'function') return;

  const input = document.querySelector('#test-input');
  if (!input) return;
  let roundMistakes = new Map();

  const css = document.createElement('style');
  css.textContent = `
    .mistake-result{margin-top:16px;padding:14px;border:1px solid var(--line);border-radius:8px;background:var(--paper)}
    .mistake-result h3{margin:0 0 8px}.mistake-chips{display:flex;gap:8px;flex-wrap:wrap;margin:10px 0}.mistake-chip{padding:5px 9px;border:1px solid var(--line);border-radius:999px;font-weight:800}
    .mistake-analysis-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px;margin-top:16px}.mistake-analysis-grid>div{padding:14px;border:1px solid var(--line);border-radius:8px}
    .mistake-bars{display:grid;gap:8px}.mistake-bar{display:grid;grid-template-columns:minmax(90px,auto) 1fr auto;gap:10px;align-items:center}.mistake-bar-track{height:10px;background:#ecece7;border-radius:99px;overflow:hidden}.mistake-bar-fill{height:100%;background:currentColor;border-radius:99px}
    .mistake-table{width:100%;border-collapse:collapse}.mistake-table th,.mistake-table td{padding:8px;border-bottom:1px solid var(--line);text-align:left}.mistake-note{color:var(--muted);font-size:.9rem}
    @media(max-width:760px){.mistake-analysis-grid{grid-template-columns:1fr}.mistake-bar{grid-template-columns:80px 1fr auto}}
  `;
  document.head.append(css);

  const visibleKey = key => key === ' ' ? 'Space' : key;
  const pairKey = (expected,actual) => `${expected}\u0000${actual}`;
  const fingerName = key => fingerFor(typeof shiftedKeys !== 'undefined' && shiftedKeys[key] ? shiftedKeys[key] : key);
  const snapshotMistakes = () => [...roundMistakes.entries()]
    .map(([key,count]) => {const [expected,actual]=key.split('\u0000'); return [expected,actual,count];})
    .sort((a,b) => b[2]-a[2] || a[0].localeCompare(b[0]) || a[1].localeCompare(b[1])).slice(0,100);

  input.addEventListener('keydown', event => {
    if (document.activeElement !== input || test?.language !== 'en' || test?.finished || test?.composing) return;
    if (event.ctrlKey || event.metaKey || event.altKey || Array.from(event.key || '').length !== 1) return;
    if (!test.started && input.value === '') roundMistakes = new Map();
    const start = input.selectionStart ?? input.value.length;
    const end = input.selectionEnd ?? start;
    if (start !== end) return;
    const expected = test.text?.[start];
    if (!expected || expected === '\n' || expected === '\r' || expected === '\t') return;
    const actual = event.key;
    if (actual === expected) return;
    const key = pairKey(expected,actual);
    roundMistakes.set(key,(roundMistakes.get(key)||0)+1);
  }, true);

  function diagnosticFrom(mistakes) {
    const fingers = new Map();
    let total = 0;
    for (const [expected,,count] of mistakes || []) {
      const finger = fingerName(expected);
      fingers.set(finger,(fingers.get(finger)||0)+count);
      total += count;
    }
    return {total,fingers:[...fingers.entries()].sort((a,b)=>b[1]-a[1])};
  }

  function renderStudentDiagnostic(mistakes) {
    const panel = document.querySelector('#result-panel');
    if (!panel || panel.hidden || test?.language !== 'en') return;
    panel.querySelector('.mistake-result')?.remove();
    const wrap = document.createElement('section');
    wrap.className = 'mistake-result';
    const analysis = diagnosticFrom(mistakes);
    if (!mistakes.length) {
      wrap.innerHTML = '<h3>鍵位診斷</h3><p>這次沒有偵測到錯按的英文字元鍵，保持這個準確度。</p><p class="mistake-note">診斷只記錄錯鍵配對與次數，不保存完整輸入內容。</p>';
    } else {
      const topPairs = mistakes.slice(0,5).map(([expected,actual,count]) => `<span class="mistake-chip">${escapeHtml(visibleKey(expected))} → ${escapeHtml(visibleKey(actual))} × ${count}</span>`).join('');
      const topFinger = analysis.fingers[0];
      wrap.innerHTML = `<h3>鍵位診斷</h3><p>本次偵測到 <strong>${analysis.total}</strong> 次錯按。${topFinger ? `最需要留意：<strong>${escapeHtml(topFinger[0])}</strong>。` : ''}</p><div class="mistake-chips">${topPairs}</div><p class="mistake-note">這裡統計按鍵當下的錯誤，因此即使用 Backspace 修正仍會列入；只保存錯鍵配對與次數，不保存完整輸入內容。</p>`;
    }
    panel.append(wrap);
  }

  const previousPublishRecord = publishRecord;
  publishRecord = function mistakePublishRecord(record) {
    const mistakes = record.language === 'en' ? snapshotMistakes() : [];
    record.mistakes = mistakes;
    if (typeof save === 'function') save();
    const result = previousPublishRecord(record);
    setTimeout(() => renderStudentDiagnostic(mistakes), 0);
    return result;
  };

  async function analyticsRequest(params = {}) {
    const search = new URLSearchParams();
    for (const [key,value] of Object.entries(params)) if (value) search.set(key,value);
    const response = await fetch(`/api/mistake-analytics?${search}`,{credentials:'same-origin',cache:'no-store',signal:AbortSignal.timeout(15000)});
    const result = await response.json().catch(()=>null);
    if (response.status === 401) {showTeacherLogin('教師登入已失效，請重新登入。'); throw Error('教師登入已失效。');}
    if (!response.ok || result === null) throw Error(result?.error || '目前無法讀取錯鍵分析。');
    return result;
  }

  function classOptions() {
    return [...new Set(data.students.map(s=>s.className).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'zh-Hant'));
  }

  function ensureTeacherUI() {
    const teacher = document.querySelector('#teacher');
    if (!teacher || document.querySelector('.tab[data-panel="mistakes"]')) return;
    const tabs = teacher.querySelector('.tabs');
    const tab = document.createElement('button');
    tab.className='tab'; tab.dataset.panel='mistakes'; tab.textContent='錯鍵分析';
    tabs?.append(tab);
    const panel=document.createElement('div');
    panel.id='panel-mistakes';panel.className='panel';
    panel.innerHTML=`<div class="card"><div class="card-head"><div><p class="eyebrow">MISTAKE ANALYTICS</p><h2>英文錯鍵與手指弱點</h2><p>只分析英文測速的聚合錯鍵，不保存學生完整輸入文章。</p></div></div>
      <div class="dashboard-controls"><label>班級<select id="mistake-class"><option value="">全部班級</option></select></label><label>學生<select id="mistake-student"><option value="">全部學生</option></select></label><button id="mistake-refresh" class="btn primary" type="button">更新分析</button><span id="mistake-status" role="status"></span></div>
      <div id="mistake-summary" class="dashboard-summary"></div><div id="mistake-detail"></div></div>`;
    teacher.querySelector('#panel-backup')?.insertAdjacentElement('beforebegin',panel);
    tab.onclick=()=>{
      teacher.querySelectorAll('.tab').forEach(x=>{x.classList.toggle('active',x===tab);x.setAttribute('aria-pressed',x===tab);});
      teacher.querySelectorAll('.panel').forEach(x=>x.classList.toggle('active',x===panel));
      refreshFilters(); loadTeacherAnalysis();
    };
    document.querySelector('#mistake-class').onchange=()=>{refreshStudentFilter();loadTeacherAnalysis();};
    document.querySelector('#mistake-student').onchange=loadTeacherAnalysis;
    document.querySelector('#mistake-refresh').onclick=loadTeacherAnalysis;
    refreshFilters();
    if (typeof protectTeacherActions === 'function') protectTeacherActions();
  }

  function refreshFilters() {
    const select=document.querySelector('#mistake-class');
    if(!select)return;
    const value=select.value;
    select.innerHTML='<option value="">全部班級</option>'+classOptions().map(c=>`<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');
    if([...select.options].some(o=>o.value===value))select.value=value;
    refreshStudentFilter();
  }

  function refreshStudentFilter() {
    const className=document.querySelector('#mistake-class')?.value || '';
    const select=document.querySelector('#mistake-student');
    if(!select)return;
    const value=select.value;
    const students=data.students.filter(s=>!className || s.className===className).sort((a,b)=>(a.seat||'').localeCompare(b.seat||'',undefined,{numeric:true}) || a.name.localeCompare(b.name,'zh-Hant'));
    select.innerHTML='<option value="">全部學生</option>'+students.map(s=>`<option value="${escapeHtml(s.id)}">${escapeHtml(studentLabel(s))}</option>`).join('');
    select.value=[...select.options].some(o=>o.value===value)?value:'';
  }

  const barRows = (rows,labelFn) => {
    const max=Math.max(1,...rows.map(row=>row.count));
    return rows.map(row=>`<div class="mistake-bar"><strong>${labelFn(row)}</strong><span class="mistake-bar-track"><span class="mistake-bar-fill" style="display:block;width:${Math.max(4,Math.round(row.count/max*100))}%"></span></span><span>${row.count}</span></div>`).join('');
  };

  function renderTeacherAnalysis(result) {
    const topKey=result.keys[0],topFinger=result.fingers[0];
    document.querySelector('#mistake-summary').innerHTML=[
      ['有錯鍵的測驗',result.summary.recordsWithMistakes],['錯按總次數',result.summary.totalMistakes],['最常錯的鍵',topKey?visibleKey(topKey.key):'—'],['最需留意手指',topFinger?topFinger.finger:'—'],['更新時間',new Date(result.generatedAt).toLocaleTimeString('zh-TW')]
    ].map(([label,value])=>`<div><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`).join('');
    if(!result.summary.totalMistakes){document.querySelector('#mistake-detail').innerHTML='<div class="empty">目前篩選範圍沒有英文錯鍵資料。新完成的英文測速會開始累積診斷。</div>';return;}
    const pairRows=result.pairs.slice(0,20).map(row=>`<tr><td>${escapeHtml(visibleKey(row.expected))}</td><td>${escapeHtml(visibleKey(row.actual))}</td><td>${escapeHtml(row.finger)}</td><td>${row.count}</td></tr>`).join('');
    document.querySelector('#mistake-detail').innerHTML=`<div class="mistake-analysis-grid"><div><h3>最常錯的預期鍵</h3><div class="mistake-bars">${barRows(result.keys.slice(0,10),row=>escapeHtml(visibleKey(row.key)))}</div></div><div><h3>手指錯按分布</h3><div class="mistake-bars">${barRows(result.fingers,row=>escapeHtml(row.finger))}</div></div></div><div style="margin-top:16px;overflow:auto"><h3>常見錯鍵配對</h3><table class="mistake-table"><thead><tr><th>應按</th><th>實際按</th><th>負責手指</th><th>次數</th></tr></thead><tbody>${pairRows}</tbody></table></div>`;
  }

  let analyticsLoading=false;
  async function loadTeacherAnalysis() {
    if(!teacherIsActive()||analyticsLoading)return;
    const status=document.querySelector('#mistake-status'); if(!status)return;
    analyticsLoading=true; status.textContent='正在分析…';
    try{
      const result=await analyticsRequest({class:document.querySelector('#mistake-class').value,studentId:document.querySelector('#mistake-student').value});
      renderTeacherAnalysis(result);status.textContent='分析完成。';
    }catch(error){document.querySelector('#mistake-detail').innerHTML=`<div class="empty">${escapeHtml(error.message)}</div>`;status.textContent='';}
    finally{analyticsLoading=false;}
  }

  const previousRenderTeacher=renderTeacher;
  renderTeacher=function mistakeRenderTeacher(){previousRenderTeacher();ensureTeacherUI();refreshFilters();};
  const observer=new MutationObserver(()=>ensureTeacherUI());
  const teacher=document.querySelector('#teacher'); if(teacher)observer.observe(teacher,{childList:true,subtree:true});
  ensureTeacherUI();
})();
