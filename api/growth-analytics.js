'use strict';

const crypto=require('node:crypto');
const {neon}=require('@neondatabase/serverless');
const {readCredentials}=require('../lib/teacher-credentials');
const {ensureAssignmentSchema}=require('../lib/typing-schema');
const {analyzeGrowth}=require('../lib/growth-analysis');

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
const safeDate=value=>value==null||value===''?null:(typeof value==='string'&&Number.isFinite(Date.parse(value))?new Date(value).toISOString():undefined);
function parseFilters(url,host){
  const query=new URL(url,`https://${host}`).searchParams;
  const className=safeText(query.get('class'),40),studentId=safeText(query.get('studentId'),100);
  const language=['en','zh'].includes(query.get('language'))?query.get('language'):'en';
  const duration=[15,30,60,120].includes(Number(query.get('duration')))?Number(query.get('duration')):60;
  const requestedThreshold=Number(query.get('threshold')??90);
  const threshold=Number.isInteger(requestedThreshold)&&requestedThreshold>=0&&requestedThreshold<=100?requestedThreshold:undefined;
  const from=safeDate(query.get('from')),to=safeDate(query.get('to'));
  if([className,studentId,threshold,from,to].some(value=>value===undefined))return null;
  if(from&&to&&Date.parse(from)>Date.parse(to))return null;
  return {className,studentId,language,duration,threshold,from,to};
}

module.exports=async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  res.setHeader('X-Content-Type-Options','nosniff');
  if(req.method!=='GET'){res.setHeader('Allow','GET');return res.status(405).json({error:'不支援此操作。'});}
  const settings=config();
  if(!settings)return res.status(503).json({error:'成長分析服務尚未設定。'});
  let credentials;
  try{credentials=await readCredentials();}catch{return res.status(503).json({error:'目前無法讀取教師登入設定。'});}
  if(!teacherSessionValid(req.headers.cookie,settings.secret,credentials.sessionKey))return res.status(401).json({error:'請先登入教師端。'});
  const filters=parseFilters(req.url,req.headers.host);
  if(!filters)return res.status(400).json({error:'分析篩選條件格式不正確。'});
  const sql=neon(settings.databaseUrl);
  try{await ensureAssignmentSchema(sql);}catch{return res.status(502).json({error:'目前無法初始化分析所需資料表。'});}
  try{
    const students=await sql`SELECT id,student_class,student_seat,student_name FROM typing_students
      WHERE active=true
        AND (${filters.className}::text IS NULL OR student_class=${filters.className})
        AND (${filters.studentId}::text IS NULL OR id=${filters.studentId})
      ORDER BY student_class,student_seat,student_name`;
    const records=await sql`SELECT r.student_id,r.speed,r.accuracy,r.created_at
      FROM typing_records r
      JOIN typing_students s ON s.id=r.student_id AND s.active=true
      WHERE r.language=${filters.language} AND r.duration=${filters.duration} AND r.accuracy>=${filters.threshold}
        AND (${filters.className}::text IS NULL OR s.student_class=${filters.className})
        AND (${filters.studentId}::text IS NULL OR r.student_id=${filters.studentId})
        AND (${filters.from}::timestamptz IS NULL OR r.created_at>=${filters.from})
        AND (${filters.to}::timestamptz IS NULL OR r.created_at<=${filters.to})
      ORDER BY r.student_id,r.created_at ASC LIMIT 50000`;
    const analysis=analyzeGrowth(
      students.map(row=>({id:row.id,className:row.student_class,seat:row.student_seat,name:row.student_name})),
      records.map(row=>({studentId:row.student_id,speed:Number(row.speed),accuracy:Number(row.accuracy),createdAt:new Date(row.created_at).toISOString()}))
    );
    return res.status(200).json({filters,summary:analysis.summary,students:analysis.students,generatedAt:new Date().toISOString()});
  }catch{return res.status(502).json({error:'目前無法讀取成長分析。'});}
};

module.exports.teacherSessionValid=teacherSessionValid;
module.exports.parseFilters=parseFilters;
