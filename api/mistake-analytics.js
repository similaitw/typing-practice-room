'use strict';

const crypto = require('node:crypto');
const {neon} = require('@neondatabase/serverless');
const {readCredentials} = require('../lib/teacher-credentials');
const {ensureAssignmentSchema} = require('../lib/typing-schema');
const {aggregateMistakes} = require('../lib/mistake-analysis');
const {readStudentSession, cookieValue, STUDENT_COOKIE} = require('../lib/student-session');

const COOKIE = '__Host-typing-teacher';
const TTL = 4 * 60 * 60;
const digest = value => crypto.createHash('sha256').update(value).digest();
const equal = (a,b) => typeof a === 'string' && a.length === b.length && crypto.timingSafeEqual(digest(a),digest(b));

function teacherSessionValid(header, secret, password) {
  const cookie = (header || '').split(';').map(s => s.trim()).find(s => s.startsWith(COOKIE + '='));
  if (!cookie) return false;
  const [payload, signature, ...extra] = cookie.slice(COOKIE.length + 1).split('.');
  if (!payload || !signature || extra.length) return false;
  const expected = crypto.createHmac('sha256', secret).update(payload + '.' + digest(password).toString('hex')).digest('base64url');
  if (!equal(signature, expected)) return false;
  try {
    const data = JSON.parse(Buffer.from(payload,'base64url').toString('utf8'));
    return data.role === 'teacher' && Number.isInteger(data.exp) && data.exp > Date.now()/1000 && data.exp <= Date.now()/1000 + TTL + 5;
  } catch { return false; }
}

function config() {
  const databaseUrl = process.env.POSTGRES_URL || process.env.DATABASE_URL;
  const password = process.env.TEACHER_PASSWORD;
  const secret = process.env.TEACHER_SESSION_SECRET;
  return databaseUrl ? {databaseUrl,password,secret} : null;
}

const safeText = (value,max) => value == null || value === '' ? null : (typeof value === 'string' && value.length <= max && !/[\r\n\t]/.test(value) ? value : undefined);
const safeDate = value => value == null || value === '' ? null : (typeof value === 'string' && Number.isFinite(Date.parse(value)) ? new Date(value).toISOString() : undefined);

module.exports = async function handler(req,res) {
  res.setHeader('Cache-Control','no-store');
  res.setHeader('X-Content-Type-Options','nosniff');
  if (req.method !== 'GET') {res.setHeader('Allow','GET'); return res.status(405).json({error:'不支援此操作。'});}
  const settings = config();
  if (!settings) return res.status(503).json({error:'錯鍵分析服務尚未設定。'});

  const query = new URL(req.url,`https://${req.headers.host}`).searchParams;
  const mine = query.get('view') === 'mine';
  let className = null, studentId = null, assignmentId = null, from = null, to = null, student = null;

  if (!mine) {
    if (!settings.password?.length || !settings.secret?.length) return res.status(503).json({error:'目前無法讀取教師登入設定。'});
    let credentials;
    try {credentials = await readCredentials();} catch {return res.status(503).json({error:'目前無法讀取教師登入設定。'});}
    if (!teacherSessionValid(req.headers.cookie,settings.secret,credentials.sessionKey)) return res.status(401).json({error:'請先登入教師端。'});
    className = safeText(query.get('class'),40);
    studentId = safeText(query.get('studentId'),100);
    assignmentId = safeText(query.get('assignmentId'),100);
    from = safeDate(query.get('from'));
    to = safeDate(query.get('to'));
    if ([className,studentId,assignmentId,from,to].some(value => value === undefined)) return res.status(400).json({error:'查詢條件格式不正確。'});
    if (from && to && Date.parse(from) > Date.parse(to)) return res.status(400).json({error:'開始日期不能晚於結束日期。'});
  } else if (!cookieValue(req.headers.cookie,STUDENT_COOKIE)) {
    return res.status(401).json({error:'請先使用老師提供的學生啟用碼登入。'});
  }

  const sql = neon(settings.databaseUrl);
  try {await ensureAssignmentSchema(sql);} catch {return res.status(502).json({error:'錯鍵資料欄位目前無法初始化。'});}

  if (mine) {
    let session;
    try {session = await readStudentSession(sql,req.headers.cookie);} catch {return res.status(502).json({error:'目前無法確認學生登入狀態。'});}
    if (!session) return res.status(401).json({error:'請先使用老師提供的學生啟用碼登入。'});
    studentId = session.studentId;
    student = session.student;
  }

  try {
    const rows = await sql`SELECT student_id, student_class, student_name, student_seat, mistakes, created_at
      FROM typing_records
      WHERE language = 'en' AND student_id IS NOT NULL AND student_class <> ''
        AND mistakes IS NOT NULL AND jsonb_typeof(mistakes) = 'array' AND jsonb_array_length(mistakes) > 0
        AND (${className}::text IS NULL OR student_class = ${className})
        AND (${studentId}::text IS NULL OR student_id = ${studentId})
        AND (${assignmentId}::text IS NULL OR assignment_id = ${assignmentId})
        AND (${from}::timestamptz IS NULL OR created_at >= ${from})
        AND (${to}::timestamptz IS NULL OR created_at <= ${to})
      ORDER BY created_at DESC LIMIT 50000`;
    const analysis = aggregateMistakes(rows);
    return res.status(200).json({
      scope:{mine,className,studentId,assignmentId,from,to,language:'en'},student,
      summary:{recordsWithMistakes:analysis.recordsWithMistakes,totalMistakes:analysis.totalMistakes},
      pairs:analysis.pairs.slice(0,100),keys:analysis.keys.slice(0,100),fingers:analysis.fingers,
      generatedAt:new Date().toISOString()
    });
  } catch {return res.status(502).json({error:'目前無法讀取錯鍵分析。'});}
};

module.exports.teacherSessionValid = teacherSessionValid;
module.exports.safeText = safeText;
module.exports.safeDate = safeDate;
