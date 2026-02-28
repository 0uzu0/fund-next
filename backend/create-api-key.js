/**
 * 创建新的 API Key 并绑定到 admin 用户
 * 用法: node create-api-key.js [api_key_name]
 */
const { initDb } = require('./db');
const { createApiKey } = require('./apiAuth');

async function main() {
  await initDb();
  const db = require('./db');

  // 获取 admin 用户 ID
  const adminUser = db.prepare("SELECT id, username FROM users WHERE username = 'admin'").get();

  if (!adminUser) {
    console.error('错误: 未找到 admin 用户');
    process.exit(1);
  }

  console.log('找到 admin 用户:', adminUser.username, '(ID:', adminUser.id + ')');

  // API Key 名称
  const keyName = process.argv[2] || 'Admin API Key ' + new Date().toISOString().slice(0, 10);

  // 创建 API Key（绑定到 admin 用户）
  const apiKey = createApiKey(
    keyName,
    '自动生成的管理员 API Key',
    adminUser.id,  // 创建者
    'read',        // 权限
    1000,          // 限流次数/分钟
    null,          // 不过期
    adminUser.id   // 绑定到 admin 用户（可以访问持仓数据）
  );

  console.log('\n=================================');
  console.log('API Key 创建成功！');
  console.log('=================================');
  console.log('API Key:', apiKey);
  console.log('名称:', keyName);
  console.log('绑定用户:', adminUser.username);
  console.log('权限: read');
  console.log('限流: 1000 次/分钟');
  console.log('=================================');
  console.log('\n请立即复制保存，此 Key 只显示一次！');
}

main().catch(err => {
  console.error('创建失败:', err.message);
  process.exit(1);
});
