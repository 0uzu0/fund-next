/**
 * 检查 API Key 是否存在
 * 用法: node check-api-key.js <api_key>
 */
const db = require('./db');

async function checkApiKey(apiKey) {
  await db.initDb();

  console.log('Checking API Key:', apiKey);
  console.log('');

  // 查询所有 API Keys
  const allKeys = db.prepare('SELECT id, key, name, active, expires_at, bind_user_id FROM api_keys').all();
  console.log('Total API Keys in database:', allKeys.length);
  console.log('');

  // 显示所有 API Keys（隐藏完整 key）
  allKeys.forEach(k => {
    console.log(`ID: ${k.id}, Key: ${k.key.substring(0, 20)}..., Name: ${k.name}, Active: ${k.active}`);
  });
  console.log('');

  // 查询指定的 API Key
  const row = db.prepare(
    `SELECT k.*, u.username as bind_username
     FROM api_keys k
     LEFT JOIN users u ON k.bind_user_id = u.id
     WHERE k.key = ?`
  ).get(apiKey);

  if (!row) {
    console.log('API Key NOT FOUND in database!');
    return;
  }

  console.log('API Key FOUND:');
  console.log('  ID:', row.id);
  console.log('  Name:', row.name);
  console.log('  Active:', row.active);
  console.log('  Expires At:', row.expires_at);
  console.log('  Bind User ID:', row.bind_user_id);
  console.log('  Bind Username:', row.bind_username);
  console.log('  Permissions:', row.permissions);
  console.log('  Rate Limit:', row.rate_limit);

  // 检查是否过期
  if (row.expires_at && new Date(row.expires_at) < new Date()) {
    console.log('');
    console.log('WARNING: This API Key has EXPIRED!');
  }

  if (!row.active) {
    console.log('');
    console.log('WARNING: This API Key is NOT ACTIVE!');
  }
}

const apiKey = process.argv[2];
if (!apiKey) {
  console.log('Usage: node check-api-key.js <api_key>');
  process.exit(1);
}

checkApiKey(apiKey).catch(console.error);
