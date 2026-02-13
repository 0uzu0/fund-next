#!/bin/bash
#
# LanFund Android APK 本地构建脚本
#
# 用法:
#   chmod +x scripts/build-apk.sh
#   ./scripts/build-apk.sh
#
# 前提条件:
#   1. 安装 Node.js >= 18
#   2. 安装 JDK 17+
#   3. 安装 Android SDK（或通过 Android Studio 安装）
#   4. 设置环境变量 ANDROID_HOME
#
# 输出:
#   构建完成后 APK 文件位于:
#   android/app/build/outputs/apk/release/app-release.apk
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_DIR"

echo "========================================"
echo "  LanFund Android APK 构建"
echo "========================================"
echo ""

# 检查 Node.js
if ! command -v node &> /dev/null; then
    echo "❌ 未找到 Node.js，请先安装 Node.js >= 18"
    exit 1
fi
echo "✅ Node.js: $(node -v)"

# 检查 Java
if ! command -v java &> /dev/null; then
    echo "❌ 未找到 Java，请先安装 JDK 17+"
    exit 1
fi
echo "✅ Java: $(java -version 2>&1 | head -1)"

# 检查 ANDROID_HOME
if [ -z "$ANDROID_HOME" ]; then
    # 尝试常见路径
    if [ -d "$HOME/Android/Sdk" ]; then
        export ANDROID_HOME="$HOME/Android/Sdk"
    elif [ -d "$HOME/Library/Android/sdk" ]; then
        export ANDROID_HOME="$HOME/Library/Android/sdk"
    else
        echo "⚠️  未设置 ANDROID_HOME 环境变量"
        echo "   请安装 Android SDK 或设置 ANDROID_HOME 环境变量"
        echo "   例如: export ANDROID_HOME=\$HOME/Android/Sdk"
        echo ""
        echo "   将尝试使用 Expo prebuild 继续..."
    fi
fi

if [ -n "$ANDROID_HOME" ]; then
    echo "✅ ANDROID_HOME: $ANDROID_HOME"
fi

# 安装依赖
echo ""
echo "📦 安装依赖..."
npm install

# 生成 Android 原生项目
echo ""
echo "🔧 生成 Android 项目..."
npx expo prebuild --platform android --clean

# 构建 APK
echo ""
echo "🏗️  构建 APK..."
cd android

if [ -f "./gradlew" ]; then
    chmod +x ./gradlew
    ./gradlew assembleRelease
else
    echo "❌ 未找到 gradlew，请确认 expo prebuild 执行成功"
    exit 1
fi

# 检查输出
APK_PATH="app/build/outputs/apk/release/app-release.apk"
if [ -f "$APK_PATH" ]; then
    APK_SIZE=$(du -h "$APK_PATH" | cut -f1)
    echo ""
    echo "========================================"
    echo "  ✅ 构建成功！"
    echo "========================================"
    echo ""
    echo "  APK 文件: $(pwd)/$APK_PATH"
    echo "  文件大小: $APK_SIZE"
    echo ""
    echo "  安装到设备:"
    echo "    adb install $APK_PATH"
    echo ""
else
    echo ""
    echo "❌ 未找到 APK 文件，构建可能失败"
    echo "   请检查上方的错误信息"
    exit 1
fi
