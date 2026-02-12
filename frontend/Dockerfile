# 前端 Dockerfile - 多阶段构建
FROM node:18-alpine AS deps

# 设置工作目录
WORKDIR /app

# 复制 package 文件
COPY package*.json ./

# 安装依赖
RUN npm ci

# 构建阶段
FROM node:18-alpine AS builder

WORKDIR /app

# 从 deps 阶段复制依赖
COPY --from=deps /app/node_modules ./node_modules

# 复制源代码
COPY . .

# 设置环境变量（生产环境）
ENV NEXT_PUBLIC_API_URL=
ENV NODE_ENV=production

# 构建应用
RUN npm run build

# 生产环境镜像
FROM node:18-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# 创建非 root 用户
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nextjs -u 1001

# 复制构建产物
COPY --from=builder /app/public ./public
COPY --from=builder /app/out ./out
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/next.config.js ./next.config.js

# 设置权限
RUN chown -R nextjs:nodejs /app

# 切换到非 root 用户
USER nextjs

# 暴露端口
EXPOSE 3000

# 健康检查
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost:3000 || exit 1

# 启动应用（静态导出，使用 serve 或 nginx）
# 注意：Next.js 静态导出需要使用静态文件服务器
RUN npm install -g serve

CMD ["serve", "-s", "out", "-l", "3000"]
