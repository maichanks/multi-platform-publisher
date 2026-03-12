# API Testing Examples - After Database Migration

**Base URL:** `http://localhost:3000/api/v1`
**Authentication:** Bearer token required for all endpoints (obtain via login endpoint)

---

## 📊 Analytics Endpoints

### 1. Get Engagement Rates

Calculate engagement rates (likes+comments+shares+clicks / views) for a date range

```bash
# Get engagement rates for a workspace (last 30 days)
curl -X GET "http://localhost:3000/api/v1/analytics/engagement-rates?workspaceId=ws_abc123&startDate=2025-01-01&endDate=2025-01-31" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# With specific platform filter
curl -X GET "http://localhost:3000/api/v1/analytics/engagement-rates?workspaceId=ws_abc123&startDate=2025-01-01&endDate=2025-01-31&platform=twitter" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# With tenant verification (optional for security)
curl -X GET "http://localhost:3000/api/v1/analytics/engagement-rates?workspaceId=ws_abc123&startDate=2025-01-01&endDate=2025-01-31&tenantId=tenant_xyz" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Response:**
```json
{
  "summary": {
    "period": { "startDate": "2025-01-01T00:00:00.000Z", "endDate": "2025-01-31T23:59:59.999Z" },
    "totalViews": 150000,
    "totalEngagement": 12345,
    "averageEngagementRate": 8.23,
    "dataPoints": 31
  },
  "dailyRates": [
    {
      "date": "2025-01-31T00:00:00.000Z",
      "platform": "twitter",
      "postsCount": 5,
      "metrics": {
        "views": 5000,
        "likes": 150,
        "comments": 25,
        "shares": 40,
        "clicks": 120,
        "totalEngagement": 335
      },
      "engagementRate": 6.70
    }
  ]
}
```

---

### 2. Get Platform Comparison

Compare performance metrics across all platforms

```bash
# Compare platforms over last 30 days
curl -X GET "http://localhost:3000/api/v1/analytics/platform-comparison?workspaceId=ws_abc123&periodDays=30" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Include tenant verification
curl -X GET "http://localhost:3000/api/v1/analytics/platform-comparison?workspaceId=ws_abc123&periodDays=30&tenantId=tenant_xyz" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Response:**
```json
{
  "period": { "days": 30 },
  "platforms": [
    {
      "platform": "twitter",
      "metrics": {
        "totalPosts": 150,
        "totalViews": 75000,
        "avgViewsPerPost": 500,
        "avgEngagementPerPost": 41.5,
        "engagementRate": 8.30,
        "breakdown": {
          "likes": 4500,
          "comments": 750,
          "shares": 1200,
          "clicks": 3000,
          "totalEngagement": 9450
        }
      },
      "periodDays": 30
    },
    {
      "platform": "linkedin",
      "metrics": { ... }
    }
  ],
  "summary": {
    "totalPlatforms": 4,
    "topPlatform": "twitter",
    "topEngagementRate": 8.30
  }
}
```

---

### 3. Get Trend Analysis

Advanced trend analysis with linear regression, moving averages, and anomaly detection

```bash
# Get trend analysis for engagement over a date range
curl -X GET "http://localhost:3000/api/v1/analytics/trend-analysis?workspaceId=ws_abc123&startDate=2025-01-01&endDate=2025-01-31&metric=engagement" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# For views trend
curl -X GET "http://localhost:3000/api/v1/analytics/trend-analysis?workspaceId=ws_abc123&startDate=2025-01-01&endDate=2025-01-31&metric=views" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# For a specific platform
curl -X GET "http://localhost:3000/api/v1/analytics/trend-analysis?workspaceId=ws_abc123&startDate=2025-01-01&endDate=2025-01-31&metric=engagement&platform=twitter" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Response:**
```json
{
  "trend": "increasing",
  "confidence": 87,
  "slope": 12.5,
  "percentChange": 5.2,
  "statistics": {
    "average": 150,
    "standardDeviation": 25.3,
    "coefficientOfVariation": 16.9,
    "max": 200,
    "min": 100
  },
  "data": [
    {
      "date": "2025-01-01",
      "value": 120,
      "ma7": null,
      "ma30": null
    },
    {
      "date": "2025-01-07",
      "value": 135,
      "ma7": 127.5,
      "ma30": null
    }
  ],
  "analysis": {
    "recentTrend": "accelerating",
    "volatility": "moderate",
    "dataPoints": 31,
    "period": { "startDate": "2025-01-01T00:00:00.000Z", "endDate": "2025-01-31T23:59:59.999Z" },
    "metric": "engagement",
    "platform": "twitter"
  },
  "anomalies": [
    {
      "date": "2025-01-15",
      "value": 250,
      "type": "above",
      "deviation": 67
    }
  ]
}
```

---

### 4. Export Analytics as CSV

Export tenant-scoped analytics data as CSV file

```bash
# Export CSV (note: use -o to save file)
curl -X GET "http://localhost:3000/api/v1/analytics/export-csv?workspaceId=ws_abc123&startDate=2025-01-01&endDate=2025-01-31" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  --output analytics-export-2025-01-31.csv

