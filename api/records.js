'use strict';

const crypto = require('node:crypto');
const {neon} = require('@neondatabase/serverless');
const COOKIE = '__Host-typing-teacher';
const TTL = 4 * 60 * 60;
const digest = value => crypto.createHash('sha256').update(value).digest();
const equal = (a, b) => typeof a === 'string' && a.length === 64 && crypto.timingSafeEqual(digest(a), digest(b));
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
  return {
    id: record.id, studentId: record.studentId || null, studentLabel: text(record.studentLabel, 160),
    studentClass: text(record.studentClass, 40), studentName: text(record.studentName, 80), studentSeat: text(record.studentSeat, 20),
    language: record.language, source: record.source, duration: record.duration, elapsedSeconds: Number(record.elapsedSeconds),
    speed: record.speed, unit: record.unit, accuracy: record.accuracy, correctChars: record.correctChars,
    errors: record.errors, typedLength: record.typedLength, targetLength: record.targetLength, createdAt: new Date(record.createdAt).toISOString()
  };
}
function rowToRecord(row) {
  return {id:row.id,studentId:row.student_id,studentLabel:row.student_label,studentClass:row.student_class,studentName:row.student_name,studentSeat:row.student_seat,language:row.language,source:row.source,duration:row.duration,elapsedSeconds:Number(row.elapsed_seconds),speed:row.speed,unit:row.unit,accuracy:row.accuracy,correctChars:row.correct_chars,errors:row.errors,typedLength:row.typed_length,targetLength:row.target_length,createdAt:row.created_at};
}
module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  const settings = config();
  if (!settings) return res.status(503).json({error: 'Vercel Postgres 尚未設定，請聯絡網站管理者。'});
  const sql = neon(settings.databaseUrl);
  if (req.method === 'POST') {
    const record = cleanRecord(req.body);
    if (!record) return res.status(400).json({error: '成績資料格式不正確。'});
    try {
      await sql`INSERT INTO typing_records (id, student_id, student_label, student_class, student_name, student_seat, language, source, duration, elapsed_seconds, speed, unit, accuracy, correct_chars, errors, typed_length, target_length, created_at)
        VALUES (${record.id}, ${record.studentId}, ${record.studentLabel}, ${record.studentClass}, ${record.studentName}, ${record.studentSeat}, ${record.language}, ${record.source}, ${record.duration}, ${record.elapsedSeconds}, ${record.speed}, ${record.unit}, ${record.accuracy}, ${record.correctChars}, ${record.errors}, ${record.typedLength}, ${record.targetLength}, ${record.createdAt})
        ON CONFLICT (id) DO NOTHING`;
      return res.status(201).json({saved: true, id: record.id});
    } catch (error) {return res.status(502).json({error: error.message || '雲端資料服務目前無法使用。'});}
  }
  if (req.method !== 'GET') {res.setHeader('Allow', 'GET, POST'); return res.status(405).json({error: '不支援此操作。'});}
  if (!sessionValid(req.headers.cookie, settings.secret, settings.password)) return res.status(401).json({error: '請先登入教師端。'});
  const query = new URL(req.url, `https://${req.headers.host}`).searchParams;
  const studentId = query.get('studentId'), language = ['en', 'zh'].includes(query.get('language')) ? query.get('language') : null;
  const duration = [15, 30, 60, 120].includes(Number(query.get('duration'))) ? Number(query.get('duration')) : null;
  const from = query.get('from') && Number.isFinite(Date.parse(query.get('from'))) ? new Date(query.get('from')).toISOString() : null;
  const to = query.get('to') && Number.isFinite(Date.parse(query.get('to'))) ? new Date(query.get('to')).toISOString() : null;
  try {
    const rows = await sql`SELECT * FROM typing_records
      WHERE (${studentId}::text IS NULL OR student_id = ${studentId})
        AND (${language}::text IS NULL OR language = ${language})
        AND (${duration}::int IS NULL OR duration = ${duration})
        AND (${from}::timestamptz IS NULL OR created_at >= ${from})
        AND (${to}::timestamptz IS NULL OR created_at <= ${to})
      ORDER BY created_at DESC LIMIT 50000`;
    return res.status(200).json(rows.map(rowToRecord));
  } catch (error) {return res.status(502).json({error: error.message || '雲端資料服務目前無法使用。'});}
};
