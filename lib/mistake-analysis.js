'use strict';

const shiftedToBase = Object.fromEntries([
  ['~','`'],['!','1'],['@','2'],['#','3'],['$','4'],['%','5'],['^','6'],['&','7'],['*','8'],['(','9'],[')','0'],['_','-'],['+','='],['{','['],['}',']'],['|','\\'],[':', ';'],['"',"'"],['<',','],['>','.'],['?','/']
]);

function oneChar(value) {
  return typeof value === 'string' && Array.from(value).length === 1 && !/[\r\n\t\u0000-\u001f\u007f]/u.test(value);
}

function cleanMistakes(value, language = 'en') {
  if (value == null) return [];
  if (language !== 'en') return Array.isArray(value) && value.length === 0 ? [] : null;
  if (!Array.isArray(value) || value.length > 100) return null;
  const merged = new Map();
  let total = 0;
  for (const item of value) {
    if (!Array.isArray(item) || item.length !== 3) return null;
    const [expected, actual, count] = item;
    if (!oneChar(expected) || !oneChar(actual) || expected === actual || !Number.isInteger(count) || count < 1 || count > 10000) return null;
    total += count;
    if (total > 100000) return null;
    const key = `${expected}\u0000${actual}`;
    merged.set(key, (merged.get(key) || 0) + count);
    if (merged.get(key) > 10000) return null;
  }
  return [...merged.entries()].map(([key,count]) => {
    const [expected,actual] = key.split('\u0000');
    return [expected,actual,count];
  }).sort((a,b) => b[2] - a[2] || a[0].localeCompare(b[0]) || a[1].localeCompare(b[1]));
}

function baseKey(char) {
  if (!oneChar(char)) return '';
  if (shiftedToBase[char]) return shiftedToBase[char];
  return /^[A-Z]$/.test(char) ? char.toLowerCase() : char;
}

function fingerForKey(char) {
  const key = baseKey(char);
  if (!key) return '其他';
  if (key === ' ') return '拇指';
  const groups = [
    ['`1qaz','左手小指'],['2wsx','左手無名指'],['3edc','左手中指'],['45rtfgvb','左手食指'],
    ['67yuhjnm','右手食指'],['8ik,','右手中指'],['9ol.','右手無名指'],["0p;/-=[]\\'",'右手小指']
  ];
  return groups.find(([keys]) => keys.includes(key.toLowerCase()))?.[1] || '其他';
}

function aggregateMistakes(rows) {
  const pairs = new Map(), expected = new Map(), fingers = new Map();
  let recordsWithMistakes = 0, totalMistakes = 0;
  for (const row of rows || []) {
    const mistakes = cleanMistakes(row?.mistakes, 'en');
    if (!mistakes || !mistakes.length) continue;
    recordsWithMistakes++;
    for (const [want,actual,count] of mistakes) {
      const pairKey = `${want}\u0000${actual}`;
      pairs.set(pairKey,(pairs.get(pairKey)||0)+count);
      expected.set(want,(expected.get(want)||0)+count);
      const finger = fingerForKey(want);
      fingers.set(finger,(fingers.get(finger)||0)+count);
      totalMistakes += count;
    }
  }
  const sortMap = map => [...map.entries()].sort((a,b) => b[1]-a[1] || a[0].localeCompare(b[0]));
  return {
    recordsWithMistakes,totalMistakes,
    pairs:sortMap(pairs).map(([key,count]) => {const [expected,actual]=key.split('\u0000');return {expected,actual,count,finger:fingerForKey(expected)};}),
    keys:sortMap(expected).map(([key,count]) => ({key,count,finger:fingerForKey(key)})),
    fingers:sortMap(fingers).map(([finger,count]) => ({finger,count}))
  };
}

module.exports = {cleanMistakes,baseKey,fingerForKey,aggregateMistakes};
