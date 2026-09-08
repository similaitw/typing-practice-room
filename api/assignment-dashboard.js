'use strict';

const crypto = require('node:crypto');
const {neon} = require('@neondatabase/serverless');
const {readCredentials} = require('../lib/teacher-credentials');
const {ensureAssignmentSchema} = require('../lib/typing-schema');

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

const validId = value => typeof value === 'string' && value.length > 0 && value.length <= 100 && !/\s/.test(value);
const validClass = value => value == null || value === '' || (typeof value === 'string' && value.length <= 40 && !/[\r\n\t]/.test(value));

function dashboardStatus({validAttempts=0,totalAttempts=0,requiredAttempts=1,dueAt=null}, now=Date.now()) {
  if (Number(validAttempts) >= Number(requiredAttempts)) return 'completed';
  if (dueAt && Date.parse(dueAt) < now) return 'overdue';
  return Number(totalAttempts) > 0 ? 'in_progress' : 'not_started';
}

const rowToAssignment = (row, classes) => ({
  id:row.id,title:row.title,language:row.language,duration:row.duration,minAccuracy:row.min_accuracy,minSpeed:row.min_speed,
  requiredAttempts:row.required_attempts,startAt:row.start_at ? new Date(row.start_at).toISOString() : null,
  dueAt:row.due_at ? new Date(row.due_at).toISOString() : null,active:row.active,targetClasses:classes
});

module.exports = async function handler(req,res) {
  res.setHeader('Cache-Control','no-store');
  res.setHeader('X-Content-Type-Options','nosniff');
  if (req.method !== 'GET') {res.setHeader('Allow','GET'); return res.status(405).json({error:'不支援此操作。'});}
  const settings = config();
  if (!settings) return res.status(503).json({error:'作業儀表板服務尚未設定。'});

  let credentials;
  try {credentials = await readCredentials();} catch {return res.status(503).json({error:'目前無法讀取教師登入設定。'});}
  if (!teacherSessionValid(req.headers.cookie,settings.secret,credentials.sessionKey)) return res.status(401).json({error:'請先登入教師端。'});

  const query = new URL(req.url,`https://${req.headers.host}`).searchParams;
  const assignmentId = query.get('id');
  const className = query.get('class') || null;
  if (!validId(assignmentId)) return res.status(400).json({error:'作業 ID 格式不正確。'});
  if (!validClass(className)) return res.status(400).json({error:'班級格式不正確。'});

  const sql = neon(settings.databaseUrl);
  try {await ensureAssignmentSchema(sql);} catch {return res.status(502).json({error:'作業資料表目前無法初始化。'});}

  try {
    const assignments = await sql`SELECT * FROM typing_assignments WHERE id = ${assignmentId} LIMIT 1`;
    if (!assignments[0]) return res.status(404).json({error:'找不到這份作業。'});
    const targetRows = await sql`SELECT student_class FROM typing_assignment_targets WHERE assignment_id = ${assignmentId} ORDER BY student_class`;
    const targetClasses = targetRows.map(row => row.student_class);
    if (className && !targetClasses.includes(className)) return res.status(400).json({error:'這份作業沒有指派給所選班級。'});

    const assignment = rowToAssignment(assignments[0],targetClasses);
    const rows = await sql`SELECT s.id, s.student_class, s.student_seat, s.student_name,
        COUNT(r.id)::int AS total_attempts,
        COUNT(r.id) FILTER (WHERE r.accuracy >= ${assignment.minAccuracy} AND r.speed >= ${assignment.minSpeed}
          AND (${assignment.dueAt}::timestamptz IS NULL OR r.created_at <= ${assignment.dueAt}))::int AS valid_attempts,
        MAX(r.speed)::int AS best_speed,
        MAX(r.accuracy)::int AS best_accuracy,
        MAX(r.created_at) AS last_attempt_at
      FROM typing_students s
      LEFT JOIN typing_records r ON r.student_id = s.id AND r.assignment_id = ${assignmentId}
      WHERE s.active = true
        AND EXISTS (SELECT 1 FROM typing_assignment_targets t WHERE t.assignment_id = ${assignmentId} AND t.student_class = s.student_class)
        AND (${className}::text IS NULL OR s.student_class = ${className})
      GROUP BY s.id, s.student_class, s.student_seat, s.student_name
      ORDER BY s.student_class, s.student_seat, s.student_name`;

    const now = Date.now();
    const students = rows.map(row => {
      const item = {
        id:row.id,className:row.student_class,seat:row.student_seat,name:row.student_name,
        totalAttempts:Number(row.total_attempts || 0),validAttempts:Number(row.valid_attempts || 0),
        bestSpeed:row.best_speed == null ? null : Number(row.best_speed),
        bestAccuracy:row.best_accuracy == null ? null : Number(row.best_accuracy),
        lastAttemptAt:row.last_attempt_at ? new Date(row.last_attempt_at).toISOString() : null,
        requiredAttempts:assignment.requiredAttempts,dueAt:assignment.dueAt
      };
      item.status = dashboardStatus(item,now);
      return item;
    });
    const completed = students.filter(student => student.status === 'completed').length;
    const inProgress = students.filter(student => student.status === 'in_progress').length;
    const overdue = students.filter(student => student.status === 'overdue').length;
    const notStarted = students.filter(student => student.status === 'not_started').length;
    const total = students.length;

    return res.status(200).json({
      assignment,selectedClass:className,classes:targetClasses,
      summary:{total,completed,inProgress,notStarted,overdue,completionRate:total ? Math.round(completed/total*100) : 0},
      students,generatedAt:new Date().toISOString()
    });
  } catch {return res.status(502).json({error:'目前無法讀取作業完成度。'});}
};

module.exports.dashboardStatus = dashboardStatus;
module.exports.teacherSessionValid = teacherSessionValid;
module.exports.validId = validId;
module.exports.validClass = validClass;
