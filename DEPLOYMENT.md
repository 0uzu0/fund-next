# 🚀 部署指南

本文档提供详细的部署说明，包括 Docker 部署、传统部署和云平台部署。

## 📋 目录

- [Docker 部署](#docker-部署)
- [传统部署](#传统部署)
- [云平台部署](#云平台部署)
- [环境变量配置](#环境变量配置)
- [故障排查](#故障排查)

## 🐳 Docker 部署

### 前置要求

- Docker >= 20.10
- Docker Compose >= 2.0

### 快速开始

#### 1. 克隆项目

```bash
git clone https://github.com/your-username/fund-next.git
cd fund-next
```

#### 2. 配置环境变量

```bash
# 复制环境变量模板
cp backend/.env.example backend/.env

# 编辑环境变量（重要：修改 SESSION_SECRET）
nano backend/.env
```

**必须修改的配置：**

```env
SESSION_SECRET=your-random-secret-key-here  # 请使用强随机字符串
DB_PATH=/app/data/fund_data.db
PORT=8311
```

#### 3. 构建并启动

```bash
# 构建并启动所有服务
docker-compose up -d

# 查看日志
docker-compose logs -f

# 查看特定服务日志
docker-compose logs -f backend
docker-compose logs -f frontend
```

#### 4. 访问应用

- 前端：http://localhost:3000
- 后端 API：http://localhost:8311
- 健康检查：http://localhost:8311/api/health

### 使用 Nginx 反向代理（生产环境）

```bash
# 启动包含 Nginx 的完整服务栈
docker-compose --profile production up -d
```

访问：http://localhost（端口 80）

### Docker 命令参考

```bash
# 启动服务
docker-compose up -d

# 停止服务
docker-compose down

# 停止并删除数据卷
docker-compose down -v

# 重新构建镜像
docker-compose build --no-cache

# 查看服务状态
docker-compose ps

# 进入容器
docker-compose exec backend sh
docker-compose exec frontend sh

# 查看资源使用
docker stats
```

## 🖥️ 传统部署

### 前置要求

- Node.js >= 18.0.0
- npm >= 8.0.0

### 部署步骤

#### 1. 安装依赖

```bash
# 在项目根目录
npm run install:all
```

#### 2. 构建前端

```bash
cd frontend
npm run build
# 静态文件输出到 frontend/out/
```

#### 3. 配置后端

```bash
cd backend
cp .env.example .env
# 编辑 .env 文件
nano .env
```

#### 4. 配置前端静态文件

确保后端可以访问前端构建文件：

```bash
# 方式1：将 out 目录复制到后端目录
cp -r frontend/out backend/public

# 方式2：使用符号链接（推荐）
ln -s ../frontend/out backend/public
```

#### 5. 启动后端

```bash
cd backend
npm start
```

后端会自动提供前端静态文件服务。

访问：http://localhost:8311

### 使用 PM2 管理进程（推荐）

```bash
# 安装 PM2
npm install -g pm2

# 启动应用
cd backend
pm2 start server.js --name fund-backend

# 查看状态
pm2 status

# 查看日志
pm2 logs fund-backend

# 设置开机自启
pm2 startup
pm2 save
```

## ☁️ 云平台部署

### Vercel（前端）

1. 连接 GitHub 仓库
2. 选择 `frontend` 目录
3. 配置环境变量：
   - `NEXT_PUBLIC_API_URL` = 你的后端 API 地址
4. 部署

### Railway / Render（全栈）

#### Railway 部署

1. 连接 GitHub 仓库
2. 选择项目根目录
3. 配置环境变量：
   ```
   DB_PATH=/app/data/fund_data.db
   SESSION_SECRET=your-secret-key
   PORT=8311
   ```
4. 设置启动命令：`cd backend && npm start`
5. 部署

#### Render 部署

1. 创建 Web Service
2. 连接 GitHub 仓库
3. 配置：
   - Build Command: `cd backend && npm install`
   - Start Command: `cd backend && npm start`
4. 配置环境变量
5. 部署

### 使用 Docker 镜像部署

#### 构建镜像

```bash
# 构建后端镜像
cd backend
docker build -t fund-backend:latest .

# 构建前端镜像
cd frontend
docker build -t fund-frontend:latest .
```

#### 推送到镜像仓库

```bash
# 标记镜像
docker tag fund-backend:latest your-registry/fund-backend:latest
docker tag fund-frontend:latest your-registry/fund-frontend:latest

# 推送镜像
docker push your-registry/fund-backend:latest
docker push your-registry/fund-frontend:latest
```

## ⚙️ 环境变量配置

### 后端环境变量

| 变量名 | 说明 | 默认值 | 必需 |
|--------|------|--------|------|
| `DB_PATH` | 数据库文件路径 | `./cache/fund_data.db` | 否 |
| `SESSION_SECRET` | Session 密钥 | `luobobo` | **是**（生产环境） |
| `PORT` | 服务端口 | `8311` | 否 |
| `CORS_ORIGIN` | CORS 允许的源 | `*` | 否 |
| `NODE_ENV` | Node 环境 | `development` | 否 |

### 前端环境变量

| 变量名 | 说明 | 默认值 | 必需 |
|--------|------|--------|------|
| `NEXT_PUBLIC_API_URL` | API 地址 | `http://localhost:8311` | 否（生产环境可留空） |

### 生产环境推荐配置

```env
# 后端
NODE_ENV=production
DB_PATH=/app/data/fund_data.db
SESSION_SECRET=<强随机字符串，至少32字符>
PORT=8311
CORS_ORIGIN=https://yourdomain.com

# 前端（生产环境）
NEXT_PUBLIC_API_URL=  # 留空，使用相对路径
```

## 🔧 故障排查

### 常见问题

#### 1. 数据库连接失败

**症状：** 启动时提示数据库初始化失败

**解决方案：**
- 检查 `DB_PATH` 路径是否正确
- 确保数据库目录有写权限
- 检查磁盘空间是否充足

```bash
# 检查权限
ls -la backend/cache/

# 创建目录
mkdir -p backend/cache
chmod 755 backend/cache
```

#### 2. 前端无法连接后端

**症状：** 前端页面显示网络错误

**解决方案：**
- 检查 `NEXT_PUBLIC_API_URL` 配置
- 检查后端服务是否运行
- 检查 CORS 配置
- 检查防火墙设置

```bash
# 测试后端连接
curl http://localhost:8311/api/health

# 检查端口占用
netstat -tulpn | grep 8311
```

#### 3. Session 失效

**症状：** 频繁需要重新登录

**解决方案：**
- 检查 `SESSION_SECRET` 是否一致
- 检查 Cookie 设置
- 检查时间同步

#### 4. Docker 容器无法启动

**症状：** `docker-compose up` 失败

**解决方案：**
- 检查 Docker 和 Docker Compose 版本
- 查看详细错误日志：`docker-compose logs`
- 检查端口占用
- 检查磁盘空间

```bash
# 查看详细日志
docker-compose logs --tail=100

# 检查端口占用
lsof -i :8311
lsof -i :3000
```

#### 5. 前端构建失败

**症状：** `npm run build` 报错

**解决方案：**
- 检查 Node.js 版本（需要 >= 18）
- 清除缓存重新安装依赖
- 检查内存是否充足

```bash
# 清除缓存
rm -rf frontend/.next frontend/node_modules
cd frontend && npm install
npm run build
```

### 日志查看

#### Docker 日志

```bash
# 所有服务日志
docker-compose logs -f

# 特定服务日志
docker-compose logs -f backend
docker-compose logs -f frontend

# 最近100行
docker-compose logs --tail=100 backend
```

#### 应用日志

应用日志会输出到控制台，使用 PM2 时可以查看：

```bash
pm2 logs fund-backend
```

### 性能优化

#### 数据库优化

- 定期清理旧数据
- 使用索引优化查询
- 定期备份数据库

#### 应用优化

- 启用 Gzip 压缩
- 使用 CDN 加速静态资源
- 配置缓存策略

## 📞 获取帮助

如果遇到问题，请：

1. 查看 [GitHub Issues](https://github.com/your-username/fund-next/issues)
2. 查看日志文件
3. 提交 Issue 并附上错误日志

---

**祝部署顺利！** 🎉
