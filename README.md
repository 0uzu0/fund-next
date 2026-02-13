<div align="center">

# 🚀 LanFund - 智能基金管理系统

> 基于 Next.js + Express 的现代化基金投资管理平台

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)](https://nodejs.org/)
[![Next.js](https://img.shields.io/badge/Next.js-14.0-black)](https://nextjs.org/)
[![Express](https://img.shields.io/badge/Express-4.18-green)](https://expressjs.com/)

[功能特性](#-功能特性) • [快速开始](#-快速开始) • [部署指南](#-部署指南) • [致谢](#-致谢)

</div>

---

## 📋 目录

- [功能特性](#-功能特性)
- [技术栈](#-技术栈)
- [快速开始](#-快速开始)
- [Docker 部署](#-docker-部署)
- [项目结构](#-项目结构)
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
├── .github/               # GitHub Actions
│   └── workflows/
│       └── ci-cd.yml     # CI/CD 配置
│
├── docker-compose.yml     # Docker Compose 配置
├── Dockerfile             # Docker 配置（根目录）
├── .gitignore            # Git 忽略文件
└── README.md             # 项目文档
```


## 🐳 Docker 部署

### 使用 Action 打包的镜像（推荐）

CI 在 push 到 main/master 后会自动构建并推送镜像到 GitHub Container Registry。在项目根目录创建 `.env` 并设置镜像地址后即可直接拉取运行：

```bash
# 创建 .env，填入你的镜像地址（与 GitHub 仓库对应）
echo "DOCKER_IMAGE=ghcr.io/<你的 GitHub 用户名>/<仓库名>:latest" >> .env
# 例如：DOCKER_IMAGE=ghcr.io/username/fund-next:latest

docker-compose up -d

# 查看日志
docker-compose logs -f

# 停止服务
docker-compose down
```

### 本地构建并运行

若需在本地构建镜像而非使用 Action 镜像：

```bash
docker-compose -f docker-compose.yml -f docker-compose.build.yml up -d --build
```

访问：http://localhost:3000（前端）和 http://localhost:8311（后端 API）

---

## 🙏 致谢

本项目的部分 **UI 设计**与 **数据接口** 参考或借鉴了以下开源项目，在此表示感谢：

- **[lanZzV/fund](https://github.com/lanZzV/fund)** — 基金实时估值、黄金价格等 Web/CLI 工具，提供了丰富的页面布局与数据展示思路。
- **[hzm0321/real-time-fund](https://github.com/hzm0321/real-time-fund)** — 基于 Next.js 的基金实时估值与重仓股追踪，采用玻璃拟态设计，数据源包括东方财富、腾讯财经等公开接口，为本项目的前端交互与数据获取方式提供了重要参考。
