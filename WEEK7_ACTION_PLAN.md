# Week 7 Action Plan - Finalization

**Status**: In Progress (2026-03-11 15:45 GMT+8)  
**Path**: No real credentials - focus on testing, hardening, release prep

---

## 🎯 Current Sprint Goals

1. **E2E Testing** - Playwright setup + critical path tests
2. **Security Hardening** - RBAC verification, input validation, tenant isolation
3. **Performance** - Redis caching, rate limiting
4. **QA Final Pass** - Comprehensive checklist, bug fixing
5. **Release Prep** - Docs, CHANGELOG, Docker build verification

---

## ✅ Done So Far

- [x] Created Playwright config (`frontend/playwright.config.ts`)
- [x] Wrote login flow tests (`tests/login.spec.ts`)
- [x] Wrote team management tests (`tests/team.spec.ts`)
- [x] Ensured mock API server works (Python version)
- [x] Updated Week 6 status docs

---

## 📋 Next Steps (Immediate)

### 1. Install Playwright Dependencies (if possible)
```bash
cd frontend
npm install --save-dev @playwright/test
npx playwright install chromium
```
If npm fails, skip and rely on manual testing checklist.

### 2. Write More E2E Tests
- Analytics dashboard rendering
- Content creation flow
- Activity log filtering
- Role-based access control (different permissions)

### 3. Security Hardening Tasks
- Verify all API endpoints check tenant context
- Add rate limiting to public/auth endpoints
- Ensure no SQL injection (Prisma should handle)
- Validate user input with class-validator coverage
- Audit log review for sensitive actions

### 4. Performance Tasks
- Add Redis cache for workspace and user lookups
- Cache analytics queries (with TTL)
- Optimize database queries (indexes already in schema)

### 5. QA Checklist
- [ ] All CRUD operations work
- [ ] RBAC blocks unauthorized actions
- [ ] Tenant data isolation verified
- [ ] Analytics calculations correct
- [ ] ActivityLog entries created for key actions
- [ ] Error handling graceful

### 6. Release Preparation
- Update `README.md` with full setup (env vars, Docker, manual testing)
- Write `CHANGELOG.md`
- Prepare GitHub release notes (v1.0.0)
- Test `docker-compose.prod.yml` build (if time)
- Create `INSTALL.md` quick start

---

## 📦 Deferred (Until Credentials Provided)

- Twitter real API integration
- Reddit real API integration
- LinkedIn real API integration
- 小红书 MCP full integration (requires QR login)
- Douyin integration (planned but not started)

---

## 🔍 Manual Testing Checklist (if Playwright fails)

- [ ] Login sets token and redirects to dashboard
- [ ] Team page loads with 3 mock members
- [ ] Invite member shows success toast
- [ ] Change role updates UI
- [ ] Remove member shows confirmation
- [ ] Activity log shows mock entries
- [ ] Analytics daily metrics display chart
- [ ] Navigation between pages works
- [ ] Logout clears localStorage and redirects

---

**Target completion**: 7 days (2026-03-18)
