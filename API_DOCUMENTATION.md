# LanFund 开放平台 API 文档

## 概述

LanFund 开放平台提供基金数据查询接口，支持第三方应用通过 API Key 方式接入。

- **基础URL**: `http://your-domain/api/v1`
- **协议**: HTTPS（生产环境）
- **数据格式**: JSON
- **字符编码**: UTF-8

---

## 认证方式

所有开放 API 请求需要在 HTTP Header 中携带 API Key：

```http
X-API-Key: your_api_key_here
```

### 获取 API Key

1. 登录 LanFund 管理后台
2. 进入「系统设置」→「API 管理」
3. 点击「生成新密钥」
4. 复制并妥善保存 API Key（仅显示一次）

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
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "错误描述"
  }
}
```

### 常见错误码

| 错误码 | HTTP状态码 | 说明 |
|--------|-----------|------|
| `MISSING_API_KEY` | 401 | 缺少 API Key |
| `INVALID_API_KEY` | 401 | API Key 无效或已吊销 |
| `RATE_LIMIT_EXCEEDED` | 429 | 请求频率超限 |
| `INSUFFICIENT_PERMISSIONS` | 403 | 权限不足 |
| `NO_USER_BOUND` | 403 | API Key 未绑定用户，无法访问用户数据 |
| `INTERNAL_ERROR` | 500 | 服务器内部错误 |

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

## 目录

- [认证方式](#认证方式)
- [通用响应格式](#通用响应格式)
- [限流规则](#限流规则)
- [API 端点](#api-端点)
  - [1. 基金搜索建议](#1-基金搜索建议)
  - [2. 获取基金实时数据](#2-获取基金实时数据)
  - [3. 获取基金历史净值](#3-获取基金历史净值)
  - [4. 获取市场指数](#4-获取市场指数)
  - [5. 获取行业板块数据](#5-获取行业板块数据)
  - [6. 获取贵金属价格](#6-获取贵金属价格)
  - [7. 获取基金基本信息](#7-获取基金基本信息)
  - [8. 获取用户持仓数据（需绑定用户）](#8-获取用户持仓数据需绑定用户)
  - [9. 获取用户交易记录（需绑定用户）](#9-获取用户交易记录需绑定用户)
- [使用流程：API Key 绑定用户获取持仓数据](#使用流程api-key-绑定用户获取持仓数据)
- [SDK 示例](#sdk-示例)
- [最佳实践](#最佳实践)
- [安全建议](#安全建议)
- [更新日志](#更新日志)
- [技术支持](#技术支持)

---

## API 端点

### 1. 基金搜索建议

根据关键词搜索基金代码和名称。

```http
GET /public/fund/suggest?q={keyword}
```

#### 请求参数

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| q | string | 是 | 搜索关键词（基金代码或名称） |

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
  ]
}
```

---

### 2. 获取基金实时数据

获取指定基金的实时估值、净值等数据。

```http
GET /public/fund/realtime?codes={fund_codes}
```

#### 请求参数

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| codes | string | 是 | 基金代码，多个用逗号分隔（最多50个） |

#### 响应示例

```json
{
  "success": true,
  "data": {
    "000001": {
      "code": "000001",
      "name": "华夏成长混合",
      "nav": 1.2345,
      "nav_date": "2024-01-15",
      "estimate": 1.2456,
      "estimate_time": "15:00:00",
      "daily_change": 0.89,
      "daily_change_percent": 0.72
    }
  }
}
```

#### 字段说明

| 字段 | 类型 | 说明 |
|------|------|------|
| code | string | 基金代码 |
| name | string | 基金名称 |
| nav | number | 最新净值 |
| nav_date | string | 净值日期 |
| estimate | number | 实时估值 |
| estimate_time | string | 估值时间 |
| daily_change | number | 日涨跌额 |
| daily_change_percent | number | 日涨跌幅(%) |

---

### 3. 获取基金历史净值

获取基金的历史净值数据。

```http
GET /public/fund/history?code={fund_code}&days={days}
```

#### 请求参数

| 参数 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| code | string | 是 | - | 基金代码 |
| days | number | 否 | 30 | 查询天数（最大365） |

#### 响应示例

```json
{
  "success": true,
  "data": {
    "code": "000001",
    "name": "华夏成长混合",
    "history": [
      {
        "date": "2024-01-15",
        "nav": 1.2345,
        "accumulated_nav": 3.4567,
        "daily_change_percent": 0.72
      }
    ]
  }
}
```

---

### 4. 获取市场指数

获取主要市场指数的实时行情。

```http
GET /public/market/indices
```

#### 响应示例

