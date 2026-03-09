# 安全架构设计

**文档签名**: maichanks <hankan1993@gmail.com>

## 安全原则

1. **纵深防御**: 多层安全措施，单点失效不影响整体
2. **最小权限**: 用户/服务仅授予必要权限
3. **加密 everywhere**: 传输加密、存储加密、密钥管理分离
4. **零信任**: 内外网同等待遇，所有请求验证身份
5. **可审计**: 所有敏感操作全程追溯到用户

## 1. 凭据存储加密

### 加密需求

社交账号OAuth令牌（特别是`access_token`、`refresh_token`）是最高密级数据，泄露会导致账号被盗用。

**威胁模型**:
- 数据库泄露（SQL注入、备份泄露、未授权访问）
- 内部人员滥用权限（DBA、运维）
- 云服务商不可靠（虚拟化逃逸）

### 加密方案: AES-256-GCM

**为什么AES-GCM?**
- 认证加密（AEAD）：同时加密和验证完整性，防篡改
- 高性能：现代CPU指令集（AES-NI）加速
- IV随机：无需固定IV，每次加密生成随机12字节IV
- 认证标签：16字节GCM tag确保密文未被修改

### 密钥管理: 环境变量 + KMS（可选）

#### 开发环境

`/.env`:
```bash
ENCRYPTION_KEY=base64:xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx  # 32字节随机密钥
```

生成密钥:
```bash
openssl rand -base64 32 > encryption.key
```

**限制**: 密钥存储在服务器，需严格权限控制（`chmod 600`）

#### 生产环境（高安全要求）

使用**云KMS**或**HashiCorp Vault**：

- **AWS**: KMS + Envelope Encryption（数据密钥随机，主密钥由KMS托管）
- **阿里云**: KMS托管密钥，自动轮转
- **自建**: Vault Transit Secrets Engine

**应用启动流程**:
```typescript
// 从环境变量或KMS获取主密钥
const masterKey = process.env.ENCRYPTION_KEY 
  ? Buffer.from(process.env.ENCRYPTION_KEY, 'base64')
  : await vault.transit.decrypt('encryption-key', ciphertext);

// 每次加密生成随机DEK（数据加密密钥）
const dek = crypto.randomBytes(32);
const encryptedDek = await kms.encrypt(dek); // KMS加密DEK

// 用DEK加密数据
const iv = crypto.randomBytes(12);
const ciphertext = aesGcmEncrypt(data, dek, iv);

// 存储: {iv, ciphertext, encryptedDek}
```

**简化方案（推荐初期使用）**:
- 单主密钥（32字节）存储在环境变量（`ENCRYPTION_KEY`）
- 定期轮转：每月1日生成新密钥，旧密钥保留用于解密历史数据
- 密钥版本化：`key_v1`, `key_v2`, 存储在数据库key_metadata表

### 数据库层加密函数

```sql
-- 启用pgcrypto扩展
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 加密函数
CREATE OR REPLACE FUNCTION encrypt_data(data TEXT, key BYTEA) 
RETURNS BYTEA AS $$
BEGIN
  RETURN pgp_sym_encrypt(data, encode(key, 'base64'));
END;
$$ LANGUAGE plpgsql;

-- 解密函数
CREATE OR REPLACE FUNCTION decrypt_data(cipher BYTEA, key BYTEA) 
RETURNS TEXT AS $$
BEGIN
  RETURN pgp_sym_decrypt(cipher, encode(key, 'base64'));
END;
$$ LANGUAGE plpgsql;
```

**应用层使用**:
```typescript
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);

// 存储加密令牌
await sql`
  INSERT INTO social_account (access_token_encrypted)
  VALUES (pgp_sym_encrypt(${accessToken}, ${process.env.ENCRYPTION_KEY}))
`;

// 查询解密
const rows = await sql`
  SELECT pgp_sym_decrypt(access_token_encrypted, ${process.env.ENCRYPTION_KEY}) as token
  FROM social_account WHERE id = ${id}
`;
```

### 字段级加密

`SocialAccount`表加密字段:
- `accessTokenEncrypted`: 必需，OAuth访问令牌
- `refreshTokenEncrypted`: 必需，刷新令牌（如提供）
- `sessionData`: 可选，浏览器自动化会话数据（cookies、localStorage）