# With custom filename
curl -X GET "http://localhost:3000/api/v1/analytics/export-csv?workspaceId=ws_abc123&startDate=2025-01-01&endDate=2025-01-31&filename=my-analytics.csv" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  --output my-analytics.csv

# With tenant verification
curl -X GET "http://localhost:3000/api/v1/analytics/export-csv?workspaceId=ws_abc123&startDate=2025-01-01&endDate=2025-01-31&tenantId=tenant_xyz" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  --output export.csv
```

**CSV Format:**
```csv
Date,Platform,Posts,Impressions,Views,Likes,Comments,Shares,Clicks,Total Engagement,Engagement Rate (%)
2025-01-31,twitter,5,0,5000,150,25,40,120,335,6.70
2025-01-31,linkedin,3,0,3000,100,15,20,80,215,7.17
```

---

## 📝 Content Endpoints (with Tenant Filtering)

All content endpoints now support optional `tenantId` parameter for additional security verification.

```bash
# Create content with tenant verification
curl -X POST "http://localhost:3000/api/v1/content?workspaceId=ws_abc123&tenantId=tenant_xyz" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "My New Post",
    "body": "Content body here...",
    "targetPlatforms": ["twitter", "linkedin"],
    "tags": ["marketing", "social"]
  }'

# Update content with tenant verification
curl -X PATCH "http://localhost:3000/api/v1/content/content_id_123?workspaceId=ws_abc123&tenantId=tenant_xyz" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Updated Title"
  }'

# Publish content
curl -X POST "http://localhost:3000/api/v1/content/content_id_123/publish?workspaceId=ws_abc123&tenantId=tenant_xyz" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "platforms": ["twitter", "linkedin"]
  }'

# Get content stats
curl -X GET "http://localhost:3000/api/v1/content/stats?workspaceId=ws_abc123&tenantId=tenant_xyz" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Activity Logging:** All content operations now generate activity logs:
- `content_created`
- `content_updated`
- `content_deleted`
- `content_published`
- `content_cancelled`

---

## 🏢 Workspace Endpoints (with Activity Logging)

```bash
# Create workspace
curl -X POST "http://localhost:3000/api/v1/workspaces" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Marketing Team",
    "description": "Marketing workspace",
    "tenantId": "tenant_xyz"
  }'

# Update workspace
curl -X PATCH "http://localhost:3000/api/v1/workspaces/ws_abc123?tenantId=tenant_xyz" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Updated Name"
  }'

# Delete workspace
curl -X DELETE "http://localhost:3000/api/v1/workspaces/ws_abc123?tenantId=tenant_xyz" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Invite member
curl -X POST "http://localhost:3000/api/v1/workspaces/ws_abc123/invite?tenantId=tenant_xyz" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "newmember@example.com",
    "role": "editor"
  }'

# Remove member
curl -X DELETE "http://localhost:3000/api/v1/workspaces/ws_abc123/members/user_xyz?tenantId=tenant_xyz" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Activity Logging:** All workspace operations:
- `workspace_created`
- `workspace_updated`
- `workspace_deleted`
- `member_invited`
- `member_removed`

---

## 🔗 Social Account Endpoints (with Activity Logging)

```bash
# Connect social account
curl -X POST "http://localhost:3000/api/v1/social-accounts/connect?workspaceId=ws_abc123&platform=twitter&tenantId=tenant_xyz" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "accessToken": "token_here",
    "refreshToken": "refresh_here",
    "platformAccountId": "12345",
    "platformUsername": "@mytwitter"
  }'

