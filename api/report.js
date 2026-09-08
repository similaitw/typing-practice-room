'use strict';

const crypto=require('node:crypto');
const {neon}=require('@neondatabase/serverless');
const {readCredentials}=require('../lib/teacher-credentials');
const {ensureAssignmentSchema}=require('../lib/typing-schema');
const {analyzeGrowth}=require('../lib/growth-analysis');
const {buildReport}=require('../lib/report-analysis');

const COOKIE='__Host-typing-teacher';
const TTL=4*60*60;
const digest=value=>crypto.createHash('sha256').update(value).digest();
const equal=(a,b)=>typeof a==='string'&&a.length===b.length&&crypto.timingSafeEqual(digest(a),digest(b));
function teacherSessionValid(header,secret,password){
  const cookie=(header||'').split(';').map(s=>s.trim()).find(s=>s.startsWith(COOKIE+'='));
  if(!cookie)return false;
  const [payload,signature,...extra]=cookie.slice(COOKIE.length+1).split('.');
  if(!payload||!signature||extra.length)return false;
  const expected=crypto.createHmac('sha256',secret).update(payload+'.'+digest(password).toString('hex')).digest('base64url');
  if(!equal(signature,expected))return false;
  try{const data=JSON.parse(Buffer.from(payload,'base64url').toString('utf8'));return data.role==='teacher'&&Number.isInteger(data.exp)&&data.exp>Date.now()/1000&&data.exp<=Date.now()/1000+TTL+5;}catch{return false;}
}
function config(){
  const databaseUrl=process.env.POSTGRES_URL||process.env.DATABASE_URL;
  const password=process.env.TEACHER_PASSWORD,secret=process.env.TEACHER_SESSION_SECRET;
  return databaseUrl&&password?.length>=12&&secret?.length>=32?{databaseUrl,password,secret}:null;
}
const safeText=(value,max)=>value==null||value===''?null:(typeof value==='string'&&value.length<=max&&!/[\r\n\t]/.test(value)?value:undefined);
const safeId=value=>value==null||value===''?null:(typeof value==='string'&&value.length<=100&&!/\s/.test(value)?value:undefined);
const safeDate=value=>value==null||value===''?null:(typeof value==='string'&&Number.isFinite(Date.parse(value))?new Date(value).toISOString():undefined);
function parseFilters(url,host){
  const query=new URL(url,`https://${host}`).searchParams;
  const className=safeText(query.get('class'),40),studentId=safeId(query.get('studentId')),assignmentId=safeId(query.get('assignmentId'));
  const language=['en','zh'].includes(query.get('language'))?query.get('language'):'en';
  const duration=[15,30,60,120].includes(Number(query.get('duration')))?Number(query.get('duration')):60;
  const source=query.get('source')==='all'?'all':'builtin';
  const requestedThreshold=Number(query.get('threshold')??90);
  const threshold=Number.isInteger(requestedThreshold)&&requestedThreshold>=0&&requestedThreshold<=100?requestedThreshold:undefined;
  const from=safeDate(query.get('from')),to=safeDate(query.get('to'));
  if([className,studentId,assignmentId,threshold,from,to].some(value=>value===undefined))return null;
  if(from&&to&&Date.parse(from)>Date.parse(to))return null;
  return {className,studentId,assignmentId,language,duration,source,threshold,from,to};
}
const assignmentFromRow=(row,targets)=>({
  id:row.id,title:row.title,language:row.language,duration:Number(row.duration),minAccuracy:Number(row.min_accuracy),minSpeed:Number(row.min_speed),requiredAttempts:Number(row.required_attempts),
  startAt:row.start_at?new Date(row.start_at).toISOString():null,dueAt:row.due_at?new Date(row.due_at).toISOString():null,active:row.active,targetClasses:targets
});

