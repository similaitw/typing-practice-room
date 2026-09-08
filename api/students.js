'use strict';

const crypto = require('node:crypto');
const {neon} = require('@neondatabase/serverless');
const {readCredentials} = require('../lib/teacher-credentials');

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

const safeText = (value, max, required = false) => {
  if (typeof value !== 'string' || value.length > max || /[\r\n\t]/.test(value)) return null;
  const trimmed = value.trim();
  return required && !trimmed ? null : trimmed;
};

function cleanStudent(raw, partial = false) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const result = {};
  if (!partial || raw.id !== undefined) {
    if (typeof raw.id !== 'string' || !raw.id || raw.id.length > 100 || /\s/.test(raw.id)) return null;
    result.id = raw.id;
  }
  for (const [key, source, max, required] of [
    ['className', 'className', 40, false],
    ['seat', 'seat', 20, false],
    ['name', 'name', 80, true]
  ]) {
    if (partial && raw[source] === undefined) continue;
    const value = safeText(raw[source] ?? '', max, required);
    if (value === null) return null;
    result[key] = value;
  }
  if (!partial || raw.active !== undefined) {
    if (raw.active !== undefined && typeof raw.active !== 'boolean') return null;
    result.active = raw.active !== false;
  }
  if (!partial || raw.createdAt !== undefined) {
    const createdAt = raw.createdAt === undefined ? new Date().toISOString() : raw.createdAt;
    if (typeof createdAt !== 'string' || !Number.isFinite(Date.parse(createdAt))) return null;
    result.createdAt = new Date(createdAt).toISOString();
  }
  return result;
}

const rowToStudent = row => ({
  id: row.id,
  className: row.student_class,
  seat: row.student_seat,
  name: row.student_name,
  active: row.active,
  createdAt: new Date(row.created_at).toISOString(),
  updatedAt: new Date(row.updated_at).toISOString()
});

