'use strict';

(() => {
  if (typeof teacherIsActive !== 'function' || typeof escapeHtml !== 'function') return;

  const css=document.createElement('style');
  css.textContent=`
    .growth-controls{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;align-items:end}.growth-controls label{display:grid;gap:5px}
    .growth-summary{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:10px;margin:16px 0}.growth-summary>div{padding:12px;border:1px solid var(--line);border-radius:8px}.growth-summary span{display:block;color:var(--muted);font-size:.82rem}.growth-summary strong{display:block;margin-top:4px;font-size:1.08rem}
    .growth-table-wrap{overflow:auto}.growth-table{width:100%;border-collapse:collapse;min-width:920px}.growth-table th,.growth-table td{padding:8px 9px;border-bottom:1px solid var(--line);text-align:left;white-space:nowrap}.growth-table th{font-size:.82rem;color:var(--muted)}
    .growth-positive{font-weight:800}.growth-negative{font-weight:800}.growth-neutral{color:var(--muted)}.growth-note{color:var(--muted);font-size:.9rem}
    @media(max-width:900px){.growth-controls{grid-template-columns:repeat(2,minmax(0,1fr))}.growth-summary{grid-template-columns:repeat(2,minmax(0,1fr))}}
    @media(max-width:520px){.growth-controls{grid-template-columns:1fr}.growth-summary{grid-template-columns:1fr}}
  `;
  document.head.append(css);

  async function requestGrowth(){
    const params=new URLSearchParams();
    for(const [name,selector] of [['class','#growth-class'],['studentId','#growth-student'],['language','#growth-language'],['duration','#growth-duration'],['source','#growth-source'],['threshold','#growth-threshold']]){
      const value=document.querySelector(selector)?.value;if(value)params.set(name,value);
    }
    const from=document.querySelector('#growth-from')?.value,to=document.querySelector('#growth-to')?.value;
    if(from)params.set('from',new Date(`${from}T00:00:00`).toISOString());
    if(to)params.set('to',new Date(`${to}T23:59:59.999`).toISOString());
    const response=await fetch(`/api/growth-analytics?${params}`,{credentials:'same-origin',cache:'no-store',signal:AbortSignal.timeout(15000)});
    const result=await response.json().catch(()=>null);
    if(response.status===401){showTeacherLogin('教師登入已失效，請重新登入。');throw Error('教師登入已失效。');}
    if(!response.ok||result===null)throw Error(result?.error||'目前無法讀取成長分析。');
    return result;
  }

  function classes(){return [...new Set(data.students.map(s=>s.className).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'zh-Hant'));}
  function refreshClassOptions(){
    const select=document.querySelector('#growth-class');if(!select)return;
    const value=select.value;
    select.innerHTML='<option value="">全部班級</option>'+classes().map(c=>`<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');
    if([...select.options].some(o=>o.value===value))select.value=value;
    refreshStudentOptions();
  }
  function refreshStudentOptions(){
    const select=document.querySelector('#growth-student');if(!select)return;
    const className=document.querySelector('#growth-class')?.value||'',value=select.value;
    const rows=data.students.filter(s=>!className||s.className===className).sort((a,b)=>(a.seat||'').localeCompare(b.seat||'',undefined,{numeric:true})||a.name.localeCompare(b.name,'zh-Hant'));
    select.innerHTML='<option value="">全部學生</option>'+rows.map(s=>`<option value="${escapeHtml(s.id)}">${escapeHtml(studentLabel(s))}</option>`).join('');
    select.value=[...select.options].some(o=>o.value===value)?value:'';
  }
  const fmt=value=>value===null||value===undefined?'—':String(value);
  const changeClass=value=>value===null?'growth-neutral':value>0?'growth-positive':value<0?'growth-negative':'growth-neutral';
  const signed=value=>value===null?'—':`${value>0?'+':''}${value}`;

  function render(result){
    const unit=result.filters.language==='en'?'WPM':'CPM',s=result.summary;
    document.querySelector('#growth-summary').innerHTML=[
      ['有紀錄學生',`${s.studentsWithRecords} / ${s.totalStudents}（${s.participationRate}%）`],
      ['最新平均',s.averageRecent===null?'—':`${s.averageRecent} ${unit}`],
      ['最新中位數',s.medianRecent===null?'—':`${s.medianRecent} ${unit}`],
      ['平均進步',s.averageImprovement===null?'—':`${signed(s.averageImprovement)} ${unit}`],
      ['平均成長率',s.averageImprovementPercent===null?'—':`${signed(s.averageImprovementPercent)}%`],
      ['平均正確率',s.averageAccuracy===null?'—':`${s.averageAccuracy}%`]
    ].map(([label,value])=>`<div><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`).join('');
    const tbody=result.students.map(row=>`<tr><td>${escapeHtml(row.className||'')}</td><td>${escapeHtml(row.seat||'')}</td><td>${escapeHtml(row.name)}</td><td>${row.tests}</td><td>${fmt(row.firstSpeed)}</td><td>${fmt(row.recentSpeed)}</td><td class="${changeClass(row.improvement)}">${signed(row.improvement)}</td><td class="${changeClass(row.improvementPercent)}">${row.improvementPercent===null?'—':signed(row.improvementPercent)+'%'}</td><td>${fmt(row.bestSpeed)}</td><td>${row.averageAccuracy===null?'—':row.averageAccuracy+'%'}</td></tr>`).join('');
    const sourceCopy=result.filters.source==='all'?'標準題庫＋自訂文章':'只含標準題庫';
    document.querySelector('#growth-detail').innerHTML=result.students.length?`<div class="growth-table-wrap"><table class="growth-table"><thead><tr><th>班級</th><th>座號</th><th>姓名</th><th>有效測驗</th><th>首次 ${unit}</th><th>最近 ${unit}</th><th>變化</th><th>成長率</th><th>最佳</th><th>平均正確率</th></tr></thead><tbody>${tbody}</tbody></table></div><p class="growth-note">${sourceCopy}。首次與最近都只在目前相同語言、秒數、正確率門檻與日期範圍內比較；只有 1 筆有效紀錄時不計成長率。班級平均與中位數以每位學生的最近值計算，不會讓練習次數多的學生被重複加權。</p>`:'<div class="empty">目前篩選範圍沒有學生。</div>';
    document.querySelector('#growth-status').textContent=`更新：${new Date(result.generatedAt).toLocaleTimeString('zh-TW')}`;
  }

  let loading=false;
  async function load(){
    if(!teacherIsActive()||loading)return;
    loading=true;const status=document.querySelector('#growth-status');if(status)status.textContent='正在分析…';
    try{render(await requestGrowth());}catch(error){document.querySelector('#growth-detail').innerHTML=`<div class="empty">${escapeHtml(error.message)}</div>`;if(status)status.textContent='';}
    finally{loading=false;}
  }

  function ensureUI(){
    const teacher=document.querySelector('#teacher');if(!teacher||document.querySelector('.tab[data-panel="growth"]'))return;
    const tab=document.createElement('button');tab.className='tab';tab.dataset.panel='growth';tab.textContent='成長分析';teacher.querySelector('.tabs')?.append(tab);
    const panel=document.createElement('div');panel.id='panel-growth';panel.className='panel';
    panel.innerHTML=`<div class="card"><div class="card-head"><div><p class="eyebrow">GROWTH ANALYTICS</p><h2>班級與個人成長分析</h2><p>同語言、同秒數分開比較，避免把不同測驗條件混在一起。</p></div></div>
      <div class="growth-controls"><label>班級<select id="growth-class"><option value="">全部班級</option></select></label><label>學生<select id="growth-student"><option value="">全部學生</option></select></label><label>語言<select id="growth-language"><option value="en">英文 WPM</option><option value="zh">中文 CPM</option></select></label><label>測驗時間<select id="growth-duration"><option value="15">15 秒</option><option value="30">30 秒</option><option value="60" selected>60 秒</option><option value="120">120 秒</option></select></label><label>測驗來源<select id="growth-source"><option value="builtin" selected>標準題庫</option><option value="all">全部來源</option></select></label><label>最低正確率<input id="growth-threshold" type="number" min="0" max="100" value="90"></label><label>開始日期<input id="growth-from" type="date"></label><label>結束日期<input id="growth-to" type="date"></label><button id="growth-refresh" class="btn primary" type="button">更新分析</button></div>
      <div id="growth-summary" class="growth-summary"></div><div id="growth-detail"></div><p id="growth-status" role="status"></p></div>`;
    teacher.querySelector('#panel-backup')?.insertAdjacentElement('beforebegin',panel) || teacher.append(panel);
    tab.onclick=()=>{teacher.querySelectorAll('.tab').forEach(x=>{x.classList.toggle('active',x===tab);x.setAttribute('aria-pressed',x===tab);});teacher.querySelectorAll('.panel').forEach(x=>x.classList.toggle('active',x===panel));refreshClassOptions();load();};
    document.querySelector('#growth-class').onchange=()=>{refreshStudentOptions();load();};
    for(const id of ['#growth-student','#growth-language','#growth-duration','#growth-source','#growth-threshold','#growth-from','#growth-to'])document.querySelector(id).onchange=load;
    document.querySelector('#growth-refresh').onclick=load;
    refreshClassOptions();
    if(typeof protectTeacherActions==='function')protectTeacherActions();
  }

  const previousRenderTeacher=renderTeacher;
  renderTeacher=function growthRenderTeacher(){previousRenderTeacher();ensureUI();refreshClassOptions();};
  const teacher=document.querySelector('#teacher');if(teacher)new MutationObserver(()=>ensureUI()).observe(teacher,{childList:true,subtree:true});
  ensureUI();
})();
