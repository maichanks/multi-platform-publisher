# QA Final Checklist - Multi-Platform Publisher

**Target**: v1.0.0 release  
**Date**: 2026-03-11  
**Score Goal**: ≥85/100

---

## 🧩 Functional Testing

### Authentication & Authorization
- [ ] Login with valid credentials returns token
- [ ] Login with invalid credentials returns 401
- [ ] Protected endpoints require Authorization header
- [ ] Token expiration enforced
- [ ] Logout clears token (client-side)

### Workspaces
- [ ] Create workspace (tenant-scoped)
- [ ] List workspaces returns only user's workspaces
- [ ] Get single workspace by ID
- [ ] Update workspace (admin/creator only)
- [ ] Delete workspace (creator only, soft delete)

### Members & Roles
- [ ] Invite member sends email (or mock success)
- [ ] List members shows all workspace members
- [ ] Change member role (admin/creator only)
- [ ] Remove member (admin/creator only)
- [ ] Cannot remove workspace owner
- [ ] Activity log records member events

### Content
- [ ] Create content (draft status)
- [ ] Update content (author or editor/admin)
- [ ] Delete content (admin/creator, not if published)
- [ ] List content with pagination
- [ ] Get content by ID
- [ ] Schedule content (future date)
- [ ] Activity log records content events

### Analytics
- [ ] Get daily metrics for date range
- [ ] Get summary (total posts, avg engagement)
- [ ] Get engagement rates (per day)
- [ ] Get platform comparison
- [ ] Get trend analysis (MA7/MA30)
- [ ] Export CSV returns valid CSV
- [ ] All analytics scoped to tenant

### Activity Log
- [ ] List activity for workspace (with limit)
- [ ] Results ordered by date descending
- [ ] Tenant scoping enforced

---

## 🔐 Security Testing

- [ ] Tenant A cannot access Tenant B data (SQL injection test)
- [ ] Unauthorized role change blocked
- [ ] Inactive token rejected
- [ ] Rate limiting enabled on auth endpoints
- [ ] Input validation on all DTOs (test invalid types)
- [ ] No stack traces exposed in errors
- [ ] CORS headers appropriate (if applicable)

---

## 🧪 E2E Scenarios (Playwright)

1. **New user onboarding**
   - Login → Create workspace → Invite teammate → Create content → Publish

2. **Team collaboration**
   - Admin invites member → Member accepts → Role change → Remove member

3. **Analytics review**
   - Create content → Track events → View dashboard → Export CSV

4. **Compliance scan** (if applicable)
   - Upload content → Run scan → Override violations

---

## 🐛 Bug Triage

| Severity | Criteria | Count | Fixed |
|----------|----------|-------|-------|
| Critical | Data loss, security breach, crash | 0 | 0 |
| High     | Major feature broken, tenant leak | 0 | 0 |
| Medium   | Feature partially broken | 0 | 0 |
| Low      | Cosmetic, minor UX issue | 0 | 0 |

---

## 📈 Performance Benchmarks

- [ ] API response time < 200ms for simple queries (workspace list, member list)
- [ ] API response time < 500ms for analytics aggregation (30 days)
- [ ] Concurrent publish handling (test with 5 simultaneous requests)
- [ ] Memory usage stable under load (<80% of allocated)

---

## 🐳 Deployment Validation

- [ ] Docker images build without errors
- [ ] `docker-compose.prod.yml` starts all services
- [ ] Health checks pass (`/api/health`)
- [ ] Logs written to files and stdout
- [ ] Environment variables documented in README

---

## 📚 Documentation

- [ ] `README.md` has quick start (5 min)
- [ ] All API endpoints documented (API.md)
- [ ] Deployment guide (production.md)
- [ ] Troubleshooting guide
- [ ] CHANGELOG.md updated

---

## ✅ Sign-off

**QA Lead**: _______________  
**Date**: _______________  
**Score**: ___ / 100

**Notes**:
