'use strict';

(() => {
  if (typeof teacherIsActive !== 'function' || typeof escapeHtml !== 'function' || typeof C === 'undefined') return;

  let assignments=[];
  let currentReport=null;
  let loading=false;

  const css=document.createElement('style');
  css.textContent=`
    .report-controls{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;align-items:end}.report-controls label{display:grid;gap:5px}
    .report-actions{display:flex;gap:8px;flex-wrap:wrap;margin:14px 0}.report-summary{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:10px;margin:14px 0}.report-summary>div{border:1px solid var(--line);border-radius:8px;padding:11px}.report-summary span{display:block;color:var(--muted);font-size:.82rem}.report-summary strong{display:block;margin-top:4px}
    .report-table-wrap{overflow:auto}.report-table{width:100%;min-width:1280px;border-collapse:collapse}.report-table th,.report-table td{padding:8px 9px;border-bottom:1px solid var(--line);text-align:left;white-space:nowrap}.report-table th{font-size:.8rem;color:var(--muted);position:sticky;top:0;background:var(--paper)}
    .report-status-completed{font-weight:800}.report-status-overdue{font-weight:800}.report-note{color:var(--muted);font-size:.88rem}
    @media(max-width:900px){.report-controls{grid-template-columns:repeat(2,minmax(0,1fr))}.report-summary{grid-template-columns:repeat(2,minmax(0,1fr))}}
    @media(max-width:520px){.report-controls{grid-template-columns:1fr}.report-summary{grid-template-columns:1fr}}
  `;
  document.head.append(css);

  const statusLabel={completed:'已完成',in_progress:'進行中',not_started:'未開始',overdue:'已逾期'};
  const fmt=value=>value===null||value===undefined?'—':String(value);
  const signed=value=>value===null||value===undefined?'—':`${value>0?'+':''}${value}`;
  const localDay=value=>{
    if(!value)return '';
    const parts=value.split('-').map(Number);if(parts.length!==3||parts.some(n=>!Number.isFinite(n)))return '';
    return new Date(parts[0],parts[1]-1,parts[2],0,0,0,0);
  };
  function paramsFromUI(){
    const params=new URLSearchParams();
    const direct=[['class','#report-class'],['studentId','#report-student'],['assignmentId','#report-assignment'],['language','#report-language'],['duration','#report-duration'],['source','#report-source'],['threshold','#report-threshold']];
    for(const [key,selector] of direct){const value=document.querySelector(selector)?.value;if(value)params.set(key,value);}
    const from=localDay(document.querySelector('#report-from')?.value||'');
    const to=localDay(document.querySelector('#report-to')?.value||'');
    if(from)params.set('from',from.toISOString());
    if(to){to.setHours(23,59,59,999);params.set('to',to.toISOString());}
    return params;
  }
  async function getJson(url){
    const response=await fetch(url,{credentials:'same-origin',cache:'no-store',signal:AbortSignal.timeout(20000)});
    const result=await response.json().catch(()=>null);
    if(response.status===401){showTeacherLogin('教師登入已失效，請重新登入。');throw Error('教師登入已失效。');}
    if(!response.ok||result===null)throw Error(result?.error||'目前無法產生報表。');
    return result;
  }
  async function loadAssignments(){
    if(!teacherIsActive())return;
    try{assignments=await getJson('/api/assignments');refreshAssignmentOptions();}catch(error){console.warn(error);}
  }
  function classes(){return [...new Set(data.students.map(s=>s.className).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'zh-Hant'));}
  function refreshClassOptions(){
    const select=document.querySelector('#report-class');if(!select)return;
    const value=select.value;
    select.innerHTML='<option value="">全部班級</option>'+classes().map(c=>`<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');
    if([...select.options].some(o=>o.value===value))select.value=value;
    refreshStudentOptions();refreshAssignmentOptions();
  }
  function refreshStudentOptions(){
    const select=document.querySelector('#report-student');if(!select)return;
    const className=document.querySelector('#report-class')?.value||'',value=select.value;
    const rows=data.students.filter(s=>!className||s.className===className).sort((a,b)=>(a.seat||'').localeCompare(b.seat||'',undefined,{numeric:true})||a.name.localeCompare(b.name,'zh-Hant'));
    select.innerHTML='<option value="">全部學生</option>'+rows.map(s=>`<option value="${escapeHtml(s.id)}">${escapeHtml(studentLabel(s))}</option>`).join('');
    select.value=[...select.options].some(o=>o.value===value)?value:'';
  }
  function refreshAssignmentOptions(){
    const select=document.querySelector('#report-assignment');if(!select)return;
    const className=document.querySelector('#report-class')?.value||'',value=select.value;
    const rows=assignments.filter(a=>!className||(a.targetClasses||[]).includes(className));
    select.innerHTML='<option value="">不指定作業</option>'+rows.map(a=>`<option value="${escapeHtml(a.id)}">${escapeHtml(a.title)}${a.active?'':'（已停用）'}</option>`).join('');
    select.value=[...select.options].some(o=>o.value===value)?value:'';
  }
  function applyAssignmentDefaults(){
    const id=document.querySelector('#report-assignment')?.value;
    const a=assignments.find(item=>item.id===id);if(!a)return;
    document.querySelector('#report-language').value=a.language;
    document.querySelector('#report-duration').value=String(a.duration);
    document.querySelector('#report-threshold').value=String(a.minAccuracy);
  }

  function filterDescription(result){
    const f=result.filters,a=result.assignment;
    const bits=[f.className?`班級 ${f.className}`:'全部班級',a?`作業：${a.title}`:'未指定作業',f.language==='en'?'英文':'中文',`${f.duration} 秒`,f.source==='builtin'?'標準題庫':'全部來源',`正確率 ≥ ${f.threshold}%`];
    if(f.from)bits.push(`自 ${new Date(f.from).toLocaleDateString('zh-TW')}`);
    if(f.to)bits.push(`至 ${new Date(f.to).toLocaleDateString('zh-TW')}`);
    return bits.join(' ｜ ');
  }
  function render(result){
    currentReport=result;
    const unit=result.filters.language==='en'?'WPM':'CPM',g=result.growthSummary||{},s=result.summary||{};
    document.querySelector('#report-summary').innerHTML=[
      ['學生人數',s.totalStudents??0],['有成長比較',s.studentsWithGrowth??0],['最近平均',g.averageRecent==null?'—':`${g.averageRecent} ${unit}`],['平均進步',g.averageImprovement==null?'—':`${signed(g.averageImprovement)} ${unit}`],['作業已完成',result.assignment?`${s.completedAssignments} / ${s.totalStudents}`:'—']
    ].map(([label,value])=>`<div><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`).join('');
    const rows=result.rows.map(row=>`<tr><td>${escapeHtml(row.className)}</td><td>${escapeHtml(row.seat)}</td><td>${escapeHtml(row.name)}</td><td>${escapeHtml(row.assignmentTitle||'—')}</td><td class="report-status-${row.assignmentStatus||''}">${escapeHtml(row.assignmentStatus?statusLabel[row.assignmentStatus]:'—')}</td><td>${row.validAttempts==null?'—':`${row.validAttempts}/${row.requiredAttempts}`}</td><td>${fmt(row.bestAssignmentSpeed)}</td><td>${row.bestAssignmentAccuracy==null?'—':row.bestAssignmentAccuracy+'%'}</td><td>${fmt(row.firstSpeed)}</td><td>${fmt(row.recentSpeed)}</td><td>${signed(row.improvement)}</td><td>${row.improvementPercent==null?'—':signed(row.improvementPercent)+'%'}</td><td>${escapeHtml(row.topKeyText||'—')}</td></tr>`).join('');
    document.querySelector('#report-detail').innerHTML=result.rows.length?`<p class="report-note">${escapeHtml(filterDescription(result))}</p><div class="report-table-wrap"><table class="report-table"><thead><tr><th>班級</th><th>座號</th><th>姓名</th><th>作業</th><th>狀態</th><th>有效次數</th><th>作業最佳 ${unit}</th><th>作業最佳正確率</th><th>首次 ${unit}</th><th>最近 ${unit}</th><th>進步</th><th>成長率</th><th>常錯鍵</th></tr></thead><tbody>${rows}</tbody></table></div>`:'<div class="empty">目前篩選範圍沒有學生。</div>';
    document.querySelector('#report-status').textContent=`產生時間：${new Date(result.generatedAt).toLocaleString('zh-TW')}`;
    document.querySelector('#report-csv').disabled=!result.rows.length;
    document.querySelector('#report-print').disabled=!result.rows.length;
  }
  async function load(){
    if(!teacherIsActive()||loading)return;
    loading=true;const status=document.querySelector('#report-status');if(status)status.textContent='正在整合報表…';
    try{render(await getJson(`/api/report?${paramsFromUI()}`));}catch(error){currentReport=null;document.querySelector('#report-detail').innerHTML=`<div class="empty">${escapeHtml(error.message)}</div>`;if(status)status.textContent='';}
    finally{loading=false;}
  }
  function downloadCSV(){
    if(!currentReport?.rows?.length)return;
    const unit=currentReport.filters.language==='en'?'WPM':'CPM';
    const headers=['班級','座號','姓名','作業','狀態','有效次數','作業最佳'+unit,'作業最佳正確率','首次'+unit,'最近'+unit,'進步幅度','成長率','常錯鍵'];
    const lines=[headers,...currentReport.rows.map(row=>[
      row.className,row.seat,row.name,row.assignmentTitle||'',row.assignmentStatus?statusLabel[row.assignmentStatus]:'',row.validAttempts==null?'':`${row.validAttempts}/${row.requiredAttempts}`,
      row.bestAssignmentSpeed??'',row.bestAssignmentAccuracy==null?'':row.bestAssignmentAccuracy+'%',row.firstSpeed??'',row.recentSpeed??'',row.improvement??'',row.improvementPercent==null?'':row.improvementPercent+'%',row.topKeyText||''
    ])].map(row=>row.map(C.csvCell).join(','));
    const blob=new Blob(['\uFEFF'+lines.join('\r\n')],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');
    const className=currentReport.filters.className||'all';a.href=url;a.download=`typing-report-${className}-${new Date().toISOString().slice(0,10)}.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  function printReport(){
    if(!currentReport?.rows?.length)return;
    const unit=currentReport.filters.language==='en'?'WPM':'CPM',win=window.open('','_blank','noopener,noreferrer');
    if(!win){toast('瀏覽器阻擋了列印視窗，請允許此網站開啟新視窗後重試。');return;}
    const rows=currentReport.rows.map(row=>`<tr><td>${escapeHtml(row.className)}</td><td>${escapeHtml(row.seat)}</td><td>${escapeHtml(row.name)}</td><td>${escapeHtml(row.assignmentTitle||'—')}</td><td>${escapeHtml(row.assignmentStatus?statusLabel[row.assignmentStatus]:'—')}</td><td>${row.validAttempts==null?'—':`${row.validAttempts}/${row.requiredAttempts}`}</td><td>${fmt(row.bestAssignmentSpeed)}</td><td>${row.bestAssignmentAccuracy==null?'—':row.bestAssignmentAccuracy+'%'}</td><td>${fmt(row.firstSpeed)}</td><td>${fmt(row.recentSpeed)}</td><td>${signed(row.improvement)}</td><td>${row.improvementPercent==null?'—':signed(row.improvementPercent)+'%'}</td><td>${escapeHtml(row.topKeyText||'—')}</td></tr>`).join('');
    const title=`打字練習報表${currentReport.filters.className?'｜'+currentReport.filters.className:''}`;
    win.document.write(`<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>@page{size:A4 landscape;margin:10mm}body{font-family:Arial,"Noto Sans TC",sans-serif;color:#111;font-size:10pt}h1{font-size:18pt;margin:0 0 4mm}.meta{margin:0 0 4mm;color:#444}table{width:100%;border-collapse:collapse;font-size:8.5pt}th,td{border:1px solid #bbb;padding:4px 5px;text-align:left;white-space:nowrap}th{background:#eee}thead{display:table-header-group}.foot{margin-top:4mm;font-size:8pt;color:#555}.no-print{margin-bottom:5mm}@media print{.no-print{display:none}}</style></head><body><button class="no-print" onclick="window.print()">列印／儲存成 PDF</button><h1>${escapeHtml(title)}</h1><p class="meta">${escapeHtml(filterDescription(currentReport))}<br>產生時間：${escapeHtml(new Date(currentReport.generatedAt).toLocaleString('zh-TW'))}</p><table><thead><tr><th>班級</th><th>座號</th><th>姓名</th><th>作業</th><th>狀態</th><th>有效</th><th>作業最佳 ${unit}</th><th>正確率</th><th>首次</th><th>最近</th><th>進步</th><th>成長率</th><th>常錯鍵</th></tr></thead><tbody>${rows}</tbody></table><p class="foot">成長數字依目前報表的語言、秒數、來源、正確率與日期範圍計算；作業狀態依該作業自身門檻判定。常錯鍵為英文聚合錯鍵，不含完整輸入內容。</p></body></html>`);
    win.document.close();win.focus();
  }

  function ensureUI(){
    const teacher=document.querySelector('#teacher');if(!teacher||document.querySelector('.tab[data-panel="report"]'))return;
    const tab=document.createElement('button');tab.className='tab';tab.dataset.panel='report';tab.textContent='報表';teacher.querySelector('.tabs')?.append(tab);
    const panel=document.createElement('div');panel.id='panel-report';panel.className='panel';
    panel.innerHTML=`<div class="card"><div class="card-head"><div><p class="eyebrow">REPORTS / EXPORT</p><h2>班級與個人報表</h2><p>整合作業完成度、成長與英文錯鍵，可下載 CSV 或列印／儲存成 PDF。</p></div></div>
      <div class="report-controls"><label>班級<select id="report-class"><option value="">全部班級</option></select></label><label>學生<select id="report-student"><option value="">全部學生</option></select></label><label>作業<select id="report-assignment"><option value="">不指定作業</option></select></label><label>語言<select id="report-language"><option value="en">英文 WPM</option><option value="zh">中文 CPM</option></select></label><label>測驗時間<select id="report-duration"><option value="15">15 秒</option><option value="30">30 秒</option><option value="60" selected>60 秒</option><option value="120">120 秒</option></select></label><label>來源<select id="report-source"><option value="builtin">標準題庫</option><option value="all">全部來源</option></select></label><label>最低正確率<input id="report-threshold" type="number" min="0" max="100" value="90"></label><label>開始日期<input id="report-from" type="date"></label><label>結束日期<input id="report-to" type="date"></label><button id="report-refresh" class="btn primary" type="button">產生報表</button></div>
      <div class="report-actions"><button id="report-csv" class="btn outline" type="button" disabled>下載 CSV</button><button id="report-print" class="btn outline" type="button" disabled>列印／儲存 PDF</button></div><div id="report-summary" class="report-summary"></div><div id="report-detail"></div><p id="report-status" role="status"></p></div>`;
    teacher.querySelector('#panel-backup')?.insertAdjacentElement('beforebegin',panel)||teacher.append(panel);
    tab.onclick=()=>{teacher.querySelectorAll('.tab').forEach(x=>{x.classList.toggle('active',x===tab);x.setAttribute('aria-pressed',x===tab);});teacher.querySelectorAll('.panel').forEach(x=>x.classList.toggle('active',x===panel));refreshClassOptions();if(!assignments.length)loadAssignments();load();};
    document.querySelector('#report-class').onchange=()=>{refreshStudentOptions();refreshAssignmentOptions();load();};
    document.querySelector('#report-assignment').onchange=()=>{applyAssignmentDefaults();load();};
    for(const id of ['#report-student','#report-language','#report-duration','#report-source','#report-threshold','#report-from','#report-to'])document.querySelector(id).onchange=load;
    document.querySelector('#report-refresh').onclick=load;document.querySelector('#report-csv').onclick=downloadCSV;document.querySelector('#report-print').onclick=printReport;
    refreshClassOptions();if(typeof protectTeacherActions==='function')protectTeacherActions();
  }

  const previousRenderTeacher=renderTeacher;
  renderTeacher=function reportRenderTeacher(){previousRenderTeacher();ensureUI();refreshClassOptions();if(teacherIsActive()&&!assignments.length)loadAssignments();};
  const teacher=document.querySelector('#teacher');if(teacher)new MutationObserver(()=>ensureUI()).observe(teacher,{childList:true,subtree:true});
  ensureUI();
})();
