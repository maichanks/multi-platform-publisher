# Release Checklist - v1.0.0 RC

**Target**: Mark as Release Candidate ready for production testing  
**Date**: 2026-03-12  
**Project**: Multi-Platform Publisher

---

## ✅ Code Completion

- [x] All features implemented (multi-tenancy, RBAC, content, analytics)
- [x] TypeScript compilation errors fixed
- [x] Input validation coverage 100%
- [x] TenantGuard enforced on all non-auth controllers
- [x] Rate limiting configured (global + auth + admin)
- [x] Redis cache service ready (optional)

---

## ✅ Documentation

- [x] README.md (quick start, features, config)
- [x] CHANGELOG.md (v0.1.0 → v1.0.0)
- [x] API.md (OpenAPI spec - generate with `nest docs` if available)
- [x] DEPLOYMENT.md (Docker & manual)
- [x] SECURITY.md (hardening, audit, compliance)
- [x] TROUBLESHOOTING.md (common issues)
- [x] QA test collection (Postman collection + manual checklist)
- [x] Test automation script (`backend/qa-runner.js`)

---

## ✅ Security & Compliance

- [x] RBAC implemented (6 permission levels)
- [x] Tenant isolation verified (TenantGuard on 7 controllers)
- [x] Input validation (class-validator on all DTOs)
- [x] Rate limiting (ThrottlerGuard global)
- [x] Audit logging (ActivityLog + AuditLog)
- [x] No hardcoded secrets (all in .env)
- [x] JWT expiration set (7 days)

---

## ✅ Testing

- [x] Unit tests for services (≥80%)
- [x] Integration tests for controllers
- [x] E2E test scaffolding (Playwright config + specs)
- [x] Manual QA test suite (Postman collection)
- [x] QA runner script for Mock mode

---

## ✅ DevOps & Deployment

- [x] Docker Compose (dev & prod)
- [x] Health check endpoint (`/api/health`)
- [x] Structured logging (Winston)
- [x] Environment variable validation (ConfigModule)
- [x] Mock mode for development (MOCK_MODE=true)
- [x] Database migrations (Prisma - ready for prod)

---

## 🚧 Known Limitations (RC)

- **No real platform credentials**：集成需要 Twitter/Reddit/LinkedIn API Key 及小红书扫码登录后才能测试真实发布
- **npm 安装问题**：前端依赖安装受 workspaces 约束影响，建议使用 pnpm
- **磁盘空间**：生产环境需监控磁盘使用并定期清理日志
- **Docker 网络**：国内环境需配置镜像源加速拉取

---

## 📦 Release Artifacts

- [ ] GitHub tag `v1.0.0-rc.1` created
- [ ] Release notes drafted (summarize features, known issues)
- [ ] Docker images built and pushed to `maichanks/multi-platform-publisher:1.0.0-rc.1`
- [ ] Pre-flight checklist for users (env vars, DB init)

---

## 🧪 Final Validation (Pre-Release)

Run these before tagging:

1. **Mock Mode QA**:
   ```bash
   cd backend && node mock-server.js &
   cd frontend && pnpm run dev
   # Open http://localhost:5173, login with dev-token
   # Verify: team page, content CRUD, analytics dashboard
   ```

2. **API Test Suite**:
   ```bash
   cd backend && node qa-runner.js
   ```

3. **Security Sanity**:
   - Attempt cross-tenant access (should 403/404)
   - Test rate limits (send 200 requests)
   - Verify audit logs written

4. **Build Verification**:
   ```bash
   # Backend
   cd backend && pnpm run build
   # Frontend
   cd frontend && pnpm run build
   # Docker
   docker-compose -f docker-compose.prod.yml build
   ```

5. **Documentation completeness**:
   - `README.md` covers quick start
   - All environment variables documented in `DEPLOYMENT.md`
   - API examples in `API.md`
   - Troubleshooting covers common errors

---

## 🎯 After Release

- Collect feedback from initial users
- Prioritize credential-free testing for v1.0.0 (test with sandbox credentials)
- Plan next sprint: real platform integrations + Douyin + improvements

---

**Sign-off**: _______________  
**Date**: _______________
