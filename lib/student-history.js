'use strict';

const {aggregateMistakes} = require('./mistake-analysis');

const round = (value,digits=1) => {
  if (!Number.isFinite(value)) return null;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
};
const average = values => values.length ? values.reduce((sum,value)=>sum+value,0)/values.length : null;

function compareBest(a,b) {
  return b.speed-a.speed || b.accuracy-a.accuracy || String(b.createdAt).localeCompare(String(a.createdAt));
}

function mistakeCount(row) {
  return Array.isArray(row?.mistakes) ? row.mistakes.reduce((sum,item)=>sum + (Array.isArray(item) && Number.isInteger(item[2]) ? item[2] : 0),0) : 0;
}

function mistakeRate(rows) {
  const typed=(rows||[]).reduce((sum,row)=>sum + (Number.isFinite(row?.typedLength) ? row.typedLength : 0),0);
  const mistakes=(rows||[]).reduce((sum,row)=>sum + mistakeCount(row),0);
  return typed ? round(mistakes/typed*100,1) : null;
}

function analyzeStudentHistory(records) {
  const attempts=(records||[]).slice().sort((a,b)=>String(a.createdAt).localeCompare(String(b.createdAt)));
  if (!attempts.length) return {
    summary:{tests:0,firstSpeed:null,recentSpeed:null,bestSpeed:null,averageAccuracy:null,improvement:null,improvementPercent:null},
    trend:[],recent:[],mistakes:{recordsWithMistakes:0,totalMistakes:0,keys:[],pairs:[],fingers:[]},mistakeTrend:null
  };
  const first=attempts[0],recent=attempts.at(-1),best=attempts.slice().sort(compareBest)[0];
  const improvement=recent.speed-first.speed;
  const trend=attempts.slice(-20).map(row=>({
    id:row.id,speed:row.speed,accuracy:row.accuracy,createdAt:row.createdAt,source:row.source,assignmentId:row.assignmentId||null
  }));
  const english=attempts.filter(row=>row.language==='en');
  const mistakes=aggregateMistakes(english);
  let mistakeTrend=null;
  if (english.length>=4) {
    const midpoint=Math.floor(english.length/2),early=english.slice(0,midpoint),late=english.slice(midpoint);
    const earlyRate=mistakeRate(early),recentRate=mistakeRate(late);
    mistakeTrend={earlyRate,recentRate,reductionPercent:earlyRate && recentRate!==null ? round((earlyRate-recentRate)/earlyRate*100,1) : null};
  }
  return {
    summary:{
      tests:attempts.length,firstSpeed:first.speed,recentSpeed:recent.speed,bestSpeed:best.speed,
      averageAccuracy:round(average(attempts.map(row=>row.accuracy))),
      improvement:attempts.length>=2?improvement:null,
      improvementPercent:attempts.length>=2&&first.speed>0?round(improvement/first.speed*100):null,
      firstAt:first.createdAt,recentAt:recent.createdAt,bestAt:best.createdAt
    },
    trend,
    recent:attempts.slice(-20).reverse().map(row=>({
      id:row.id,speed:row.speed,accuracy:row.accuracy,createdAt:row.createdAt,source:row.source,
      duration:row.duration,unit:row.unit,assignmentId:row.assignmentId||null
    })),
    mistakes,
    mistakeTrend
  };
}

module.exports={round,average,mistakeCount,mistakeRate,analyzeStudentHistory};
