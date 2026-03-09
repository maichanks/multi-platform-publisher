# API 规范 (OpenAPI 3.0 概览)

**文档签名**: maichanks <hankan1993@gmail.com>

## 概述

本API遵循RESTful设计原则，使用OpenAPI 3.0规范。所有端点以`/api/v1/`为前缀，支持JSON请求/响应。认证采用OAuth 2.0 + API Key双模式。

**基础信息**:
- Base URL: `https://api.multiplatform.publisher/v1`
- 字符编码: UTF-8
- 时间格式: ISO 8601 (UTC)
- 分页: `?page=1&limit=50`（默认limit=20，最大=100）
- 错误处理: 标准HTTP状态码 + 统一错误响应体

## 认证方案

### 用户认证: OAuth 2.0 Authorization Code Flow with PKCE

适用于前端Web应用和后端API调用。

**流程**:
1. 前端引导用户到授权页 `/oauth/authorize`
2. 用户登录并授权
3. 授权服务器返回`code`到redirect_uri
4. 前端用`code` + `code_verifier` 交换`access_token`和`refresh_token`
5. API调用携带`Authorization: Bearer <access_token>`

**端点**:
- `GET /oauth/authorize` - 授权端点
- `POST /oauth/token` - 令牌交换
- `POST /oauth/refresh` - 刷新令牌
- `POST /oauth/revoke` - 撤销令牌

### 集成认证: API Key

适用于第三方系统集成、CI/CD、内部服务调用。

**使用方式**:
```
X-API-Key: pk_live_xxxxxxxxxxxxx
```

**管理端点**:
- `GET /auth/api-keys` - 列出API Keys
- `POST /auth/api-keys` - 创建新API Key
- `DELETE /auth/api-keys/{id}` - 删除API Key