**长度设计**:
- 加密前明确字段长度上限（如access_token最长2000字符）
- 加密后存储为`BYTEA`或`TEXT`，预留空间（建议4000字符）

## 2. API 认证与授权

### 认证方案

#### 用户会话: OAuth 2.0 Authorization Code Flow with PKCE

适用于Web前端（浏览器）。

**PKCE (Proof Key for Code Exchange)** 防止授权码拦截攻击:

1. 前端生成随机`code_verifier`（43-128字符）
2. 计算`code_challenge = BASE64URL(SHA256(code_verifier))`
3. 授权请求携带`code_challenge`和`code_challenge_method=S256`
4. 回调收到`code`后，用`code_verifier`交换令牌

**NestJS实现**: `@nestjs/passport` + `passport-oauth2`

```typescript
// oauth2.strategy.ts
@Injectable()
export class OAuth2Strategy extends PassportStrategy(Strategy, 'oauth2') {
  constructor(private readonly config: OAuth2Config) {
    super({
      authorizationURL: config.authorizationURL,
      tokenURL: config.tokenURL,
      userProfileURL: config.userProfileURL,
      scope: config.scope,
    }, async (accessToken, refreshToken, profile) => {
      // 查找或创建用户
      const user = await this.authService.upsertUser(profile);
      return user;
    });
  }
}
```

#### 服务端API密钥

适用于服务间调用、CI/CD、第三方集成。

**生成方式**:
```bash
openssl rand -hex 32  # 生成256位随机密钥
```

**存储**: 
- 数据库`ApiKey`表存储**哈希**（SHA256），不存明文
- 应用层使用: `crypto.createHash('sha256').update(apiKey).digest('hex')`验证

**验证中间件**:
```typescript
@Injectable()
export class ApiKeyGuard implements CanActivate {
  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();
    const apiKey = request.headers['x-api-key'] as string;
    
    if (!apiKey) throw new UnauthorizedException('Missing API Key');
    
    const keyHash = crypto.createHash('sha256').update(apiKey).digest('hex');
    const dbKey = await this.apiKeyRepo.findByHash(keyHash);
    
    if (!dbKey || dbKey.revoked || dbKey.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid or expired API Key');
    }
    
    // 更新lastUsedAt、ip等
    await this.apiKeyRepo.updateLastUsed(dbKey.id, request.ip);
    
    // 将用户信息挂载到request
    request.user = dbKey.user;
    return true;
  }
}
```

#### 会话管理

- **JWT无状态**: 适合水平扩展，但无法主动吊销
- **Redis会话**: 有状态，支持实时吊销，但需粘性会话或共享Session存储

**选择Redis会话存储**:
- 实现`IamSession`接口，存储`{userId, workspaceId, role, permissions, expiresAt}`
- Redis Key: `session:{sessionId}`，TTL=7天
- 好处: 主动登出、会话数限制、设备管理

```typescript
@ Injectable()
export class SessionService {
  async createSession(userId: string, workspaceId: string): Promise<string> {
    const sessionId = crypto.randomUUID();
    const session: SessionData = {
      userId,
      workspaceId,
      createdAt: new Date(),
      expiresAt: addDays(new Date(), 7),
    };
    await this.redis.setex(`session:${sessionId}`, 7*24*3600, JSON.stringify(session));
    return sessionId;
  }
  
  async validateSession(sessionId: string): Promise<SessionData | null> {
    const data = await this.redis.get(`session:${sessionId}`);
    return data ? JSON.parse(data) : null;
  }
}
```

### 授权模型: RBAC + ABAC

#### RBAC（角色基础访问控制）

预定义角色（WorkspaceRole）:
- `creator`: 工作区所有者，所有权限
- `admin`: 管理成员、设置、账单
- `approver`: 审核发布内容
- `editor`: 创建、编辑自己内容
- `viewer`: 只读

**权限枚举**:
```typescript
enum Permission {
  // 工作区管理
  workspace_read = 'workspace:read',
  workspace_update = 'workspace:update',
  workspace_delete = 'workspace:delete',
  
  // 成员管理
  member_invite = 'member:invite',
  member_remove = 'member:remove',
  member_role_update = 'member:role_update',
  
  // 社交账号
  social_account_connect = 'social_account:connect',
  social_account_disconnect = 'social_account:disconnect',
  social_account_publish = 'social_account:publish', // 关键权限
  
  // 内容
  content_create = 'content:create',
  content_read = 'content:read',
  content_update = 'content:update', // 仅自己的内容
  content_delete = 'content:delete',
  content_publish = 'content:publish',
  
  // 合规与审核
  compliance_view = 'compliance:view',
  compliance_override = 'compliance:override', // 高风险绕过
  
  // 分析
  analytics_view = 'analytics:view',
  analytics_export = 'analytics:export',
  
  // 系统
  api_key_manage = 'api_key:manage',
  webhook_manage = 'webhook:manage',
  audit_log_view = 'audit:view',
}
```

