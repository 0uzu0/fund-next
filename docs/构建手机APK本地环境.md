# 构建手机 APK 本地环境

本文说明在 **Windows / macOS / Linux** 上搭建本地环境并构建 LanFund 安卓 APK。

## 一、环境要求

| 项目 | 版本/说明 |
|------|-----------|
| **Node.js** | ≥ 16（推荐 20 LTS） |
| **npm** | ≥ 8（随 Node 安装） |
| **Java JDK** | **17**（推荐 [Eclipse Temurin](https://adoptium.net/) 或 Oracle JDK 17） |
| **Android SDK** | 需包含：`platform-tools`、`platforms;android-34`、`build-tools;34.0.0` |

## 二、安装步骤

### 1. Node.js

- 官网下载安装：<https://nodejs.org/>
- 或使用 nvm：`nvm install 20 && nvm use 20`

安装后验证：

```bash
node -v   # 建议 v20.x
npm -v
```

### 2. Java 17

- **Windows**：从 [Adoptium](https://adoptium.net/) 下载 Windows x64 JDK 17 安装，或使用 Chocolatey：`choco install temurin17`
- **macOS**：`brew install openjdk@17`，并将 `JAVA_HOME` 指向该 JDK
- **Linux**：`sudo apt install openjdk-17-jdk`（Ubuntu/Debian）或 `sudo yum install java-17-openjdk-devel`（RHEL/CentOS）

验证：

```bash
java -version
# 应显示 openjdk version "17.x.x" 或类似
```

### 3. Android 开发环境

任选其一即可。

#### 方式 A：安装 Android Studio（推荐，最简单）

1. 下载 [Android Studio](https://developer.android.com/studio)
2. 安装时勾选 **Android SDK**、**Android SDK Platform**、**Android Virtual Device**
3. 打开 Android Studio → **More Actions** → **SDK Manager**，确保已安装：
   - **Android SDK Platform 34**（或 API 34）
   - **Android SDK Build-Tools 34.0.0**
   - **Android SDK Platform-Tools**

#### 方式 B：仅安装命令行 SDK（不装 Android Studio）

1. 下载 [Command line tools](https://developer.android.com/studio#command-tools)
2. 解压到目录，例如 `C:\Android\cmdline-tools`（Windows）或 `~/Android/cmdline-tools`（macOS/Linux）
3. 用其安装 SDK 组件（在解压后的 `bin` 目录下执行，将 `ANDROID_HOME` 换成你的 SDK 根路径）：

```bash
# 设置 ANDROID_HOME（示例）
# Windows PowerShell:
$env:ANDROID_HOME = "C:\Users\你的用户名\AppData\Local\Android\Sdk"
# macOS/Linux:
export ANDROID_HOME=~/Library/Android/sdk   # 或你实际路径

# 安装必要组件（sdkmanager 在 $ANDROID_HOME/cmdline-tools/latest/bin 或 tools/bin）
sdkmanager "platform-tools" "platforms;android-34" "build-tools;34.0.0"
```

### 4. 配置环境变量

构建 APK 前必须让系统能找到 **Java** 和 **Android SDK**。

- **JAVA_HOME**（建议设置）  
  - Windows：`C:\Program Files\Eclipse Adoptium\jdk-17.x.x`（按实际路径）  
  - macOS/Linux：`/usr/lib/jvm/java-17-openjdk` 或 Homebrew 的路径  

- **ANDROID_HOME**（必须）  
  - Windows 常见：`C:\Users\你的用户名\AppData\Local\Android\Sdk`  
  - macOS：`~/Library/Android/sdk`  
  - Linux：`~/Android/Sdk` 或 `/opt/android-sdk`  

**Windows（PowerShell，当前用户）：**

```powershell
[System.Environment]::SetEnvironmentVariable("JAVA_HOME", "C:\Program Files\Eclipse Adoptium\jdk-17.x.x", "User")
[System.Environment]::SetEnvironmentVariable("ANDROID_HOME", "C:\Users\你的用户名\AppData\Local\Android\Sdk", "User")
# 可选：将 platform-tools 加入 Path
$path = [System.Environment]::GetEnvironmentVariable("Path", "User")
[System.Environment]::SetEnvironmentVariable("Path", "$path;$env:ANDROID_HOME\platform-tools", "User")
```

**macOS / Linux（写入 `~/.bashrc` 或 `~/.zshrc`）：**

```bash
export JAVA_HOME=/path/to/jdk-17
export ANDROID_HOME=~/Library/Android/sdk
export PATH=$PATH:$ANDROID_HOME/platform-tools
```

设置后**重新打开终端**再执行构建。

## 三、构建 APK

### 1. 安装项目依赖

在**项目根目录** `fund-next` 下：

```bash
npm run mobile:install
```

或进入 mobile 目录：

```bash
cd mobile
npm install
```

### 2. 生成 Android 工程并打 Release 包

在**项目根目录**执行（推荐，已做跨平台处理）：

```bash
npm run mobile:build:apk
```

该命令会：

1. 在 `mobile` 下执行 `npx expo prebuild --platform android --clean` 生成/刷新 `mobile/android`
2. 在 `mobile/android` 下执行 Gradle 打 Release 包

**仅在 Windows 上若上述脚本失败**，可改为分步执行：

```powershell
cd mobile
npx expo prebuild --platform android --clean
cd android
.\gradlew.bat assembleRelease
```

### 3. 输出位置

APK 路径：

```
mobile/android/app/build/outputs/apk/release/app-release.apk
```

可复制到手机安装或重命名为 `lanfund-1.0.0.apk` 等。

## 四、可选：真机调试时前端地址

若用真机访问本机前端，在 `mobile` 目录创建 `.env`，写入（把 IP 换成你电脑在内网的 IP）：

```
EXPO_PUBLIC_WEB_URL=http://192.168.1.100:3000
```

开发时先在本机启动前端（如 `npm run dev:frontend`），再在手机浏览器或 App 内访问该地址以登录并使用。

## 五、常见问题

| 现象 | 处理 |
|------|------|
| `JAVA_HOME` 未设置或不是 JDK 17 | 设置 `JAVA_HOME` 为 JDK 17 安装目录，并重启终端 |
| `ANDROID_HOME` 未设置 | 设置为本机 Android SDK 根目录，并重启终端 |
| `sdkmanager` 找不到 | 确认已安装 Android SDK，并把 `platform-tools` 或 cmdline-tools 的 `bin` 加入 PATH |
| Gradle 报错 `SDK location not found` | 在 `mobile/android` 下创建 `local.properties`，内容一行：`sdk.dir=C:\\Users\\你的用户名\\AppData\\Local\\Android\\Sdk`（Windows 路径用双反斜杠） |
| 构建很慢 | 首次会下载 Gradle 与依赖，属正常；可配置 Gradle 镜像加速（如阿里云） |
| 签名 | 当前为 debug 签名；正式发布需在 `mobile/android` 中配置 keystore 并改用 release 签名 |

按上述步骤配置后，即可在本地稳定构建手机 APK。
