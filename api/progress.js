'use strict';

const {neon} = require('@neondatabase/serverless');
const {ensureProgressSchema} = require('../lib/progress-schema');
const {lessonLanguage, validLessonId} = require('../lib/lesson-catalog');
const {readStudentSession, sameOrigin, cookieValue, STUDENT_COOKIE} = require('../lib/student-session');

function config() {
  const databaseUrl = process.env.POSTGRES_URL || process.env.DATABASE_URL;
  return databaseUrl ? {databaseUrl} : null;
}

function cleanComplete(body) {
  if (!body || body.action !== 'complete' || !validLessonId(body.lessonId)) return null;
  if (!Number.isInteger(body.accuracy) || body.accuracy < 90 || body.accuracy > 100) return null;
  if (!Number.isInteger(body.speed) || body.speed < 0 || body.speed > 10000) return null;
  return {lessonId:body.lessonId,language:lessonLanguage(body.lessonId),accuracy:body.accuracy,speed:body.speed};
}

function cleanMerge(body) {
  if (!body || body.action !== 'merge' || !Array.isArray(body.lessonIds) || body.lessonIds.length > 20) return null;
  const lessonIds = [...new Set(body.lessonIds)];
  if (lessonIds.some(id => !validLessonId(id))) return null;
  return lessonIds;
}

const rowToProgress = row => ({
  lessonId:row.lesson_id,
  language:row.language,
  completedAt:new Date(row.completed_at).toISOString(),
  bestAccuracy:Number(row.best_accuracy),
  bestSpeed:Number(row.best_speed),
  attempts:Number(row.attempts),
  updatedAt:new Date(row.updated_at).toISOString()
});

module.exports = async function handler(req,res) {
  res.setHeader('Cache-Control','no-store');
  res.setHeader('X-Content-Type-Options','nosniff');
  if (!['GET','POST'].includes(req.method)) {res.setHeader('Allow','GET, POST'); return res.status(405).json({error:'不支援此操作。'});}
  const settings = config();
  if (!settings) return res.status(503).json({error:'課程進度服務尚未設定。'});
  if (!cookieValue(req.headers?.cookie, STUDENT_COOKIE)) return res.status(401).json({error:'請先使用學生啟用碼登入。'});
  if (req.method === 'POST' && !sameOrigin(req)) return res.status(403).json({error:'來源驗證失敗。'});

  const sql = neon(settings.databaseUrl);
  let session;
  try {session = await readStudentSession(sql,req.headers.cookie);} catch {return res.status(502).json({error:'目前無法驗證學生登入。'});}
  if (!session) return res.status(401).json({error:'學生登入已失效，請重新取得啟用碼。'});
  if (req.method === 'POST' && req.body?.studentId !== session.studentId) return res.status(403).json({error:'課程進度與目前學生登入身分不一致。'});
  try {await ensureProgressSchema(sql);} catch {return res.status(502).json({error:'課程進度資料表目前無法初始化。'});}

  try {
    if (req.method === 'GET') {
      const rows = await sql`SELECT lesson_id, language, completed_at, best_accuracy, best_speed, attempts, updated_at
        FROM typing_progress WHERE student_id = ${session.studentId} ORDER BY updated_at DESC, lesson_id`;
      return res.status(200).json({student:session.student,progress:rows.map(rowToProgress)});
    }

    const complete = cleanComplete(req.body);
    if (complete) {
      const rows = await sql`INSERT INTO typing_progress
          (student_id, lesson_id, language, completed_at, best_accuracy, best_speed, attempts, updated_at)
        VALUES (${session.studentId}, ${complete.lessonId}, ${complete.language}, now(), ${complete.accuracy}, ${complete.speed}, 1, now())
        ON CONFLICT (student_id, lesson_id) DO UPDATE SET
          language = EXCLUDED.language,
          best_accuracy = GREATEST(typing_progress.best_accuracy, EXCLUDED.best_accuracy),
          best_speed = GREATEST(typing_progress.best_speed, EXCLUDED.best_speed),
          attempts = typing_progress.attempts + 1,
          updated_at = now()
        RETURNING lesson_id, language, completed_at, best_accuracy, best_speed, attempts, updated_at`;
      return res.status(200).json({saved:true,student:session.student,progress:rowToProgress(rows[0])});
    }

    const lessonIds = cleanMerge(req.body);
    if (!lessonIds) return res.status(400).json({error:'課程進度資料格式不正確。'});
    for (const lessonId of lessonIds) {
      const language = lessonLanguage(lessonId);
      await sql`INSERT INTO typing_progress
          (student_id, lesson_id, language, completed_at, best_accuracy, best_speed, attempts, updated_at)
        VALUES (${session.studentId}, ${lessonId}, ${language}, now(), 90, 0, 1, now())
        ON CONFLICT (student_id, lesson_id) DO NOTHING`;
    }
    const rows = await sql`SELECT lesson_id, language, completed_at, best_accuracy, best_speed, attempts, updated_at
      FROM typing_progress WHERE student_id = ${session.studentId} ORDER BY updated_at DESC, lesson_id`;
    return res.status(200).json({merged:true,student:session.student,progress:rows.map(rowToProgress)});
  } catch {return res.status(502).json({error:'目前無法讀寫課程進度。'});}
};

module.exports.cleanComplete = cleanComplete;
module.exports.cleanMerge = cleanMerge;
module.exports.rowToProgress = rowToProgress;
