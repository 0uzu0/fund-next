#!/bin/sh
# 修复卷挂载目录权限（named volume 可能为 root 所有），创建会话目录，再以 nodejs 用户启动
set -e
for dir in /app/data /app/cache /app/tmp; do
  [ -d "$dir" ] && chown -R nodejs:nodejs "$dir"
done
# 确保 Session 持久化目录存在且可写（SESSION_PATH 由环境变量传入，默认 /app/data/sessions）
mkdir -p "${SESSION_PATH:-/app/data/sessions}"
chown -R nodejs:nodejs "${SESSION_PATH:-/app/data/sessions}"
exec su-exec nodejs node server.js
