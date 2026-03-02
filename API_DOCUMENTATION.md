# LanFund 开放平台 API 文档

## 概述

LanFund 开放平台提供基金数据查询接口，支持第三方应用通过 API Key 方式接入。

- **基础URL**: `http://your-domain/api/v1/public`
- **协议**: HTTPS（生产环境）
- **数据格式**: JSON
- **字符编码**: UTF-8

---

## 认证方式

所有开放 API 请求需要在 HTTP Header 中携带 API Key：

```http
X-API-Key: your_api_key_here
```

或在查询参数中传递：

```http
GET /api/v1/public/fund/detail?code=000001&api_key=your_api_key_here
```

### 获取 API Key

1. 登录 LanFund 管理后台
2. 进入「系统设置」→「API 密钥管理」
3. 点击「新建 API Key」
4. 填写名称、描述等信息
5. 复制并妥善保存 API Key（仅显示一次）

> **注意**：API Key 创建时会自动绑定到当前登录用户，可用于访问该用户的持仓数据。

---

## 通用响应格式

### 成功响应

```json
{
  "success": true,
  "data": { ... }
}
```

### 错误响应

```json
{
  "error": "error_code",
  "message": "错误描述"
}
```

### 常见错误码

| 错误码 | HTTP状态码 | 说明 |
|--------|-----------|------|
| `unauthorized` | 401 | 缺少 API Key 或 API Key 无效/已过期 |
| `rate_limit_exceeded` | 429 | 请求频率超限 |
| `forbidden` | 403 | 权限不足或未绑定用户 |
| `bad_request` | 400 | 请求参数错误 |
| `not_found` | 404 | 未找到该基金 |
| `internal_error` | 500 | 服务器内部错误 |

---

## 限流规则

- **默认限制**: 100 次/分钟/API Key
- **触发限制后**: 需等待 60 秒后恢复
- **响应头信息**:
  ```http
  X-RateLimit-Limit: 100
  X-RateLimit-Remaining: 95
  X-RateLimit-Reset: 1704067200
  ```

---

## API 端点

### 1. 搜索基金

根据关键词搜索基金代码和名称。

```http
GET /fund/search?keyword={keyword}&limit={limit}
```

#### 请求参数

| 参数 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| keyword | string | 是 | - | 搜索关键词（基金代码或名称），至少2个字符 |
| limit | number | 否 | 10 | 返回结果数量限制 |

#### 响应示例

```json
{
  "success": true,
  "data": [
    {
      "code": "000001",
      "name": "华夏成长混合",
      "type": "混合型"
    },
    {
      "code": "000011",
      "name": "华夏大盘精选混合",
      "type": "混合型"
    }
  ],
  "total": 2
}
```

---

### 2. 获取贵金属价格

获取黄金、白银等贵金属的实时价格。

```http
GET /market/precious-metals
```

#### 响应示例

```json
{
  "success": true,
  "data": [
    {
      "name": "现货黄金",
      "symbol": "XAU",
      "price": 2034.52,
      "unit": "美元/盎司",
      "change": 12.34,
      "change_percent": 0.61
    },
    {
      "name": "现货白银",
      "symbol": "XAG",
      "price": 22.85,
      "unit": "美元/盎司",
      "change": -0.15,
      "change_percent": -0.65
    }
  ],
  "total": 2,
  "update_time": "2024-01-15T15:00:00.000Z"
}
```

---

### 3. 获取用户持仓数据

获取 API Key 绑定的用户的基金持仓数据。此接口需要 API Key 在创建时绑定具体用户。

```http
GET /user/portfolio
```

#### 前置条件

API Key 必须绑定用户才能访问此接口。

#### 响应示例

**成功响应：**
```json
{
  "success": true,
  "data": {
    "user_id": 2,
    "username": "zhangsan",
    "holdings": [
      {
        "code": "000001",
        "name": "华夏成长混合",
        "shares": 1000.5,
        "holding_units": 1000.5,
        "cost_per_unit": 1.2345,
        "stored_holding_profit": 123.45,
        "is_hold": true,
        "chart_default": false,
        "quote": {
          "nav": 1.3456,
          "acc_nav": 3.5678,
          "daily_return": 2.35,
          "date": "2024-01-15",
          "update_time": "2024-01-15 15:00:00"
        },
        "calculated": {
          "current_value": 1345.60,
          "cost_value": 1234.50,
          "profit": 111.10,
          "profit_rate": 9.00
        }
      }
    ],
    "summary": {
      "total_funds": 5,
      "valid_quotes": 5,
      "total_value": 12345.67,
      "total_cost": 11234.56,
      "total_profit": 1111.11,
      "profit_rate": 9.89
    }
  }
}
```

**未绑定用户错误：**
```json
{
  "error": "no_user_bound",
  "message": "该API Key未绑定用户，无法访问持仓数据"
}
```

---

### 4. 获取基金详细信息

获取基金的完整信息，包括基本信息、实时行情、历史净值、重仓股、各周期涨幅等。这是一个综合查询接口。

