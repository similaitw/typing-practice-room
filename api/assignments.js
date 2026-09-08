'use strict';

const crypto = require('node:crypto');
const {neon} = require('@neondatabase/serverless');
const {readCredentials} = require('../lib/teacher-credentials');
const {ensureAssignmentSchema} = require('../lib/typing-schema');
const {readStudentSession, sameOrigin} = require('../lib/student-session');

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

const safeText = (value,max,required=true) => {
  if (typeof value !== 'string' || value.length > max || /[\r\n\t]/.test(value)) return null;
  const text = value.trim();
  return required && !text ? null : text;
};
const safeDate = value => value == null || value === '' ? null : (typeof value === 'string' && Number.isFinite(Date.parse(value)) ? new Date(value).toISOString() : undefined);
function cleanAssignment(raw, partial=false) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const out = {};
  if (!partial || raw.title !== undefined) {const v=safeText(raw.title,120,true); if(v===null)return null; out.title=v;}
  if (!partial || raw.language !== undefined) {if(!['en','zh'].includes(raw.language))return null; out.language=raw.language;}
  if (!partial || raw.duration !== undefined) {if(![15,30,60,120].includes(raw.duration))return null; out.duration=raw.duration;}
  for (const [key,min,max] of [['minAccuracy',0,100],['minSpeed',0,10000],['requiredAttempts',1,20]]) {
    if (!partial || raw[key] !== undefined) {if(!Number.isInteger(raw[key]) || raw[key] < min || raw[key] > max)return null; out[key]=raw[key];}
  }
  for (const key of ['startAt','dueAt']) {
    if (!partial || raw[key] !== undefined) {const v=safeDate(raw[key]); if(v===undefined)return null; out[key]=v;}
  }
  if (!partial || raw.active !== undefined) {if(raw.active!==undefined && typeof raw.active !== 'boolean')return null; out.active=raw.active !== false;}
  if (!partial || raw.targetClasses !== undefined) {
    if (!Array.isArray(raw.targetClasses) || !raw.targetClasses.length || raw.targetClasses.length > 50) return null;
    const classes = [...new Set(raw.targetClasses.map(v => safeText(v,40,true)))];
    if (classes.some(v => v === null) || !classes.length) return null;
    out.targetClasses = classes;
  }
  return out;
}
const rowToAssignment = (row,targets=[]) => ({
  id:row.id,title:row.title,language:row.language,duration:row.duration,minAccuracy:row.min_accuracy,minSpeed:row.min_speed,
  requiredAttempts:row.required_attempts,startAt:row.start_at ? new Date(row.start_at).toISOString() : null,
  dueAt:row.due_at ? new Date(row.due_at).toISOString() : null,active:row.active,
  createdAt:new Date(row.created_at).toISOString(),updatedAt:new Date(row.updated_at).toISOString(),targetClasses:targets
});

