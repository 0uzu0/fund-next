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

// 使用示例
getFundRealtime(['000001', '000011'])
  .then(data => console.log(data))
  .catch(err => console.error(err));
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

# 使用示例
try:
    data = get_fund_realtime(['000001', '000011'])
    print(data)
except requests.exceptions.RequestException as e:
    print(f'Error: {e}')
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
| v1.1.0 | 2024-01-20 | 新增用户持仓数据接口，支持 API Key 绑定用户 |
| v1.0.0 | 2024-01-15 | 初始版本发布 |

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
