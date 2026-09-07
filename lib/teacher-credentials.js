const crypto = require('node:crypto');
const {promisify} = require('node:util');
const scrypt = promisify(crypto.scrypt);
const digest = value => crypto.createHash('sha256').update(value).digest();

async function readCredentials() {
  const databaseUrl = process.env.POSTGRES_URL || process.env.DATABASE_URL;
  const initialPassword = process.env.TEACHER_PASSWORD;
  if (databaseUrl) {
    const {neon} = require('@neondatabase/serverless');
    const sql = neon(databaseUrl);
    const rows = await sql`SELECT password_hash, revision FROM teacher_credentials WHERE id = 1`;
    if (rows.length) {
      const row = rows[0];
      if (!/^scrypt\$[a-f0-9]{32}\$[a-f0-9]{128}$/.test(row.password_hash) || typeof row.revision !== 'string' || !row.revision) throw Error('Invalid credential storage');
      return {hash:row.password_hash,revision:row.revision,sessionKey:row.password_hash + ':' + row.revision,canChange:true,sql};
    }
    if (!initialPassword || initialPassword.length < 12) throw Error('Missing initial password');
    return {initialPassword,revision:null,sessionKey:initialPassword,canChange:true,sql};
  }
  if (!initialPassword || initialPassword.length < 12) throw Error('Missing initial password');
  return {initialPassword,revision:null,sessionKey:initialPassword,canChange:false};
}
async function verifyPassword(candidate,credentials) {
  if (typeof candidate !== 'string' || candidate.length > 256) return false;
  if (!credentials.hash) return crypto.timingSafeEqual(digest(candidate),digest(credentials.initialPassword));
  const [,salt,hash] = credentials.hash.split('$');
  const derived = await scrypt(candidate,salt,64);
  return crypto.timingSafeEqual(derived,Buffer.from(hash,'hex'));
}
async function replacePassword(credentials,password) {
  if (!credentials.canChange) throw Error('Password storage is unavailable');
  const salt = crypto.randomBytes(16).toString('hex');
  const key = await scrypt(password,salt,64);
  const hash = `scrypt$${salt}$${key.toString('hex')}`;
  const revision = crypto.randomUUID();
  const sql = credentials.sql;
  // Optimistic concurrency: a second request with an old session cannot overwrite the first change.
  const rows = credentials.revision === null
    ? await sql`INSERT INTO teacher_credentials (id,password_hash,revision) VALUES (1,${hash},${revision}) ON CONFLICT (id) DO NOTHING RETURNING revision`
    : await sql`UPDATE teacher_credentials SET password_hash=${hash},revision=${revision},updated_at=now() WHERE id=1 AND revision=${credentials.revision} RETURNING revision`;
  return rows.length === 1;
}
module.exports = {readCredentials,verifyPassword,replacePassword};
