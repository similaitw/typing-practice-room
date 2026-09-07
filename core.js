'use strict';

// Shared, browser-independent rules for scoring, CSV and backup validation.
const TypingCore = (() => {
  const emptyData = () => ({version: 1, settings: {}, students: [], lessonProgress: {}, testRecords: []});
  const chars = text => Array.from(text);
  function measure(value, target, seconds, language) {
    const typed = chars(value), expected = chars(target);
    const correct = typed.filter((c, i) => c === expected[i]).length;
    const elapsed = Math.max(0.1, seconds);
    return {correct, typed: typed.length, errors: typed.length - correct,
      accuracy: typed.length ? Math.round(correct / typed.length * 100) : 100,
      speed: Math.round(correct / (language === 'en' ? 5 : 1) / (elapsed / 60)),
      elapsed, progress: Math.min(100, Math.round(typed.length / Math.max(1, expected.length) * 100))};
  }
  const languageOf = text => /[\p{Script=Han}\p{Script=Bopomofo}]/u.test(text) ? 'zh' : 'en';
  const compareScores = (a, b) => b.speed - a.speed || b.accuracy - a.accuracy || b.createdAt.localeCompare(a.createdAt);
  function rank(records, language, threshold, students) {
    const ids = new Set(students.map(s => s.id));
    const best = new Map();
    records.filter(r => r.language === language && ids.has(r.studentId) && r.accuracy >= threshold)
      .sort(compareScores).forEach(r => { if (!best.has(r.studentId)) best.set(r.studentId, r); });
    return [...best.values()].sort(compareScores);
  }
  function parseCSV(text) {
    const rows = []; let row = [], cell = '', quoted = false, closed = false;
    text = text.replace(/^\uFEFF/, '');
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (quoted) {
        if (c === '"' && text[i + 1] === '"') {cell += '"'; i++;}
        else if (c === '"') {quoted = false; closed = true;}
        else cell += c;
      } else if (c === '"') {
        if (cell || closed) throw Error('CSV 引號格式不正確。');
        quoted = true;
      } else if (c === ',' || c === '\n' || c === '\r') {
        row.push(cell); cell = ''; closed = false;
        if (c !== ',') {
          if (row.some(x => x.trim())) rows.push(row);
          row = [];
          if (c === '\r' && text[i + 1] === '\n') i++;
        }
      } else {
        if (closed && c.trim()) throw Error('CSV 引號後有多餘文字。');
        if (!closed) cell += c;
      }
    }
    if (quoted) throw Error('CSV 引號未結束。');
    row.push(cell);
    if (row.some(x => x.trim())) rows.push(row);
    return rows;
  }
  function rosterCSV(text) {
    const rows = parseCSV(text), header = rows.shift()?.map(s => s.trim());
    const name = header?.indexOf('姓名'), seat = header?.indexOf('座號'), classColumn = header?.indexOf('班級');
    if (name == null || name < 0 || seat < 0) throw Error('CSV 首列必須包含「座號、姓名」。');
    return rows.map(row => {
      const n = (row[name] || '').trim(), s = (row[seat] || '').trim();
      if (!n || n.length > 80 || s.length > 20 || /[\r\n]/.test(n + s)) throw Error('姓名或座號格式不正確。');
      const entry = {seat: /^\d+$/.test(s) ? s.padStart(2, '0') : s, name: n};
      if (classColumn >= 0) {
        const className = (row[classColumn] || '').trim();
        if (className.length > 40 || /[\r\n\t]/.test(className)) throw Error('班級最多 40 字，不能包含換行。');
        entry.className = className;
      }
      return entry;
    });
  }
  function csvCell(value) {
    let text = String(value ?? '');
    if (/^[\s]*[=+@-]/.test(text)) text = "'" + text;
    return '"' + text.replaceAll('"', '""') + '"';
  }
  const validText = (v, max) => typeof v === 'string' && v.length <= max;
  const validDate = v => validText(v, 40) && Number.isFinite(Date.parse(v));
  const number = (v, max = 10000000) => Number.isFinite(v) && v >= 0 && v <= max;
  function validateData(p) {
    const fail = () => {throw Error('備份資料格式不正確或版本不支援，原有資料未變更。');};
    if (!p || p.version !== 1 || !Array.isArray(p.students) || p.students.length > 2000 ||
        !Array.isArray(p.testRecords) || p.testRecords.length > 50000 ||
        !p.lessonProgress || typeof p.lessonProgress !== 'object' || Array.isArray(p.lessonProgress)) fail();
    const result = emptyData(), ids = new Set(), recordIds = new Set();
    for (const s of p.students) {
      if (!s || !validText(s.id, 100) || !s.id || ids.has(s.id) || !validText(s.seat, 20) ||
          !validText(s.name, 80) || !s.name.trim() || !validDate(s.createdAt) ||
          (s.className !== undefined && !validText(s.className,40))) fail();
      ids.add(s.id);
      result.students.push({id:s.id, seat:s.seat, name:s.name, createdAt:new Date(s.createdAt).toISOString()});
      if (s.className !== undefined) result.students.at(-1).className = s.className;
    }
    for (const r of p.testRecords) {
      if (!r || !validText(r.id, 100) || !r.id || recordIds.has(r.id) ||
          !(r.studentId === null || validText(r.studentId, 100)) || !validText(r.studentLabel, 160) ||
          !['en','zh'].includes(r.language) || !['builtin','custom'].includes(r.source) ||
          ![15,30,60,120].includes(r.duration) || !validDate(r.createdAt) ||
          r.unit !== (r.language === 'en' ? 'WPM' : 'CPM') || !number(r.accuracy,100) ||
          !number(r.elapsedSeconds, r.duration + 1) ||
          !['speed','correctChars','errors','typedLength','targetLength'].every(k => number(r[k]) && Number.isInteger(r[k])) ||
          !r.typedLength || !r.targetLength || r.correctChars + r.errors !== r.typedLength || r.correctChars > r.targetLength) fail();
      recordIds.add(r.id);
      const clean = {};
      ['id','studentId','studentLabel','language','source','duration','elapsedSeconds','speed','unit','accuracy',
        'correctChars','errors','typedLength','targetLength'].forEach(k => {clean[k] = r[k];});
      clean.createdAt = new Date(r.createdAt).toISOString();
      for (const [key,max] of [['studentClass',40],['studentName',80],['studentSeat',20]]) {
        if (r[key] !== undefined) {if (!validText(r[key],max)) fail(); clean[key] = r[key];}
      }
      result.testRecords.push(clean);
    }
    for (const [key,value] of Object.entries(p.lessonProgress)) {
      if (/^[a-z0-9-]{1,40}$/.test(key) && value === true) result.lessonProgress[key] = true;
    }
    if (number(p.settings?.threshold,100)) result.settings.threshold = p.settings.threshold;
    return result;
  }
  return {emptyData, chars, measure, languageOf, compareScores, rank, parseCSV, rosterCSV, csvCell, validateData};
})();
