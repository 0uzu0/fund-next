# LanFund 安卓 App（React Native）

基于前端页面的 Android 应用，底部导航仅保留：**持仓基金**、**贵金属行情**、**行业板块**、**用户管理** 四个功能。内容通过 WebView 加载前端对应页面。

## 环境

- Node.js >= 16
- npm 或 yarn
- Android 模拟器或真机（开发时需与前端、后端同网或可访问）

## 安装与运行

```bash
# 在项目根目录
npm run mobile:install
npm run mobile:start
```

或在 `mobile` 目录下：

```bash
cd mobile
npm install
npx expo start
```

在 Expo 界面按 `a` 启动 Android。

## 使用流程（APK / 真机）

打开 App 后按以下顺序：

1. **服务端地址**：首次使用需填写前端页面地址（如 `https://你的域名` 或 `http://192.168.1.100:3000`），点击「保存并进入登录」。
2. **登录页**：在 WebView 中完成登录；登录成功后会自动进入主界面，也可点击「已登录，直接进入」跳过。
3. **功能页**：底部四个 Tab（持仓基金、贵金属行情、行业板块、用户管理），内容均通过 WebView 加载已配置地址下的对应页面。

地址会保存在本机，下次打开会直接进入登录页。

## 配置前端地址（开发时）

开发时若希望默认使用某地址，可在 `mobile` 目录创建 `.env`：

```
EXPO_PUBLIC_WEB_URL=http://192.168.1.100:3000
```

或导出环境变量后启动：

```bash
EXPO_PUBLIC_WEB_URL=http://你的电脑IP:3000 npx expo start
```

- **Android 模拟器**：未配置时默认使用 `http://10.0.2.2:3000`（模拟器访问本机 3000 端口）。

## 打包 APK

在项目根目录执行（已支持 Windows / macOS / Linux）：

```bash
npm run mobile:build:apk
```

或在 `mobile` 目录：

```bash
node scripts/build-apk.js
```

APK 输出在 `mobile/android/app/build/outputs/apk/release/app-release.apk`。

**本地环境要求**（JDK 17、Android SDK 等）见 [构建手机APK本地环境](../docs/构建手机APK本地环境.md)。

## GitHub Actions 打包

仓库已配置 `.github/workflows/android-apk.yml`，支持两种方式打包并产出 APK：

1. **按 tag 自动打包并发布**  
   推送以 `v` 开头的 tag（如 `v1.0.0`）到 GitHub，会自动构建 APK 并创建 Release、上传 APK：
   ```bash
   git tag v1.0.0
   git push origin v1.0.0
   ```

2. **手动触发**  
   在 GitHub 仓库 → Actions → “Android APK Build & Release” → “Run workflow”：
   - **不填**「发布版本标签」：仅构建并上传 APK 为 Artifact，可在该次 Run 的页面下载。
   - **填写**「发布版本标签」（如 `v1.0.0`）：构建后创建同名 Release 并上传 APK。

## 底部导航对应页面

| Tab       | 对应前端路径           |
|----------|------------------------|
| 持仓基金 | `/portfolio`          |
| 贵金属行情 | `/precious-metals`  |
| 行业板块 | `/sectors`            |
| 用户管理 | `/admin/profile`     |

使用前请先在前端完成登录；WebView 会携带 Cookie，与浏览器登录态一致（需前后端同域或正确配置 Cookie 域）。未登录时各页会跳转到登录页，登录成功后会按 `redirect` 参数跳回原页面（如贵金属行情 → 登录 → 仍回到贵金属行情）。

**若出现 net::ERR_CLEARTEXT_NOT_PERMITTED**：已在本项目中开启 Android 明文流量（`usesCleartextTraffic`）。请重新执行 `npx expo prebuild --platform android --clean` 并重新打包 APK 后重试；真机开发时请在 `mobile/.env` 中设置 `EXPO_PUBLIC_WEB_URL=http://你的电脑IP:3000`。