**角色-权限映射**:
```typescript
const ROLE_PERMISSIONS: Record<WorkspaceRole, Permission[]> = {
  creator: Object.values(Permission), // 全部权限
  admin: [
    Permission.workspace_read,
    Permission.member_invite,
    Permission.member_remove,
    Permission.social_account_connect,
    Permission.social_account_disconnect,
    Permission.content_create,
    Permission.content_read,
    Permission.content_update, // 所有成员内容
    Permission.content_delete,
    Permission.compliance_view,
    Permission.analytics_view,
    Permission.analytics_export,
    Permission.api_key_manage,
    Permission.webhook_manage,
    Permission.audit_log_view,
  ],
  approver: [
    Permission.workspace_read,
    Permission.content_read,
    Permission.content_publish, // 审核发布
    Permission.compliance_view,
    Permission.compliance_override, // 可绕过
    Permission.analytics_view,
  ],
  editor: [
    Permission.workspace_read,
    Permission.content_create,
    Permission.content_read,
    // 只能更新/删除自己创建的内容（ABAC动态判断）
    Permission.content_publish, // 无需审核（如果角色允许）
    Permission.compliance_view,
  ],
  viewer: [
    Permission.workspace_read,
    Permission.content_read,
    Permission.analytics_view,
  ],
};
```

#### ABAC（属性基础访问控制）

动态权限检查（如"只能编辑自己创建的内容"）：

```typescript
@Injectable()
export class AuthorizationService {
  async canUpdateContent(userId: string, content: Content): Promise<boolean> {
    // 角色有全局更新权限
    if (this.hasGlobalPermission(userId, Permission.content_update)) {
      return true;
    }
    
    // 否则只能操作自己的内容
    return content.createdById === userId;
  }
  
  async canPublish(userId: string, content: Content): Promise<boolean> {
    // 内容风险等级
    const risk = await this.complianceService.getRiskLevel(content.id);
    
    if (risk === 'high' && !this.hasPermission(userId, Permission.compliance_override)) {
      return false; // 高风险内容只有授权人员可发布
    }
    
    // 检查是否有发布配额
    if (!await this.quotaService.canPublish(userId, content.platform)) {
      return false;
    }
    
    return this.hasPermission(userId, Permission.content_publish);
  }
}
```

### 权限检查装饰器（NestJS）

```typescript
// permissions.decorator.ts
export function RequirePermissions(...permissions: Permission[]) {
  return SetMetadata('permissions', permissions);
}

// permissions.guard.ts
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly authz: AuthorizationService) {}
  
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user; // 已由AuthGuard设置
    const permissions = this.reflector.get<Permission[]>(
      'permissions', 
      context.getHandler()
    );
    
    if (!permissions || permissions.length === 0) {
      return true; // 无权限要求，放行
    }
    
    const allowed = await this.authz.checkPermissions(user.id, permissions);
    if (!allowed) {
      throw new ForbiddenException('Insufficient permissions');
    }
    
    return true;
  }
}

// 使用
@Controller('contents')
export class ContentController {
  @Post()
  @RequirePermissions(Permission.content_create)
  async create(@Body() dto: CreateContentDto) {
    // 创建内容
  }
}
```

## 3. 速率限制

### 分布式限流: Token Bucket + Redis

**需求**:
- API全局限流: 用户每1000请求/小时
- 发布接口限流: 每平台每用户配额（Twitter: 1500/15min）
- 维持公平使用，防止暴力攻击

### 实现: Redis + Bull内置限流

NestJS使用`nestjs-throttler`:

```typescript
// main.ts
import { ThrottlerModule } from 'nestjs-throttler';

@Module({
  imports: [
    ThrottlerModule.forRoot([
      {
        ttl: 3600, // 1小时窗口（秒）
        limit: 1000, // 用户级全局限制
      },
      {
        ttl: 900, // 15分钟
        limit: 1500, // Twitter发布限制
        keyGenerator: (request) => `publish:twitter:${request.user.id}`,
      },
    ]),
  ],
})
export class AppModule {}
```

