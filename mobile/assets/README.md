# App 图标与启动图

## APK 图标放置位置与尺寸

将应用图标放在此目录下。`app.json` 已配置 `icon` 与 `android.adaptiveIcon.foregroundImage`，均指向 `./assets/icon.png`。

### 规范（与 APK 多分辨率适配）

| 项目 | 要求 |
|------|------|
| **文件** | `icon.png`，PNG，**无透明通道时用纯色底** |
| **尺寸** | **1024×1024** 像素（Expo 会生成 mdpi/hdpi/xhdpi/xxhdpi/xxxhdpi 等） |
| **Android 自适应图标** | 系统会裁成圆形/圆角矩形等，重要内容请放在**画面中心约 66% 区域内**（约中心 672×672px），避免被裁掉 |

- 单文件方案：只放 **icon.png** 即可，`app.json` 中已用其同时作为应用图标和 Android 自适应前景图，背景色为 `#1a1a2e`。
- 若需单独前景图（如透明背景 logo）：可新增 `adaptive-icon.png`（1024×1024，PNG），并在 `app.json` 的 `android.adaptiveIcon` 里改为 `"foregroundImage": "./assets/adaptive-icon.png"`。

### 修改图标后

1. 替换 `mobile/assets/icon.png`（或按上表增加 `adaptive-icon.png` 并改配置）。
2. 重新生成并打 APK：
   ```bash
   npm run mobile:build:apk
   ```
   或：`cd mobile && npx expo prebuild --platform android --clean && cd android && ./gradlew assembleRelease`
