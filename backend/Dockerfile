# 后端 Dockerfile - 包含前端构建产物
# 阶段1: 构建前端
FROM node:18-alpine AS frontend-builder

WORKDIR /app/frontend

# 复制前端 package 文件
COPY frontend/package.json frontend/package-lock.json* ./

# 安装前端依赖
RUN npm ci --no-audit --no-fund || npm install --no-audit --no-fund

# 复制前端源代码
COPY frontend/ .

# 构建前端（静态导出）
ENV NEXT_PUBLIC_API_URL=
ENV NODE_ENV=production
RUN npm run build

# 阶段2: 构建后端
FROM node:18-alpine AS backend-builder

WORKDIR /app

# 复制后端 package 文件
COPY backend/package.json backend/package-lock.json* ./

# 安装后端依赖
RUN npm ci --only=production --no-audit --no-fund || \
    (echo "npm ci failed, falling back to npm install" && \
     npm install --only=production --no-audit --no-fund)

# 复制后端应用代码
COPY backend/ .

# 从前端构建阶段复制构建产物
COPY --from=frontend-builder /app/frontend/out ./frontend/out
COPY --from=frontend-builder /app/frontend/public ./frontend/public

# 创建数据目录
RUN mkdir -p /app/cache

# 生产环境镜像（与根目录 Dockerfile 一致：entrypoint 修复卷权限后以 nodejs 启动）
FROM node:18-alpine

WORKDIR /app

RUN apk add --no-cache su-exec && \
    addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# 复制后端依赖和代码（包含前端构建产物、entrypoint.sh）
COPY --from=backend-builder /app/node_modules ./node_modules
COPY --from=backend-builder /app .
RUN chmod +x /app/entrypoint.sh

RUN mkdir -p /app/cache /app/tmp /app/data && \
    chown -R nodejs:nodejs /app/cache /app/tmp /app/data && \
    chmod -R 755 /app/tmp

EXPOSE 8311

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:8311/api/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

ENTRYPOINT ["/app/entrypoint.sh"]