```json
{
  "success": true,
  "data": {
    "domestic": [
      {
        "name": "上证指数",
        "symbol": "SH000001",
        "price": 2880.5,
        "change": -12.34,
        "change_percent": -0.43
      }
    ],
    "global": [
      {
        "name": "纳斯达克",
        "symbol": "IXIC",
        "price": 15360.2,
        "change": 125.6,
        "change_percent": 0.82
      }
    ]
  }
}
```

---

### 5. 获取行业板块数据

获取各行业板块的涨跌幅排行。

```http
GET /public/market/sectors
```

#### 响应示例

```json
{
  "success": true,
  "data": [
    {
      "name": "半导体",
      "change_percent": 2.56,
      "leading_stocks": ["中芯国际", "韦尔股份"]
    },
    {
      "name": "新能源",
      "change_percent": -1.23,
      "leading_stocks": ["宁德时代", "比亚迪"]
    }
  ]
}
```

---

### 6. 获取贵金属价格

获取黄金、白银等贵金属的实时价格。

```http
GET /public/market/precious-metals
```

#### 响应示例

```json
{
  "success": true,
  "data": {
    "gold": {
      "price": 480.52,
      "currency": "CNY/g",
      "change": 2.15,
      "change_percent": 0.45,
      "update_time": "2024-01-15T15:00:00+08:00"
    },
    "silver": {
      "price": 5.82,
      "currency": "CNY/g",
      "change": -0.03,
      "change_percent": -0.51,
      "update_time": "2024-01-15T15:00:00+08:00"
    }
  }
}
```

---

### 7. 获取基金基本信息

获取基金的详细基本信息。

```http
GET /public/fund/info?code={fund_code}
```

#### 请求参数

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| code | string | 是 | 基金代码 |

#### 响应示例

```json
{
  "success": true,
  "data": {
    "code": "000001",
    "name": "华夏成长混合",
    "type": "混合型",
    "company": "华夏基金",
    "manager": "张三",
    "establish_date": "2001-12-18",
    "scale": 45.67,
    "rating": 4,
    "risk_level": "中高风险",
    "investment_style": "成长型"
  }
}
```

---

### 8. 获取用户持仓数据（需绑定用户）

获取 API Key 绑定的用户的基金持仓数据。此接口需要 API Key 在创建时绑定具体用户。

```http
GET /public/user/portfolio
```

#### 前置条件

1. 管理员在创建 API Key 时必须选择绑定用户
2. 该用户必须在系统中持有基金

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

#### 字段说明

| 字段 | 类型 | 说明 |
|------|------|------|
| user_id | number | 用户ID |
| username | string | 用户名 |
| holdings | array | 持仓基金列表 |
| holdings[].code | string | 基金代码 |
| holdings[].name | string | 基金名称 |
| holdings[].shares | number | 持有份额 |
| holdings[].cost_per_unit | number | 成本单价 |
| holdings[].quote | object | 实时行情数据 |
| holdings[].calculated | object | 计算后的盈亏数据 |
| summary | object | 汇总统计信息 |

---

### 9. 获取用户交易记录（需绑定用户）

获取 API Key 绑定的用户的基金交易记录。

```http
GET /public/user/position-records?limit=50&offset=0
```

#### 请求参数

| 参数 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| limit | number | 否 | 50 | 返回记录数量限制（最大100） |
| offset | number | 否 | 0 | 分页偏移量 |

#### 响应示例

```json
{
  "success": true,
  "data": {
    "user_id": 2,
    "username": "zhangsan",
    "records": [
      {
        "id": 1,
        "fund_code": "000001",
        "fund_name": "华夏成长混合",
        "operation": "buy",
        "amount": 1000,
        "units": 812.35,
        "trade_date": "2024-01-15",
        "period": " afternoon",
        "holding_before": {
          "units": 0,
          "cost_per_unit": 0
        },
        "holding_after": {
          "units": 812.35,
          "cost_per_unit": 1.2309
        },
        "created_at": "2024-01-15T14:30:00+08:00"
      }
    ],
    "pagination": {
      "total": 128,
      "limit": 50,
      "offset": 0,
      "has_more": true
    }
  }
}
```

---

## 使用流程：API Key 绑定用户获取持仓数据

### 步骤 1：管理员创建 API Key 并绑定用户

```bash
# 管理员登录后，调用管理接口创建 API Key
curl -X POST https://your-domain/api/admin/api-keys \
  -H "Content-Type: application/json" \
  -H "Cookie: connect.sid=your_session_cookie" \
  -d '{
    "name": "我的投资App",
    "permissions": "read",
    "bindUserId": 2
  }'
```

**响应：**
```json
{
  "success": true,
  "data": {
    "api_key": "ak_a1b2c3d4e5f6...",
    "name": "我的投资App",
    "permissions": "read",
    "bind_user_id": 2
  }
}
```

