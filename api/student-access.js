'use strict';

const crypto = require('node:crypto');
const {neon} = require('@neondatabase/serverless');
const {readCredentials} = require('../lib/teacher-credentials');
const {ensureAssignmentSchema} = require('../lib/typing-schema');
const {
  STUDENT_TTL,
  hashToken,
  randomToken,
  setStudentCookie,
  clearStudentCookie,
  sameOrigin,
  readStudentSession
} = require('../lib/student-session');

const TEACHER_COOKIE = '__Host-typing-teacher';
const TEACHER_TTL = 4 * 60 * 60;
const digest = value => crypto.createHash('sha256').update(value).digest();
const equal = (a, b) => typeof a === 'string' && a.length === b.length && crypto.timingSafeEqual(digest(a), digest(b));
function teacherSessionValid(header, secret, password) {
  const cookie = (header || '').split(';').map(s => s.trim()).find(s => s.startsWith(TEACHER_COOKIE + '='));
  if (!cookie) return false;
  const [payload, signature, ...extra] = cookie.slice(TEACHER_COOKIE.length + 1).split('.');
  if (!payload || !signature || extra.length) return false;
  const expected = crypto.createHmac('sha256', secret).update(payload + '.' + digest(password).toString('hex')).digest('base64url');
  if (!equal(signature, expected)) return false;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return data.role === 'teacher' && Number.isInteger(data.exp) && data.exp > Date.now() / 1000 && data.exp <= Date.now() / 1000 + TEACHER_TTL + 5;
  } catch { return false; }
}

function config() {
  const databaseUrl = process.env.POSTGRES_URL || process.env.DATABASE_URL;
  const password = process.env.TEACHER_PASSWORD;
  const secret = process.env.TEACHER_SESSION_SECRET;
  return databaseUrl && password?.length >= 12 && secret?.length >= 32 ? {databaseUrl, password, secret} : null;
}

const safeId = value => typeof value === 'string' && value.length >= 1 && value.length <= 100 && !/\s/.test(value);

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  const settings = config();
  if (!settings) return res.status(503).json({error:'學生登入服務尚未設定。'});
  if (!['GET','POST'].includes(req.method)) {res.setHeader('Allow','GET, POST'); return res.status(405).json({error:'不支援此操作。'});}
  if (req.method === 'POST' && !sameOrigin(req)) return res.status(403).json({error:'來源驗證失敗。'});
  const sql = neon(settings.databaseUrl);
  try { await ensureAssignmentSchema(sql); }
  catch { return res.status(502).json({error:'學生登入資料表目前無法初始化。'}); }

  if (req.method === 'GET') {
    try {
      const session = await readStudentSession(sql, req.headers.cookie);
      if (!session) return res.status(200).json({authenticated:false});
      return res.status(200).json({authenticated:true, expiresAt:session.expiresAt, student:session.student});
    } catch { return res.status(502).json({error:'目前無法確認學生登入狀態。'}); }
  }

  const action = req.body?.action;
  if (action === 'redeem') {
    const code = typeof req.body?.code === 'string' ? req.body.code.trim() : '';
    if (code.length < 20 || code.length > 100 || /\s/.test(code)) return res.status(400).json({error:'啟用碼格式不正確。'});
    try {
      const codeHash = hashToken(code);
      const rows = await sql`SELECT a.student_id, st.student_class, st.student_seat, st.student_name
        FROM typing_student_access a JOIN typing_students st ON st.id = a.student_id
        WHERE a.code_hash = ${codeHash} AND a.code_expires_at > now() AND st.active = true LIMIT 1`;
      if (!rows[0]) return res.status(401).json({error:'啟用碼無效或已過期，請向老師取得新的啟用碼。'});
      const token = randomToken(32), tokenHash = hashToken(token), sessionId = crypto.randomUUID();
      const expiresAt = new Date(Date.now() + STUDENT_TTL * 1000).toISOString();
      await sql`INSERT INTO typing_student_sessions (id, student_id, token_hash, expires_at)
        VALUES (${sessionId}, ${rows[0].student_id}, ${tokenHash}, ${expiresAt})`;
      await sql`UPDATE typing_student_access SET code_hash = NULL, code_expires_at = NULL, updated_at = now()
        WHERE student_id = ${rows[0].student_id} AND code_hash = ${codeHash}`;
      setStudentCookie(res, token);
      return res.status(200).json({authenticated:true,expiresAt,student:{id:rows[0].student_id,className:rows[0].student_class,seat:rows[0].student_seat,name:rows[0].student_name}});
    } catch { return res.status(502).json({error:'目前無法完成學生登入。'}); }
  }

  if (action === 'logout') {
    try {
      const session = await readStudentSession(sql, req.headers.cookie);
      if (session) await sql`UPDATE typing_student_sessions SET revoked_at = now() WHERE id = ${session.sessionId}`;
      clearStudentCookie(res);
      return res.status(200).json({authenticated:false});
    } catch { return res.status(502).json({error:'目前無法完成學生登出。'}); }
  }

  if (action === 'issue') {
    let credentials;
    try { credentials = await readCredentials(); }
    catch { return res.status(503).json({error:'目前無法讀取教師登入設定。'}); }
    if (!teacherSessionValid(req.headers.cookie, settings.secret, credentials.sessionKey)) return res.status(401).json({error:'請先登入教師端。'});
    const studentId = req.body?.studentId;
    if (!safeId(studentId)) return res.status(400).json({error:'學生 ID 格式不正確。'});
    try {
      const rows = await sql`SELECT id, student_class, student_seat, student_name FROM typing_students WHERE id = ${studentId} AND active = true LIMIT 1`;
      if (!rows[0]) return res.status(404).json({error:'找不到這位啟用中的學生。'});
      const code = randomToken(24), codeHash = hashToken(code), expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      await sql`INSERT INTO typing_student_access (student_id, code_hash, code_expires_at, updated_at)
        VALUES (${studentId}, ${codeHash}, ${expiresAt}, now())
        ON CONFLICT (student_id) DO UPDATE SET code_hash = EXCLUDED.code_hash, code_expires_at = EXCLUDED.code_expires_at, updated_at = now()`;
      await sql`UPDATE typing_student_sessions SET revoked_at = now() WHERE student_id = ${studentId} AND revoked_at IS NULL`;
      return res.status(200).json({code,expiresAt,student:{id:rows[0].id,className:rows[0].student_class,seat:rows[0].student_seat,name:rows[0].student_name}});
    } catch { return res.status(502).json({error:'目前無法產生學生啟用碼。'}); }
  }

  return res.status(400).json({error:'不支援的學生登入操作。'});
};

module.exports.teacherSessionValid = teacherSessionValid;
