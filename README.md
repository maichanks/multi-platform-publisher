# Multi-Platform Publisher

统一的多平台内容发布与团队协作平台，支持 Twitter、Reddit、LinkedIn、小红书等社交平台。

---

## 🚀 快速开始（5 分钟）

### 前置要求

- Node.js 18+
- PostgreSQL 14+（Mock 模式无需）
- Redis 7+（可选，用于缓存）
- Docker & Docker Compose（生产部署）

### 安装步骤

1. **克隆仓库**
```bash
git clone https://github.com/maichanks/multi-platform-publisher.git
cd multi-platform-publisher
```

2. **安装依赖**
```bash
cd backend
pnpm install
cd ../frontend
pnpm install
```

3. **配置环境变量**
```bash
cd backend
cp .env.example .env
# 编辑 .env，填写以下必要项：
# - JWT_SECRET（随机字符串）
# - DATABASE_URL（生产环境需要）
```

4. **启动 Mock 模式（开发测试）**
```bash
# 终端 1: 启动 Mock API
cd backend
node mock-server.js

# 终端 2: 启动前端
cd frontend
pnpm run dev

# 访问 http://localhost:5173
```

5. **生产部署（Docker）**
```bash
docker-compose -f docker-compose.prod.yml up -d
```

---

## 📚 功能特性

- **多平台发布**：一键发布到 Twitter、Reddit、LinkedIn、小红书
- **团队协作**：成员邀请、角色管理（creator/admin/editor/viewer）
- **内容管理**：草稿、定时、批量发布
- **数据分析**：参与率、趋势、平台对比、CSV 导出
- **合规扫描**：内容审核、风险标记、人工覆盖
- **AI 适配**：自动调整内容格式适应不同平台（可选）

---

## 🛡️ 权限说明

| 角色 | 权限 |
|------|------|
| **Creator** | 所有权限，包括删除工作区 |
| **Admin** | 管理成员、发布内容、查看分析 |
| **Editor** | 创建/编辑内容，发布到指定平台 |
| **Viewer** | 仅查看内容与分析数据 |

---

## ⚙️ 配置说明

### 平台 API 密钥（生产环境）

| 平台 | 环境变量 | 说明 |
|------|----------|------|
| Twitter | `TWITTER_CLIENT_ID` `TWITTER_CLIENT_SECRET` `TWITTER_API_KEY` `TWITTER_API_SECRET` | OAuth 2.0 + API v2 |
| Reddit | `REDDIT_CLIENT_ID` `REDDIT_CLIENT_SECRET` `REDDIT_USER_AGENT` | Script 模式 |
| LinkedIn | `LINKEDIN_CLIENT_ID` `LINKEDIN_CLIENT_SECRET` | OAuth 2.0 |
| 小红书 | 使用扫码登录（MCP） | 无需 API Key |

### 速率限制

- 全局：100 请求/分钟
- 登录/注册：5 请求/分钟
- 管理 API：30 请求/分钟

---

## 🧪 测试

```bash
# 运行单元测试
cd backend
pnpm test

# 运行 E2E 测试（需安装 Playwright）
cd frontend
pnpm exec playwright test
```

完整测试指南见 [docs/TESTING.md](docs/TESTING.md)。

---

## 📖 文档

- [部署指南](docs/DEPLOYMENT.md)
- [API 参考](docs/API.md)
- [安全加固](docs/SECURITY.md)
- [故障排除](docs/TROUBLESHOOTING.md)

---

## 🤝 贡献

欢迎提交 Issue 和 Pull Request。请阅读 [CONTRIBUTING.md](CONTRIBUTING.md)。

---

## 📄 许可证

MIT License © 2026 maichanks
