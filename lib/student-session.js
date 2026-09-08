'use strict';

const crypto = require('node:crypto');
const STUDENT_COOKIE = '__Host-typing-student';
const STUDENT_TTL = 8 * 60 * 60;

const hashToken = value => crypto.createHash('sha256').update(value).digest('hex');
const randomToken = bytes => crypto.randomBytes(bytes).toString('base64url');

function cookieValue(header, name) {
  const cookie = (header || '').split(';').map(part => part.trim()).find(part => part.startsWith(name + '='));
  return cookie ? cookie.slice(name.length + 1) : '';
}

function setStudentCookie(res, token, maxAge = STUDENT_TTL) {
  res.setHeader('Set-Cookie', `${STUDENT_COOKIE}=${token}; Max-Age=${maxAge}; Path=/; HttpOnly; Secure; SameSite=Strict`);
}

function clearStudentCookie(res) {
  res.setHeader('Set-Cookie', `${STUDENT_COOKIE}=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Strict`);
}

function sameOrigin(req) {
  const origin = req.headers?.origin;
  if (!origin) return true;
  try { return new URL(origin).host === req.headers.host; }
  catch { return false; }
}

async function readStudentSession(sql, header) {
  const token = cookieValue(header, STUDENT_COOKIE);
  if (!token) return null;
  const tokenHash = hashToken(token);
  const rows = await sql`SELECT s.id AS session_id, s.student_id, s.expires_at,
      st.student_class, st.student_seat, st.student_name, st.active
    FROM typing_student_sessions s
    JOIN typing_students st ON st.id = s.student_id
    WHERE s.token_hash = ${tokenHash} AND s.revoked_at IS NULL AND s.expires_at > now()
      AND st.active = true LIMIT 1`;
  if (!rows[0]) return null;
  return {
    sessionId: rows[0].session_id,
    studentId: rows[0].student_id,
    expiresAt: new Date(rows[0].expires_at).toISOString(),
    student: {
      id: rows[0].student_id,
      className: rows[0].student_class,
      seat: rows[0].student_seat,
      name: rows[0].student_name
    }
  };
}

module.exports = {
  STUDENT_COOKIE,
  STUDENT_TTL,
  hashToken,
  randomToken,
  cookieValue,
  setStudentCookie,
  clearStudentCookie,
  sameOrigin,
  readStudentSession
};
