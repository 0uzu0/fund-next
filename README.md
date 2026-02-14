<div align="center">

# 🚀 LanFund - 智能基金管理系统

> 基于 Next.js + Express 的现代化基金投资管理平台

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)](https://nodejs.org/)
[![Next.js](https://img.shields.io/badge/Next.js-14.0-black)](https://nextjs.org/)
[![Express](https://img.shields.io/badge/Express-4.18-green)](https://expressjs.com/)

[功能特性](#-功能特性) • [快速开始](#-快速开始) • [部署指南](#-docker-部署) • [使用说明](docs/使用说明.md) • [致谢](#-致谢)

</div>

---

## 📋 目录

- [功能特性](#-功能特性)
- [技术栈](#-技术栈)
- [快速开始](#-快速开始)
- [Docker 部署](#-docker-部署)
- [项目结构](#-项目结构)
- [使用说明](#-使用说明)
- [致谢](#-致谢)

## ✨ 功能特性

### 🎯 核心功能

- **📊 持仓管理**：实时追踪基金持仓，支持加仓/减仓操作
- **📈 数据可视化**：精美的图表展示基金估值曲线和涨跌趋势
- **💼 分组管理**：灵活的自选基金分组，支持自定义分类
- **📋 持仓记录**：完整的交易历史记录，支持撤销操作
- **📱 响应式设计**：完美适配桌面端和移动端

### 🌟 高级特性

- **⚡ 性能优化**：代码分割、懒加载、请求缓存，加载速度提升 50%
- **🔄 实时数据**：自动刷新基金估值和行情数据
- **💾 数据持久化**：SQLite 数据库，数据安全可靠
- **🔐 用户认证**：Session + Cookie 安全认证机制
- **📊 市场行情**：7×24 小时快讯、市场指数、贵金属行情
- **🤖 AI 助手**：持仓页浮动问答（可配置 OpenAI、DeepSeek 等接口）

### 📱 页面功能

- **持仓基金页**：基金估值图表、持仓统计、加仓/减仓
- **持仓记录**：完整的交易历史，支持撤销
- **市场行情**：实时快讯、市场指数、贵金属价格
- **行业板块**：板块分类、基金查询、行业分析

## 🛠 技术栈

### 前端技术

- **框架**：Next.js 14 (React 18)
- **语言**：TypeScript
- **图表**：Chart.js + react-chartjs-2
- **样式**：CSS Modules + CSS Variables
- **构建工具**：Webpack (Next.js 内置)

### 后端技术

- **框架**：Express.js
- **数据库**：SQLite (sql.js)
- **认证**：express-session + cookie-parser
- **HTTP 客户端**：Axios
- **文件上传**：Multer

### 开发工具

- **包管理**：npm
- **代码检查**：ESLint + TypeScript
- **容器化**：Docker + Docker Compose
- **CI/CD**：GitHub Actions

## 🚀 快速开始

### 前置要求

- Node.js >= 18.0.0
- npm >= 8.0.0
- Git

### 安装步骤

#### 1. 克隆项目

```bash
git clone https://github.com/your-username/fund-next.git
cd fund-next
```

#### 2. 安装依赖

```bash
# 一键安装所有依赖（推荐）
npm run install:all

# 或分别安装
npm install
cd backend && npm install
cd ../frontend && npm install
```

#### 3. 配置环境变量

**后端配置** (`backend/.env`):

```env
# 数据库路径
DB_PATH=./cache/fund_data.db

# Session 密钥（请修改为随机字符串）
SESSION_SECRET=your-secret-key-here

# 服务端口
PORT=8311

# CORS 配置（生产环境）
CORS_ORIGIN=http://localhost:3000

# AI 助手（可选，支持 OpenAI / DeepSeek 等兼容接口；不配置则不显示持仓页浮动助手）
# AI_API_URL=https://api.openai.com
# AI_API_URL=https://api.deepseek.com
# AI_API_KEY=sk-xxx
# AI_MODEL=gpt-4o-mini
# AI_MODEL=deepseek-chat
```

**前端配置** (`frontend/.env.local`):

```env
# API 地址（开发环境）
NEXT_PUBLIC_API_URL=http://localhost:8311

# 生产环境可留空（同源请求）
# NEXT_PUBLIC_API_URL=
```

#### 4. 启动开发服务器

```bash
# 一键启动前后端（推荐）
npm run dev

# 或分别启动
npm run dev:backend  # 后端：http://localhost:8311
npm run dev:frontend # 前端：http://localhost:3000
```

#### 5. 访问应用

打开浏览器访问：http://localhost:3000

默认登录信息（首次运行会自动创建）：
- 用户名：`admin`
- 密码：`admin`（请及时修改）

## 📁 项目结构

```
fund-next/
├── backend/                 # Express 后端服务
│   ├── routes/             # 路由定义
│   │   ├── auth.js        # 认证路由
│   │   └── fundApi.js     # 基金 API 路由
│   ├── services/          # 业务逻辑服务
│   │   ├── fund123.js     # 基金数据服务
│   │   ├── fundQuotes.js  # 行情数据服务
│   │   └── ...
│   ├── cache/             # 数据库缓存目录
│   ├── server.js          # 服务器入口
│   └── package.json
│
├── frontend/               # Next.js 前端应用
│   ├── pages/             # 页面路由
│   │   ├── portfolio.tsx # 持仓基金页
│   │   ├── market.tsx    # 市场行情页
│   │   └── ...
│   ├── components/        # React 组件
│   │   ├── FundChart.tsx # 基金图表组件
│   │   ├── TopNavbar.tsx # 顶部导航栏
│   │   └── ...
│   ├── hooks/            # 自定义 Hooks
│   │   └── useChartData.ts
│   ├── utils/            # 工具函数
│   │   └── apiClient.ts  # API 客户端
│   ├── styles/           # 样式文件
│   └── package.json
│
├── mobile/                # MoreFund 安卓端（React Native / Expo）
│   ├── src/              # 应用源码
│   ├── scripts/          # 构建脚本（如 build-apk.js）
│   ├── .github/workflows/# 独立仓库用 CI（可抽离为新项目）
│   └── README.md         # 独立项目说明
│
├── .github/               # GitHub Actions
│   └── workflows/
│       └── android-apk.yml # 安卓 APK 构建与发布
│
├── docker-compose.yml     # Docker Compose 配置
├── Dockerfile             # Docker 配置（根目录）
├── .gitignore            # Git 忽略文件
└── README.md             # 项目文档
```

**安卓端抽离**：`mobile/` 为独立项目，可整体复制为新仓库单独维护；其内 `package.json`、`README.md` 与 `.github/workflows/android-apk.yml` 已按「项目根目录即本 App」配置，克隆后在本目录执行 `npm install`、`npm run build:apk` 即可。

## 🐳 Docker 部署

### 服务端 Docker 打包与发布（自动化流程）

| 方式 | 说明 |
|------|------|
| **自动构建** | 代码 push 到 `main` / `master` 后，CI/CD 会自动构建并推送镜像 `ghcr.io/<用户名>/<仓库名>:latest`。 |
| **手动发布** | 在 GitHub 仓库 **Actions** 页选择 **「CI/CD」**，点击 **Run workflow**，可选填写镜像标签（如 `v1.0.0`），运行完成后即可拉取对应镜像。 |

手动发布时若填写了标签（如 `v1.0.0`），会同时推送该标签与 `latest`；不填则仅更新 `latest`。

### 使用已打包镜像部署（推荐）

在项目根目录创建 `.env`，配置镜像与密钥后直接拉取运行：

```bash
# .env 示例（按需修改）：
#   DOCKER_IMAGE=ghcr.io/你的用户名/fund-next:latest
#   SESSION_SECRET=一串随机密钥或 UUID
# 注意：SESSION_SECRET 写明文，不要写 ${SESSION_SECRET:xxx}，否则 Compose 会报错
#
# 可选 - AI 助手（持仓页浮动问答，需 OpenAI/DeepSeek 等兼容接口）：
#   AI_API_URL=https://api.openai.com
#   AI_API_KEY=sk-xxx
#   AI_MODEL=gpt-4o-mini

docker-compose up -d

# 查看日志
docker-compose logs -f

# 停止服务
docker-compose down
```

**持久化**：基金列表、用户与组合等数据保存在 Docker 卷 `fund-data`（对应容器内 `/app/data`）。请勿删除该卷或使用 `docker-compose down -v`，否则数据会丢失。

### 本地构建并运行

不依赖 Action 镜像、在本地从源码构建并运行：

```bash
docker-compose -f docker-compose.yml -f docker-compose.build.yml up -d --build
```

访问：http://localhost:3000（前端）、http://localhost:8311（后端 API）。

## 📖 使用说明

服务端部署、手机端（Android APP）配置与日常使用详见：**[docs/使用说明.md](docs/使用说明.md)**，包括：

- **服务端**：Docker 镜像部署、本地构建、源码运行、环境变量、端口与健康检查
- **手机端**：APK 安装、首次配置服务器地址、登录、底部导航、设置页、常见问题
- **二者关系**：同一服务端同时服务浏览器与 APP，数据一致

---

## 🙏 致谢

本项目的部分 **UI 设计**与 **数据接口** 参考或借鉴了以下开源项目，在此表示感谢：

- **[lanZzV/fund](https://github.com/lanZzV/fund)** — 基金实时估值、黄金价格等 Web/CLI 工具，提供了丰富的页面布局与数据展示思路。
- **[hzm0321/real-time-fund](https://github.com/hzm0321/real-time-fund)** — 基于 Next.js 的基金实时估值与重仓股追踪，采用玻璃拟态设计，数据源包括东方财富、腾讯财经等公开接口，为本项目的前端交互与数据获取方式提供了重要参考。
