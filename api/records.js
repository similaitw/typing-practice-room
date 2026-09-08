'use strict';

const crypto = require('node:crypto');
const {neon} = require('@neondatabase/serverless');
const {readCredentials} = require('../lib/teacher-credentials');
const {ensureAssignmentSchema} = require('../lib/typing-schema');
const {readStudentSession, sameOrigin} = require('../lib/student-session');
const COOKIE = '__Host-typing-teacher';
const TTL = 4 * 60 * 60;
const digest = value => crypto.createHash('sha256').update(value).digest();
const equal = (a, b) => typeof a === 'string' && a.length === b.length && crypto.timingSafeEqual(digest(a), digest(b));
function sessionValid(header, secret, password) {
  const cookie = (header || '').split(';').map(s => s.trim()).find(s => s.startsWith(COOKIE + '='));
  if (!cookie) return false;
  const [payload, signature, ...extra] = cookie.slice(COOKIE.length + 1).split('.');
  if (!payload || !signature || extra.length) return false;
  const expected = crypto.createHmac('sha256', secret).update(payload + '.' + digest(password).toString('hex')).digest('base64url');
  if (!equal(signature, expected)) return false;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return data.role === 'teacher' && Number.isInteger(data.exp) && data.exp > Date.now() / 1000 && data.exp <= Date.now() / 1000 + TTL + 5;
  } catch { return false; }
}
function config() {
  const databaseUrl = process.env.POSTGRES_URL || process.env.DATABASE_URL;
  const password = process.env.TEACHER_PASSWORD;
  const secret = process.env.TEACHER_SESSION_SECRET;
  return databaseUrl && password?.length >= 12 && secret?.length >= 32 ? {databaseUrl, password, secret} : null;
}
function cleanRecord(record) {
  const integer = (value, max) => Number.isInteger(value) && value >= 0 && value <= max;
  if (!record || typeof record !== 'object' || typeof record.id !== 'string' || record.id.length > 100 ||
      !['en', 'zh'].includes(record.language) || !['builtin', 'custom'].includes(record.source) ||
      ![15, 30, 60, 120].includes(record.duration) || record.unit !== (record.language === 'en' ? 'WPM' : 'CPM') ||
      !Number.isFinite(record.elapsedSeconds) || record.elapsedSeconds <= 0 || record.elapsedSeconds > record.duration + 1 ||
      !integer(record.speed, 100000) || !integer(record.accuracy, 100) || !integer(record.correctChars, 10000000) ||
      !integer(record.errors, 10000000) || !integer(record.typedLength, 10000000) || !integer(record.targetLength, 10000000) ||
      !record.typedLength || !record.targetLength || record.correctChars + record.errors !== record.typedLength ||
      record.correctChars > record.targetLength || typeof record.createdAt !== 'string' || !Number.isFinite(Date.parse(record.createdAt))) return null;
  const text = (value, max) => typeof value === 'string' && value.length <= max ? value : '';
  const assignmentId = record.assignmentId == null || record.assignmentId === '' ? null :
    (typeof record.assignmentId === 'string' && record.assignmentId.length <= 100 && !/\s/.test(record.assignmentId) ? record.assignmentId : undefined);
  if (assignmentId === undefined) return null;
  return {
    id: record.id, studentId: record.studentId || null, studentLabel: text(record.studentLabel, 160),
    studentClass: text(record.studentClass, 40), studentName: text(record.studentName, 80), studentSeat: text(record.studentSeat, 20),
    language: record.language, source: record.source, duration: record.duration, elapsedSeconds: Number(record.elapsedSeconds),
    speed: record.speed, unit: record.unit, accuracy: record.accuracy, correctChars: record.correctChars,
    errors: record.errors, typedLength: record.typedLength, targetLength: record.targetLength,
    assignmentId, createdAt: new Date(record.createdAt).toISOString()
  };
}
function rowToRecord(row) {
  return {id:row.id,studentId:row.student_id,studentLabel:row.student_label,studentClass:row.student_class,studentName:row.student_name,studentSeat:row.student_seat,language:row.language,source:row.source,duration:row.duration,elapsedSeconds:Number(row.elapsed_seconds),speed:row.speed,unit:row.unit,accuracy:row.accuracy,correctChars:row.correct_chars,errors:row.errors,typedLength:row.typed_length,targetLength:row.target_length,assignmentId:row.assignment_id || null,createdAt:row.created_at};
}
module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  const settings = config();
  if (!settings) return res.status(503).json({error: 'Vercel Postgres 尚未設定，請聯絡網站管理者。'});
  const sql = neon(settings.databaseUrl);
  if (req.method === 'POST') {
    if (!sameOrigin(req)) return res.status(403).json({error:'來源驗證失敗。'});
    const record = cleanRecord(req.body);
    if (!record) return res.status(400).json({error: '成績資料格式不正確。'});
    try {
      if (record.assignmentId) {
        await ensureAssignmentSchema(sql);
        const studentSession = await readStudentSession(sql, req.headers.cookie);
        if (!studentSession) return res.status(401).json({error:'正式作業需要先使用學生啟用碼登入。'});
        if (record.studentId !== studentSession.studentId) return res.status(403).json({error:'待傳作業與目前學生登入身分不一致，請切回原學生後再同步。'});
        const assignments = await sql`SELECT a.* FROM typing_assignments a
          JOIN typing_assignment_targets t ON t.assignment_id = a.id
          WHERE a.id = ${record.assignmentId} AND a.active = true AND t.student_class = ${studentSession.student.className}
            AND (a.start_at IS NULL OR a.start_at <= now()) LIMIT 1`;
        const assignment = assignments[0];
        if (!assignment) return res.status(403).json({error:'這份作業未指派給目前學生或尚未開始。'});
        if (record.source !== 'builtin' || record.language !== assignment.language || record.duration !== assignment.duration) {
          return res.status(400).json({error:'測驗設定與老師指定作業不一致。'});
        }
        record.studentId = studentSession.studentId;
        record.studentClass = studentSession.student.className;
        record.studentName = studentSession.student.name;
        record.studentSeat = studentSession.student.seat;
        record.studentLabel = [record.studentClass,record.studentName,record.studentSeat ? record.studentSeat + '號' : ''].filter(Boolean).join(' ｜ ');
        record.createdAt = new Date().toISOString();
      }
      if (record.assignmentId) {
        await sql`INSERT INTO typing_records (id, student_id, student_label, student_class, student_name, student_seat, language, source, duration, elapsed_seconds, speed, unit, accuracy, correct_chars, errors, typed_length, target_length, assignment_id, created_at)
          VALUES (${record.id}, ${record.studentId}, ${record.studentLabel}, ${record.studentClass}, ${record.studentName}, ${record.studentSeat}, ${record.language}, ${record.source}, ${record.duration}, ${record.elapsedSeconds}, ${record.speed}, ${record.unit}, ${record.accuracy}, ${record.correctChars}, ${record.errors}, ${record.typedLength}, ${record.targetLength}, ${record.assignmentId}, ${record.createdAt})
          ON CONFLICT (id) DO NOTHING`;
      } else {
        await sql`INSERT INTO typing_records (id, student_id, student_label, student_class, student_name, student_seat, language, source, duration, elapsed_seconds, speed, unit, accuracy, correct_chars, errors, typed_length, target_length, created_at)
          VALUES (${record.id}, ${record.studentId}, ${record.studentLabel}, ${record.studentClass}, ${record.studentName}, ${record.studentSeat}, ${record.language}, ${record.source}, ${record.duration}, ${record.elapsedSeconds}, ${record.speed}, ${record.unit}, ${record.accuracy}, ${record.correctChars}, ${record.errors}, ${record.typedLength}, ${record.targetLength}, ${record.createdAt})
          ON CONFLICT (id) DO NOTHING`;
      }
      return res.status(201).json({saved: true, id: record.id, assignmentId: record.assignmentId});
    } catch (error) {return res.status(502).json({error: error.message || '雲端資料服務目前無法使用。'});}
  }
  if (req.method !== 'GET') {res.setHeader('Allow', 'GET, POST'); return res.status(405).json({error: '不支援此操作。'});}
  const publicQuery = new URL(req.url, `https://${req.headers.host}`).searchParams;
  if (publicQuery.get('view') === 'leaderboard') {
    const language = publicQuery.get('language') === 'zh' ? 'zh' : 'en';
    const requestedThreshold = Number(publicQuery.get('threshold') ?? 90);
    const threshold = Number.isInteger(requestedThreshold) && requestedThreshold >= 0 && requestedThreshold <= 100 ? requestedThreshold : 90;
    try {
      const rows = await sql`WITH best AS (
        SELECT student_class, student_name, student_seat, speed, unit, accuracy, created_at,
          ROW_NUMBER() OVER (PARTITION BY student_class, student_name, student_seat
            ORDER BY speed DESC, accuracy DESC, created_at DESC, id) AS position
        FROM typing_records WHERE language = ${language} AND accuracy >= ${threshold}
          AND student_id IS NOT NULL AND student_class <> '' AND student_name <> '' AND student_seat <> ''
      ) SELECT student_class, student_name, student_seat, speed, unit, accuracy, created_at
        FROM best WHERE position = 1 ORDER BY speed DESC, accuracy DESC, created_at DESC,
          student_class, student_name, student_seat LIMIT 2000`;
      return res.status(200).json(rows.map(row => ({studentClass:row.student_class,
        studentName:row.student_name, studentSeat:row.student_seat,
        studentLabel:[row.student_class,row.student_name,row.student_seat+'號'].join(' ｜ '),
        speed:row.speed,unit:row.unit,accuracy:row.accuracy,createdAt:row.created_at})));
    } catch {return res.status(502).json({error:'排行榜資料庫暫時無法使用，請稍後重試。'});}
  }
  let credentials;
  try {credentials = await readCredentials();}
  catch {return res.status(503).json({error:'目前無法讀取教師登入設定，請稍後再試。'});}
  if (!sessionValid(req.headers.cookie, settings.secret, credentials.sessionKey)) return res.status(401).json({error: '請先登入教師端。'});
  const query = new URL(req.url, `https://${req.headers.host}`).searchParams;
  const studentId = query.get('studentId'), language = ['en', 'zh'].includes(query.get('language')) ? query.get('language') : null;
  const duration = [15, 30, 60, 120].includes(Number(query.get('duration'))) ? Number(query.get('duration')) : null;
  const assignmentId = query.get('assignmentId') && query.get('assignmentId').length <= 100 ? query.get('assignmentId') : null;
  const from = query.get('from') && Number.isFinite(Date.parse(query.get('from'))) ? new Date(query.get('from')).toISOString() : null;
  const to = query.get('to') && Number.isFinite(Date.parse(query.get('to'))) ? new Date(query.get('to')).toISOString() : null;
  try {
    await ensureAssignmentSchema(sql);
    const rows = await sql`SELECT * FROM typing_records
      WHERE (${studentId}::text IS NULL OR student_id = ${studentId})
        AND (${language}::text IS NULL OR language = ${language})
        AND (${duration}::int IS NULL OR duration = ${duration})
        AND (${assignmentId}::text IS NULL OR assignment_id = ${assignmentId})
        AND (${from}::timestamptz IS NULL OR created_at >= ${from})
        AND (${to}::timestamptz IS NULL OR created_at <= ${to})
      ORDER BY created_at DESC LIMIT 50000`;
    return res.status(200).json(rows.map(rowToRecord));
  } catch (error) {return res.status(502).json({error: error.message || '雲端資料服務目前無法使用。'});}
};

module.exports.cleanRecord = cleanRecord;
module.exports.sessionValid = sessionValid;
