'use strict';

const round = (value,digits=1) => {
  if (!Number.isFinite(value)) return null;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
};
const average = values => values.length ? values.reduce((sum,value)=>sum+value,0)/values.length : null;
const median = values => {
  if (!values.length) return null;
  const sorted=[...values].sort((a,b)=>a-b),mid=Math.floor(sorted.length/2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid-1]+sorted[mid])/2;
};

function compareBest(a,b) {
  return b.speed-a.speed || b.accuracy-a.accuracy || String(b.createdAt).localeCompare(String(a.createdAt));
}

function analyzeGrowth(students,records) {
  const byStudent=new Map();
  for (const row of records || []) {
    if (!row?.studentId) continue;
    if (!byStudent.has(row.studentId)) byStudent.set(row.studentId,[]);
    byStudent.get(row.studentId).push(row);
  }
  const rows=(students||[]).map(student=>{
    const attempts=(byStudent.get(student.id)||[]).slice().sort((a,b)=>String(a.createdAt).localeCompare(String(b.createdAt)));
    if (!attempts.length) return {...student,tests:0,firstSpeed:null,recentSpeed:null,bestSpeed:null,averageAccuracy:null,improvement:null,improvementPercent:null,firstAt:null,recentAt:null};
    const first=attempts[0],recent=attempts.at(-1),best=attempts.slice().sort(compareBest)[0];
    const improvement=recent.speed-first.speed;
    return {...student,tests:attempts.length,firstSpeed:first.speed,recentSpeed:recent.speed,bestSpeed:best.speed,
      averageAccuracy:round(average(attempts.map(row=>row.accuracy))),
      improvement:attempts.length>=2?improvement:null,
      improvementPercent:attempts.length>=2&&first.speed>0?round(improvement/first.speed*100):null,
      firstAt:first.createdAt,recentAt:recent.createdAt};
  });
  const active=rows.filter(row=>row.tests>0),growth=rows.filter(row=>row.improvement!==null);
  return {
    summary:{
      totalStudents:rows.length,
      studentsWithRecords:active.length,
      participationRate:rows.length?Math.round(active.length/rows.length*100):0,
      averageFirst:round(average(active.map(row=>row.firstSpeed))),
      averageRecent:round(average(active.map(row=>row.recentSpeed))),
      medianRecent:round(median(active.map(row=>row.recentSpeed))),
      averageAccuracy:round(average(active.map(row=>row.averageAccuracy))),
      averageImprovement:round(average(growth.map(row=>row.improvement))),
      averageImprovementPercent:round(average(growth.map(row=>row.improvementPercent).filter(value=>value!==null))),
      studentsWithGrowthComparison:growth.length
    },
    students:rows
  };
}

module.exports={round,average,median,analyzeGrowth};