```http
GET /fund/detail?code={fund_code}&history_days={days}
```

#### 请求参数

| 参数 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| code | string | 是 | - | 基金代码 |
| history_days | number | 否 | 365 | 历史净值天数（最大365） |

#### 响应示例

```json
{
  "success": true,
  "data": {
    "fund_code": "000001",
    "fund_name": "华夏成长混合",
    "fund_type": "混合型",
    "current_quote": {
      "nav": 1.2345,
      "acc_nav": 3.4567,
      "daily_return": 0.89,
      "date": "2024-01-15",
      "update_time": "2024-01-15 15:00:00"
    },
    "history": {
      "records": [
        {
          "date": "2024-01-15",
          "nav": 1.2345,
          "acc_nav": 3.4567,
          "daily_return": 0.72
        }
      ],
      "stats": {
        "total_records": 365,
        "first_date": "2023-01-15",
        "last_date": "2024-01-15",
        "max_nav": 1.3456,
        "min_nav": 1.1234,
        "avg_daily_return": 0.05
      },
      "period_returns": {
        "1_week": "1.23",
        "1_month": "3.45",
        "3_months": "8.90",
        "6_months": "15.20",
        "1_year": "25.60"
      }
    },
    "holdings": [
      {
        "stock_code": "600519",
        "stock_name": "贵州茅台",
        "weight": "8.52%",
        "change_percent": 1.25
      }
    ],
    "update_time": "2024-01-15T15:00:00.000Z"
  }
}
```

---

## SDK 示例

### JavaScript / Node.js

```javascript
const API_KEY = 'your_api_key';
const BASE_URL = 'https://your-domain/api/v1/public';

// 搜索基金
async function searchFunds(keyword, limit = 10) {
  const response = await fetch(
    `${BASE_URL}/fund/search?keyword=${encodeURIComponent(keyword)}&limit=${limit}`,
    { headers: { 'X-API-Key': API_KEY } }
  );
  return await response.json();
}

// 获取贵金属价格
async function getPreciousMetals() {
  const response = await fetch(
    `${BASE_URL}/market/precious-metals`,
    { headers: { 'X-API-Key': API_KEY } }
  );
  return await response.json();
}

// 获取用户持仓数据
async function getUserPortfolio() {
  const response = await fetch(
    `${BASE_URL}/user/portfolio`,
    { headers: { 'X-API-Key': API_KEY } }
  );
  return await response.json();
}

// 获取基金详细信息
async function getFundDetail(code, historyDays = 365) {
  const response = await fetch(
    `${BASE_URL}/fund/detail?code=${code}&history_days=${historyDays}`,
    { headers: { 'X-API-Key': API_KEY } }
  );
  return await response.json();
}
```

### Python

```python
import requests

API_KEY = 'your_api_key'
BASE_URL = 'https://your-domain/api/v1/public'

headers = {'X-API-Key': API_KEY}

# 搜索基金
def search_funds(keyword, limit=10):
    params = {'keyword': keyword, 'limit': limit}
    response = requests.get(f'{BASE_URL}/fund/search', headers=headers, params=params)
    return response.json()

# 获取贵金属价格
def get_precious_metals():
    response = requests.get(f'{BASE_URL}/market/precious-metals', headers=headers)
    return response.json()

# 获取用户持仓数据
def get_user_portfolio():
    response = requests.get(f'{BASE_URL}/user/portfolio', headers=headers)
    return response.json()

# 获取基金详细信息
def get_fund_detail(code, history_days=365):
    params = {'code': code, 'history_days': history_days}
    response = requests.get(f'{BASE_URL}/fund/detail', headers=headers, params=params)
    return response.json()
```

### cURL

```bash
# 搜索基金
curl -X GET 'https://your-domain/api/v1/public/fund/search?keyword=华夏&limit=10' \
  -H 'X-API-Key: your_api_key'

# 获取贵金属价格
curl -X GET 'https://your-domain/api/v1/public/market/precious-metals' \
  -H 'X-API-Key: your_api_key'

# 获取用户持仓数据
curl -X GET 'https://your-domain/api/v1/public/user/portfolio' \
  -H 'X-API-Key: your_api_key'

# 获取基金详细信息
curl -X GET 'https://your-domain/api/v1/public/fund/detail?code=000001&history_days=365' \
  -H 'X-API-Key: your_api_key'
```

---

## 安全建议

1. **保护 API Key**
   - 不要在客户端代码中硬编码 API Key
   - 通过后端代理转发请求
   - 定期轮换 API Key

2. **使用 HTTPS**
   - 生产环境必须使用 HTTPS

3. **监控用量**
   - 定期检查 API 调用日志

---

## 更新日志

| 版本 | 日期 | 更新内容 |
|------|------|----------|
| v1.1.0 | 2026-03-02 | 持仓收益计算优化：部分减仓不减少持仓收益；清仓时才清零；预估数据增加交易日判断（周末/节假日/盘前隐藏） |
| v1.0.0 | 2024-02-28 | 初始版本发布，提供基金搜索、贵金属价格、用户持仓、基金详情四个接口 |