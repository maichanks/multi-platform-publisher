# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-03-12 (Release Candidate)

### 🎉 Added
- **Multi-Platform Publishing**：支持 Twitter、Reddit、LinkedIn、小红书（MCP）
- **Team Collaboration**：工作区管理、成员邀请、角色控制（creator/admin/editor/viewer）
- **Content Lifecycle**：草稿、定时发布、批量操作、发布队列
- **Analytics Dashboard**：参与率、趋势分析、平台对比、CSV 导出
- **Compliance Scanning**：内容审核、风险标记、人工覆盖流程
- **AI Adaptation**：可选 AI 自动适配不同平台格式（预览模式）
- **Multi-Tenancy**：完整租户隔离，RBAC 权限系统
- **Activity Logging**：所有关键操作审计日志
- **Rate Limiting**：全局及端点级速率限制
- **Redis Caching**：频繁查询缓存支持（可选）
- **Docker Deployment**：生产环境 Docker Compose 配置
- **Mock Mode**：开发与测试无需真实数据库/API

### 🏗️ Architecture
- NestJS 后端（模块化、分层架构）
- React + Ant Design 前端（Vite 构建）
- PostgreSQL + Prisma ORM
- Bull 队列（发布、适配、合规扫描）
- Redis 缓存（可选）

### 🔐 Security
- JWT 认证 + 刷新令牌
- TenantGuard 确保租户隔离
- 权限装饰器细粒度控制
- 输入验证（class-validator）
- 错误处理与日志记录

### 🧪 Testing
- **单元测试**：Services 与 Utils
- **集成测试**：控制器与适配器
- **E2E 测试框架**：Playwright（测试用例就绪）
- **QA 检查清单**：功能、安全、性能

### 📦 DevOps
- **CI/CD**：GitHub Actions（构建、测试、发布）
- **健康检查**：`/api/health` 端点
- **监控**：OpenClaw Gateway 心跳集成
- **日志**：Winston 结构化日志

### 📚 Documentation
- README（快速开始）
- API 文档（OpenAPI/Swagger）
- 部署指南、安全手册、故障排除
- 测试指南与代码注释

### 🐛 Fixed
- 租户隔离漏洞（所有控制器已加固）
- 输入验证覆盖（所有 DTO 完成）
- 速率限制配置（全局/认证/管理）

---

## [0.1.0] - 2026-03-09 (Alpha)

### Added
- 初始 MVP：基础发布功能
- 支持 Twitter、Reddit、LinkedIn（Mock）
- 简单前端 UI（Vue 2）
- 本地数据库（SQLite）

---

**Note**: Full commit history available in GitHub repository.
