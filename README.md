<div align="center">

# 🚀 LanFund - 智能基金管理系统

> 基于 Next.js + Express 的现代化基金投资管理平台

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)](https://nodejs.org/)
[![Next.js](https://img.shields.io/badge/Next.js-14.0-black)](https://nextjs.org/)
[![Express](https://img.shields.io/badge/Express-4.18-green)](https://expressjs.com/)

[功能特性](#-功能特性) • [快速开始](#-快速开始) • [部署指南](#-部署指南) • [开发文档](#-开发文档)

</div>

---

## 📋 目录

- [功能特性](#-功能特性)
- [技术栈](#-技术栈)
- [快速开始](#-快速开始)
- [项目结构](#-项目结构)
- [环境配置](#-环境配置)
- [部署指南](#-部署指南)
- [性能优化](#-性能优化)
- [开发文档](#-开发文档)
- [贡献指南](#-贡献指南)
- [许可证](#-许可证)

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

## ⚙️ 环境配置

### 开发环境

```bash
# 后端环境变量
DB_PATH=./cache/fund_data.db
SESSION_SECRET=dev-secret-key
PORT=8311
CORS_ORIGIN=http://localhost:3000

# 前端环境变量
NEXT_PUBLIC_API_URL=http://localhost:8311
```

### 生产环境

```bash
# 后端环境变量
DB_PATH=/app/data/fund_data.db
SESSION_SECRET=production-secret-key-change-this
PORT=8311
CORS_ORIGIN=https://yourdomain.com

# 前端环境变量（静态导出，无需配置）
# NEXT_PUBLIC_API_URL=  # 留空，使用相对路径
```

## 🚢 部署指南

### Docker 部署（推荐）

#### 1. 使用 Docker Compose

```bash
# 构建并启动所有服务
docker-compose up -d

# 查看日志
docker-compose logs -f

# 停止服务
docker-compose down
```

#### 2. 单独构建 Docker 镜像

**后端镜像：**

```bash
cd backend
docker build -t fund-backend:latest .
docker run -p 8311:8311 fund-backend:latest
```

**前端镜像：**

```bash
cd frontend
docker build -t fund-frontend:latest .
docker run -p 3000:3000 fund-frontend:latest
```

### 传统部署

#### 1. 构建前端

```bash
cd frontend
npm run build
# 静态文件在 frontend/out/ 目录
```

#### 2. 配置后端托管前端

将 `frontend/out/` 目录复制到后端可访问的位置，后端会自动提供静态文件服务。

#### 3. 启动后端

```bash
cd backend
npm start
```

访问：http://localhost:8311

### 云平台部署

#### Vercel（前端）

```bash
cd frontend
vercel deploy
```

#### Railway / Render（全栈）

1. 连接 GitHub 仓库
2. 配置环境变量
3. 自动部署

## ⚡ 性能优化

项目已实现多项性能优化措施：

- ✅ **代码分割**：React、Next.js、Chart.js 单独打包
- ✅ **懒加载**：图表组件动态导入
- ✅ **请求缓存**：API 客户端内存缓存，减少 60-80% 重复请求
- ✅ **请求去重**：相同请求只发送一次
- ✅ **资源预加载**：DNS 预解析和预连接
- ✅ **组件优化**：React.memo、useMemo、useCallback

详细优化文档请查看：[PERFORMANCE_OPTIMIZATION.md](./PERFORMANCE_OPTIMIZATION.md)

## 📚 开发文档

### API 文档

#### 认证接口

- `POST /api/auth/login` - 用户登录
- `POST /api/auth/logout` - 用户登出
- `GET /api/auth/me` - 获取当前用户信息

#### 基金接口

- `GET /api/fund/data` - 获取基金数据
- `GET /api/fund/chart-data` - 获取图表数据
- `POST /api/fund/add` - 添加基金
- `DELETE /api/fund/delete` - 删除基金

完整 API 文档请查看：[API.md](./docs/API.md)

### 开发指南

#### 添加新页面

1. 在 `frontend/pages/` 创建新页面文件
2. 在 `frontend/components/Sidebar.tsx` 添加导航链接
3. 使用 API 客户端发送请求：

```typescript
import { apiGet } from '../utils/apiClient';

const data = await apiGet('/api/endpoint', {
  cache: { ttl: 5 * 60 * 1000 }
});
```

#### 添加新 API

1. 在 `backend/routes/` 创建路由文件
2. 在 `backend/server.js` 注册路由
3. 实现业务逻辑

### 代码规范

- 使用 TypeScript 进行类型检查
- 遵循 ESLint 规则
- 使用 Prettier 格式化代码
- 提交前运行 `npm run lint`

## 🤝 贡献指南

欢迎贡献代码！请遵循以下步骤：

1. Fork 本项目
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启 Pull Request

### 开发流程

```bash
# 1. 克隆你的 Fork
git clone https://github.com/your-username/fund-next.git

# 2. 添加上游仓库
git remote add upstream https://github.com/original-owner/fund-next.git

# 3. 创建开发分支
git checkout -b feature/your-feature

# 4. 提交更改
git commit -m "feat: add your feature"

# 5. 推送到你的 Fork
git push origin feature/your-feature

# 6. 在 GitHub 创建 Pull Request
```

## 📄 许可证

本项目采用 [MIT License](LICENSE) 许可证。

## 🙏 致谢

- [Next.js](https://nextjs.org/) - React 框架
- [Express](https://expressjs.com/) - Node.js Web 框架
- [Chart.js](https://www.chartjs.org/) - 图表库
- [sql.js](https://sql.js.org/) - SQLite 的 JavaScript 实现

## 📞 联系方式

- 项目 Issues: [GitHub Issues](https://github.com/your-username/fund-next/issues)
- 邮箱: your-email@example.com

---

<div align="center">

**⭐ 如果这个项目对你有帮助，请给个 Star！⭐**

Made with ❤️ by [Your Name](https://github.com/your-username)

</div>