module.exports=async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  res.setHeader('X-Content-Type-Options','nosniff');
  if(req.method!=='GET'){res.setHeader('Allow','GET');return res.status(405).json({error:'不支援此操作。'});}
  const settings=config();
  if(!settings)return res.status(503).json({error:'報表服務尚未設定。'});
  let credentials;
  try{credentials=await readCredentials();}catch{return res.status(503).json({error:'目前無法讀取教師登入設定。'});}
  if(!teacherSessionValid(req.headers.cookie,settings.secret,credentials.sessionKey))return res.status(401).json({error:'請先登入教師端。'});
  const filters=parseFilters(req.url,req.headers.host);
  if(!filters)return res.status(400).json({error:'報表篩選條件格式不正確。'});
  const sql=neon(settings.databaseUrl);
  try{await ensureAssignmentSchema(sql);}catch{return res.status(502).json({error:'目前無法初始化報表資料表。'});}
  try{
    let assignment=null;
    if(filters.assignmentId){
      const assignmentRows=await sql`SELECT * FROM typing_assignments WHERE id=${filters.assignmentId} LIMIT 1`;
      if(!assignmentRows[0])return res.status(404).json({error:'找不到這份作業。'});
      const targets=await sql`SELECT student_class FROM typing_assignment_targets WHERE assignment_id=${filters.assignmentId} ORDER BY student_class`;
      assignment=assignmentFromRow(assignmentRows[0],targets.map(row=>row.student_class));
      if(filters.className&&!assignment.targetClasses.includes(filters.className))return res.status(400).json({error:'這份作業沒有指派給所選班級。'});
    }

    const studentRows=await sql`SELECT s.id,s.student_class,s.student_seat,s.student_name FROM typing_students s
      WHERE s.active=true
        AND (${filters.className}::text IS NULL OR s.student_class=${filters.className})
        AND (${filters.studentId}::text IS NULL OR s.id=${filters.studentId})
        AND (${filters.assignmentId}::text IS NULL OR EXISTS (
          SELECT 1 FROM typing_assignment_targets t WHERE t.assignment_id=${filters.assignmentId} AND t.student_class=s.student_class
        ))
      ORDER BY s.student_class,s.student_seat,s.student_name`;
    const students=studentRows.map(row=>({id:row.id,className:row.student_class,seat:row.student_seat,name:row.student_name}));

    const growthRows=await sql`SELECT r.student_id,r.speed,r.accuracy,r.created_at FROM typing_records r
      JOIN typing_students s ON s.id=r.student_id AND s.active=true
      WHERE r.language=${filters.language} AND r.duration=${filters.duration} AND r.accuracy>=${filters.threshold}
        AND (${filters.source}='all' OR r.source='builtin')
        AND (${filters.className}::text IS NULL OR s.student_class=${filters.className})
        AND (${filters.studentId}::text IS NULL OR r.student_id=${filters.studentId})
        AND (${filters.assignmentId}::text IS NULL OR EXISTS (
          SELECT 1 FROM typing_assignment_targets t WHERE t.assignment_id=${filters.assignmentId} AND t.student_class=s.student_class
        ))
        AND (${filters.from}::timestamptz IS NULL OR r.created_at>=${filters.from})
        AND (${filters.to}::timestamptz IS NULL OR r.created_at<=${filters.to})
      ORDER BY r.student_id,r.created_at ASC LIMIT 50000`;
    const growth=analyzeGrowth(students,growthRows.map(row=>({studentId:row.student_id,speed:Number(row.speed),accuracy:Number(row.accuracy),createdAt:new Date(row.created_at).toISOString()})));

    let assignmentStats=[];
    if(assignment){
      const rows=await sql`SELECT s.id,
          COUNT(r.id)::int AS total_attempts,
          COUNT(r.id) FILTER (WHERE r.accuracy>=${assignment.minAccuracy} AND r.speed>=${assignment.minSpeed}
            AND (${assignment.dueAt}::timestamptz IS NULL OR r.created_at<=${assignment.dueAt}))::int AS valid_attempts,
          MAX(r.speed)::int AS best_speed,MAX(r.accuracy)::int AS best_accuracy
        FROM typing_students s
        LEFT JOIN typing_records r ON r.student_id=s.id AND r.assignment_id=${assignment.id}
        WHERE s.active=true
          AND EXISTS (SELECT 1 FROM typing_assignment_targets t WHERE t.assignment_id=${assignment.id} AND t.student_class=s.student_class)
          AND (${filters.className}::text IS NULL OR s.student_class=${filters.className})
          AND (${filters.studentId}::text IS NULL OR s.id=${filters.studentId})
        GROUP BY s.id`;
      assignmentStats=rows.map(row=>({id:row.id,totalAttempts:Number(row.total_attempts||0),validAttempts:Number(row.valid_attempts||0),bestSpeed:row.best_speed==null?null:Number(row.best_speed),bestAccuracy:row.best_accuracy==null?null:Number(row.best_accuracy)}));
    }

    let mistakeRows=[];
    if(filters.language==='en'){
      const rows=await sql`SELECT r.student_id,r.mistakes FROM typing_records r
        JOIN typing_students s ON s.id=r.student_id AND s.active=true
        WHERE r.language='en' AND r.duration=${filters.duration}
          AND r.mistakes IS NOT NULL AND jsonb_typeof(r.mistakes)='array' AND jsonb_array_length(r.mistakes)>0
          AND (${filters.source}='all' OR r.source='builtin')
          AND (${filters.className}::text IS NULL OR s.student_class=${filters.className})
          AND (${filters.studentId}::text IS NULL OR r.student_id=${filters.studentId})
          AND (${filters.assignmentId}::text IS NULL OR r.assignment_id=${filters.assignmentId})
          AND (${filters.from}::timestamptz IS NULL OR r.created_at>=${filters.from})
          AND (${filters.to}::timestamptz IS NULL OR r.created_at<=${filters.to})
        ORDER BY r.created_at DESC LIMIT 50000`;
      mistakeRows=rows.map(row=>({studentId:row.student_id,mistakes:row.mistakes}));
    }

    const report=buildReport({students,growthStudents:growth.students,assignment,assignmentRows:assignmentStats,mistakeRows,now:Date.now()});
    return res.status(200).json({filters,assignment,growthSummary:growth.summary,summary:report.summary,rows:report.rows,generatedAt:new Date().toISOString()});
  }catch{return res.status(502).json({error:'目前無法產生報表。'});}
};

module.exports.teacherSessionValid=teacherSessionValid;
module.exports.parseFilters=parseFilters;