**自定义存储适配器**（Redis）:
```typescript
import { ThrottlerStorage } fromnestjs-throttler';
import { Redis } from 'ioredis';

export class RedisStorage implements ThrottlerStorage {
  constructor(private readonly redis: Redis) {}
  
  async get(key: string): Promise<number> {
    const val = await this.redis.get(key);
    return val ? parseInt(val, 10) : 0;
  }
  
  async increment(key: string, ttl: number): Promise<number> {
    const current = await this.redis.incr(key);
    if (current === 1) {
      await this.redis.pexpire(key, ttl * 1000);
    }
    return current;
  }
}
```

### 发布队列限流

更细粒度的发布配额管理（`SocialAccount.rateLimitRemaining`）:

```typescript
// 发布前检查限流
@Injectable()
export class RateLimitService {
  async checkPublishQuota(accountId: string): Promise<boolean> {
    const account = await this.socialAccountRepo.findById(accountId);
    if (account.rateLimitRemaining <= 0) {
      if (account.rateLimitResetAt > new Date()) {
        throw new TooManyRequestsException(
          `Rate limit exceeded. Reset in ${Math.ceil((account.rateLimitResetAt.getTime() - Date.now())/1000)}s`
        );
      } else {
        // 限流已过期，重置计数器
        await this.resetRateLimit(accountId);
      }
    }
    return true;
  }
  
  async decrementQuota(accountId: string): Promise<void> {
    await this.redis.decr(`ratelimit:${accountId}`);
    // 原子操作更新DB（定期同步到DB，避免频繁写）
  }
}
```

## 4. 审计日志

### 不可变日志设计

`AuditLog`表记录所有敏感操作，**禁止UPDATE/DELETE**（DB权限控制）。

**记录内容**:
- `action`: 枚举的操作类型
- `userId`, `workspaceId`: 操作者和所属租户
- `resourceType`, `resourceId`: 操作对象
- `beforeState`, `afterState`: 变更前后快照（JSON）
- `changes`: 详细差异（JSON Patch格式）
- `ipAddress`, `userAgent`, `requestId`: 上下文

### 自动填充审计日志

使用PostgreSQL触发器或应用层中间件：

```typescript
// audit.middleware.ts
@Injectable()
export class AuditMiddleware implements NestMiddleware {
  constructor(private readonly auditService: AuditService) {}
  
  async use(req: Request, res: Response, next: NextFunction) {
    const start = Date.now();
    
    res.on('finish', async () => {
      const user = req.user as User | null;
      const workspaceId = (req as any).workspaceId; // 从JWT/会话解析
      
      // 记录响应时间、状态码等
      await this.auditService.log({
        workspaceId,
        userId: user?.id,
        action: this.mapMethodToAction(req.method, req.routePath),
        resourceType: this.determineResourceType(req),
        resourceId: this.extractResourceId(req),
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        requestId: req.headers['x-request-id'],
        statusCode: res.statusCode,
        durationMs: Date.now() - start,
      });
    });
    
    next();
  }
}
```

### 审计日志查询与合规报告

```sql
-- 查询某工作区所有内容删除操作
SELECT * FROM AuditLog 
WHERE workspaceId = 'ws_xxx' 
  AND action = 'content_deleted'
  AND createdAt >= '2025-03-01'
ORDER BY createdAt DESC;

-- 生成合规报告（GDPR Data Subject Access Request）
SELECT action, COUNT(*) as count 
FROM AuditLog 
WHERE userId = 'user_xxx'
GROUP BY action
ORDER BY count DESC;
```

### 日志防篡改

- **数据库权限**: 应用程序只有INSERT权限，禁止UPDATE/DELETE（运维审计角色除外）
- **WORM存储**: 定期将审计日志归档到只读存储（AWS S3 Glacier、阿里云OSS归档）
- **哈希链**: 可选的增强方案，每日计算前一天日志的Merkle Root，存入区块链或离线存储

## 5. 合规性设计 (GDPR, CCPA)

### GDPR要求

