'use strict';

const {aggregateMistakes}=require('./mistake-analysis');

function assignmentStatus({validAttempts=0,totalAttempts=0,requiredAttempts=1,dueAt=null},now=Date.now()){
  if(Number(validAttempts)>=Number(requiredAttempts))return 'completed';
  if(dueAt&&Date.parse(dueAt)<now)return 'overdue';
  return Number(totalAttempts)>0?'in_progress':'not_started';
}

function mistakeSummary(rows){
  const byStudent=new Map();
  for(const row of rows||[]){
    if(!row?.studentId)continue;
    if(!byStudent.has(row.studentId))byStudent.set(row.studentId,[]);
    byStudent.get(row.studentId).push({mistakes:row.mistakes});
  }
  const result=new Map();
  for(const [studentId,items] of byStudent){
    const analysis=aggregateMistakes(items);
    result.set(studentId,{
      totalMistakes:analysis.totalMistakes,
      topKeys:analysis.keys.slice(0,3),
      topKeyText:analysis.keys.slice(0,3).map(item=>`${item.key} ×${item.count}`).join('、')
    });
  }
  return result;
}

function buildReport({students=[],growthStudents=[],assignment=null,assignmentRows=[],mistakeRows=[],now=Date.now()}){
  const growth=new Map((growthStudents||[]).map(row=>[row.id,row]));
  const assignmentByStudent=new Map((assignmentRows||[]).map(row=>[row.id,row]));
  const mistakes=mistakeSummary(mistakeRows);
  const rows=(students||[]).map(student=>{
    const g=growth.get(student.id)||{};
    const a=assignmentByStudent.get(student.id)||{};
    const m=mistakes.get(student.id)||{totalMistakes:0,topKeys:[],topKeyText:''};
    const assignmentInfo=assignment?{
      assignmentId:assignment.id,
      assignmentTitle:assignment.title,
      assignmentStatus:assignmentStatus({
        validAttempts:Number(a.validAttempts||0),
        totalAttempts:Number(a.totalAttempts||0),
        requiredAttempts:assignment.requiredAttempts,
        dueAt:assignment.dueAt
      },now),
      validAttempts:Number(a.validAttempts||0),
      requiredAttempts:assignment.requiredAttempts,
      bestAssignmentSpeed:a.bestSpeed??null,
      bestAssignmentAccuracy:a.bestAccuracy??null
    }:{assignmentId:null,assignmentTitle:'',assignmentStatus:null,validAttempts:null,requiredAttempts:null,bestAssignmentSpeed:null,bestAssignmentAccuracy:null};
    return {
      id:student.id,className:student.className||'',seat:student.seat||'',name:student.name||'',
      ...assignmentInfo,
      tests:Number(g.tests||0),firstSpeed:g.firstSpeed??null,recentSpeed:g.recentSpeed??null,bestSpeed:g.bestSpeed??null,
      improvement:g.improvement??null,improvementPercent:g.improvementPercent??null,averageAccuracy:g.averageAccuracy??null,
      totalMistakes:m.totalMistakes,topKeys:m.topKeys,topKeyText:m.topKeyText
    };
  });
  const completed=rows.filter(row=>row.assignmentStatus==='completed').length;
  const withGrowth=rows.filter(row=>row.improvement!==null).length;
  return {
    summary:{totalStudents:rows.length,completedAssignments:assignment?completed:null,studentsWithGrowth:withGrowth},
    rows
  };
}

module.exports={assignmentStatus,mistakeSummary,buildReport};
