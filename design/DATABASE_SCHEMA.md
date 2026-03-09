# 数据库架构设计 (Prisma Schema)

**文档签名**: maichanks <hankan1993@gmail.com>

## 设计原则

1. **多租户架构**: 所有用户数据通过`workspace_id`隔离
2. **软删除**: 关键表使用`deletedAt`而非物理删除
3. **时区统一**: 所有时间戳存储为UTC，应用层转换
4. **索引优化**: 高频查询字段建立复合索引
5. **JSONB半结构化存储**: AI适配结果、平台特定元数据使用JSONB
6. **审计追踪**: 关键操作记录到AuditLog（不可变）
7. **数据完整性**: 外键约束、检查约束、非空约束

## Prisma Schema 完整定义

```prisma
// prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
  previewFeatures = ["postgresqlExtensions"]
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
  extensions = [pgcrypto]  // 用于加密、UUID生成
}

// ==================== 用户与认证 ====================

model User {
  id                String           @id @default(cuid())
  email             String           @unique
  emailVerified     DateTime?
  name              String?
  avatarUrl         String?
  passwordHash      String?          // 仅本地账号需要
  oauthProvider     String?          // google, github, wechat
  oauthProviderId   String?          @unique
  createdAt         DateTime         @default(now())
  updatedAt         DateTime         @updatedAt
  deletedAt         DateTime?

  // 关系
  workspaceMembers  WorkspaceMember[]
  ownedWorkspaces   Workspace[]      @relation("WorkspaceOwner")
  createdContents   Content[]
  aiAdaptationLogs  AIAdaptationLog[]
  auditLogs         AuditLog[]
  apiKeys           ApiKey[]

  @@index([email])
  @@index([deletedAt])
}

model ApiKey {
  id               String   @id @default(cuid())
  userId           String
  name             String   // "生产环境集成"、"CI/CD流水线"
  keyPrefix        String   // "pk_live_xxx" 前缀，用于识别
  keyHash          String   @unique  // SHA256哈希存储，不存明文
  lastUsedAt       DateTime?
  lastUsedIp       String?
  expiresAt        DateTime?
  createdAt        DateTime @default(now())
  revoked          Boolean  @default(false)

  user             User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([keyHash])
}

// ==================== 多租户工作区 ====================

model Workspace {
  id               String           @id @default(cuid())
  name             String
  slug             String           @unique  // URL友好标识
  description      String?
  avatarUrl        String?
  ownerId          String
  createdAt        DateTime         @default(now())
  updatedAt        DateTime         @updatedAt
  deletedAt        DateTime?

  // 关系
  owner            User             @relation("WorkspaceOwner", fields: [ownerId], references: [id])
  members          WorkspaceMember[]
  socialAccounts   SocialAccount[]
  contents         Content[]
  tags             Tag[]
  webhooks         Webhook[]
  analyticsDaily   AnalyticsDaily[]
  complianceLogs   ComplianceLog[]

  @@index([ownerId])
  @@index([slug])
  @@index([deletedAt])
}

model WorkspaceMember {
  id             String         @id @default(cuid())
  workspaceId    String
  userId         String
  role           WorkspaceRole  // creator, admin, approver, editor, viewer
  joinedAt       DateTime       @default(now())

  workspace      Workspace      @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  user           User           @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([workspaceId, userId])
  @@index([userId])
  @@index([workspaceId])
}

enum WorkspaceRole {
  creator    // 工作区创建者，最高权限
  admin      // 管理员，可管理成员和设置
  approver   // 审核者，可审核发布内容
  editor     // 编辑者，可创建和编辑内容
  viewer     // 仅查看者，无修改权限
}

// ==================== 社交账号连接 ====================

model SocialAccount {
  id                   String            @id @default(cuid())
  workspaceId          String
  platform             SocialPlatform    // twitter, linkedin, reddit, youtube, xiaohongshu, douyin, etc.
  platformAccountId    String            // 平台返回的用户ID
  platformUsername     String            // @handle形式
  platformDisplayName  String?
  profileUrl           String?
  avatarUrl            String?
  
  // 加密存储的访问令牌 - AES-256-GCM
  accessTokenEncrypted String            // 加密后的令牌
  refreshTokenEncrypted String?          // 加密后的刷新令牌（如支持）
  tokenExpiresAt       DateTime?         // 令牌过期时间
  tokenScope           String?           // 权限范围
  
  // 会话数据（用于浏览器自动化平台）
  sessionData          Json?             // {cookie: "...", localStorage: {...}}
  
  // 状态和限流追踪
  status               SocialAccountStatus  // connected, disconnected, expired, error
  lastSyncAt           DateTime?
  rateLimitRemaining   Int               @default(0)
  rateLimitResetAt     DateTime?
  errorMessage         String?
  
  createdAt            DateTime          @default(now())
  updatedAt            DateTime          @updatedAt

  workspace            Workspace         @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  publishJobs          PublishJob[]

  @@unique([workspaceId, platform, platformAccountId])
  @@index([workspaceId])
  @@index([platform])
  @@index([status])
}

enum SocialPlatform {
  twitter
  linkedin
  reddit
  youtube
  xiaohongshu
  douyin
  facebook
  instagram
  tiktok
  weibo
  // 可扩展
}

enum SocialAccountStatus {
  connected      // 正常连接
  disconnected   // 用户主动断开
  expired        // 令牌过期
  error          // 连接异常（限流、封禁等）
  pending        // 等待用户授权（浏览器自动化场景）
}

// ==================== 内容管理与AI适配 ====================

model Content {
  id                 String           @id @default(cuid())
  workspaceId        String
  createdById        String
  title              String
  body               String           @db.Text
  summary            String?          @db.Text
  media              Json             // [{type: 'image'|'video', url: '...', alt: '...', size: 123}]
  tags               String[]         // 标签数组
  
  // 原始内容（发布前状态）
  status             ContentStatus    // draft, scheduled, processing, published, failed
  errorMessage       String?
  
  // 调度发布
  scheduledAt        DateTime?
  
  // 平台适配配置与结果
  targetPlatforms    SocialPlatform[]
  aiAdaptationConfig Json?            // {enabled: true, instructions: {twitter: "...", xiaohongshu: "..."}}
  
  // 适配结果缓存（避免重复计算）
  // 结构: {platform: {text, media, hashtags, estimated_metrics}}
  adaptationResults Json?             // JSONB存储
  
  // 发布结果（逐平台）
  // 结构: {platform: {status, postUrl, publishedAt, platformPostId, engagement}}
  publishResults     Json?
  
  createdAt          DateTime         @default(now())
  updatedAt          DateTime         @updatedAt
  publishedAt        DateTime?
  deletedAt          DateTime?

  workspace          Workspace        @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  createdBy          User             @relation(fields: [createdById], references: [id])
  aiAdaptationLogs   AIAdaptationLog[]
  publishJobs        PublishJob[]
  complianceScans    ComplianceScan[]

  @@index([workspaceId])
  @@index([createdById])
  @@index([status])
  @@index([scheduledAt])
  @@index([publishedAt])
  @@index([deletedAt])
  @@index([createdAt])
}

enum ContentStatus {
  draft         // 草稿，未提交发布
  scheduled     // 已调度，等待定时发布
  processing    // AI适配中 / 发布队列中
  published     // 已成功发布到所有平台（或部分）
  failed        // 发布失败（非全部）
  cancelled     // 已取消
}

// AI适配日志: 追踪每次AI调用
model AIAdaptationLog {
  id                String   @id @default(cuid())
  contentId         String
  platform          SocialPlatform
  prompt            String   @db.Text      // 发送给AI的完整提示词
  originalText      String   @db.Text      // 原文
  adaptedText       String   @db.Text      // AI生成的适配文本
  modelUsed         String                  // 使用的模型（如"gpt-4o"）
  tokensInput       Int
  tokensOutput      Int
  tokensTotal       Int
  costCents         Int        // 成本（美分），便于计算
  durationMs        Int        // API耗时
  success           Boolean    // 是否成功
  errorMessage      String?
  createdAt         DateTime   @default(now())

  content           Content    @relation(fields: [contentId], references: [id], onDelete: Cascade)

  @@index([contentId])
  @@index([createdAt])
  @@index([modelUsed])
}

// ==================== 发布队列 (Bull) ====================

// Bull队列在Redis中存储，但在数据库保留任务元数据用于追踪和审计
model PublishJob {
  id                String           @id @default(cuid())
  contentId         String
  socialAccountId   String
  platform          SocialPlatform
  status            JobStatus        // pending, active, completed, failed, delayed
  priority          Int              @default(0)  // 队列优先级（数字越小越高）
  
  // Bull元数据
  bullJobId         String?          @unique    // Redis中Bull的job ID
  attemptsMade      Int              @default(0)
  maxAttempts       Int              @default(3)
  delayUntil        DateTime?
  
  // 执行结果
  startedAt         DateTime?
  completedAt       DateTime?
  result            Json?            // {postUrl, platformPostId, success, error}
  
  // 重试策略
  backoffStrategy   String?          // "exponential", "fixed"
  backoffDelayMs    Int?             // 重试延迟（毫秒）
  
  createdAt         DateTime         @default(now())
  updatedAt         DateTime         @updatedAt

  content           Content          @relation(fields: [contentId], references: [id], onDelete: Cascade)
  socialAccount     SocialAccount    @relation(fields: [socialAccountId], references: [id])

  @@index([contentId])
  @@index([socialAccountId])
  @@index([status])
  @@index([priority, delayUntil])  // 用于队列排序
  @@index([createdAt])
}

enum JobStatus {
  pending      // 等待中
  active       // 执行中
  completed    // 成功完成
  failed       // 失败（重试耗尽）
  delayed      // 延迟执行
  cancelled    // 已取消
}

// ==================== 统一分析 ====================

// 每日聚合数据（定时任务生成）
model AnalyticsDaily {
  id                String           @id @default(cuid())
  workspaceId       String
  platform          SocialPlatform?
  date              DateTime         // 某天0点UTC
  postsCount        Int              // 发布数
  engagement        Json             // {likes, comments, shares, views, reach}
  audience          Json?            // {followers, growth, demographics}
  metrics           Json?            // 其他平台特定指标
  
  createdAt         DateTime         @default(now())
  updatedAt         DateTime         @updatedAt

  workspace         Workspace        @relation(fields: [workspaceId], references: [id], onDelete: Cascade)

  @@unique([workspaceId, platform, date])
  @@index([workspaceId, date])
  @@index([date])
  @@index([platform])
}

// 实时事件追踪（可选，用于细粒度分析）
// 如果分析需求更复杂，可单独建事实表并用ClickHouse存储
// 这里仅记录原始事件，实际查询建议用物化视图或数据仓库

model AnalyticsEvent {
  id                String           @id @default(cuid())
  workspaceId       String
  contentId         String?
  platform          SocialPlatform
  eventType         AnalyticsEventType  // view, like, comment, share, click, follow
  eventData         Json             // 事件相关数据（如位置、设备、referrer）
  userId            String?          // 平台用户ID（匿名化处理）
  sessionId         String?
  ipAddress         String?          // IP（匿名化哈希）
  userAgent         String?
  occurredAt        DateTime         @default(now())

  @@index([workspaceId, occurredAt])
  @@index([contentId])
  @@index([platform])
}

enum AnalyticsEventType {
  view
  like
  comment
  share
  click
  follow
  impression
}

// ==================== 合规扫描 ====================

model ComplianceScan {
  id                String           @id @default(cuid())
  contentId         String
  workspaceId       String
  scanType          ComplianceScanType  // sensitive, copyright, brand_safety, regulatory
  triggeredBy       String              // userId 或 "system"
  
  // 扫描状态
  status            ScanStatus          // pending, running, completed, failed
  startedAt         DateTime           @default(now())
  completedAt       DateTime?
  
  // 结果
  overallRisk       RiskLevel?         // low, medium, high, critical
  violations        Json?              // [{type, severity, rule, description, snippet, suggestion}]
  
  // AI配置
  aiModelUsed       String?
  tokensUsed        Int?
  costCents         Int?
  
  // 人工干预
  userOverride      Boolean            @default(false)
  overrideReason    String?
  overrideBy        String?
  overrideAt        DateTime?
  
  errorMessage      String?

  content           Content            @relation(fields: [contentId], references: [id], onDelete: Cascade)

  @@index([contentId])
  @@index([workspaceId])
  @@index([status])
  @@index([startedAt])
  @@index([overallRisk])
}

enum ComplianceScanType {
  sensitive       // 敏感词、政治、色情、暴力等
  copyright       // 盗版、未授权引用
  brand_safety    // 品牌安全（竞品对比、不当言论）
  regulatory      // 法规合规（GDPR、CCPA、广告法）
}

enum ScanStatus {
  pending
  running
  completed
  failed
}

enum RiskLevel {
  low
  medium
  high
  critical
}

// ==================== 标签管理 ====================

model Tag {
  id              String   @id @default(cuid())
  workspaceId     String
  name            String
  color           String   @default("#6B7280")  // Hex颜色
  description     String?
  usageCount      Int      @default(0)         // 使用次数（统计用）
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  workspace       Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)

  @@unique([workspaceId, name])
  @@index([workspaceId])
}

// ==================== Webhooks ====================

model Webhook {
  id              String   @id @default(cuid())
  workspaceId     String
  url             String
  secret          String?  // HMAC签名密钥（加密存储）
  events          String[] // ["content.published", "compliance.scan.completed"]
  isActive        Boolean  @default(true)
  lastSentAt      DateTime?
  lastFailureAt   DateTime?
  failureCount    Int      @default(0)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  workspace       Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)

  @@index([workspaceId])
  @@index([isActive])
}

// ==================== 审计日志 (不可变) ====================

model AuditLog {
  id              String           @id @default(cuid())
  workspaceId     String?
  userId          String?
  action          AuditAction      // 操作类型
  resourceType    AuditResource    // 资源类型
  resourceId      String?
  
  // 变更快照（JSON Patch格式）
  beforeState     Json?            // 变更前的数据
  afterState      Json?            // 变更后的数据
  changes         Json?            // diff详细信息
  
  // 上下文
  ipAddress       String?
  userAgent       String?
  requestId       String?          // 关联API请求
  
  createdAt       DateTime         @default(now())

  @@index([workspaceId])
  @@index([userId])
  @@index([action])
  @@index([resourceType, resourceId])
  @@index([createdAt])
}

enum AuditAction {
  user_created
  user_updated
  user_deleted
  workspace_created
  workspace_updated
  workspace_deleted
  member_invited
  member_role_changed
  member_removed
  social_account_connected
  social_account_disconnected
  social_account_token_refreshed
  content_created
  content_updated
  content_deleted
  content_published
  ai_adaptation_run
  compliance_scan_run
  compliance_override
  api_key_created
  api_key_revoked
  webhook_created
  webhook_updated
  webhook_deleted
  system_config_changed
  export_data_requested
  data_deletion_requested
}

enum AuditResource {
  user
  workspace
  member
  social_account
  content
  ai_adaptation
  compliance_scan
  api_key
  webhook
  system
}

// ==================== 加密辅助函数 (PostgreSQL pgcrypto) ====================

// 应用层调用这些SQL函数进行加密解密
// 详见 Security Architecture 文档
//
// CREATE EXTENSION IF NOT EXISTS pgcrypto;
//
// 加密:
// INSERT INTO social_account (access_token_encrypted) 
// VALUES (pgp_sym_encrypt('my_token', 'your_secret_key'));
//
// 解密:
// SELECT pgp_sym_decrypt(access_token_encrypted, 'your_secret_key') 
// FROM social_account WHERE id = '...';

```

