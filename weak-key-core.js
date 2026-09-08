'use strict';

(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports) module.exports=api;
  else root.WeakKeyCore=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  const WORDS=(
    'about after again always answer around because before begin between bring build call carry change children city class close come could country day different down each early earth end enough every example family far find first follow form found four friend from get give good great group grow hand hard have help here high home house important keep kind know large last learn left life light line little long look make many may mean might more most move much must name near need never new next night number old only open other over own part people place point put read real right run same school see sentence set should show small some sound spell still study such take tell than that their them then there these thing think three through time together too try turn under use very want water way well what when where which while who why will with word work world would write year young quick quiet question keyboard practice progress correct typing finger lesson teacher student'
  ).split(/\s+/);
  const SHIFT_TO_BASE={'~':'`','!':'1','@':'2','#':'3','$':'4','%':'5','^':'6','&':'7','*':'8','(':'9',')':'0','_':'-','+':'=','{':'[','}':']','|':'\\',':':';','"':"'",'<':',','>':'.','?':'/'};

  function normalizePracticeKey(value){
    if(typeof value!=='string'||Array.from(value).length!==1) return null;
    if(/[A-Z]/.test(value)) return value.toLowerCase();
    return value;
  }

  function normalizeTargetKeys(values){
    const seen=new Set(),out=[];
    for(const value of values||[]){
      const key=normalizePracticeKey(value);
      if(!key||/[\r\n\t]/.test(key)||seen.has(key)) continue;
      seen.add(key);out.push(key);
      if(out.length===4) break;
    }
    return out;
  }

  function baseKey(key){return SHIFT_TO_BASE[key]||key;}
  const displayKey=key=>key===' '?'Space':key;

  function wordsForKey(key){
    const base=baseKey(key).toLowerCase();
    if(!/^[a-z]$/.test(base)) return [];
    return WORDS.filter(word=>word.includes(base)).sort((a,b)=>{
      const ac=[...a].filter(ch=>ch===base).length,bc=[...b].filter(ch=>ch===base).length;
      return bc-ac||a.length-b.length||a.localeCompare(b);
    }).slice(0,18);
  }

  function drillFor(keys){
    const pieces=[];
    for(const key of keys){
      if(key===' ') pieces.push('space space space');
      else pieces.push(`${key}${key} ${key}${key}${key}`);
    }
    for(let i=0;i<keys.length;i++) for(let j=i+1;j<keys.length;j++) pieces.push(`${keys[i]}${keys[j]} ${keys[j]}${keys[i]} ${keys[i]}${keys[i]} ${keys[j]}${keys[j]}`);
    return pieces.join(' ');
  }

  function buildPractice(targetKeys,duration=60){
    const keys=normalizeTargetKeys(targetKeys);
    if(!keys.length) return '';
    const seconds=duration===120?120:60;
    const targetLength=seconds===120?760:420;
    const banks=keys.map(wordsForKey);
    const chunks=[drillFor(keys)];
    let round=0;
    while(chunks.join(' ').length<targetLength){
      const words=[];
      for(let i=0;i<keys.length;i++){
        const bank=banks[i];
        if(bank.length){
          words.push(bank[(round+i*3)%bank.length],bank[(round+i*3+5)%bank.length]);
        }else if(keys[i]===' '){
          words.push('keep a steady space rhythm');
        }else{
          const base=baseKey(keys[i]);
          words.push(`${keys[i]}${base}${keys[i]}`,`${base}${keys[i]}${base}`);
        }
      }
      chunks.push(words.join(' '));
      if(round%2===1) chunks.push(drillFor(keys));
      round++;
      if(round>80) break;
    }
    return chunks.join(' ').replace(/\s+/g,' ').trim().slice(0,targetLength).trim();
  }

  return {normalizePracticeKey,normalizeTargetKeys,baseKey,displayKey,buildPractice};
});
