'use strict';

const LESSON_LANGUAGE = Object.freeze({
  home:'en', reach:'en', top:'en', bottom:'en', symbols:'en', words:'en', sentences:'en',
  'zh-home':'zh', 'zh-initial':'zh', 'zh-final':'zh', 'zh-combo':'zh', 'zh-words':'zh',
  'zh-sentence':'zh', 'zh-punctuation':'zh', 'zh-long':'zh'
});

const validStudentId = value => typeof value === 'string' && value.length > 0 && value.length <= 100 && !/\s/.test(value);
const validLessonId = value => typeof value === 'string' && Object.hasOwn(LESSON_LANGUAGE,value);
const validMetric = (value,max) => Number.isInteger(value) && value >= 0 && value <= max;

function cleanAttempt(body) {
  if (!body || typeof body !== 'object' || !validStudentId(body.studentId) || !validLessonId(body.lessonId) ||
      !validMetric(body.accuracy,100) || !validMetric(body.speed,10000)) return null;
  return {
    studentId:body.studentId,
    lessonId:body.lessonId,
    language:LESSON_LANGUAGE[body.lessonId],
    accuracy:body.accuracy,
    speed:body.speed,
    completed:body.accuracy >= 90
  };
}

const rowToProgress = row => ({
  lessonId:row.lesson_id,
  language:row.language,
  bestAccuracy:Number(row.best_accuracy || 0),
  bestSpeed:Number(row.best_speed || 0),
  attempts:Number(row.attempts || 0),
  completedAt:row.completed_at ? new Date(row.completed_at).toISOString() : null,
  updatedAt:row.updated_at ? new Date(row.updated_at).toISOString() : null
});

module.exports = {LESSON_LANGUAGE,validStudentId,validLessonId,cleanAttempt,rowToProgress};
