# Multi-Platform Publisher - QA Manual Test Collection

**Environment**: Mock mode (MOCK_MODE=true)  
**Base URL**: `http://localhost:3000`  
**Auth**: Use `/api/auth/login` to obtain token, then set `Authorization: Bearer <token>`

---

## 📦 Test Suite

### 1. Authentication

#### 1.1 Login Success
- **Request**: `POST /api/auth/login`
- **Body**:
```json
{
  "email": "demo@example.com",
  "password": "demo123"
}
```
- **Expected**: `200 OK`, returns `{ success: true, data: { token, user } }`
- **Action**: Save `token` to environment variable `authToken`

#### 1.2 Login Failure
- **Request**: `POST /api/auth/login` with wrong credentials
- **Expected**: `401 Unauthorized`

#### 1.3 Get Profile
- **Request**: `GET /api/auth/me`
- **Headers**: `Authorization: Bearer {{authToken}}`
- **Expected**: `200 OK`, returns user info with `defaultWorkspaceId: ws-mock-1`

---

### 2. Workspaces

#### 2.1 List Workspaces
- **Request**: `GET /api/v1/workspaces`
- **Headers**: `Authorization: Bearer {{authToken}}`
- **Expected**: `200 OK`, returns array with 1 workspace (id: ws-mock-1)

#### 2.2 Get Single Workspace
- **Request**: `GET /api/v1/workspaces/ws-mock-1`
- **Expected**: `200 OK`, workspace details

---

### 3. Team Management

#### 3.1 List Members
- **Request**: `GET /api/v1/workspaces/ws-mock-1/members`
- **Expected**: `200 OK`, returns 3 mock members (Alice, Bob, Charlie) with roles creator/admin/editor

#### 3.2 Invite Member
- **Request**: `POST /api/v1/workspaces/ws-mock-1/members`
- **Body**:
```json
{
  "email": "new@example.com",
  "name": "New User",
  "role": "editor"
}
```
- **Expected**: `200 OK`, `{ success: true, message: "Member invited (mock)" }`

#### 3.3 Update Member Role
- **Request**: `PUT /api/v1/workspaces/ws-mock-1/members/u2/role`
- **Body**:
```json
{
  "role": "viewer"
}
```
- **Expected**: `200 OK`, `{ success: true, message: "Member role updated (mock)" }`

#### 3.4 Remove Member
- **Request**: `DELETE /api/v1/workspaces/ws-mock-1/members/u3`
- **Expected**: `200 OK`, `{ success: true, message: "Member removed (mock)" }`

#### 3.5 Activity Log
- **Request**: `GET /api/v1/workspaces/ws-mock-1/activity?limit=10`
- **Expected**: `200 OK`, returns mock activities (member_invited, content_created, etc.)

---

### 4. Content Management

#### 4.1 Create Content
- **Request**: `POST /api/content`
- **Body**:
```json
{
  "title": "Test Post",
  "body": "This is a test content body.",
  "tags": ["test", "mock"],
  "targetPlatforms": ["twitter"],
  "workspaceId": "ws-mock-1"
}
```
- **Expected**: `200 OK`, returns created content with `id`, `status: draft`

#### 4.2 List Content
- **Request**: `GET /api/content?workspaceId=ws-mock-1&page=1&limit=20`
- **Expected**: `200 OK`, returns array of content items

#### 4.3 Update Content
- **Request**: `PATCH /api/content/{{contentId}}`
- **Body**: `{ "title": "Updated Title" }`
- **Expected**: `200 OK`, updated content

#### 4.4 Publish Content
- **Request**: `POST /api/content/{{contentId}}/publish`
- **Body**: `{ "platforms": ["twitter"] }`
- **Expected**: `200 OK`, content status changes to `published` (mock)

#### 4.5 Schedule Content
- **Request**: `POST /api/content/{{contentId}}/schedule`
- **Body**: `{ "scheduledAt": "2026-03-13T12:00:00Z" }`
- **Expected**: `200 OK`, content status `scheduled`

#### 4.6 Delete Content
- **Request**: `DELETE /api/content/{{contentId}}?workspaceId=ws-mock-1`
- **Expected**: `204 No Content` or `200 OK` with success message

---

### 5. Analytics

#### 5.1 Get Daily Metrics
- **Request**: `GET /api/analytics/daily?workspaceId=ws-mock-1&start=2026-03-01&end=2026-03-11`
- **Expected**: `200 OK`, returns 30 days of mock data with impressions/engagement

#### 5.2 Get Summary
- **Request**: `GET /api/analytics/summary?workspaceId=ws-mock-1`
- **Expected**: `200 OK`, total posts, avg engagement, etc.

#### 5.3 Export CSV
- **Request**: `GET /api/analytics/export/csv?workspaceId=ws-mock-1&start=2026-03-01&end=2026-03-11`
- **Expected**: `200 OK`, `Content-Type: text/csv`, returns CSV data

---

### 6. Tenant Isolation (Security)

#### 6.1 Cross-Tenant Access Denied
- **Setup**: Create two workspaces (different tenants) - in mock mode, test that request to workspace not belonging to user returns 403 or 404
- **Expected**: Access denied

---

### 7. Rate Limiting

#### 7.1 Exceed Global Limit
- **Action**: Send >100 requests within 1 minute (use script)
- **Expected**: `429 Too Many Requests` after limit exceeded

#### 7.2 Exceed Auth Limit
- **Action**: Attempt >5 failed logins within 1 minute
- **Expected**: `429` after 5 attempts

---

## 📝 Pass Criteria

- [ ] All endpoints return expected status codes
- [ ] Data consistent across CRUD operations
- [ ] Rate limiting triggers correctly
- [ ] Tenant isolation prevents cross-access
- [ ] No console errors in Mock API server logs

---

**Estimated Time**: 30-45 minutes
