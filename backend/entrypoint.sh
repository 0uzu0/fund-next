#!/bin/sh
# 修复卷挂载目录权限（named volume 可能为 root 所有），再以 nodejs 用户启动
set -e
if [ -d /app/data ]; then chown -R nodejs:nodejs /app/data; fi
if [ -d /app/cache ]; then chown -R nodejs:nodejs /app/cache; fi
if [ -d /app/tmp ]; then chown -R nodejs:nodejs /app/tmp; fi
exec su-exec nodejs node server.js
