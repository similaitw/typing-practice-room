'use strict';

(() => {
  if (typeof escapeHtml !== 'function' || typeof publishRecord !== 'function') return;

  let current=null;
  let loading=false;
  let refreshTimer=null;

  const css=document.createElement('style');
  css.textContent=`
    .my-records-card{margin:20px 0 28px;padding:20px;border:1px solid var(--line);border-radius:8px;background:var(--paper)}
    .my-records-head{display:flex;justify-content:space-between;gap:16px;align-items:flex-start}.my-records-controls{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin:14px 0;align-items:end}.my-records-controls label{display:grid;gap:5px}
    .my-records-summary{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:9px;margin:14px 0}.my-records-summary>div{padding:11px;border:1px solid var(--line);border-radius:8px}.my-records-summary span{display:block;color:var(--muted);font-size:.8rem}.my-records-summary strong{display:block;margin-top:4px}
    .my-records-chart{border:1px solid var(--line);border-radius:8px;padding:12px;overflow:auto}.my-records-chart svg{display:block;width:100%;min-width:560px;height:auto}.my-records-chart text{font-size:11px;fill:currentColor}.my-records-chart .grid{stroke:currentColor;opacity:.13}.my-records-chart .trend-line{fill:none;stroke:currentColor;stroke-width:3}.my-records-chart .trend-dot{fill:currentColor}
    .my-records-recent{display:grid;gap:7px;margin-top:12px}.my-records-row{display:grid;grid-template-columns:minmax(110px,1fr) auto auto minmax(120px,auto);gap:10px;align-items:center;padding:8px 0;border-bottom:1px solid var(--line)}
    .my-records-weak{margin-top:14px;padding:12px;border:1px solid var(--line);border-radius:8px}.my-records-weak-list{display:flex;gap:8px;flex-wrap:wrap;margin-top:8px}.my-records-weak-list span{padding:5px 8px;border:1px solid var(--line);border-radius:99px}.my-records-note{color:var(--muted);font-size:.88rem}
    @media(max-width:820px){.my-records-controls{grid-template-columns:repeat(2,minmax(0,1fr))}.my-records-summary{grid-template-columns:repeat(2,minmax(0,1fr))}.my-records-row{grid-template-columns:1fr auto auto}.my-records-row small{grid-column:1/-1}}
    @media(max-width:520px){.my-records-head{display:block}.my-records-controls{grid-template-columns:1fr}.my-records-summary{grid-template-columns:1fr}}
  `;
  document.head.append(css);

  const signed=value=>value==null?'—':`${value>0?'+':''}${value}`;
  const fmtDate=value=>new Date(value).toLocaleString('zh-TW',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'});

  function ensureUI(){
    if(document.querySelector('#my-records'))return document.querySelector('#my-records');
    const section=document.createElement('section');
    section.id='my-records';section.className='my-records-card';
    section.innerHTML=`<div class="my-records-head"><div><p class="eyebrow">MY RECORDS / 學習歷程</p><h2>我的紀錄</h2><p id="my-records-copy">使用學生啟用碼登入後，可以查看自己的測速趨勢。</p></div><button id="my-records-refresh" class="btn quiet" type="button">更新</button></div>
      <div id="my-records-controls" class="my-records-controls" hidden><label>語言<select id="my-records-language"><option value="en">英文 WPM</option><option value="zh">中文 CPM</option></select></label><label>測驗時間<select id="my-records-duration"><option value="15">15 秒</option><option value="30">30 秒</option><option value="60" selected>60 秒</option><option value="120">120 秒</option></select></label><label>來源<select id="my-records-source"><option value="builtin">標準題庫</option><option value="all">全部練習</option></select></label><label>最低正確率<select id="my-records-threshold"><option value="0">全部完成測驗</option><option value="80">80%</option><option value="90">90%</option><option value="95">95%</option></select></label></div>
      <div id="my-records-summary" class="my-records-summary"></div><div id="my-records-chart"></div><div id="my-records-weak"></div><div id="my-records-recent"></div><p id="my-records-status" role="status"></p>`;
    const weak=document.querySelector('#weak-key-practice'),tasks=document.querySelector('#my-tasks'),overview=document.querySelector('#overview');
    if(weak)weak.insertAdjacentElement('afterend',section);else if(tasks)tasks.insertAdjacentElement('afterend',section);else overview?.append(section);
    document.querySelector('#my-records-refresh').onclick=refresh;
    for(const id of ['my-records-language','my-records-duration','my-records-source','my-records-threshold'])document.querySelector('#'+id).onchange=refresh;
    return section;
  }

  function params(){
    const p=new URLSearchParams();
    p.set('language',document.querySelector('#my-records-language')?.value||'en');
    p.set('duration',document.querySelector('#my-records-duration')?.value||'60');
    p.set('source',document.querySelector('#my-records-source')?.value||'builtin');
    p.set('threshold',document.querySelector('#my-records-threshold')?.value||'0');
    return p;
  }

  async function request(){
    const response=await fetch(`/api/my-records?${params()}`,{credentials:'same-origin',cache:'no-store',signal:AbortSignal.timeout(15000)});
    const result=await response.json().catch(()=>null);
    if(!response.ok||result===null)throw Object.assign(Error(result?.error||'目前無法讀取你的紀錄。'),{status:response.status});
    return result;
  }

  function renderLoggedOut(){
    ensureUI();current=null;
    document.querySelector('#my-records-copy').textContent='先在「我的任務」使用老師提供的一次性啟用碼登入，才能查看自己的學習紀錄。';
    document.querySelector('#my-records-controls').hidden=true;
    document.querySelector('#my-records-summary').innerHTML='';
    document.querySelector('#my-records-chart').innerHTML='';
    document.querySelector('#my-records-weak').innerHTML='';
    document.querySelector('#my-records-recent').innerHTML='';
    document.querySelector('#my-records-status').textContent='';
  }

  function chartSVG(points,unit){
    if(!points.length)return '<div class="empty">這個條件目前沒有測速紀錄。</div>';
    if(points.length===1)return `<div class="empty">目前只有 1 筆紀錄：${points[0].speed} ${unit}。再完成一次相同條件測驗，就會開始畫出趨勢。</div>`;
    const W=700,H=230,L=48,R=18,T=18,B=38;
    const speeds=points.map(p=>p.speed),min=Math.min(...speeds),max=Math.max(...speeds),pad=Math.max(2,Math.ceil((max-min)*.15));
    const yMin=Math.max(0,min-pad),yMax=Math.max(yMin+1,max+pad);
    const x=i=>L+i*(W-L-R)/(points.length-1),y=v=>T+(yMax-v)*(H-T-B)/(yMax-yMin);
    const coords=points.map((p,i)=>`${x(i).toFixed(1)},${y(p.speed).toFixed(1)}`).join(' ');
    const grid=[0,.5,1].map(f=>{const yy=T+f*(H-T-B),value=Math.round(yMax-f*(yMax-yMin));return `<line class="grid" x1="${L}" y1="${yy}" x2="${W-R}" y2="${yy}"/><text x="4" y="${yy+4}">${value}</text>`;}).join('');
    const dots=points.map((p,i)=>`<circle class="trend-dot" cx="${x(i)}" cy="${y(p.speed)}" r="4"><title>${fmtDate(p.createdAt)}｜${p.speed} ${unit}｜正確率 ${p.accuracy}%</title></circle>`).join('');
    const first=fmtDate(points[0].createdAt),last=fmtDate(points.at(-1).createdAt);
    return `<div class="my-records-chart"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="最近 ${points.length} 次測速趨勢，從 ${points[0].speed} 到 ${points.at(-1).speed} ${unit}">${grid}<polyline class="trend-line" points="${coords}"/>${dots}<text x="${L}" y="${H-10}">${escapeHtml(first)}</text><text x="${W-R}" y="${H-10}" text-anchor="end">${escapeHtml(last)}</text><text x="${W-R}" y="14" text-anchor="end">${unit}</text></svg></div>`;
  }

  function render(result){
    current=result;
    const unit=result.filters.language==='en'?'WPM':'CPM',s=result.summary;
    document.querySelector('#my-records-controls').hidden=false;
    document.querySelector('#my-records-copy').textContent=`${result.student.name} 的私人學習紀錄；目前只顯示你自己的資料。`;
    document.querySelector('#my-records-summary').innerHTML=[
      ['測驗次數',s.tests],['第一次',s.firstSpeed==null?'—':`${s.firstSpeed} ${unit}`],['最近一次',s.recentSpeed==null?'—':`${s.recentSpeed} ${unit}`],['個人最佳',s.bestSpeed==null?'—':`${s.bestSpeed} ${unit}`],['平均正確率',s.averageAccuracy==null?'—':`${s.averageAccuracy}%`],['成長',s.improvement==null?'—':`${signed(s.improvement)} ${unit}${s.improvementPercent==null?'':`（${signed(s.improvementPercent)}%）`}`]
    ].map(([label,value])=>`<div><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`).join('');
    document.querySelector('#my-records-chart').innerHTML=chartSVG(result.trend,unit);

    const weak=document.querySelector('#my-records-weak');
    if(result.filters.language==='en'&&result.mistakes?.keys?.length){
      const trend=result.mistakeTrend;
      let trendText='';
      if(trend?.earlyRate!=null&&trend?.recentRate!=null){
        const change=trend.reductionPercent;
        trendText=`前半段 ${trend.earlyRate} 次／100 字元 → 後半段 ${trend.recentRate} 次／100 字元${change==null?'':`，${change>=0?'減少':'增加'} ${Math.abs(change)}%`}`;
      }
      weak.innerHTML=`<div class="my-records-weak"><strong>弱鍵觀察</strong>${trendText?`<p>${escapeHtml(trendText)}</p>`:''}<div class="my-records-weak-list">${result.mistakes.keys.slice(0,5).map(row=>`<span><b>${escapeHtml(row.key===' '?'空格':row.key)}</b> ×${row.count} · ${escapeHtml(row.finger||'')}</span>`).join('')}</div><p class="my-records-note">錯鍵趨勢以「過程中錯按事件／100 個已輸入字元」比較前半與後半紀錄，包含已用 Backspace 修正的錯按。</p></div>`;
    }else weak.innerHTML='';

    document.querySelector('#my-records-recent').innerHTML=result.recent.length?`<h3>最近紀錄</h3><div class="my-records-recent">${result.recent.map(row=>`<div class="my-records-row"><strong>${row.speed} ${escapeHtml(row.unit)}</strong><span>${row.accuracy}%</span><span>${row.assignmentTitle?escapeHtml(row.assignmentTitle):row.source==='custom'?'自訂／特訓':'標準題庫'}</span><small>${escapeHtml(fmtDate(row.createdAt))}</small></div>`).join('')}</div>`:'';
    document.querySelector('#my-records-status').textContent=result.truncated?'紀錄超過 10,000 筆，目前先分析最早 10,000 筆。':`更新：${new Date(result.generatedAt).toLocaleTimeString('zh-TW')}`;
  }

  async function refresh(){
    ensureUI();
    if(loading)return;
    loading=true;document.querySelector('#my-records-status').textContent='正在讀取你的紀錄…';
    try{render(await request());}
    catch(error){if(error.status===401)renderLoggedOut();else document.querySelector('#my-records-status').textContent=error.message;}
    finally{loading=false;}
  }

  const originalPublish=publishRecord;
  publishRecord=async function myRecordsPublish(record){
    await originalPublish(record);
    clearTimeout(refreshTimer);refreshTimer=setTimeout(refresh,700);
  };

  document.addEventListener('submit',event=>{if(event.target?.id==='student-code-form'){clearTimeout(refreshTimer);refreshTimer=setTimeout(refresh,900);}},true);
  document.addEventListener('click',event=>{if(event.target?.id==='student-end-session'){clearTimeout(refreshTimer);refreshTimer=setTimeout(refresh,900);}},true);
  window.addEventListener('focus',()=>{if(document.querySelector('#overview')?.classList.contains('active'))refresh();});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh();});

  ensureUI();refresh();
})();
