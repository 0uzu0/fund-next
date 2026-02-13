# 多阶段构建：前端 + 后端，构建上下文必须为仓库根目录（包含 frontend/ 与 backend/）
# 阶段1: 构建前端
FROM node:18-alpine AS frontend-builder

WORKDIR /app/frontend

COPY frontend/package.json frontend/package-lock.json* ./
RUN npm ci --no-audit --no-fund || npm install --no-audit --no-fund

COPY frontend/ .
ENV NEXT_PUBLIC_API_URL=
ENV NODE_ENV=production
RUN npm run build

# 阶段2: 构建后端
FROM node:18-alpine AS backend-builder

WORKDIR /app

COPY backend/package.json backend/package-lock.json* ./
RUN npm ci --only=production --no-audit --no-fund || \
    (echo "npm ci failed, falling back to npm install" && \
     npm install --only=production --no-audit --no-fund)

COPY backend/ .
COPY --from=frontend-builder /app/frontend/out ./frontend/out
COPY --from=frontend-builder /app/frontend/public ./frontend/public
RUN mkdir -p /app/cache

# 最终镜像
FROM node:18-alpine

WORKDIR /app

RUN apk add --no-cache su-exec && \
    addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

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
