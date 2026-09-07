const crypto = require('node:crypto');

const COOKIE = '__Host-typing-teacher';
const TTL = 4 * 60 * 60;
const digest = value => crypto.createHash('sha256').update(value).digest();
const equal = (a,b) => crypto.timingSafeEqual(digest(a),digest(b));
function signature(payload,secret,password) {
  // Changing either environment secret invalidates previously issued sessions.
  return crypto.createHmac('sha256',secret).update(payload + '.' + digest(password).toString('hex')).digest('base64url');
}
function readSession(header,secret,password) {
  const cookie = (header || '').split(';').map(s => s.trim()).find(s => s.startsWith(COOKIE + '='));
  if (!cookie) return null;
  const token = cookie.slice(COOKIE.length + 1);
  if (token.length > 1000) return null;
  const [payload,sig,...extra] = token.split('.');
  if (!payload || !sig || extra.length || !equal(sig,signature(payload,secret,password))) return null;
  try {
    const data = JSON.parse(Buffer.from(payload,'base64url').toString('utf8'));
    return data.role === 'teacher' && Number.isInteger(data.exp) && data.exp > Date.now() / 1000 && data.exp <= Date.now() / 1000 + TTL + 5 ? data : null;
  } catch {return null;}
}
module.exports = async function handler(req,res) {
  res.setHeader('Cache-Control','no-store');
  res.setHeader('X-Content-Type-Options','nosniff');
  const send = (status,body) => res.status(status).json(body);
  const password = process.env.TEACHER_PASSWORD;
  const secret = process.env.TEACHER_SESSION_SECRET;
  if (!password || password.length < 12 || !secret || secret.length < 32) return send(503,{error:'教師登入尚未設定，請聯絡網站管理者。'});
  if (req.method === 'GET') {
    const session = readSession(req.headers.cookie,secret,password);
    return send(200,{authenticated:!!session,expiresAt:session ? session.exp * 1000 : null});
  }
  if (req.method !== 'POST') {res.setHeader('Allow','GET, POST'); return send(405,{error:'不支援此操作。'});}
  // Require browser requests from this site's own origin; no permissive CORS.
  let origin;
  try {origin = new URL(req.headers.origin);} catch {return send(403,{error:'請由本站登入。'});}
  if (origin.protocol !== 'https:' || origin.host !== req.headers.host ||
      !String(req.headers['content-type'] || '').startsWith('application/json')) return send(403,{error:'請由本站登入。'});
  let body = req.body;
  if (typeof body === 'string') {
    if (body.length > 2048) return send(400,{error:'資料格式不正確。'});
    try {body = JSON.parse(body);} catch {return send(400,{error:'資料格式不正確。'});}
  }
  if (body?.action === 'logout') {
    res.setHeader('Set-Cookie',`${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`);
    return send(200,{authenticated:false});
  }
  if (body?.action !== 'login' || typeof body.password !== 'string' || body.password.length > 256) return send(400,{error:'請輸入教師密碼。'});
  if (!equal(body.password,password)) {
    // A fixed minimum delay slows naive retries without retaining user/IP data.
    await new Promise(resolve => setTimeout(resolve,500));
    return send(401,{error:'密碼不正確，請再試一次。'});
  }
  const exp = Math.floor(Date.now() / 1000) + TTL;
  const payload = Buffer.from(JSON.stringify({role:'teacher',exp,nonce:crypto.randomBytes(16).toString('hex')})).toString('base64url');
  const token = payload + '.' + signature(payload,secret,password);
  res.setHeader('Set-Cookie',`${COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${TTL}`);
  return send(200,{authenticated:true,expiresAt:exp * 1000});
};
