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

## 错误处理

错误响应格式：

```json
{
  "error": "error_code",
  "message": "错误描述"
}
```

常见错误码：

| 错误码 | HTTP 状态码 | 说明 |
|--------|-------------|------|
| `unauthorized` | 401 | API Key 无效或缺失 |
| `forbidden` | 403 | 权限不足（未绑定用户） |
| `bad_request` | 400 | 请求参数错误 |
| `not_found` | 404 | 资源不存在 |
| `internal_error` | 500 | 服务器内部错误 |

---

## API 端点

### 1. 持仓总览

获取用户持仓的总体概况。数据与前端页面实时同步。

```
GET /portfolio/summary
```

**权限**：API Key 必须绑定用户

**响应示例**：

```json
{
  "success": true,
  "data": {
    "total_value": 150000.00,
    "today_est_change": 1234.56,
    "today_actual_change": 1234.56,
    "holding_profit": 15000.00,
    "cumulative_profit": 18000.00
  }
}
```

**字段说明**：

| 字段 | 说明 | 计算公式 |
|------|------|----------|
| `total_value` | 总持仓金额 | Σ(持有份额 × 净值) |
| `today_est_change` | 今日预估涨跌 | Σ(持仓金额 × 预估涨跌幅%) |
| `today_actual_change` | 今日实际涨跌 | Σ(持仓金额 × 日涨跌幅%，根据显示规则) |
| `holding_profit` | 持仓收益 | Σ(持有份额 × (净值 - 成本)) |
| `cumulative_profit` | 累计收益 | 持仓收益 + 清仓基金历史收益 |

---

### 2. 持仓基金列表

获取用户持有的基金列表及详细数据。数据与前端页面实时同步，使用相同的数据源和计算逻辑。

```
GET /portfolio/holdings
```

**权限**：API Key 必须绑定用户

**响应示例**：

```json
{
  "success": true,
  "data": [
    {
      "code": "000001",
      "name": "华夏成长混合",
      "holding_amount": 50000.00,
      "est_amount": 615.00,
      "est_change_pct": 1.23,
      "actual_amount": 615.00,
      "actual_change_pct": 1.23,
      "cumulative": 5000.00,
      "net_value": "1.2345(01-15)",
      "update_time": "14:32",
      "day_growth": "1.23%",
      "holding_units": 10000,
      "cost_per_unit": 1.1000,
      "estimate_date": "2024-01-15",
      "net_value_date": "01-15"
    }
  ]
}
```

**字段说明**：

| 字段 | 说明 | 计算公式 |
|------|------|----------|
| `code` | 基金代码 | - |
| `name` | 基金名称 | - |
| `holding_amount` | 持仓金额 | 持有份额 × 净值 |
| `est_amount` | 预估收益 | 持仓金额 × 预估涨跌幅% |
| `est_change_pct` | 预估涨跌(%) | 来自数据源 |
| `actual_amount` | 实际收益 | 持仓金额 × 日涨跌幅%（根据显示规则） |
| `actual_change_pct` | 实际涨跌(%) | 日涨跌幅（根据显示规则） |
| `cumulative` | 持仓收益 | 持有份额 × (净值 - 成本单价) |
| `net_value` | 单位净值（含日期） | 例："1.2345(01-15)" |
| `update_time` | 估值更新时间 | 例："14:32" |
| `day_growth` | 日涨跌幅 | 例："1.23%" |
| `holding_units` | 持有份额 | - |
| `cost_per_unit` | 成本单价 | - |
| `estimate_date` | 估值日期 | YYYY-MM-DD |
| `net_value_date` | 净值日期 | MM-DD |

---

### 3. 基金详情

获取基金的实时行情和基本信息。

```
GET /fund/detail?code={基金代码}
```

**参数**：

| 参数 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| code | String | 是 | - | 基金代码 |

**响应示例**：

```json
{
  "success": true,
  "data": {
    "fund_code": "000001",
    "fund_name": "华夏成长混合",
    "current_quote": {
      "nav": 1.8000,
      "nav_date": "01-15",
      "daily_return": 1.23,
      "estimate_return": 1.25,
      "update_time": "14:32",
      "estimate_date": "2024-01-15"
    },
    "stats": {
      "consecutive_info": "3天 2.5%",
      "monthly_info": "15/20 5.2%"
    },
    "update_time": "2024-01-15T09:30:00.000Z"
  }
}
```

**字段说明**：

| 字段 | 说明 |
|------|------|
| `fund_code` | 基金代码 |
| `fund_name` | 基金名称 |
| `current_quote.nav` | 单位净值 |
| `current_quote.nav_date` | 净值日期 (MM-DD) |
| `current_quote.daily_return` | 日涨跌幅(%) |
| `current_quote.estimate_return` | 预估涨跌幅(%) |
| `current_quote.update_time` | 估值更新时间 |
| `current_quote.estimate_date` | 估值日期 |
| `stats.consecutive_info` | 连涨/跌信息 |
| `stats.monthly_info` | 近30天统计 |

---

### 4. 搜索基金

根据关键词搜索基金。

```
GET /fund/search?keyword={关键词}&limit=10
```

**参数**：

| 参数 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| keyword | String | 是 | - | 搜索关键词，至少2个字符 |
| limit | Number | 否 | 10 | 返回数量限制 |

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

### 5. 贵金属价格

获取黄金、白银等贵金属实时价格。

```
GET /market/precious-metals
```

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
  "update_time": "2024-01-15T09:30:00.000Z"
}
```

---

## 数据说明

### 计算逻辑

| 指标 | 计算公式 |
|------|----------|
| 持仓金额 | 持有份额 × 单位净值 |
| 预估收益 | 持仓金额 × 预估涨跌幅% |
| 实际收益 | 持仓金额 × 日涨跌幅%（根据显示规则） |
| 持仓收益 | 持有份额 × (净值 - 成本单价) |
| 累计收益 | 持仓收益 + 清仓基金历史收益 |

### 显示规则

**实际收益/涨跌**：
- 净值日期为今天：显示
- 净值日期为昨天且当前时间 < 9:30：显示
- 净值日期为昨天且当前时间 >= 9:30：不显示（等待今天净值）

### 更新频率

| 数据类型 | 更新频率 |
|----------|----------|
| 持仓总览/列表 | 实时计算 |
| 基金行情 | 交易日 9:30-15:00 实时更新 |
| 历史净值 | 每日 15:00 后更新 |
| 贵金属价格 | 实时 |

---

## 变更日志

### 2024-03-02
- `/portfolio/holdings` 接口数据与前端实时同步
  - 使用与前端相同的数据源（fund123 + 天天基金）
  - 使用相同的计算逻辑（`searchCode` + `buildPositionRows`）
  - 实际收益/涨跌遵循相同的显示规则
  - 新增字段：`net_value`, `update_time`, `day_growth`, `holding_units`, `cost_per_unit`, `estimate_date`, `net_value_date`
- `/portfolio/summary` 接口同样使用前端一致的数据源和计算逻辑
- `/fund/detail` 接口简化，移除历史净值和重仓股（当前版本暂不支持）

### 2024-01-15
- 重构持仓接口，拆分为总览和列表两个独立接口
- 精简响应字段，只保留核心数据
- 统一计算逻辑：持仓收益 = 持有份额 × (净值 - 成本)