async function ensureSchema(sql) {
  await sql`CREATE TABLE IF NOT EXISTS typing_students (
    id text PRIMARY KEY,
    student_class text NOT NULL DEFAULT '',
    student_seat text NOT NULL DEFAULT '',
    student_name text NOT NULL,
    active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
  )`;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS typing_students_identity_idx
    ON typing_students (student_class, student_seat, student_name)`;
  await sql`CREATE INDEX IF NOT EXISTS typing_students_active_class_idx
    ON typing_students (active, student_class, student_seat, student_name)`;
}

async function updateRecordIdentity(sql, id, student) {
  const label = [student.className, student.name, student.seat ? student.seat + '號' : ''].filter(Boolean).join(' ｜ ');
  await sql`UPDATE typing_records SET student_id = ${id}, student_label = ${label}, student_class = ${student.className},
    student_name = ${student.name}, student_seat = ${student.seat}
    WHERE student_id = ${id}`;
}

async function upsertStudent(sql, student) {
  let rows = await sql`SELECT id FROM typing_students
    WHERE id = ${student.id} OR (student_class = ${student.className} AND student_seat = ${student.seat} AND student_name = ${student.name})
    ORDER BY CASE WHEN id = ${student.id} THEN 0 ELSE 1 END LIMIT 1`;
  let id = rows[0]?.id;
  if (!id) {
    try {
      rows = await sql`INSERT INTO typing_students (id, student_class, student_seat, student_name, active, created_at, updated_at)
        VALUES (${student.id}, ${student.className}, ${student.seat}, ${student.name}, ${student.active}, ${student.createdAt}, now())
        RETURNING id`;
      id = rows[0].id;
    } catch {
      rows = await sql`SELECT id FROM typing_students
        WHERE student_class = ${student.className} AND student_seat = ${student.seat} AND student_name = ${student.name} LIMIT 1`;
      if (!rows[0]) throw Error('學生資料寫入衝突。');
      id = rows[0].id;
    }
  }
  await sql`UPDATE typing_students SET student_class = ${student.className}, student_seat = ${student.seat},
    student_name = ${student.name}, active = ${student.active}, updated_at = now() WHERE id = ${id}`;
  if (id !== student.id) {
    const label = [student.className, student.name, student.seat ? student.seat + '號' : ''].filter(Boolean).join(' ｜ ');
    await sql`UPDATE typing_records SET student_id = ${id}, student_label = ${label}, student_class = ${student.className},
      student_name = ${student.name}, student_seat = ${student.seat}
      WHERE student_id = ${student.id} AND student_class = ${student.className}
        AND student_name = ${student.name} AND student_seat = ${student.seat}`;
  }
  await updateRecordIdentity(sql, id, student);
  return id;
}

async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  const settings = config();
  if (!settings) return res.status(503).json({error: 'Vercel Postgres 尚未設定，請聯絡網站管理者。'});
  if (req.body && JSON.stringify(req.body).length > 256 * 1024) return res.status(413).json({error: '學生名單資料過大。'});

  let credentials;
  try { credentials = await readCredentials(); }
  catch { return res.status(503).json({error: '目前無法讀取教師登入設定，請稍後再試。'}); }
  if (!sessionValid(req.headers.cookie, settings.secret, credentials.sessionKey)) return res.status(401).json({error: '請先登入教師端。'});

  const sql = neon(settings.databaseUrl);
  try { await ensureSchema(sql); }
  catch { return res.status(502).json({error: '雲端學生名單目前無法初始化。'}); }

  if (req.method === 'GET') {
    try {
      const rows = await sql`SELECT * FROM typing_students ORDER BY active DESC, student_class, student_seat, student_name, created_at LIMIT 2000`;
      return res.status(200).json(rows.map(rowToStudent));
    } catch { return res.status(502).json({error: '雲端學生名單目前無法讀取。'}); }
  }

  if (req.method === 'POST') {
    const items = Array.isArray(req.body?.students) ? req.body.students : [req.body?.student ?? req.body];
    if (!items.length || items.length > 200) return res.status(400).json({error: '每次可儲存 1–200 位學生。'});
    const students = items.map(item => cleanStudent(item));
    if (students.some(student => !student)) return res.status(400).json({error: '學生資料格式不正確。'});
    try {
      const saved = [];
      for (let offset = 0; offset < students.length; offset += 25) {
        const chunk = students.slice(offset, offset + 25);
        saved.push(...await Promise.all(chunk.map(student => upsertStudent(sql, student))));
      }
      return res.status(200).json({saved});
    } catch { return res.status(502).json({error: '雲端學生名單目前無法儲存。'}); }
  }

  if (req.method === 'PATCH') {
    if (typeof req.body?.id !== 'string' || !req.body.id || req.body.id.length > 100 || /\s/.test(req.body.id)) return res.status(400).json({error: '學生 ID 格式不正確。'});
    const patch = cleanStudent(req.body, true);
    if (!patch) return res.status(400).json({error: '學生資料格式不正確。'});
    try {
      const rows = await sql`SELECT * FROM typing_students WHERE id = ${req.body.id} LIMIT 1`;
      if (!rows[0]) return res.status(404).json({error: '找不到這位學生。'});
      const current = rowToStudent(rows[0]);
      const next = {
        id: current.id,
        className: patch.className ?? current.className,
        seat: patch.seat ?? current.seat,
        name: patch.name ?? current.name,
        active: patch.active ?? current.active,
        createdAt: current.createdAt
      };
      try {
        await sql`UPDATE typing_students SET student_class = ${next.className}, student_seat = ${next.seat},
          student_name = ${next.name}, active = ${next.active}, updated_at = now() WHERE id = ${next.id}`;
      } catch { return res.status(409).json({error: '已有相同班級、姓名與座號的學生。'}); }
      await updateRecordIdentity(sql, next.id, next);
      const updated = await sql`SELECT * FROM typing_students WHERE id = ${next.id} LIMIT 1`;
      return res.status(200).json(rowToStudent(updated[0]));
    } catch { return res.status(502).json({error: '雲端學生名單目前無法更新。'}); }
  }

  res.setHeader('Allow', 'GET, POST, PATCH');
  return res.status(405).json({error: '不支援此操作。'});
}

module.exports = handler;
module.exports.cleanStudent = cleanStudent;
module.exports.sessionValid = sessionValid;
