'use strict';

const {neon}=require('@neondatabase/serverless');
const {cookieValue,STUDENT_COOKIE,readStudentSession}=require('../lib/student-session');
const {ensureAssignmentSchema}=require('../lib/typing-schema');
const {analyzeStudentHistory}=require('../lib/student-history');

function config(){
  const databaseUrl=process.env.POSTGRES_URL||process.env.DATABASE_URL;
  return databaseUrl?{databaseUrl}:null;
}

function parseFilters(url,host){
  const query=new URL(url,`https://${host}`).searchParams;
  const language=['en','zh'].includes(query.get('language'))?query.get('language'):'en';
  const duration=[15,30,60,120].includes(Number(query.get('duration')))?Number(query.get('duration')):60;
  const source=['builtin','all'].includes(query.get('source'))?query.get('source'):'builtin';
  const rawThreshold=query.get('threshold');
  const threshold=rawThreshold==null||rawThreshold===''?0:Number(rawThreshold);
  if(!Number.isInteger(threshold)||threshold<0||threshold>100)return null;
  return {language,duration,source,threshold};
}

module.exports=async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  res.setHeader('X-Content-Type-Options','nosniff');
  if(req.method!=='GET'){res.setHeader('Allow','GET');return res.status(405).json({error:'不支援此操作。'});}
  if(!cookieValue(req.headers.cookie,STUDENT_COOKIE))return res.status(401).json({error:'請先使用老師提供的學生啟用碼登入。'});
  const filters=parseFilters(req.url,req.headers.host);
  if(!filters)return res.status(400).json({error:'我的紀錄篩選條件格式不正確。'});
  const settings=config();
  if(!settings)return res.status(503).json({error:'學生紀錄服務尚未設定。'});
  const sql=neon(settings.databaseUrl);
  try{await ensureAssignmentSchema(sql);}catch{return res.status(502).json({error:'目前無法初始化學生紀錄資料。'});}
  let session;
  try{session=await readStudentSession(sql,req.headers.cookie);}catch{return res.status(502).json({error:'目前無法確認學生登入。'});}
  if(!session)return res.status(401).json({error:'學生登入已失效，請向老師取得新的啟用碼。'});
  try{
    const rows=await sql`SELECT r.id,r.language,r.source,r.duration,r.speed,r.unit,r.accuracy,r.typed_length,r.mistakes,r.assignment_id,r.created_at,
        a.title AS assignment_title
      FROM typing_records r
      LEFT JOIN typing_assignments a ON a.id=r.assignment_id
      WHERE r.student_id=${session.studentId}
        AND r.language=${filters.language}
        AND r.duration=${filters.duration}
        AND r.accuracy>=${filters.threshold}
        AND (${filters.source}='all' OR r.source='builtin')
      ORDER BY r.created_at ASC LIMIT 10000`;
    const records=rows.map(row=>({
      id:row.id,language:row.language,source:row.source,duration:Number(row.duration),speed:Number(row.speed),unit:row.unit,
      accuracy:Number(row.accuracy),typedLength:Number(row.typed_length||0),mistakes:Array.isArray(row.mistakes)?row.mistakes:[],
      assignmentId:row.assignment_id||null,assignmentTitle:row.assignment_title||null,createdAt:new Date(row.created_at).toISOString()
    }));
    const analysis=analyzeStudentHistory(records);
    const titles=new Map(records.filter(row=>row.assignmentId&&row.assignmentTitle).map(row=>[row.assignmentId,row.assignmentTitle]));
    for(const row of analysis.recent)row.assignmentTitle=row.assignmentId?titles.get(row.assignmentId)||null:null;
    for(const row of analysis.trend)row.assignmentTitle=row.assignmentId?titles.get(row.assignmentId)||null:null;
    return res.status(200).json({
      student:session.student,filters,summary:analysis.summary,trend:analysis.trend,recent:analysis.recent,
      mistakes:{totalMistakes:analysis.mistakes.totalMistakes,recordsWithMistakes:analysis.mistakes.recordsWithMistakes,keys:analysis.mistakes.keys.slice(0,5)},
      mistakeTrend:filters.language==='en'?analysis.mistakeTrend:null,
      truncated:rows.length===10000,generatedAt:new Date().toISOString()
    });
  }catch{return res.status(502).json({error:'目前無法讀取你的學習紀錄。'});}
};

module.exports.parseFilters=parseFilters;