## 关键索引设计

### Content 表高频查询索引

```sql
-- 查询工作区内容列表（按状态 + 发布时间倒序）
CREATE INDEX idx_content_workspace_status_published ON Content(workspaceId, status, publishedAt DESC) 
WHERE deletedAt IS NULL AND status IN ('published', 'scheduled');

-- 查询待发布内容（调度任务需要）
CREATE INDEX idx_content_scheduled ON Content(scheduledAt) 
WHERE status = 'scheduled' AND scheduledAt <= NOW();

-- 搜索内容标题/标签（全文检索，可选）
CREATE INDEX idx_content_tags ON Content USING GIN(tags);
CREATE INDEX idx_content_title_gin ON Content USING GIN(to_tsvector('english', title || ' ' || COALESCE(body, '')));
```

### PublishJob 队列索引

```sql
-- Bull队列拉取任务（优先 + 延迟）
CREATE INDEX idx_publishjob_status_priority ON PublishJob(status, priority, delayUntil) 
WHERE status IN ('pending', 'active') AND (delayUntil IS NULL OR delayUntil <= NOW());

-- 按content查询发布状态
CREATE INDEX idx_publishjob_content ON PublishJob(contentId);
```

### AnalyticsDaily 聚合索引

```sql
-- 快速获取某工作区时间范围数据
CREATE INDEX idx_analytics_workspace_date ON AnalyticsDaily(workspaceId, date DESC);

-- 跨工作区平台比较（后台管理用）
CREATE INDEX idx_analytics_platform_date ON AnalyticsDaily(platform, date DESC);
```

