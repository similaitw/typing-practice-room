'use strict';

const crypto = require('node:crypto');
const {neon} = require('@neondatabase/serverless');
const {sameOrigin} = require('../lib/student-session');

function config() {
  const databaseUrl = process.env.POSTGRES_URL || process.env.DATABASE_URL;
  return databaseUrl ? {databaseUrl} : null;
}

function cleanIdentity(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const className = typeof raw.className === 'string' ? raw.className.trim() : '';
  const name = typeof raw.name === 'string' ? raw.name.trim() : '';
  let seat = typeof raw.seat === 'string' || typeof raw.seat === 'number' ? String(raw.seat).trim() : '';
  if (!className || className.length > 40 || !name || name.length > 80 ||
      !/^\d{1,3}$/.test(seat) || Number(seat) < 1 || Number(seat) > 999 ||
      /[\r\n\t]/.test(className + name)) return null;
  seat = seat.padStart(2, '0');
  return {className, name, seat};
}

const rowToStudent = row => ({
  id: row.id,
  className: row.student_class,
  name: row.student_name,
  seat: row.student_seat,
  active: row.active !== false
});

async function findStudent(sql, identity) {
  const rows = await sql`SELECT id, student_class, student_name, student_seat, active
    FROM typing_students
    WHERE student_class = ${identity.className} AND student_name = ${identity.name} AND student_seat = ${identity.seat}
    LIMIT 1`;
  return rows[0] ? rowToStudent(rows[0]) : null;
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({error: '不支援此操作。'});
  }
  if (!sameOrigin(req)) return res.status(403).json({error: '來源驗證失敗。'});
  const settings = config();
  if (!settings) return res.status(503).json({error: '排行榜資料庫尚未設定。'});
  if (req.body && JSON.stringify(req.body).length > 4096) return res.status(413).json({error: '登錄資料過大。'});
  const identity = cleanIdentity(req.body);
  if (!identity) return res.status(400).json({error: '請正確填寫班級、姓名與座號。'});

  const sql = neon(settings.databaseUrl);
  try {
    let student = await findStudent(sql, identity);
    if (student) {
      if (!student.active) return res.status(403).json({error: '這個學生身分目前已停用，請洽老師。'});
      return res.status(200).json({student, created: false});
    }

    const countRows = await sql`SELECT COUNT(*)::int AS count FROM typing_students WHERE active = true`;
    if (Number(countRows[0]?.count || 0) >= 2000) return res.status(409).json({error: '排行榜登錄人數已達上限，請洽老師。'});

    const id = crypto.randomUUID();
    const inserted = await sql`INSERT INTO typing_students (id, student_class, student_seat, student_name, active, created_at, updated_at)
      VALUES (${id}, ${identity.className}, ${identity.seat}, ${identity.name}, true, now(), now())
      ON CONFLICT (student_class, student_seat, student_name) DO NOTHING
      RETURNING id, student_class, student_name, student_seat, active`;
    if (inserted[0]) return res.status(201).json({student: rowToStudent(inserted[0]), created: true});

    student = await findStudent(sql, identity);
    if (!student) throw Error('排行榜身分寫入衝突。');
    if (!student.active) return res.status(403).json({error: '這個學生身分目前已停用，請洽老師。'});
    return res.status(200).json({student, created: false});
  } catch (error) {
    return res.status(502).json({error: error.message || '排行榜登錄服務目前無法使用。'});
  }
};

module.exports.cleanIdentity = cleanIdentity;