> **重要**：`api_key` 只显示一次，请立即复制保存！

### 步骤 2：使用 API Key 获取持仓数据

```javascript
const API_KEY = 'ak_a1b2c3d4e5f6...';

// 获取持仓数据
async function getPortfolio() {
  const response = await fetch('https://your-domain/api/v1/public/user/portfolio', {
    headers: {
      'X-API-Key': API_KEY
    }
  });
  
  const data = await response.json();
  
  if (data.success) {
    console.log('持仓基金:', data.data.holdings);
    console.log('汇总信息:', data.data.summary);
  } else {
    console.error('获取失败:', data.message);
  }
}

getPortfolio();
```

### 步骤 3：处理响应数据

```javascript
// 计算总收益率
function calculateTotalReturn(summary) {
  return {
    totalValue: summary.total_value,
    totalCost: summary.total_cost,
    totalProfit: summary.total_profit,
    profitRate: summary.profit_rate
  };
}

// 获取涨幅最大的基金
function getTopGainer(holdings) {
  return holdings
    .filter(h => h.calculated)
    .sort((a, b) => b.calculated.profit_rate - a.calculated.profit_rate)[0];
}
```

---

## SDK 示例

### JavaScript / Node.js

```javascript
const axios = require('axios');

const API_KEY = 'your_api_key';
const BASE_URL = 'https://your-domain/api/v1';

const client = axios.create({
  baseURL: BASE_URL,
  headers: {
    'X-API-Key': API_KEY
  }
});

// 获取基金实时数据
async function getFundRealtime(codes) {
  try {
    const response = await client.get('/public/fund/realtime', {
      params: { codes: codes.join(',') }
    });
    return response.data;
  } catch (error) {
    console.error('API Error:', error.response?.data || error.message);
    throw error;
  }
}

// 获取用户持仓数据（需要 API Key 绑定用户）
async function getUserPortfolio() {
  try {
    const response = await client.get('/public/user/portfolio');
    return response.data;
  } catch (error) {
    console.error('API Error:', error.response?.data || error.message);
    throw error;
  }
}

// 获取用户交易记录
async function getUserRecords(limit = 50, offset = 0) {
  try {
    const response = await client.get('/public/user/position-records', {
      params: { limit, offset }
    });
    return response.data;
  } catch (error) {
    console.error('API Error:', error.response?.data || error.message);
    throw error;
  }
}

// 使用示例：获取持仓数据并计算收益
async function analyzePortfolio() {
  try {
    const portfolio = await getUserPortfolio();
    
    if (!portfolio.success) {
      console.error('获取持仓失败:', portfolio.message);
      return;
    }
    
    const { holdings, summary } = portfolio.data;
    
    console.log('=== 持仓汇总 ===');
    console.log(`总基金数: ${summary.total_funds}`);
    console.log(`总市值: ¥${summary.total_value.toFixed(2)}`);
    console.log(`总成本: ¥${summary.total_cost.toFixed(2)}`);
    console.log(`总收益: ¥${summary.total_profit.toFixed(2)}`);
    console.log(`收益率: ${summary.profit_rate.toFixed(2)}%`);
    
    console.log('\n=== 持仓明细 ===');
    holdings.forEach(h => {
      const calc = h.calculated;
      console.log(`${h.code} - ${h.name}`);
      console.log(`  份额: ${h.holding_units}, 成本价: ¥${h.cost_per_unit}`);
      console.log(`  现价: ¥${h.quote?.nav}, 收益: ¥${calc?.profit} (${calc?.profit_rate}%)`);
    });
    
  } catch (err) {
    console.error('分析失败:', err.message);
  }
}

analyzePortfolio();
```

### Python

