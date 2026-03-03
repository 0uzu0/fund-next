# 公开 API 文档

> 供第三方应用接入使用，需要 API Key 认证

## 基础信息

- **Base URL**: `/api/v1/public`
- **认证方式**: Header 中携带 `X-API-Key`
- **响应格式**: JSON

## 认证

所有 API 请求都需要在请求头中携带 API Key：

```http
X-API-Key: your-api-key-here
```

API Key 可通过管理后台创建和管理。

## 错误处理

当请求失败时，API 会返回以下格式的错误响应：

```json
{
  "error": "error_code",
  "message": "错误描述信息"
}
```

常见错误码：

| 错误码 | HTTP 状态码 | 说明 |
|--------|-------------|------|
| `unauthorized` | 401 | API Key 无效或缺失 |
| `forbidden` | 403 | 权限不足（如未绑定用户） |
| `bad_request` | 400 | 请求参数错误 |
| `not_found` | 404 | 资源不存在 |
| `internal_error` | 500 | 服务器内部错误 |

---

## API 端点

### 1. 搜索基金

根据关键词搜索基金代码和名称。

```
GET /fund/search
```

**请求参数**：

| 参数 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| keyword | String | 是 | - | 搜索关键词（基金代码或名称），至少2个字符 |
| limit | Number | 否 | 10 | 返回结果数量限制 |

**响应示例**：

```json
{
  "success": true,
  "data": [
    {
      "code": "000001",
      "name": "华夏成长混合",
      "type": "混合型"
    }
  ],
  "total": 1
}
```

---

### 2. 获取贵金属价格

获取黄金、白银等贵金属的实时价格。

```
GET /market/precious-metals
```

**请求参数**：无

**响应示例**：

```json
{
  "success": true,
  "data": [
    {
      "name": "黄金",
      "symbol": "AU",
      "price": 450.23,
      "unit": "元/克",
      "change": 2.15,
      "change_percent": 0.48
    }
  ],
  "total": 1,
  "update_time": "2024-01-15T09:30:00.000Z"
}
```

---

### 3. 获取用户持仓数据

获取 API Key 绑定的用户的基金持仓数据（需要该 Key 绑定用户）。

```
GET /user/portfolio
```

**请求参数**：无

**权限要求**：API Key 必须绑定用户

**响应示例**：

```json
{
  "success": true,
  "data": {
    "user_id": 1,
    "username": "admin",
    "holdings": [
      {
        "code": "000001",
        "name": "华夏成长混合",
        "shares": 1000,
        "holding_units": 1000,
        "cost_per_unit": 1.5,
        "stored_holding_profit": 0,
        "is_hold": true,
        "chart_default": false,
        "quote": {
          "nav": 1.8,
          "acc_nav": 2.5,
          "daily_return": 1.23,
          "date": "2024-01-15",
          "update_time": "2024-01-15 15:00:00"
        },
        "calculated": {
          "current_value": 1800,
          "cost_value": 1500,
          "profit": 300,
          "today_profit": 22.15,
          "profit_rate": 20.0
        }
      }
    ],
    "summary": {
      "total_funds": 1,
      "valid_quotes": 1,
      "total_value": 1800,
      "total_cost": 1500,
      "holding_profit": 300,
      "cumulative_profit": 300,
      "today_profit": 22.15,
      "profit_rate": 20.0
    }
  }
}
```

**字段说明**：

| 字段 | 说明 |
|------|------|
| `holdings` | 持仓基金列表 |
| `holdings[].quote` | 实时行情数据（获取失败时为 null） |
| `holdings[].calculated` | 计算后的数据（获取行情失败时为 null） |
| `summary.total_value` | 总持仓市值 |
| `summary.total_cost` | 总成本 |
| `summary.holding_profit` | 持仓收益（持有份额 × (净值 - 成本)） |
| `summary.cumulative_profit` | 累计收益（持仓收益 + 清仓基金历史收益） |
| `summary.today_profit` | 今日实际收益（持有份额 × 昨日净值 × 今日涨跌幅） |

**计算公式**：

- **持仓收益** = 持有份额 × (净值 - 成本单价)
- **今日实际收益** = 持有份额 × 昨日净值 × 今日涨跌幅(%)
- **累计收益** = 持仓收益 + 清仓基金历史收益

---

### 4. 获取基金详细信息

获取基金的完整信息，包括名称、实时行情、历史净值、重仓股、各周期涨幅等。

```
GET /fund/detail
```

**请求参数**：

| 参数 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| code | String | 是 | - | 基金代码 |
| history_days | Number | 否 | 365 | 历史净值天数（最大365） |

**响应示例**：

```json
{
  "success": true,
  "data": {
    "fund_code": "000001",
    "fund_name": "华夏成长混合",
    "fund_type": "混合型",
    "current_quote": {
      "nav": 1.8,
      "acc_nav": 2.5,
      "daily_return": 1.23,
      "date": "2024-01-15",
      "update_time": "2024-01-15 15:00:00"
    },
    "history": {
      "records": [
        {
          "date": "2024-01-14",
          "nav": 1.778,
          "acc_nav": 2.478,
          "daily_return": -0.56
        }
      ],
      "stats": {
        "total_records": 250,
        "first_date": "2023-01-15",
        "last_date": "2024-01-15",
        "max_nav": 1.85,
        "min_nav": 1.45,
        "avg_daily_return": 0.02
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
        "weight": 9.5,
        "change_percent": 1.2
      }
    ],
    "update_time": "2024-01-15T09:30:00.000Z"
  }
}
```

**字段说明**：

| 字段 | 说明 |
|------|------|
| `current_quote` | 实时行情数据 |
| `current_quote.nav` | 单位净值（昨日净值） |
| `current_quote.acc_nav` | 累计净值 |
| `current_quote.daily_return` | 日涨跌幅(%) |
| `history.records` | 历史净值记录列表 |
| `history.stats` | 历史数据统计 |
| `history.period_returns` | 各周期收益率 |
| `holdings` | 重仓股列表 |

---

## 数据更新频率

| 数据类型 | 更新频率 | 说明 |
|----------|----------|------|
| 基金搜索 | 实时 | 从数据库查询 |
| 贵金属价格 | 实时 | 从外部API获取 |
| 基金行情 | 交易日 9:30-15:00 | 实时更新 |
| 历史净值 | 每日 15:00 后 | 每日更新一次 |
| 重仓股 | 每季度 | 随季报更新 |

---

## 注意事项

1. **API 限流**：每个 API Key 默认限制为每分钟 60 次请求
2. **数据延迟**：基金估值数据可能有 5-15 分钟延迟
3. **交易时间**：
   - 交易日：周一至周五（节假日除外）
   - 交易时间：9:30-11:30, 13:00-15:00
   - 非交易时间可能返回缓存数据
4. **净值日期**：实际收益数据仅在净值日期为当天或昨天（9:30前）时显示

---

## 变更日志

### 2024-01-15
- 初始版本发布
- 提供基金搜索、贵金属价格、用户持仓、基金详情四个接口
- 持仓收益计算改为动态计算：持有份额 × (净值 - 成本)