## 错误响应格式

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "请求参数无效",
    "details": [
      {
        "field": "email",
        "message": "邮箱格式不正确"
      }
    ],
    "request_id": "req_abc123def456"
  }
}
```

**标准错误码**:
- `400 BAD_REQUEST` - 请求参数错误
- `401 UNAUTHORIZED` - 认证失败
- `403 FORBIDDEN` - 权限不足
- `404 NOT_FOUND` - 资源不存在
- `409 CONFLICT` - 资源冲突（如邮箱已存在）
- `422 UNPROCESSABLE_ENTITY` - 业务逻辑错误
- `429 TOO_MANY_REQUESTS` - 速率限制
- `500 INTERNAL_SERVER_ERROR` - 服务器错误
- `503 SERVICE_UNAVAILABLE` - 服务维护中

## 速率限制

基于用户+端点的滑动窗口算法（Redis实现）。

**响应头**:
```
X-RateLimit-Limit: 100       # 窗口内最大请求数
X-RateLimit-Remaining: 95   # 剩余请求数
X-RateLimit-Reset: 45       # 重置时间（秒）
```

**默认限制**:
- 普通用户: 1000次/小时
- API Key: 10000次/小时（根据套餐调整）
- 发布接口: 100次/天（受限于平台配额）

## 核心API端点

### 1. 工作区管理 (Workspace)

#### 列出工作区
`GET /workspaces`

**响应**:
```json
{
  "data": [
    {
      "id": "ws_abc123",
      "name": "科技媒体团队",
      "slug": "tech-media",
      "avatar_url": "https://...",
      "member_count": 12,
      "created_at": "2025-01-15T10:30:00Z",
      "role": "admin"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 3
  }
}
```

#### 创建工作区
`POST /workspaces`

**请求**:
```json
{
  "name": "我的团队",
  "description": "负责社交媒体运营"
}
```

#### 获取单个工作区
`GET /workspaces/{workspace_id}`

#### 更新工作区
`PATCH /workspaces/{workspace_id}`

#### 删除工作区
`DELETE /workspaces/{workspace_id}`

### 2. 成员与角色 (Members)

#### 列出成员
`GET /workspaces/{workspace_id}/members`

#### 邀请成员
`POST /workspaces/{workspace_id}/invitations`

**请求**:
```json
{
  "email": "colleague@example.com",
  "role": "creator",  // creator, admin, approver, editor, viewer
  "message": "加入我们的团队吧！"
}
```

#### 更新成员角色
`PATCH /workspaces/{workspace_id}/members/{user_id}`

```json
{
  "role": "approver"
}
```

#### 移除成员
`DELETE /workspaces/{workspace_id}/members/{user_id}`

### 3. 社交账号连接 (Social Accounts)

#### 列出已连接账号
`GET /workspaces/{workspace_id}/social-accounts`

**响应**:
```json
{
  "data": [
    {
      "id": "acc_xyz789",
      "platform": "twitter",  // twitter, linkedin, reddit, youtube, xiaohongshu, douyin
      "username": "@mybrand",
      "profile_url": "https://twitter.com/mybrand",
      "avatar_url": "https://...",
      "status": "connected",  // connected, disconnected, expired, error
      "last_sync_at": "2025-03-08T14:20:00Z",
      "rate_limit": {
        "remaining": 1450,
        "reset_at": "2025-03-08T15:15:00Z"
      }
    }
  ]
}
```

#### 连接新账号 (OAuth Flow)
`POST /workspaces/{workspace_id}/social-accounts/connect`

**请求**:
```json
{
  "platform": "twitter"
}
```

**响应**:
```json
{
  "auth_url": "https://api.twitter.com/oauth/authorize?oauth_token=...",
  "expires_in": 600,
  "state": "csrf_token_xyz"
}
```

前端引导用户到`auth_url`完成授权后，授权服务器回调到前端，前端调用：

`POST /workspaces/{workspace_id}/social-accounts/connect/callback`

```json
{
  "code": "oauth_code_from_callback",
  "state": "csrf_token_xyz"
}
```

返回`social_account_id`，连接成功。

**针对浏览器自动化平台（小红书、抖音）**:

```json
{
  "platform": "xiaohongshu",
  "qr_code_url": "https://...",  // 二维码URL
  "session_token": "temp_xyz",  // 临时会话Token
  "expires_in": 300
}
```

前端显示二维码，用户扫码登录后，调用：

`POST /workspaces/{workspace_id}/social-accounts/verify-login`

```json
{
  "session_token": "temp_xyz",
  "verification_code": "123456"  // 如果需要短信验证
}
```

#### 断开账号连接
`DELETE /workspaces/{workspace_id}/social-accounts/{account_id}`

#### 刷新账号令牌
`POST /workspaces/{workspace_id}/social-accounts/{account_id}/refresh`

### 4. 内容管理 (Content)

#### 创建内容草稿
`POST /workspaces/{workspace_id}/contents`

**请求**:
```json
{
  "title": "如何提升团队协作效率",
  "body": "完整文章内容...",
  "summary": "文章摘要",
  "tags": ["团队管理", "协作工具", "效率"],
  "media": [
    {
      "type": "image",
      "url": "https://...",
      "alt_text": "团队协作示意图"
    }
  ],
  "target_platforms": ["twitter", "linkedin", "xiaohongshu"],
  "ai_adaptation": {
    "enabled": true,
    "instructions": {
      "twitter": "使用简洁语言，添加热门话题标签",
      "linkedin": "专业语气，突出商业价值",
      "xiaohongshu": "亲切口吻，使用emoji，添加热门标签"
    }
  },
  "schedule": {
    "type": "immediate",  // immediate, scheduled, draft
    "publish_at": "2025-03-10T09:00:00Z"  // 仅当type=scheduled
  }
}
```

**响应**:
```json
{
  "id": "cnt_abc123",
  "workspace_id": "ws_abc123",
  "title": "如何提升团队协作效率",
  "status": "draft",  // draft, scheduled, processing, published, failed
  "target_platforms": ["twitter", "linkedin"],
  "created_at": "2025-03-09T05:57:00Z",
  "updated_at": "2025-03-09T05:57:00Z",
  "published_at": null
}
```

#### 列出内容
`GET /workspaces/{workspace_id}/contents`

**查询参数**:
- `status` (draft|scheduled|processing|published|failed)
- `platform` (过滤特定平台发布状态)
- `start_date`, `end_date` (发布时间范围)
- `creator_id` (创建者筛选)
- `page`, `limit`

**响应**:
```json
{
  "data": [
    {
      "id": "cnt_abc123",
      "title": "如何提升团队协作效率",
      "status": "published",
      "target_platforms": ["twitter", "linkedin"],
      "platform_status": {
        "twitter": {
          "status": "published",
          "post_url": "https://twitter.com/.../status/123",
          "published_at": "2025-03-10T09:00:01Z",
          "engagement": {
            "likes": 45,
            "retweets": 12,
            "replies": 3
          }
        },
        "linkedin": {
          "status": "published",
          "post_url": "https://linkedin.com/feed/update-123",
          "published_at": "2025-03-10T09:00:05Z",
          "engagement": {
            "likes": 23,
            "comments": 5,
            "shares": 2
          }
        }
      },
      "created_at": "2025-03-09T05:57:00Z",
      "published_at": "2025-03-10T09:00:05Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 156
  }
}
```

#### 获取单条内容
`GET /workspaces/{workspace_id}/contents/{content_id}`

#### 更新内容
`PATCH /workspaces/{workspace_id}/contents/{content_id}`

允许修改草稿状态的内容，已发布内容只能修改本地元数据。

#### 删除内容
`DELETE /workspaces/{workspace_id}/contents/{content_id}`

软删除，保留发布记录。

#### 重新发布
`POST /workspaces/{workspace_id}/contents/{content_id}/republish`

手动触发已删除或失败的发布任务。

#### AI内容适配预览
`POST /workspaces/{workspace_id}/contents/{content_id}/preview-adaptation`

**请求**:
```json
{
  "platforms": ["twitter", "xiaohongshu"]
}
```

**响应**:
```json
{
  "adaptations": {
    "twitter": {
      "text": "简洁版本... #标签",
      "media": [...],
      "estimated_length": 240
    },
    "xiaohongshu": {
      "text": "亲切口吻版本... 💕",
      "media": [...],
      "hashtags": ["#团队管理", "#效率工具"]
    }
  },
  "cost": {
    "tokens_used": 850,
    "estimated_cost": 0.0045
  }
}
```

### 5. 发布队列与状态 (Publishing)

#### 获取发布队列状态
`GET /workspaces/{workspace_id}/publish-queue`

返回等待中、处理中、失败的任务。

**响应**:
```json
{
  "queued": [
    {
      "job_id": "job_123",
      "content_id": "cnt_abc",
      "platform": "twitter",
      "position": 3,
      "estimated_time": "2025-03-10T09:01:00Z"
    }
  ],
  "processing": [...],
  "failed": [...]
}
```

#### 重试失败任务
`POST /workspaces/{workspace_id}/publish-queue/{job_id}/retry`

#### 取消队列任务
`DELETE /workspaces/{workspace_id}/publish-queue/{job_id}`

### 6. 统一分析 (Analytics)

#### 获取分析概览
`GET /workspaces/{workspace_id}/analytics/overview`

**查询参数**:
- `start_date`, `end_date`
- `platforms` (逗号分隔，如`twitter,linkedin`)

**响应**:
```json
{
  "period": {
    "start": "2025-03-01",
    "end": "2025-03-31"
  },
  "summary": {
    "total_posts": 145,
    "total_engagement": {
      "likes": 4520,
      "comments": 892,
      "shares": 345,
      "views": 125000
    },
    "avg_engagement_rate": 2.8
  },
  "platforms": [
    {
      "platform": "twitter",
      "posts": 60,
      "engagement": {
        "likes": 2100,
        "retweets": 450,
        "replies": 180
      },
      "top_post": {
        "id": "cnt_xyz",
        "url": "https://twitter.com/...",
        "engagement_rate": 5.2
      }
    }
  ]
}
```

#### 获取详细分析数据
`GET /workspaces/{workspace_id}/analytics/details`

支持按日、平台、内容类型聚合。

**响应**:
```json
{
  "data": [
    {
      "date": "2025-03-01",
      "platform": "twitter",
      "posts": 3,
      "engagement": {
        "likes": 150,
        "retweets": 30,
        "replies": 12
      }
    }
  ],
  "pagination": { ... }
}
```

#### 导出分析报告
`GET /workspaces/{workspace_id}/analytics/export`

**查询参数**:
- `format` (csv|xlsx|json)
- `start_date`, `end_date`

返回文件下载URL或直接流式传输。

### 7. 合规扫描 (Compliance)

#### 扫描内容
`POST /workspaces/{workspace_id}/compliance/scan`

**请求**:
```json
{
  "content_id": "cnt_abc123",
  "scan_types": ["sensitive", "copyright", "brand_safety"],
  "regions": ["cn", "us", "eu"]
}
```

**响应**:
```json
{
  "scan_id": "scan_xyz789",
  "status": "completed",
  "results": [
    {
      "type": "sensitive",
      "severity": "high",
      "rule": "political_reference",
      "description": "内容涉及政治敏感话题",
      "snippet": "原文片段...",
      "suggestion": "建议移除或替换相关表述"
    },
    {
      "type": "copyright",
      "severity": "medium",
      "rule": "unauthorized_quote",
      "description": "引用未注明出处",
      "suggestion": "添加来源引用"
    }
  ],
  "overall_risk": "medium",
  "scanned_at": "2025-03-09T06:00:00Z"
}
```

#### 获取扫描历史
`GET /workspaces/{workspace_id}/compliance/scans`

#### 手动覆盖合规决定
`POST /workspaces/{workspace_id}/compliance/{scan_id}/override`

**请求**:
```json
{
  "reason": "业务需要，经法务审批",
  "approved_by": "user_abc"
}
```

### 8. 系统与健康检查 (System)

#### 健康检查
`GET /health`

**响应**:
```json
{
  "status": "ok",
  "timestamp": "2025-03-09T06:00:00Z",
  "services": {
    "database": "healthy",
    "redis": "healthy",
    "ai_provider": "healthy",
    "queue": "healthy"
  },
  "version": "1.0.0"
}
```

#### 指标端点 (Prometheus)
`GET /metrics`

返回Prometheus格式指标。

### 9. Webhooks (异步通知)

#### 注册Webhook
`POST /workspaces/{workspace_id}/webhooks`

**请求**:
```json
{
  "url": "https://my-app.com/webhooks/publisher",
  "events": [
    "content.published",
    "content.failed",
    "analytics.daily_aggregated"
  ],
  "secret": "whsec_xyz"  // 可选，用于签名验证
}
```

#### 列出Webhooks
`GET /workspaces/{workspace_id}/webhooks`

#### 删除Webhook
`DELETE /workspaces/{workspace_id}/webhooks/{webhook_id}`

**支持的事件**:
- `content.published` - 内容成功发布到某平台
- `content.failed` - 发布失败
- `compliance.scan.completed` - 合规扫描完成
- `analytics.daily_aggregated` - 每日统计数据更新
- `social_account.connected` / `disconnected` - 账号连接状态变更

**Webhook请求签名**:
```
X-Webhook-Signature: sha256=abcdef1234567890...
```

使用HMAC SHA256 + secret生成，接收端验证。

### 10. 标签与分类管理 (Tags)

#### 列出标签
`GET /workspaces/{workspace_id}/tags`

#### 创建标签
`POST /workspaces/{workspace_id}/tags`

```json
{
  "name": "产品发布",
  "color": "#FF5733",
  "description": "用于产品相关内容的标签"
}
```

#### 更新/删除标签
`PATCH /workspaces/{workspace_id}/tags/{tag_id}`
`DELETE /workspaces/{workspace_id}/tags/{tag_id}`

## API版本管理

- 当前版本: v1 (`/api/v1/`)
- 弃用策略: 新版本发布后旧版本支持6个月
- 版本标识: URL路径版本（如`/api/v2/`）

## 数据导出API

#### 导出工作区数据 (GDPR/CCPA)
`GET /workspaces/{workspace_id}/export`

触发数据导出作业，返回下载链接（7天内有效）。

#### 删除工作区数据 (Right to be Forgotten)
`DELETE /workspaces/{workspace_id}/data`

软删除所有个人数据，保留匿名统计信息。

---

**文档维护**: 架构组  
**更新日期**: 2026-03-09  
**下次评审**: 2026-03-16