## 软删除策略

所有含`deletedAt`的表：

- **应用层**: `WHERE deletedAt IS NULL` 作为默认查询条件（Prisma全局查询过滤器，v5可用）
- **外键约束**: 允许NULL，软删除后仍保留关联记录，历史数据完整
- **统计查询**: 软删除数据不应计入统计
- **硬清理**: 定期任务删除`deletedAt < NOW() - INTERVAL '90 days'`的数据到归档表

## 数据保留策略

| 数据类型 | 保留期 | 归档/清理策略 |
|----------|--------|----------------|
| Content | 永久（除非用户删除） | 软删除90天后硬删 |
| AnalyticsDaily | 永久 | 按分区表管理（每月一个分区） |
| AnalyticsEvent | 2年 | 冷数据迁移至对象存储 |
| AuditLog | 7年（法规要求） | 定期压缩归档 |
| AIAdaptationLog | 2年 | 可配置清理 |
| PublishJob | 180天 | 清理后保留聚合统计 |
| ComplianceScan | 永久（合规要求） | 重要数据永久保留 |

## 扩展性考虑

### 分库分表（Sharding）

当单库超过1000万行时考虑：

- **Content表按workspaceId哈希分表**（`content_{hash}`）
- **AnalyticsEvent按日期分区**（每月一个分区）
- 使用Prisma `$queryRaw`处理跨分片查询（或迁移到数据仓库）

### 读写分离

- **读副本**: Analytics查询走只读副本，减轻主库压力
- **连接池**: PgBouncer管理连接池，max_connections控制在200以内

### 缓存策略

- **Content缓存**: Redis缓存热门内容（30分钟TTL）
- **分析数据**: 每日预计算存入AnalyticsDaily，查询走缓存（1小时TTL）
- **SocialAccount令牌**: 内存缓存（LRU），避免频繁查询DB

---

**文档维护**: 架构组  
**更新日期**: 2026-03-09  
**Prisma Schema 文件**: `prisma/schema.prisma
