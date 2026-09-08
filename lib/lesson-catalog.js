'use strict';

const LESSON_CATALOG = Object.freeze({
  home:'en', reach:'en', top:'en', bottom:'en', symbols:'en', words:'en', sentences:'en',
  'zh-home':'zh', 'zh-initial':'zh', 'zh-final':'zh', 'zh-combo':'zh',
  'zh-words':'zh', 'zh-sentence':'zh', 'zh-punctuation':'zh', 'zh-long':'zh'
});

function lessonLanguage(lessonId) {
  return typeof lessonId === 'string' ? LESSON_CATALOG[lessonId] || null : null;
}

function validLessonId(lessonId) {
  return !!lessonLanguage(lessonId);
}

module.exports = {LESSON_CATALOG, lessonLanguage, validLessonId};
