/**
 * 应用图标生成脚本
 *
 * 用于将源图标文件生成各种尺寸的 Android 图标。
 *
 * 使用方法：
 *   1. 将一个 1024x1024 的 PNG 图标放置为 mobile/assets/icon-source.png
 *   2. 运行：node scripts/generate-icons.js
 *
 * 注意：此脚本需要 sharp 包（npm install sharp --save-dev）
 * 如果不想安装 sharp，也可以手动准备以下尺寸的图标：
 *   - assets/icon.png          (1024x1024) - 通用图标
 *   - assets/adaptive-icon.png (1024x1024) - Android 自适应图标前景
 *   - assets/splash.png        (1284x2778) - 启动屏图片
 */

const fs = require('fs');
const path = require('path');

// 检查是否安装了 sharp
let sharp;
try {
  sharp = require('sharp');
} catch {
  console.log('提示: sharp 未安装，将创建占位图标文件。');
  console.log('如需生成实际图标，请运行: npm install sharp --save-dev');
  console.log('');
  createPlaceholders();
  process.exit(0);
}

const SOURCE_ICON = path.join(__dirname, '..', 'assets', 'icon-source.png');
const ASSETS_DIR = path.join(__dirname, '..', 'assets');

async function generateIcons() {
  if (!fs.existsSync(SOURCE_ICON)) {
    console.log('未找到源图标文件:', SOURCE_ICON);
    console.log('请放置一个 1024x1024 的 PNG 图标文件。');
    console.log('将创建占位图标...');
    createPlaceholders();
    return;
  }

  try {
    // 通用图标 1024x1024
    await sharp(SOURCE_ICON)
      .resize(1024, 1024)
      .png()
      .toFile(path.join(ASSETS_DIR, 'icon.png'));
    console.log('✅ 生成 icon.png (1024x1024)');

    // 自适应图标 1024x1024
    await sharp(SOURCE_ICON)
      .resize(1024, 1024)
      .png()
      .toFile(path.join(ASSETS_DIR, 'adaptive-icon.png'));
    console.log('✅ 生成 adaptive-icon.png (1024x1024)');

    // 启动屏 1284x2778
    const splashBuffer = await sharp({
      create: {
        width: 1284,
        height: 2778,
        channels: 4,
        background: { r: 13, g: 17, b: 23, alpha: 1 }, // #0d1117
      },
    })
      .composite([
        {
          input: await sharp(SOURCE_ICON).resize(256, 256).png().toBuffer(),
          gravity: 'centre',
        },
      ])
      .png()
      .toFile(path.join(ASSETS_DIR, 'splash.png'));
    console.log('✅ 生成 splash.png (1284x2778)');

    console.log('\n图标生成完成！');
  } catch (err) {
    console.error('生成图标时出错:', err.message);
    createPlaceholders();
  }
}

function createPlaceholders() {
  const assetsDir = path.join(__dirname, '..', 'assets');

  // 创建简单的 1x1 PNG 作为占位符（仅用于开发）
  // PNG 文件的最小结构
  const minimalPNG = Buffer.from([
    0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, // PNG signature
    0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52, // IHDR chunk
    0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, // 1x1 pixels
    0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53, // 8-bit RGB
    0xDE, 0x00, 0x00, 0x00, 0x0C, 0x49, 0x44, 0x41, // IDAT chunk
    0x54, 0x08, 0xD7, 0x63, 0x60, 0x60, 0x60, 0x00, // compressed data
    0x00, 0x00, 0x04, 0x00, 0x01, 0x27, 0x34, 0x27, //
    0x0A, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, // IEND chunk
    0x44, 0xAE, 0x42, 0x60, 0x82,
  ]);

  const files = ['icon.png', 'adaptive-icon.png', 'splash.png'];
  files.forEach((file) => {
    const filePath = path.join(assetsDir, file);
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, minimalPNG);
      console.log(`📄 创建占位文件: ${file}`);
    } else {
      console.log(`⏭️  跳过已存在: ${file}`);
    }
  });

  console.log('\n注意: 当前使用的是占位图标，正式发布前请替换为实际图标文件。');
  console.log('推荐: 将项目中的 frontend/public/1.ico 转换为 1024x1024 的 PNG 格式。');
}

generateIcons();
