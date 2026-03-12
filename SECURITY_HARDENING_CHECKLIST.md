# Security Hardening Checklist - Multi-Platform Publisher

**Date**: 2026-03-11  
**Status**: In Progress (Week 7)

---

## 🔒 RBAC & Tenant Isolation

### Permissions Verification
- [ ] `@PermissionChecker` applied to all protected endpoints
- [ ] Workspace-level permissions: `WORKSPACE_CREATE`, `WORKSPACE_UPDATE`, `WORKSPACE_DELETE`, `MEMBER_INVITE`, `MEMBER_REMOVE`, `member:update_role`
- [ ] Content permissions: `CONTENT_READ`, `CONTENT_CREATE`, `CONTENT_UPDATE`, `CONTENT_DELETE`, `CONTENT_PUBLISH`
- [ ] Analytics permissions: `ANALYTICS_READ`, `ANALYTICS_EXPORT`
- [ ] Compliance permissions: `COMPLIANCE_READ`, `COMPLIANCE_OVERRIDE`

### Tenant Scoping
- [ ] All DB queries in WorkspacesService include `tenantId`
- [ ] ContentService queries filter by `workspace.tenantId`
- [ ] AnalyticsService queries filter by `workspace.tenantId`
- [ ] ActivityLog entries include `tenantId`
- [ ] TenantMiddleware sets `req.tenant` for every request
- [ ] TenantGuard blocks cross-tenant access

### Test Cases
- [ ] User from Tenant A cannot access Tenant B's workspaces
- [ ] Member role changes only by creator/admin
- [ ] Cannot remove workspace owner
- [ ] Admin cannot promote others to admin (only creator)

---

## 🛡️ Input Validation & Sanitization

- [ ] All DTOs use `class-validator` decorators (`IsString`, `IsEmail`, `IsEnum`, etc.)
- [ ] Request bodies validated before processing
- [ ] Query parameters validated (e.g., `ParseIntPipe`, custom validation)
- [ ] No raw SQL queries (Prisma ORM only)
- [ ] Output encoding for user-generated content (XSS prevention)
- [ ] File upload validation (content type, size) - if any

---

## 🔐 Authentication & Session

- [ ] JWT secret strong and stored in `.env` (not hardcoded)
- [ ] Token expiration set (7 days or configurable)
- [ ] Refresh token mechanism (optional for MVP)
- [ ] Password hashing with bcrypt (already in User model)
- [ ] Failed login attempts rate-limited
- [ ] Token revocation on logout (optional)

---

## 📝 Auditing & Logging

- [ ] `ActivityLog` records all sensitive actions:
  - [ ] Member invite/remove
  - [ ] Role changes
  - [ ] Content created/updated/deleted/published
  - [ ] Social account connect/disconnect
  - [ ] AI adaptation runs
  - [ ] Compliance scan and override
  - [ ] Data export/deletion requests
- [ ] `AuditLog` captures before/after states for updates
- [ ] IP address and user-agent captured
- [ ] Structured logging with request ID (if implemented)

---

## 🚀 Performance & DoS Protection

- [ ] Rate limiting configured (`@nestjs/throttler`)
  - [ ] Global rate limit (e.g., 100 req/min)
  - [ ] Auth endpoints stricter
- [ ] Redis used for caching frequent queries (workspace, user profiles)
- [ ] Database indexes present (already in schema)
- [ ] Connection pooling configured (PostgreSQL)
- [ ] Graceful degradation under load

---

## 📦 Dependency & Configuration

- [ ] No `console.log` in production (use LoggerService)
- [ ] Environment variables validated (`@nestjs/config` validation)
- [ ] Default values safe for production
- [ ] No debug endpoints left enabled
- [ ] CORS configured properly (if public API)
- [ ] Helmet middleware enabled (security headers)

---

## 🧪 Testing Coverage

- [ ] Unit tests for services (≥80%)
- [ ] Integration tests for controllers
- [ ] E2E tests covering critical user journeys
- [ ] RBAC tests for all roles
- [ ] Tenant isolation tests

---

## 🐳 Docker & Deployment

- [ ] Dockerfile uses non-root user (if possible)
- [ ] Secrets passed via environment (not build args)
- [ ] Network policies between containers
- [ ] No sensitive data in logs
- [ ] Health checks implemented (`/api/health`)
- [ ] Readiness/liveness probes in docker-compose
- [ ] Resource limits (CPU/memory) set

---

## 📋 Pre-Release Validation

Run this checklist before v1.0.0 release.

**Sign-off**: ___________  
**Date**: ___________  
