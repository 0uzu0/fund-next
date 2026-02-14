/**
 * 本地构建 Release APK（跨平台：Windows / macOS / Linux）
 * 用法：在 mobile 目录下执行 node scripts/build-apk.js
 * 或在项目根目录执行 npm run mobile:build:apk
 */
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const isWin = process.platform === 'win32';
const mobileRoot = path.resolve(__dirname, '..');
const androidDir = path.join(mobileRoot, 'android');

function run(cmd, opts = {}) {
  const options = { stdio: 'inherit', cwd: opts.cwd || mobileRoot, ...opts };
  console.log('[build-apk]', cmd);
  execSync(cmd, options);
}

// 1. 生成 Android 工程（目录已存在时不用 --clean，避免 EBUSY 被占用）
const prebuildClean = !fs.existsSync(androidDir);
const prebuildCmd = prebuildClean
  ? 'npx expo prebuild --platform android --clean'
  : 'npx expo prebuild --platform android';
if (!prebuildClean) console.log('[build-apk] android 已存在，使用增量 prebuild（无 --clean）');
run(prebuildCmd);

if (!fs.existsSync(androidDir)) {
  console.error('[build-apk] android 目录未生成，请检查 expo prebuild 输出');
  process.exit(1);
}

// 写入 local.properties（prebuild 会清空 android，故在此生成）
const sdkDir = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT || (
  isWin
    ? path.join(process.env.USERPROFILE || 'C:\\Users', 'AppData', 'Local', 'Android', 'Sdk')
    : path.join(process.env.HOME || '', 'Library', 'Android', 'sdk')
);
const localPropsPath = path.join(androidDir, 'local.properties');
const sdkDirEscaped = sdkDir.replace(/\\/g, '\\\\');
fs.writeFileSync(localPropsPath, `sdk.dir=${sdkDirEscaped}\n`, 'utf8');
console.log('[build-apk] 已写入 local.properties，sdk.dir=', sdkDir);

// 2. 执行 Gradle 打 Release 包
const gradlew = isWin ? 'gradlew.bat' : './gradlew';
if (!isWin) {
  try {
    fs.chmodSync(path.join(androidDir, 'gradlew'), 0o755);
  } catch (e) {
    // 忽略 chmod 错误
  }
}
run(`${gradlew} assembleRelease --no-daemon`, { cwd: androidDir });

const apkPath = path.join(androidDir, 'app', 'build', 'outputs', 'apk', 'release', 'app-release.apk');
if (fs.existsSync(apkPath)) {
  console.log('\n[build-apk] 构建完成，APK 路径：');
  console.log(apkPath);
} else {
  console.error('[build-apk] 未找到 APK 输出，请检查上方 Gradle 输出');
  process.exit(1);
}