# Disconnect social account
curl -X DELETE "http://localhost:3000/api/v1/social-accounts/account_xyz/disconnect?workspaceId=ws_abc123&tenantId=tenant_xyz" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Refresh token (optional userId for logging)
curl -X POST "http://localhost:3000/api/v1/social-accounts/account_xyz/refresh?tenantId=tenant_xyz" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Activity Logging:**
- `social_account_connected`
- `social_account_disconnected`
- `social_account_token_refreshed`

---

## 🔍 View Activity Logs

```bash
# Get activity logs for a workspace
curl -X GET "http://localhost:3000/api/v1/activity-logs/workspace/ws_abc123?limit=50&offset=0" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Get activity logs for a tenant (admin only)
curl -X GET "http://localhost:3000/api/v1/activity-logs/tenant/tenant_xyz?limit=100&offset=0" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Filter by action type
curl -X GET "http://localhost:3000/api/v1/activity-logs/workspace/ws_abc123?action=content_created&limit=50" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

---

## 📈 Example Testing Workflow

1. **Login and get token:**
```bash
TOKEN=$(curl -X POST "http://localhost:3000/api/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"password"}' \
  | jq -r '.accessToken')
```

2. **Create a workspace:**
```bash
WS_ID=$(curl -X POST "http://localhost:3000/api/v1/workspaces?tenantId=tenant_xyz" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Workspace"}' \
  | jq -r '.id')
```

3. **Create some content:**
```bash
CONTENT_ID=$(curl -X POST "http://localhost:3000/api/v1/content?workspaceId=$WS_ID&tenantId=tenant_xyz" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"Test Post","body":"Test content","targetPlatforms":["twitter"]}' \
  | jq -r '.id')
```

4. **Publish content:**
```bash
curl -X POST "http://localhost:3000/api/v1/content/$CONTENT_ID/publish?workspaceId=$WS_ID&tenantId=tenant_xyz" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"platforms":["twitter"]}'
```

5. **Check analytics:**
```bash
curl -X GET "http://localhost:3000/api/v1/analytics/engagement-rates?workspaceId=$WS_ID&startDate=$(date -d '30 days ago' +%Y-%m-%d)&endDate=$(date +%Y-%m-%d)&tenantId=tenant_xyz" \
  -H "Authorization: Bearer $TOKEN" | jq .
```

6. **Export CSV:**
```bash
curl -X GET "http://localhost:3000/api/v1/analytics/export-csv?workspaceId=$WS_ID&startDate=$(date -d '30 days ago' +%Y-%m-%d)&endDate=$(date +%Y-%m-%d)&tenantId=tenant_xyz" \
  -H "Authorization: Bearer $TOKEN" \
  --output analytics.csv
```

7. **View activity logs:**
```bash
curl -X GET "http://localhost:3000/api/v1/activity-logs/workspace/$WS_ID?limit=20" \
  -H "Authorization: Bearer $TOKEN" | jq .
```

---

## 🔐 Security Notes

- All endpoints support optional `tenantId` parameter for additional tenant verification
- When `tenantId` is provided, the system verifies the workspace belongs to that tenant
- Activity logs capture: `tenantId`, `workspaceId`, `userId`, action type, resource ID, metadata, IP, user agent
- All write operations log activities automatically
- Tenant isolation is enforced at database query level

---

## 🚀 Ready for Migration

All services now include:
✅ Extended AnalyticsService with engagement rates, platform comparison, trend analysis, CSV export
✅ Activity logging in Content, Workspaces, SocialAccounts services
✅ Tenant filtering throughout ContentService
✅ Consistent activity log method using ActivityAction enums
✅ Example curl commands for comprehensive testing

**Next Steps:** Deploy database, run migrations, update app.module.ts to include new ActivityLogModule globally if needed, and start testing!
