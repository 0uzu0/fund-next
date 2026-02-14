# App 图标与启动图

## APK 图标放置位置

将应用图标放在此目录下，并在 `mobile/app.json` 中配置路径。

### 推荐文件

| 文件 | 用途 | 建议尺寸 |
|------|------|----------|
| **icon.png** | 应用图标（必放） | **1024×1024** 像素，PNG |

- 将 **icon.png** 放在 `mobile/assets/` 下即可，Expo 会据此生成各尺寸及 Android 自适应图标。
- 如需单独设计 Android 前景图，可在 `app.json` 的 `android.adaptiveIcon` 中增加 `"foregroundImage": "./assets/adaptive-icon.png"`，并放置同尺寸 PNG（透明背景）。

### 修改图标后

1. 将 `icon.png`（及可选的 `adaptive-icon.png`）放入本目录 `mobile/assets/`。
2. 确认 `mobile/app.json` 中已配置 `icon` 与 `android.adaptiveIcon.foregroundImage`（见下方）。
3. 重新生成 Android 工程并打包：
   ```bash
   cd mobile
   npx expo prebuild --platform android --clean
   cd android && ./gradlew assembleRelease
   ```
   或在项目根目录执行：`npm run mobile:build:apk`。
