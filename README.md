# Multi-Platform Content Publisher

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Version](https://img.shields.io/badge/version-1.0.0--alpha.0-orange.svg)]()

**智能多平台内容发布系统** - 一键发布到 Twitter、Reddit、LinkedIn、小红书、抖音等平台，集成 AI 内容适配、智能合规扫描、统一数据分析。

## ✨ 核心功能

- **多平台发布**: 支持 Twitter/X、Reddit、LinkedIn、小红书、抖音等主流平台
- **AI 智能适配**: 自动根据平台特性调整内容风格、长度、标签
- **合规扫描**: 内置敏感词库 + AI 合规检查，确保内容安全
- **统一分析**: 跨平台数据聚合，统一指标看板
- **团队协作**: 多工作区、角色权限管理 (RBAC)
- **浏览器自动化**: 针对无 API 平台（小红书、抖音）的 Web 自动化方案

## 🚀 快速开始 (5 分钟)

### 前置要求

- Node.js 20.x LTS
- Docker & Docker Compose
- Git

### 1. 克隆并安装

```bash
git clone https://github.com/maichanks/multi-platform-publisher.git
cd multi-platform-publisher
npm install
```

### 2. 配置环境变量

```bash
# 复制环境变量模板
cp .env.example .env

# 编辑 .env 文件，填入必要的配置
# 至少需要配置:
# - DATABASE_URL (PostgreSQL)
# - REDIS_URL
# - ENCRYPTION_KEY (32字节随机字符串)
# - OPENROUTER_API_KEY (可选，AI 功能)
```

### 平台 API 配置 (必需)

系统支持多个社交媒体平台的自动发布。每个平台需要独立的 OAuth 2.0 凭据。请根据你需要使用的平台，对应的配置部分。

#### Twitter/X (推荐)

1. 访问 [Twitter Developer Portal](https://developer.twitter.com/)
2. 创建新项目和应用，或使用现有应用
3. 启用 **OAuth 2.0** (PKCE) 并设置以下权限:
   - `tweet.read`
   - `tweet.write`
   - `users.read`
   - `offline.access`
4. 配置回调 URL: `http://localhost:3000/api/v1/platforms/twitter/oauth/callback` (开发环境)
5. 获取以下凭据填入 `.env`:

```bash
TWITTER_CLIENT_ID=your_client_id
TWITTER_CLIENT_SECRET=your_client_secret
TWITTER_API_KEY=your_api_key
TWITTER_API_SECRET=your_api_secret
TWITTER_REDIRECT_URI=http://localhost:3000/api/v1/platforms/twitter/oauth/callback
```

**注意**: Twitter API v2 有速率限制，免费层: 每月 1,500 条推文。详见 [Twitter docs](https://developer.twitter.com/en/docs/twitter-api/rate-limits)。

#### Reddit

1. 访问 [Reddit App Preferences](https://www.reddit.com/prefs/apps)
2. 点击 "Create App" 或 "Create Another App"
3. 选择 "script" 类型
4. 填写:
   - **name**: 应用名称 (如 "MultiPlatformPublisher")
   - **description**: 描述
   - **about url**: 可选
   - **redirect uri**: `http://localhost:3000/api/v1/platforms/reddit/oauth/callback`
5. 创建后获取 `client_id` 和 `client_secret`
6. 可选: 设置 `REDDIT_USER_AGENT` (应包含你的 Reddit 用户名，格式: `app-name/version by u/username`)

```bash
REDDIT_CLIENT_ID=your_client_id
REDDIT_CLIENT_SECRET=your_client_secret
REDDIT_USER_AGENT="multi-platform-publisher/1.0.0 by u/your_username"
REDDIT_REDIRECT_URI=http://localhost:3000/api/v1/platforms/reddit/oauth/callback
```

**注意**: Reddit API 速率限制 per OAuth app: 60 请求/分钟。详见 [Reddit API docs](https://www.reddit.com/dev/api/).

#### LinkedIn

1. 访问 [LinkedIn Developer Portal](https://www.linkedin.com/developers/)
2. 创建新应用
3. 在 **Auth** 选项卡中添加重定向 URL:
   - `http://localhost:3000/api/v1/platforms/linkedin/oauth/callback`
4. 勾选权限:
   - `r_liteprofile` (读取基本资料)
   - `r_emailaddress` (读取邮箱)
   - `w_member_social` (创建和修改帖子)
5. 保存后获取 `Client ID` 和 `Client Secret`

```bash
LINKEDIN_CLIENT_ID=your_client_id
LINKEDIN_CLIENT_SECRET=your_client_secret
LINKEDIN_REDIRECT_URI=http://localhost:3000/api/v1/platforms/linkedin/oauth/callback
```

**注意**: LinkedIn API 限制: 免费开发应用每日 100,000 次调用。详见 [LinkedIn docs](https://docs.microsoft.com/en-us/linkedin/).

#### 生产环境注意事项

- **OAuth 回调地址** 必须设为实际部署域名，如: `https://yourdomain.com/api/v1/platforms/twitter/oauth/callback`
- 所有密钥必须为强随机字符串，不要提交到版本控制
- 建议使用环境变量管理工具 (如 Docker secrets, Kubernetes secrets, AWS Parameter Store)
- 定期轮换密钥，遵循各平台安全最佳实践

### 3. 启动开发环境

```bash
# 一键启动所有服务 (PostgreSQL, Redis, 后端, 前端)
npm run docker:up

# 数据库迁移 (自动在容器内执行，或手动):
docker-compose exec backend npx prisma migrate dev

# 生成 Prisma Client
docker-compose exec backend npx prisma generate

# 访问应用
# 前端: http://localhost:5173
# 后端 API: http://localhost:3000
# API 文档 (Swagger): http://localhost:3000/api/docs
```

### 4. 初始化账号

首次使用需注册管理员账号:

1. 访问 http://localhost:5173/auth/register
2. 填写邮箱、密码
3. 注册成功后自动获得管理员权限

## 📦 项目结构

```
multi-platform-publisher/
├── backend/                 # NestJS 后端
│   ├── src/
│   │   ├── auth/           # 认证模块 (OAuth2, JWT)
│   │   ├── workspaces/     # 工作区管理
│   │   ├── users/          # 用户管理
│   │   ├── social-accounts/# 社交账号连接
│   │   ├── content/        # 内容 CRUD
│   │   ├── analytics/      # 分析引擎
│   │   ├── compliance/     # 合规扫描
│   │   ├── ai-adaptation/  # AI 内容适配
│   │   ├── platforms/      # 平台适配器 (Twitter, Reddit, LinkedIn, etc.)
│   │   └── common/         # 公共模块 (decorators, guards, filters)
│   └── prisma/             # 数据库模型
├── frontend/                # React + Vite + Ant Design
│   ├── src/
│   │   ├── features/       # 功能模块
│   │   ├── layouts/        # 页面布局
│   │   ├── components/     # 通用组件
│   │   └── api/            # API 客户端
│   └── index.html
├── shared/                  # 共享代码
│   ├── config/             # 配置管理
│   ├── types/              # TypeScript 类型定义
│   ├── utils/              # 工具函数
│   └── prisma/             # Prisma 客户端实例
├── packages/               # 独立包
│   └── platform-adapters/ # 平台适配器 SDK
├── docs/                   # 文档
│   ├── API_SPECIFICATION.md
│   ├── DEPLOYMENT.md
│   ├── SECURITY_ARCHITECTURE.md
│   ├── INTEGRATION_PLANS.md
│   └── TROUBLESHOOTING.md
├── docker-compose.yml      # 开发环境
├── docker-compose.prod.yml # 生产环境
├── .env.example            # 环境变量模板
├── scripts/                # 运维脚本
└── .github/workflows/      # CI/CD
```

## 🛠️ 技术栈

### 后端
- **框架**: NestJS 10.x (TypeScript)
- **数据库**: PostgreSQL 15 + Prisma ORM
- **缓存**: Redis 7
- **队列**: Bull (基于 Redis Streams)
- **认证**: OAuth2 PKCE + JWT
- **API 文档**: Swagger / OpenAPI 3.0
- **日志**: Winston + 结构化日志

### 前端
- **框架**: React 18.x + Vite 5.x
- **UI**: Ant Design 5.x
- **状态管理**: Zustand
- **路由**: React Router v6
- **HTTP**: Axios + 类型安全
- **图表**: @ant-design/charts

### 基础设施
- **容器**: Docker + Docker Compose
- **CI/CD**: GitHub Actions
- **监控**: Prometheus + Grafana (生产环境)
- **浏览器自动化**: Puppeteer + stealth-plugin

## 📖 完整文档

| 文档 | 描述 |
|------|------|
| [API 规范](docs/API_SPECIFICATION.md) | 完整 API 接口定义 (OpenAPI 3.0) |
| [部署指南](docs/DEPLOYMENT.md) | 生产环境部署、监控、备份 |
| [安全架构](docs/SECURITY_ARCHITECTURE.md) | RBAC、加密、审计、合规 |
| [集成方案](docs/INTEGRATION_PLANS.md) | 各平台 API 实现细节 |
| [故障排查](docs/TROUBLESHOOTING.md) | 常见问题与解决方案 |

## 🧪 测试

```bash
# 运行所有测试
npm run test

# 仅后端测试
npm run test --workspace=backend

# 仅前端测试
npm run test --workspace=frontend

# 代码检查
npm run lint

# 类型检查
npm run type-check
```

## 🔐 安全报告

发现安全问题请邮件至: **security@example.com** (请替换为实际邮箱)

我们遵循 responsible disclosure 原则。

## 📄 许可证

MIT © [maichanks](mailto:hankan1993@gmail.com)

---

**开发中** - 当前版本: 1.0.0-alpha.0 | 预计 v1.0.0 正式发布: 2026-03-30