module.exports = async function handler(req,res) {
  res.setHeader('Cache-Control','no-store');
  res.setHeader('X-Content-Type-Options','nosniff');
  const settings = config();
  if (!settings) return res.status(503).json({error:'作業服務尚未設定。'});
  if (!['GET','POST','PATCH'].includes(req.method)) {res.setHeader('Allow','GET, POST, PATCH'); return res.status(405).json({error:'不支援此操作。'});}
  if (req.method !== 'GET' && !sameOrigin(req)) return res.status(403).json({error:'來源驗證失敗。'});
  const sql = neon(settings.databaseUrl);
  try {await ensureAssignmentSchema(sql);} catch {return res.status(502).json({error:'作業資料表目前無法初始化。'});}
  const query = new URL(req.url,`https://${req.headers.host}`).searchParams;

  if (req.method === 'GET' && query.get('view') === 'mine') {
    let session;
    try {session = await readStudentSession(sql,req.headers.cookie);} catch {return res.status(502).json({error:'目前無法確認學生登入。'});}
    if (!session) return res.status(401).json({error:'請先使用老師提供的學生啟用碼登入。'});
    try {
      const rows = await sql`SELECT a.*,
          COUNT(r.id) FILTER (WHERE r.student_id = ${session.studentId} AND r.accuracy >= a.min_accuracy AND r.speed >= a.min_speed
            AND (a.due_at IS NULL OR r.created_at <= a.due_at))::int AS valid_attempts
        FROM typing_assignments a
        JOIN typing_assignment_targets t ON t.assignment_id = a.id
        LEFT JOIN typing_records r ON r.assignment_id = a.id
        WHERE a.active = true AND t.student_class = ${session.student.className}
          AND (a.start_at IS NULL OR a.start_at <= now())
        GROUP BY a.id
        ORDER BY (a.due_at IS NULL), a.due_at, a.created_at DESC LIMIT 100`;
      const now = Date.now();
      return res.status(200).json(rows.map(row => {
        const attempts = Number(row.valid_attempts || 0);
        const completed = attempts >= row.required_attempts;
        const overdue = !completed && row.due_at && Date.parse(row.due_at) < now;
        return {...rowToAssignment(row,[session.student.className]),validAttempts:attempts,status:completed?'completed':overdue?'overdue':attempts?'in_progress':'not_started'};
      }));
    } catch {return res.status(502).json({error:'目前無法讀取學生作業。'});}
  }

  let credentials;
  try {credentials = await readCredentials();} catch {return res.status(503).json({error:'目前無法讀取教師登入設定。'});}
  if (!teacherSessionValid(req.headers.cookie,settings.secret,credentials.sessionKey)) return res.status(401).json({error:'請先登入教師端。'});

  if (req.method === 'GET') {
    try {
      const rows = await sql`SELECT * FROM typing_assignments ORDER BY active DESC, created_at DESC LIMIT 500`;
      const targets = await sql`SELECT assignment_id, student_class FROM typing_assignment_targets ORDER BY student_class`;
      const byId = new Map();
      for (const target of targets) {if(!byId.has(target.assignment_id))byId.set(target.assignment_id,[]); byId.get(target.assignment_id).push(target.student_class);}
      return res.status(200).json(rows.map(row => rowToAssignment(row,byId.get(row.id)||[])));
    } catch {return res.status(502).json({error:'目前無法讀取作業。'});}
  }

  if (req.method === 'POST') {
    const assignment = cleanAssignment(req.body);
    if (!assignment) return res.status(400).json({error:'作業資料格式不正確。'});
    if (assignment.startAt && assignment.dueAt && Date.parse(assignment.startAt) > Date.parse(assignment.dueAt)) return res.status(400).json({error:'開始時間不能晚於截止時間。'});
    const id = crypto.randomUUID();
    try {
      await sql`INSERT INTO typing_assignments (id,title,language,duration,min_accuracy,min_speed,required_attempts,start_at,due_at,active)
        VALUES (${id},${assignment.title},${assignment.language},${assignment.duration},${assignment.minAccuracy},${assignment.minSpeed},${assignment.requiredAttempts},${assignment.startAt},${assignment.dueAt},${assignment.active})`;
      for (const className of assignment.targetClasses) await sql`INSERT INTO typing_assignment_targets (assignment_id,student_class) VALUES (${id},${className}) ON CONFLICT DO NOTHING`;
      return res.status(201).json({id,...assignment});
    } catch {return res.status(502).json({error:'目前無法建立作業。'});}
  }

  const id = req.body?.id;
  if (typeof id !== 'string' || !id || id.length > 100 || /\s/.test(id)) return res.status(400).json({error:'作業 ID 格式不正確。'});
  const patch = cleanAssignment(req.body,true);
  if (!patch) return res.status(400).json({error:'作業資料格式不正確。'});
  try {
    const rows = await sql`SELECT * FROM typing_assignments WHERE id = ${id} LIMIT 1`;
    if (!rows[0]) return res.status(404).json({error:'找不到這份作業。'});
    const current = rowToAssignment(rows[0],[]);
    const next = {
      title:patch.title ?? current.title,language:patch.language ?? current.language,duration:patch.duration ?? current.duration,
      minAccuracy:patch.minAccuracy ?? current.minAccuracy,minSpeed:patch.minSpeed ?? current.minSpeed,
      requiredAttempts:patch.requiredAttempts ?? current.requiredAttempts,startAt:patch.startAt !== undefined ? patch.startAt : current.startAt,
      dueAt:patch.dueAt !== undefined ? patch.dueAt : current.dueAt,active:patch.active ?? current.active
    };
    if (next.startAt && next.dueAt && Date.parse(next.startAt) > Date.parse(next.dueAt)) return res.status(400).json({error:'開始時間不能晚於截止時間。'});
    await sql`UPDATE typing_assignments SET title=${next.title},language=${next.language},duration=${next.duration},min_accuracy=${next.minAccuracy},
      min_speed=${next.minSpeed},required_attempts=${next.requiredAttempts},start_at=${next.startAt},due_at=${next.dueAt},active=${next.active},updated_at=now() WHERE id=${id}`;
    if (patch.targetClasses) {
      await sql`DELETE FROM typing_assignment_targets WHERE assignment_id = ${id}`;
      for (const className of patch.targetClasses) await sql`INSERT INTO typing_assignment_targets (assignment_id,student_class) VALUES (${id},${className})`;
    }
    return res.status(200).json({id,...next,targetClasses:patch.targetClasses});
  } catch {return res.status(502).json({error:'目前無法更新作業。'});}
};

module.exports.cleanAssignment = cleanAssignment;
module.exports.teacherSessionValid = teacherSessionValid;