| 要求 | 实现 |
|------|------|
| **Right to be Forgotten** | `DELETE /workspaces/{id}/data` 触发硬删除/匿名化流程 |
| **Data Portability** | `GET /workspaces/{id}/export` 导出JSON/CSV格式数据 |
| **Consent** | 用户注册时明确同意Privacy Policy，记录`consentGivenAt` |
| **Data Breach Notification** | 监控告警，72小时内上报监管 |
| **Privacy by Design** | 默认最小化收集，数据加密存储 |
| **DPO (Data Protection Officer)** | 指定管理员角色负责合规 |

### 数据生命周期管理

```typescript
// 定期任务清理过期数据
@Cron('0 2 * * *') // 每天2AM UTC
async cleanupExpiredData() {
  // 1. 软删除超过90天的数据 → 硬删除
  const cutoff = subDays(new Date(), 90);
  await this.prisma.$executeRaw`
    DELETE FROM Content 
    WHERE deletedAt < ${cutoff} 
    AND status = 'deleted'
  `;
  
  // 2. AnalyticsEvent超过2年 → 归档到对象存储
  const archiveCutoff = subYears(new Date(), 2);
  await this.archiveOldEvents(archiveCutoff);
  
  // 3. AIAdaptationLog超过2年 → 删除聚合摘要外保留全部
  await this.prisma.aIAdaptationLog.deleteMany({
    where: { createdAt: { lt: archiveCutoff } }
  });
}
```

### 数据匿名化

GDPR删除不是简单`DELETE`，可能是**匿名化**（保留统计数据但去标识化）：

```typescript
async anonymizeUserData(userId: string) {
  await this.prisma.$transaction(async (tx) => {
    // 1. 内容: 保留标题和统计，删除个人字段
    await tx.content.updateMany({
      where: { createdById: userId },
      data: {
        createdById: 'anon_system',
      }
    });
    
    // 2. 审计日志: 保留但匿名化userId
    await tx.auditLog.updateMany({
      where: { userId },
      data: { userId: 'anon_user' }
    });
    
    // 3. 用户表: 清空个人字段但保留记录（外键依赖）
    await tx.user.update({
      where: { id: userId },
      data: {
        email: null,
        name: null,
        avatarUrl: null,
        passwordHash: null,
        oauthProviderId: null,
        deletedAt: new Date(),
      }
    });
  });
}
```

### 隐私政策与用户协议

- 用户注册时显示最新版本，记录`agreedToTermsAt`、`agreedToPrivacyAt`
- 政策更新时，需要重新同意（重大变更）
- 存储所有历史版本，支持审计

## 6. 密钥与Secrets管理

### 环境变量标准

**`.env.example`**:
```bash
# 应用基础
NODE_ENV=production
APP_NAME="MultiPlatform Publisher"
APP_VERSION=1.0.0
PORT=3000

# 数据库
DATABASE_URL="postgresql://user:pass@localhost:5432/mp_publisher?sslmode=require"

# Redis
REDIS_URL="redis://localhost:6379"

# 加密密钥（必须）
ENCRYPTION_KEY="base64:xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"

# AI服务
OPENROUTER_API_KEY="sk-or-..."

# OAuth应用凭据
OAUTH_TWITTER_CLIENT_ID="..."
OAUTH_TWITTER_CLIENT_SECRET="..."
OAUTH_LINKEDIN_CLIENT_ID="..."
OAUTH_LINKEDIN_CLIENT_SECRET="..."

# 浏览器自动化（可选）
XHS_MCP_ENDPOINT="http://localhost:3001"
PUPPETEER_STEALTH_ENABLED=true

# 邮件服务（SMTP）
SMTP_HOST="smtp.gmail.com"
SMTP_PORT=587
SMTP_USER="noreply@example.com"
SMTP_PASS="..."

# 监控
SENTRY_DSN="https://..."
PROMETHEUS_ENABLED=true

# 日志
LOG_LEVEL=info
LOG_FILE="/var/log/mp-publisher/app.log"
```

### 密钥轮转策略

1. **ENCRYPTION_KEY**: 每季度轮换一次
   - 同时保留旧密钥在内存（`LEGACY_KEYS`环境变量）
   - 写入时用新密钥，读取时尝试所有密钥直到成功
   - 3个月后完全移除旧密钥

2. **OAuth客户端密钥**: 每半年检查一次，如有泄露立即轮换

3. **API Key**: 用户可随时撤销，系统自动替换

### 密钥访问控制

