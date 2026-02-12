# LanFund 移动端 (Android)

使用 React Native (Expo) + WebView 将 LanFund 基金管理系统打包为 Android APK。

## 技术方案

本项目采用 **WebView 包装** 方案，将现有的 Next.js Web 前端嵌入到 React Native 应用中：

- **React Native (Expo)**: 提供原生 Android 应用壳
- **react-native-webview**: 加载 Web 前端页面
- **原生增强**: 状态栏、底部导航、启动屏、返回键处理、设置页

### 为什么选择 WebView 方案？

| 方案 | 优点 | 缺点 |
|------|------|------|
| ✅ WebView 包装 | 零改动复用现有前端、开发快、维护成本低 | 性能略逊于纯原生 |
| React Native 重写 | 原生体验最佳 | 工作量巨大、需要维护两套代码 |

考虑到现有 Web 前端已有完善的移动端响应式样式，WebView 方案是最佳平衡点。

## 项目结构

```
mobile/
├── App.tsx                  # 应用入口
├── app.json                 # Expo 配置
├── eas.json                 # EAS Build 配置
├── package.json             # 依赖管理
├── tsconfig.json            # TypeScript 配置
├── babel.config.js          # Babel 配置
├── assets/                  # 静态资源
│   ├── icon.png             # 应用图标 (1024x1024)
│   ├── adaptive-icon.png    # Android 自适应图标
│   └── splash.png           # 启动屏
├── src/
│   ├── config.ts            # 应用配置
│   ├── storage.ts           # 本地存储工具
│   ├── WebViewScreen.tsx    # WebView 主屏幕
│   └── SettingsScreen.tsx   # 设置页面
└── scripts/
    ├── build-apk.sh         # 本地构建脚本
    └── generate-icons.js    # 图标生成脚本
```

## 功能特性

- 📱 加载 LanFund Web 前端（后端同源托管）
- ⚙️ 可配置服务器地址（局域网/公网）
- 🔗 连接测试功能
- 🔙 Android 返回键支持（WebView 历史后退）
- 🏠 底部导航栏（后退、刷新、首页、设置）
- 📱 移动端样式注入优化
- 🔄 下拉刷新
- 🌙 深色主题（与 Web 端一致）
- 💾 服务器地址持久化存储
- ⚡ 启动屏

## 前提条件

### 方法一：EAS Build（推荐，无需本地环境）

只需要：
- Node.js >= 18
- Expo 账号（免费注册：https://expo.dev/signup）

### 方法二：本地构建

- Node.js >= 18
- JDK 17+
- Android SDK（通过 Android Studio 安装）
- 设置 `ANDROID_HOME` 环境变量

## 快速开始

### 1. 安装依赖

```bash
cd mobile
npm install
```

### 2. 配置服务器地址

编辑 `src/config.ts`，修改 `DEFAULT_SERVER_URL` 为你的后端地址：

```typescript
export const DEFAULT_SERVER_URL = 'http://你的服务器IP:8311';
```

> 首次打开 APP 时也可以在设置页面中配置。

### 3. 准备图标

将你的应用图标（1024x1024 PNG）放置为 `assets/icon-source.png`，然后运行：

```bash
npm install sharp --save-dev
node scripts/generate-icons.js
```

或者手动准备以下文件：
- `assets/icon.png` (1024x1024)
- `assets/adaptive-icon.png` (1024x1024)
- `assets/splash.png` (1284x2778，深色背景 #0d1117 + 居中 logo)

### 4. 构建 APK

#### 方法一：EAS Build（云端构建，推荐）

```bash
# 安装 EAS CLI
npm install -g eas-cli

# 登录 Expo 账号
eas login

# 构建 APK（preview profile）
eas build --platform android --profile preview
```

构建完成后，终端会显示下载链接。

#### 方法二：本地构建

```bash
# 使用构建脚本
chmod +x scripts/build-apk.sh
./scripts/build-apk.sh
```

或者手动执行：

```bash
# 生成 Android 原生项目
npx expo prebuild --platform android --clean

# 构建 Release APK
cd android
chmod +x gradlew
./gradlew assembleRelease
```

APK 输出路径：`android/app/build/outputs/apk/release/app-release.apk`

#### 方法三：生成 AAB（用于 Google Play）

```bash
eas build --platform android --profile production
```

### 5. 安装到手机

```bash
# USB 连接手机后
adb install android/app/build/outputs/apk/release/app-release.apk

# 或者直接将 APK 文件传输到手机安装
```

## 开发调试

```bash
# 启动 Expo 开发服务器
npm start

# 在已连接的 Android 设备/模拟器上运行
npm run android
```

## 自定义配置

### 修改应用名称和包名

编辑 `app.json`：

```json
{
  "expo": {
    "name": "你的应用名称",
    "android": {
      "package": "com.yourcompany.appname"
    }
  }
}
```

### 修改深色主题颜色

编辑 `src/config.ts` 中的 `THEME` 对象。

### 添加更多 Android 权限

编辑 `app.json` 中的 `android.permissions` 数组。

## 注意事项

1. **网络访问**: 手机和 LanFund 后端服务器需要在同一网络中（局域网），或者后端部署在公网
2. **HTTP 限制**: Android 9+ 默认禁止明文 HTTP，Expo 已自动处理。如果遇到问题，请使用 HTTPS
3. **Cookie**: WebView 的 Cookie 行为与浏览器一致，登录状态会自动保持
4. **性能**: WebView 方案的性能对于本项目的使用场景完全足够
5. **图标**: 正式发布前请替换占位图标为实际应用图标

## 常见问题

### Q: 无法连接到服务器？
- 检查手机和服务器是否在同一局域网
- 确认服务器地址正确（IP:端口）
- 使用 APP 中的"测试连接"功能诊断

### Q: 页面加载很慢？
- 首次加载需要下载完整的 Web 资源，后续会使用缓存
- 检查网络连接质量

### Q: 如何更新 Web 内容？
- 更新后端部署即可，APP 会自动加载最新内容（不需要重新发布 APK）