```python
import requests

API_KEY = 'your_api_key'
BASE_URL = 'https://your-domain/api/v1'

headers = {
    'X-API-Key': API_KEY
}

# 获取基金实时数据
def get_fund_realtime(codes):
    params = {'codes': ','.join(codes)}
    response = requests.get(
        f'{BASE_URL}/public/fund/realtime',
        headers=headers,
        params=params
    )
    response.raise_for_status()
    return response.json()

# 获取用户持仓数据（需要 API Key 绑定用户）
def get_user_portfolio():
    response = requests.get(
        f'{BASE_URL}/public/user/portfolio',
        headers=headers
    )
    response.raise_for_status()
    return response.json()

# 获取用户交易记录
def get_user_records(limit=50, offset=0):
    params = {'limit': limit, 'offset': offset}
    response = requests.get(
        f'{BASE_URL}/public/user/position-records',
        headers=headers,
        params=params
    )
    response.raise_for_status()
    return response.json()

# 使用示例：分析持仓数据
def analyze_portfolio():
    try:
        portfolio = get_user_portfolio()
        
        if not portfolio.get('success'):
            print(f"获取持仓失败: {portfolio.get('message')}")
            return
        
        data = portfolio['data']
        holdings = data['holdings']
        summary = data['summary']
        
        print('=== 持仓汇总 ===')
        print(f"总基金数: {summary['total_funds']}")
        print(f"总市值: ¥{summary['total_value']:.2f}")
        print(f"总成本: ¥{summary['total_cost']:.2f}")
        print(f"总收益: ¥{summary['total_profit']:.2f}")
        print(f"收益率: {summary['profit_rate']:.2f}%")
        
        print('\n=== 持仓明细 ===')
        for h in holdings:
            calc = h.get('calculated', {})
            print(f"{h['code']} - {h['name']}")
            print(f"  份额: {h['holding_units']}, 成本价: ¥{h['cost_per_unit']}")
            if calc:
                print(f"  现价: ¥{h.get('quote', {}).get('nav')}, "
                      f"收益: ¥{calc.get('profit')} ({calc.get('profit_rate')}%)")
        
    except requests.exceptions.RequestException as e:
        print(f'Error: {e}')

analyze_portfolio()
```

### cURL

```bash
# 获取基金实时数据
curl -X GET \
  'https://your-domain/api/v1/public/fund/realtime?codes=000001,000011' \
  -H 'X-API-Key: your_api_key'

# 获取市场指数
curl -X GET \
  'https://your-domain/api/v1/public/market/indices' \
  -H 'X-API-Key: your_api_key'

# 获取用户持仓数据（需要 API Key 绑定用户）
curl -X GET \
  'https://your-domain/api/v1/public/user/portfolio' \
  -H 'X-API-Key: your_api_key'

# 获取用户交易记录
curl -X GET \
  'https://your-domain/api/v1/public/user/position-records?limit=50&offset=0' \
  -H 'X-API-Key: your_api_key'
```

---

## 最佳实践

### 1. 错误处理

建议实现指数退避重试机制：

```javascript
async function apiCallWithRetry(url, options, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fetch(url, options);
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      // 指数退避：1s, 2s, 4s
      await delay(Math.pow(2, i) * 1000);
    }
  }
}
```

### 2. 缓存策略

对于不频繁变化的数据（如基金基本信息），建议本地缓存：

```javascript
// 缓存24小时
const CACHE_DURATION = 24 * 60 * 60 * 1000;

async function getCachedFundInfo(code) {
  const cacheKey = `fund_info_${code}`;
  const cached = localStorage.getItem(cacheKey);
  
  if (cached) {
    const { data, timestamp } = JSON.parse(cached);
    if (Date.now() - timestamp < CACHE_DURATION) {
      return data;
    }
  }
  
  const response = await fetch(`/api/v1/public/fund/info?code=${code}`);
  const data = await response.json();
  
  localStorage.setItem(cacheKey, JSON.stringify({
    data,
    timestamp: Date.now()
  }));
  
  return data;
}
```

### 3. 批量请求

尽量合并请求以减少 API 调用次数：

```javascript
// ❌ 不推荐：多次单独请求
const fund1 = await getFundData('000001');
const fund2 = await getFundData('000011');

// ✅ 推荐：批量请求
const funds = await getFundData(['000001', '000011']);
```

---

## 安全建议

1. **保护 API Key**
   - 不要在客户端代码（浏览器、移动App）中硬编码 API Key
   - 通过后端代理转发请求
   - 定期轮换 API Key

2. **使用 HTTPS**
   - 生产环境必须使用 HTTPS
   - 验证服务器证书

3. **监控用量**
   - 定期检查 API 调用日志
   - 设置异常告警

---

## 更新日志

| 版本 | 日期 | 更新内容 |
|------|------|----------|
| v1.2.0 | 2024-02-27 | 新增 API Key 管理后台，支持创建/查看/吊销 API Key |
| v1.1.0 | 2024-01-20 | 新增用户持仓数据接口 (`/public/user/portfolio`)，支持 API Key 绑定用户获取持仓基金数据 |
| v1.0.0 | 2024-01-15 | 初始版本发布，提供基金查询、市场行情等基础接口 |

---

## 技术支持

- **文档**: https://your-domain/docs
- **问题反馈**: https://github.com/your-repo/issues
- **邮箱**: api-support@example.com

---

## 术语表

| 术语 | 说明 |
|------|------|
| NAV | Net Asset Value，基金单位净值 |
| 估值 | 基金在交易日的实时估算净值 |
| 累计净值 | 包含分红再投资的基金净值 |
| 涨跌幅 | 当日价格变动的百分比 |