- 开发环境: `.env`文件权限`chmod 600`, git忽略
- 生产环境: 使用Secrets Manager（K8s Secrets、Docker Swarm Secrets、HashiCorp Vault）
- 禁止硬编码: 任何代码中不得出现明文密钥

## 7. 网络安全

### 传输加密

- 强制HTTPS (TLS 1.2+)
- HSTS头: `Strict-Transport-Security: max-age=31536000; includeSubDomains`
- 证书: Let's Encrypt自动续期（Certbot或K8s cert-manager）

### CORS策略

严格限制来源:

```typescript
app.enableCors({
  origin: [
    'https://app.multiplatform.publisher',
    'https://admin.multiplatform.publisher',
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
});
```

### SQL注入防护

- **Prisma ORM**: 参数化查询，自动转义
- 禁止`prisma.$executeRaw`拼接SQL（如需使用，严格参数化）
- 原则: 绝不信任前端输入，所有输入验证

```typescript
// 错误示范（SQL注入风险）
const search = req.body.search;
const sql = `SELECT * FROM content WHERE title LIKE '%${search}%'`; // ❌

// 正确 - Prisma参数化
await prisma.content.findMany({
  where: { title: { contains: search } } // ✅
});
```

### XSS防护

- 前端React默认转义，`dangerouslySetInnerHTML`慎用
- 输出AI生成内容时严格过滤HTML（使用`DOMPurify`）

```typescript
import DOMPurify from 'dompurify';

const safeHtml = DOMPurify.sanitize(aiGeneratedHtml, {
  ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'br'],
  ALLOWED_ATTR: ['href', 'target', 'rel'],
});
```

### CSRF防护

- 状态变更API（POST/PUT/DELETE）必须CSRF Token
- SameSite Cookie: `SameSite=Strict`（如使用Cookie认证）
- API Key认证不受CSRF影响

## 8. 日志与监控

### 结构化日志 (JSON)

```typescript
// logger.service.ts
import winston from 'winston';

const logger = winston.createLogger({
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json(),
  ),
  transports: [
    new winston.transports.File({ 
      filename: 'logs/error.log', 
      level: 'error' 
    }),
    new winston.transports.File({ 
      filename: 'logs/combined.log' 
    }),
    new winston.transports.Console(),
  ],
});

// 使用
logger.info('Content published', {
  userId: user.id,
  workspaceId: workspace.id,
  contentId: content.id,
  platform: platform,
  requestId: req.id,
  durationMs,
});
```

### 安全事件告警

监控以下事件并告警（Slack/钉钉/邮件）:

- 认证失败 > 10次/分钟（同一IP）
- 权限拒绝 > 5次/分钟（同一用户）
- 异常API速率 > 1000次/分钟
- 数据库连接池耗尽
- 加密/解密失败（可能密钥错误）

使用Sentry捕获异常堆栈。

## 9. 浏览器自动化安全

针对小红书、抖音的MCP (Multi-agent Control Protocol) 浏览器自动化:

### 反检测措施

- **stealth-plugin**: 隐藏`navigator.webdriver`、Chrome插件列表
- **真实用户数据**: 使用随机但合理的User-Agent、屏幕分辨率、时区
- **模拟人类行为**: 随机鼠标移动、点击间隔>100ms
- **IP轮换**: 代理池（住宅代理优先），同一账号24小时内固定IP

### 会话隔离

- 每个`social_account`独立浏览器上下文（incognito profile）
- 数据目录按`accountId`隔离
- 会话结束后清除缓存、cookies

### 风险控制

- 自动检测验证码: 如遇到验证码，暂停队列并通知人工介入
- 账号封禁防护: 检测到异常（登录频繁、操作过快）立即停止并告警
- 最小化权限: 浏览器仅访问必要页面，不访问其他网站

## 10. 渗透测试清单

上线前至少一次第三方安全审计:

- [ ] SQL注入测试
- [ ] XSS反射/存储型
- [ ] CSRF令牌绕过
- [ ] 认证旁路（未授权访问）
- [ ] 速率限制绕过
- [ ] IDOR (Insecure Direct Object Reference)
- [ ] OAuth2流程漏洞（state未验证、redirect_uri开放重定向）
- [ ] 密文存储测试（能否解密）
- [ ] 会话固定攻击
- [ ] 浏览器自动化检测（是否能被发现）

---

**文档维护**: 安全团队  
**最后更新**: 2026-03-09  
**下次审计**: 2026-06-09
