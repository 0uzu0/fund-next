# GitHub Actions 设置指南

## 🔧 修复依赖锁定文件错误

如果遇到错误：`Dependencies lock file is not found`，请按照以下步骤操作：

### 1. 确保锁定文件被提交到 Git

项目需要提交以下锁定文件：

```bash
# 检查锁定文件是否存在
ls -la backend/package-lock.json
ls -la frontend/package-lock.json

# 如果不存在，生成锁定文件
cd backend && npm install
cd ../frontend && npm install

# 提交锁定文件
git add backend/package-lock.json frontend/package-lock.json
git commit -m "chore: add package lock files"
git push
```

### 2. 验证 .gitignore 配置

确保 `.gitignore` 文件配置正确：

- ✅ **应该忽略**：根目录的 `package-lock.json`（如果存在）
- ✅ **应该提交**：`backend/package-lock.json` 和 `frontend/package-lock.json`

当前配置：
```
# 只忽略根目录的锁定文件
/package-lock.json
/yarn.lock
/pnpm-lock.yaml
```

### 3. 检查文件是否被 Git 跟踪

```bash
# 检查锁定文件是否被跟踪
git ls-files | grep package-lock.json

# 应该看到：
# backend/package-lock.json
# frontend/package-lock.json
```

### 4. 如果锁定文件被忽略

如果锁定文件被 `.gitignore` 忽略，需要强制添加：

```bash
# 强制添加被忽略的文件
git add -f backend/package-lock.json
git add -f frontend/package-lock.json
git commit -m "chore: add package lock files"
git push
```

## 📝 工作流程说明

### 依赖安装流程

1. **缓存检查**：GitHub Actions 会检查是否有缓存的 `node_modules`
2. **锁定文件检查**：使用 `package-lock.json` 作为缓存键
3. **依赖安装**：如果没有缓存或锁定文件变化，重新安装依赖

### 缓存策略

- **backend/node_modules**：基于 `backend/package-lock.json` 的哈希值缓存
- **frontend/node_modules**：基于 `frontend/package-lock.json` 的哈希值缓存

### 故障排查

#### 问题：找不到锁定文件

**原因**：
- 锁定文件没有被提交到 Git
- `.gitignore` 配置错误

**解决**：
```bash
# 1. 检查锁定文件是否存在
ls backend/package-lock.json frontend/package-lock.json

# 2. 如果不存在，生成它们
cd backend && npm install
cd ../frontend && npm install

# 3. 检查是否被忽略
git check-ignore backend/package-lock.json frontend/package-lock.json

# 4. 强制添加并提交
git add -f backend/package-lock.json frontend/package-lock.json
git commit -m "chore: add package lock files"
git push
```

#### 问题：缓存未命中

**原因**：
- 锁定文件内容变化
- 缓存键不匹配

**解决**：
- 这是正常行为，GitHub Actions 会重新安装依赖
- 新的依赖会被缓存供下次使用

## ✅ 验证设置

运行以下命令验证设置是否正确：

```bash
# 1. 检查锁定文件
ls -la backend/package-lock.json frontend/package-lock.json

# 2. 检查 Git 跟踪
git ls-files | grep package-lock.json

# 3. 检查 .gitignore
cat .gitignore | grep package-lock

# 4. 测试本地安装
cd backend && npm ci
cd ../frontend && npm ci
```

如果所有步骤都成功，GitHub Actions 应该能够正常工作！
