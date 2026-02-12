# 后端 Dockerfile
FROM node:18-alpine AS builder

# 设置工作目录
WORKDIR /app

# 复制 package 文件
COPY package*.json ./

# 安装依赖
RUN npm ci --only=production

# 复制应用代码
COPY . .

# 创建数据目录
RUN mkdir -p /app/cache

# 生产环境镜像
FROM node:18-alpine

WORKDIR /app

# 复制依赖和代码
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app .

# 创建非 root 用户
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# 设置数据目录权限
RUN chown -R nodejs:nodejs /app/cache

# 切换到非 root 用户
USER nodejs

# 暴露端口
EXPOSE 8311

# 健康检查
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:8311/api/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# 启动应用
CMD ["node", "server.js"]
