'use strict';

const crypto = require('node:crypto');
const {neon} = require('@neondatabase/serverless');
const {readCredentials} = require('../lib/teacher-credentials');
const {ensureAssignmentSchema} = require('../lib/typing-schema');
const {aggregateMistakes} = require('../lib/mistake-analysis');

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
  return databaseUrl && password?.length >= 12 && secret?.length >= 32 ? {databaseUrl,password,secret} : null;
}

const safeText = (value,max) => value == null || value === '' ? null : (typeof value === 'string' && value.length <= max && !/[\r\n\t]/.test(value) ? value : undefined);
const safeDate = value => value == null || value === '' ? null : (typeof value === 'string' && Number.isFinite(Date.parse(value)) ? new Date(value).toISOString() : undefined);

module.exports = async function handler(req,res) {
  res.setHeader('Cache-Control','no-store');
  res.setHeader('X-Content-Type-Options','nosniff');
  if (req.method !== 'GET') {res.setHeader('Allow','GET'); return res.status(405).json({error:'不支援此操作。'});}
  const settings = config();
  if (!settings) return res.status(503).json({error:'錯鍵分析服務尚未設定。'});
  let credentials;
  try {credentials = await readCredentials();} catch {return res.status(503).json({error:'目前無法讀取教師登入設定。'});}
  if (!teacherSessionValid(req.headers.cookie,settings.secret,credentials.sessionKey)) return res.status(401).json({error:'請先登入教師端。'});

  const query = new URL(req.url,`https://${req.headers.host}`).searchParams;
  const className = safeText(query.get('class'),40);
  const studentId = safeText(query.get('studentId'),100);
  const assignmentId = safeText(query.get('assignmentId'),100);
  const from = safeDate(query.get('from'));
  const to = safeDate(query.get('to'));
  if ([className,studentId,assignmentId,from,to].some(value => value === undefined)) return res.status(400).json({error:'查詢條件格式不正確。'});
  if (from && to && Date.parse(from) > Date.parse(to)) return res.status(400).json({error:'開始日期不能晚於結束日期。'});

  const sql = neon(settings.databaseUrl);
  try {await ensureAssignmentSchema(sql);} catch {return res.status(502).json({error:'錯鍵資料欄位目前無法初始化。'});}
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
      scope:{className,studentId,assignmentId,from,to,language:'en'},
      summary:{recordsWithMistakes:analysis.recordsWithMistakes,totalMistakes:analysis.totalMistakes},
      pairs:analysis.pairs.slice(0,100),keys:analysis.keys.slice(0,100),fingers:analysis.fingers,
      generatedAt:new Date().toISOString()
    });
  } catch {return res.status(502).json({error:'目前無法讀取錯鍵分析。'});}
};

module.exports.teacherSessionValid = teacherSessionValid;
module.exports.safeText = safeText;
module.exports.safeDate = safeDate;
