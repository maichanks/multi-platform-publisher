# 开发实施计划

**文档签名**: maichanks <hankan1993@gmail.com>

## 总体里程碑

| 里程碑 | 时间 | 目标 | 交付物 |
|--------|------|------|--------|
| M1 架构搭建 | Week 1-2 | 后端API框架、数据库、CI/CD就绪 | 可运行的空壳系统、API文档 |
| M2 基础平台 | Week 3 | Twitter/Reddit/LinkedIn发布 | 3个平台发布完成 |
| M3 中国平台 | Week 4 | 浏览器自动化框架 + 小红书 | 小红书发布成功 |
| M4 AI引擎 | Week 5 | AI内容适配 + 合规扫描 | AI服务集成、合规报告 |
| M5 分析系统 | Week 6 | 统一分析仪表板 + 团队协作 | 数据看板、成员管理 |
| M6 测试完善 | Week 7 | 端到端测试 + 安全审计 | 测试报告、渗透测试结果 |
| M7 Beta发布 | Week 8 | 文档 + Beta测试 | 用户文档、Beta部署 |
| M8 优化发布 | Week 9-10 | Bug修复 + v1.0.0发布 | 正式v1.0.0 |

**团队规模假设**:
- 后端工程师: 2人
- 前端工程师: 1人
- 全栈/DevOps: 1人
- QA/测试: 1人（可兼）

## Week 1-2: 核心后端 + API + 数据库

### 任务分解

| 天 | 任务 | 负责人 | 验收标准 |
|----|------|--------|----------|
| 1-2 | **项目初始化**<br>- `git init`, `.gitignore`<br>- `package.json` (NestJS monorepo)<br>- ESLint + Prettier<br>- Docker Compose开发环境 | DevOps | `docker-compose up` 启动所有服务 |
| 3 | **Prisma Schema设计**<br>- 创建`User`, `Workspace`, `WorkspaceMember`表<br>- 编写`prisma/schema.prisma`<br>- 运行`prisma migrate dev`生成迁移 | 后端 | 数据库表创建成功 |
| 4 | **认证系统**<br>- OAuth2 Authorization Code Flow with PKCE<br>- JWT + Redis Session<br>- API Key生成与验证中间件 | 后端 | 登录/注册接口可用，API Key验证通过 |
| 5 | **用户与工作区管理**<br>- `POST /workspaces`<br>- `GET /workspaces`<br>- 成员邀请 (`POST /invitations`)<br>- 角色RBAC基础框架 | 后端 | 可创建工作区、邀请成员、分配角色 |

### 开发环境就绪检查清单

- [ ] PostgreSQL 15运行，可连接
- [ ] Redis 7运行，可连接
- [ ] NestJS应用启动(`npm run start:dev`)
- [ ] Prisma Client生成成功
- [ ] 环境变量`.env`配置完整（`DATABASE_URL`, `REDIS_URL`, `ENCRYPTION_KEY`）
- [ ] Postman/OpenAPI文档生成（`@nestjs/swagger`）
- [ ] Git仓库，main分支保护

### 产出物

- `prisma/migrations/` - 数据库迁移脚本
- `src/auth/` - 认证模块（OAuth2, JWT）
- `src/workspaces/` - 工作区模块
- `src/users/` - 用户模块
- `src/common/decorators/` - `@RequirePermissions`装饰器
- `docker-compose.yml` - 开发环境
- `docs/API_SPECIFICATION.md`初稿（已在本设计文档中）

---

## Week 3: Twitter/Reddit/LinkedIn 集成

### 任务分解

| 天 | 任务 | 负责人 | 验收标准 |
|----|------|--------|----------|
| 1-2 | **平台适配器架构**<br>- 定义`IPlatformAdapter`接口<br>- 实现`AdapterFactory`工厂<br>- 实现`MockAdapter`用于测试 | 后端 | 可注入不同适配器，单测通过 |
| 3-4 | **Twitter 适配器**<br>- OAuth2 PKCE连接<br>- 发布文字+图片<br>- 媒体上传（分块）<br>- 限流处理<br>- 错误重试 | 后端A | 真实Twitter账号测试发布成功 |
| 5 | **Reddit 适配器**<br>- OAuth2 script连接<br>- Subreddit选择<br>- 发布到指定subreddit<br>- 规则检查（长度、禁用词） | 后端B | 测试Subreddit发布成功 |
| 6 | **LinkedIn 适配器**<br>- OAuth2连接<br>- 图片上传<br>- 标题/描述/标签 | 后端B | 测试LinkedIn账号发布成功 |

### 开发要点

**统一错误处理**:
```typescript
class PlatformException extends Error {
  constructor(
    public platform: SocialPlatform,
    public code: string,
    public message: string,
    public retryAfter?: number,
    public retryable = true,
  ) { super(message); }
}
```

**Bull队列配置**:
```typescript
// publish-queue.processor.ts
@Processor('publish', {
  concurrency: 10,
  settings: {
    stalledInterval: 30000,
  },
})
export class PublishProcessor {
  @Process({ name: 'publish-content', concurrency: 5 })
  async handleContentPublish(job: Job<PublishJob>) {
    // 调用对应适配器
    // 成功则标记完成，失败则根据retryable决定重试
  }
}
```

### 测试策略

- **单元测试**: Mock HTTP请求（`nock`库），验证请求参数正确
- **集成测试**: 使用真实开发账号（非生产），验证发布流程
- **媒体上传测试**: 小文件（<1MB）确保API正确

### 风险与缓解

| 风险 | 可能性 | 影响 | 缓解措施 |
|------|--------|------|----------|
| Twitter API审核慢 | 中 | 高 | 提前申请，使用测试dev environment |
| LinkedIn API访问受限 | 高 | 中 | 准备备用方案（仅发布文字），或提交企业申请 |
| 限流触发频繁 | 中 | 中 | 实现精准限流计数，队列延迟 |

---

## Week 4: 浏览器自动化框架 + 小红书

### 任务分解

| 天 | 任务 | 负责人 | 验收标准 |
|----|------|--------|----------|
| 1-2 | **浏览器自动化基础设施**<br>- 启动`xhs-mcp-server`（或自建Puppeteer服务）<br>- 实现`BrowserManager`（启动、关闭、状态）<br>- 集成`puppeteer-extra-plugin-stealth` | 后端A | 无头Chrome可启动，访问小红书页面 |
| 3-4 | **小红书适配器**<br>- 扫码登录流程（二维码生成）<br>- Cookies + localStorage恢复会话<br>- 图片上传（拖拽模拟）<br>- 内容表单填写<br>- 发布确认 | 后端A | 真实小红书账号发布成功 |
| 5 | **会话管理**<br>- 会话持久化（加密存储cookies）<br>- 会话复用（避免重复扫码）<br>- 失效检测（自动重登） | 后端B | 会话可保存3天，自动恢复 |
| 6 | **错误处理与监控**<br>- 验证码识别（第三方服务）<br>- 异常页面检测（封禁、风控）<br>- 浏览器崩溃恢复 | 后端B | 验证码触发时暂停队列并通知 |

### 开发要点

**浏览器资源管理**:

一个账号对应一个浏览器实例，需控制总数（内存有限）:
```typescript
class BrowserPool {
  private browsers: Map<string, Browser> = new Map();
  private queue: Queue<{ accountId: string; }> = new Queue();
  
  async acquire(accountId: string): Promise<Browser> {
    if (this.browsers.has(accountId)) {
      return this.browsers.get(accountId)!;
    }
    
    if (this.browsers.size < MAX_BROWSERS) {
      const browser = await this.launchBrowser();
      this.browsers.set(accountId, browser);
      return browser;
    }
    
    // 等待某个浏览器释放
    return new Promise(resolve => {
      this.queue.add({ accountId });
      // ... 复杂逻辑需使用EventEmitter
    });
  }
  
  async release(accountId: string): Promise<void> {
    const browser = this.browsers.get(accountId);
    if (browser) {
      await browser.close();
      this.browsers.delete(accountId);
      this.queue.process(); // 处理下一个等待
    }
  }
}
```

**二维码推送**:

- 后端启动浏览器获取二维码`<img src>` URL
- 前端轮询`GET /publish/qrcode/{sessionToken}`获取二维码
- 用户扫码后，前端轮询`GET /publish/status/{sessionToken}`直到成功

**合规性特别注意**:

小红书对自动化高度敏感，发布需:
- 模拟真人操作（随机延迟、鼠标轨迹）
- 同一账号不要频繁发布（限5条/天）
- IP为中国大陆（使用国内代理或服务器）
- 内容避免敏感词（即使合规扫描通过，小红书风控独立）

### 测试策略

- 准备多个小红书测试账号（未实名或新号）
- 开发环境使用模拟二维码（不真扫码）
- 生产灰度: 首批仅1-2个账号，监控成功率

### 风险与缓解

| 风险 | 可能性 | 影响 | 缓解措施 |
|------|--------|------|----------|
| 小红书风控封号 | 高 | 中 | 使用新注册账号，行为模拟极致，IP轮换 |
| 验证码频繁 | 高 | 中 | 集成自动打码服务，人工备用 |
| 浏览器内存泄漏 | 中 | 高 | 定期重启浏览器（每10次发布后） |

---

## Week 5: AI 适配引擎 + 合规扫描

### 任务分解

| 天 | 任务 | 负责人 | 验收标准 |
|----|------|--------|----------|
| 1-2 | **AI服务封装**<br>- OpenRouter集成（客户端）<br>- 模型路由（primary/fallback）<br>- 成本统计（tokens、费用）<br>- 超时与重试 | 后端A | 能调用GPT-4o、Qwen模型，获取响应 |
| 3-4 | **内容适配引擎**<br>- 提示词模板（各平台）<br>- 生成适配内容（text + hashtags）<br>- 缓存机制（Redis，24h）<br>- 预览接口 | 后端A | 输入原文，输出Twitter/小红书/抖音适配文本 |
| 5 | **合规扫描服务**<br>- 敏感词库（内置 + 动态更新）<br>- AI合规检查（调用Qwen）<br>- 风险评级（low/medium/high/critical）<br>- 人工覆盖接口 | 后端B | 内容扫描返回详细违规条目 |
| 6 | **AI日志与成本控制**<br>- `AIAdaptationLog`入库<br>- 成本报表（日报）<br>- 预算告警（月度$100、$200） | 后端B | 成本监控面板数据准确 |

### AI提示词设计

**平台适配提示词模板** (`templates/adaptation.md`):

```
你是多平台内容适配助手。

原始内容:
---
${originalContent}
---

目标平台: ${platform}
平台规则:
- 最大长度: ${maxLength}
- 标签格式: #标签
- 风格: ${style} (Twitter: 简洁、话题导向; 小红书: 亲切、emoji、标签叠; LinkedIn: 专业、商业价值)
- 其他要求: ${instructions}

请改写内容，保持核心信息不变，适配平台风格。输出JSON:
{
  "text": "适配后的正文",
  "hashtags": ["#标签1", "#标签2"],
  "estimated_engagement": "中等" // 预估互动率
}
```

使用Structured Outputs（OpenAI JSON模式）保证结构化响应。

### 合规扫描提示词

```
你内容合规扫描AI。

内容:
---
${content}
---

检查以下风险类型:
1. 敏感词（政治、色情、暴力、宗教）
2. 版权侵权（引用未注明来源）
3. 虚假宣传（夸大、不实）
4. 广告法违规（最、第一、国家级）
5. 平台特定规则（如小红书禁止外部导流）

返回JSON:
{
  "overall_risk": "low|medium|high",
  "violations": [
    {
      "type": "sensitive",
      "severity": "high",
      "rule": "political_reference",
      "description": "提到了敏感政治话题",
      "snippet": "原文片段",
      "suggestion": "建议删除相关段落"
    }
  ]
}
```

### 成本优化策略

- **缓存**: 相同原文+相同平台适配结果，复用24小时
- **小模型优先**: 小红书等简单适配可用`gpt-4o-mini`，成本1/10
- **批量扫描**: 每日凌晨批量扫描待发布队列，避免高峰调用
- **配额限制**: 单用户每日消耗超过$0.5（约10万tokens）需审批

### 测试策略

- AI响应缓存测试（相同输入返回缓存）
- 合规扫描案例库（100条已知违规内容）
- 成本计算准确性（tokens vs billed）

### 风险与缓解

| 风险 | 可能性 | 影响 | 缓解措施 |
|------|--------|------|----------|
| AI幻觉（编造标签） | 中 | 中 | 后置验证（检查标签长度、是否含敏感词） |
| API成本失控 | 中 | 高 | 硬性配额、实时监控、告警 |
| 合规漏检 | 低 | 极高 | 多层检查（关键词 + AI + 人工审核可选） |
| 响应慢（AI延迟） | 中 | 中 | 异步任务 + 超时设置（10s），不影响发布主流程 |

---

## Week 6: 分析仪表板 + 团队协作

### 任务分解

| 天 | 任务 | 负责人 | 验收标准 |
|----|------|--------|----------|
| 1-3 | **前端架构搭建**<br>- Vite + React + Ant Design<br>- 路由配置（React Router）<br>- 状态管理（Zustand）<br>- 主题系统（暗黑模式） | 前端 | 页面框架完成，可路由切换 |
| 4-5 | **分析仪表板**<br>- 概览页面（KPI卡片、平台对比图）<br>- 折线图（发布趋势、互动趋势）<br>- 柱状图（平台效果对比）<br>- 数据导出（CSV/Excel） | 前端 | 图表可视化，数据来自API |
| 6 | **团队协作功能**<br>- 成员列表 + 邀请<br>- 角色管理（Creator/Admin/Editor/Viewer）<br>- 内容审核流（Approver角色）<br>- 操作日志（AuditLog表格） | 前端 + 后端 | 成员管理界面、审核按钮生效 |

### 前端架构

**目录结构**:

```
frontend/
├── public/
├── src/
│   ├── api/           # API客户端（Axios + 类型）
│   ├── components/    # 通用组件（Button, Modal, Table）
│   ├── features/
│   │   ├── auth/      # 登录页
│   │   ├── workspace/ # 工作区管理
│   │   ├── content/   # 内容列表/编辑器
│   │   ├── analytics/ # 分析仪表板
│   │   ├── team/      # 成员管理
│   │   └── settings/  # 设置
│   ├── layouts/       # MainLayout, AuthLayout
│   ├── hooks/         # 自定义Hooks (useAuth, useWorkspace)
│   ├── utils/         # 工具函数
│   └── App.tsx
├── index.html
├── vite.config.ts
└── package.json
```

**状态管理 (Zustand)**:

```typescript
// stores/workspace.store.ts
interface WorkspaceStore {
  currentWorkspace: Workspace | null;
  workspaces: Workspace[];
  setCurrentWorkspace: (ws: Workspace) => void;
  fetchWorkspaces: () => Promise<void>;
}

export const useWorkspaceStore = create<WorkspaceStore>((set) => ({
  currentWorkspace: null,
  workspaces: [],
  setCurrentWorkspace: (ws) => set({ currentWorkspace: ws }),
  fetchWorkspaces: async () => {
    const res = await api.get('/workspaces');
    set({ workspaces: res.data });
  },
}));
```

**图表**:

使用`@ant-design/charts`（Ant Design官方图表库，基于G2）：

```tsx
import { Line } from '@ant-design/charts';

<Line
  data={dailyPosts}
  xField="date"
  yField="count"
  seriesField="platform"
  smooth
  animation={{
    appear: { animation: 'path-in', duration: 1000 },
  }}
/>
```

### 后端补充接口

Week 6需补充的API（Week 3-5可能已实现部分）：

- `GET /analytics/overview` (已有设计)
- `GET /analytics/details` (分页查询)
- `GET /analytics/export` (文件导出)
- `GET /workspaces/{id}/members` (列表)
- `POST /workspaces/{id}/invitations` (邀请)
- `PATCH /workspaces/{id}/members/{userId}` (角色变更)
- `GET /audit-logs` (审计日志分页)

### 测试策略

- **前端单元测试**: Jest + React Testing Library，覆盖率>80%
- **E2E测试**: Playwright（用户登录、创建内容、发布）
- **图表渲染测试**: 确保数据正常显示

### 风险与缓解

| 风险 | 可能性 | 影响 | 缓解措施 |
|------|--------|------|----------|
| 图表性能差（大数据） | 中 | 中 | 后端聚合（限制查询范围）、虚拟滚动 |
| Ant Design主题不一致 | 低 | 低 | 使用ConfigProvider统一定制 |
| 权限控制漏洞 | 中 | 高 | 前端显示隐藏，后端必须二次验证 |

---

## Week 7: 测试 + 安全审计

### 任务分解

| 任务 | 子任务 | 负责人 | 交付物 |
|------|--------|--------|--------|
| **单元测试** | 所有Service/Controller 80%+覆盖率 | QA + 后端 | Jest覆盖率报告 |
| **集成测试** | API E2E（发布流程、AI适配） | QA | Postman集合、Newman CI集成 |
| **前端测试** | 组件测试、E2E流程 | 前端 | Playwright测试脚本 |
| **安全审计** | 漏洞扫描、渗透测试 | DevOps/外部 | OWASP ZAP报告、手动测试结果 |
| **性能测试** | 负载测试（100并发用户） | DevOps | k6脚本、性能报告 |
| **Bug修复** | 解决所有Critical/High Bug | 全体 | Bug跟踪关闭 |

### 测试环境

独立于开发的Staging环境:

```
staging.multiplatform.publisher
├── postgres (单独DB)
├── redis (单独)
├── backend (镜像 tag=staging)
├── frontend (镜像 tag=staging)
└── nginx (staging配置)
```

数据使用合成数据（`prisma db seed`生成10工作区×100内容）。

### 安全审计要点

对照`SECURITY_ARCHITECTURE.md`逐项检查:

- [ ] SQL注入: 所有查询使用Prisma参数化
- [ ] XSS: 前端无`dangerouslySetInnerHTML`，或使用`DOMPurify`
- [ ] CSRF: 状态变更API有CSRF Token或SameSite Cookie
- [ ] 认证旁路: 未认证用户无法访问`/api/protected/*`
- [ ] 速率限制: 各端点实施限流
- [ ] 加密存储: `SocialAccount`令牌可见密文
- [ ] 日志敏感信息: 无access_token、密码泄露到日志
- [ ] 依赖漏洞: `npm audit`无高危
- [ ] 文件上传: 文件类型校验，无路径遍历

**渗透测试工具**:
- OWASP ZAP: 自动化扫描
- sqlmap: SQL注入验证（应全部拦截）
- Burp Suite: 手动测试业务逻辑漏洞

### 性能测试 (k6)

```javascript
// load-test.js
import http from 'k6/http';
import { check, sleep } from 'k6';

export let options = {
  stages: [
    { duration: '2m', target: 50 },  // 50虚拟用户
    { duration: '5m', target: 100 }, // 100虚拟用户
    { duration: '2m', target: 0 },   // 收尾
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'], // 95%请求<500ms
    http_req_failed: ['rate<0.01'],   // 失败率<1%
  },
};

const BASE_URL = 'https://staging.multiplatform.publisher';

export default function () {
  // 登录获取token
  const loginRes = http.post(`${BASE_URL}/api/v1/auth/login`, {
    email: `user${__VU}@example.com`,
    password: 'test123',
  });
  check(loginRes, { 'login success': (r) => r.status === 200 });
  const token = loginRes.json('access_token');

  // 获取工作区列表
  const workspacesRes = http.get(`${BASE_URL}/api/v1/workspaces`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  check(workspacesRes, { 'list workspaces': (r) => r.status === 200 });

  sleep(1);
}
```

运行: `k6 run load-test.js`

**性能目标**:
- P95延迟 < 500ms
- 错误率 < 1%
- 单服务器支持1000用户稳定运行

### Bug管理

使用GitHub Issues/GitLab Issues:

- **标签**: `bug`, `enhancement`, `security`, `performance`
- **优先级**: `critical`, `high`, `medium`, `low`
- **状态**: `open`, `in-progress`, `ready-for-test`, `closed`

每日站会同步阻塞问题。

---

## Week 8: Beta 发布准备

### 任务分解

| 任务 | 子任务 | 负责人 | 交付物 |
|------|--------|--------|--------|
| 文档编写 | - 用户手册<br>- 安装部署指南<br>- API文档（Swagger）<br>- 故障排查FAQ | 技术写作 | README.md, docs/ |
| 生产部署 | - 准备生产服务器<br>- SSL证书申请<br>- Docker Compose proda配置<br>- 监控（Prometheus + Grafana）<br>- 备份脚本 | DevOps | 生产环境就绪 |
| 数据迁移 | - 从开发DB迁移到生产DB<br>- 验证数据完整性 | DevOps | 迁移脚本、验证报告 |
| Beta用户邀请 | - 邀请10-20个内测用户<br>- 收集反馈渠道设立<br>- 用户培训（在线会议/视频） | 产品 | 内测用户名单、反馈收集 |

### 文档清单

**开发者文档**:
- `ARCHITECTURE.md` - 架构总览（本文档集合）
- `API_SPECIFICATION.md` - API接口
- `DEPLOYMENT.md` - 部署指南
- `SECURITY_ARCHITECTURE.md` - 安全设计
- `INTEGRATION_PLANS.md` - 平台实现细节

**运维文档**:
- `OPERATIONS.md` - 日常运维（备份、恢复、监控、告警处理）
- `UPGRADE.md` - 版本升级步骤

**用户文档**:
- `USER_GUIDE.md` - 如何创建工作区、连接账号、发布内容
- `TROUBLESHOOTING.md` - 常见问题（登录失败、发布失败、配额限制）
- `PLATFORM_GUIDES.md` - 各平台使用技巧（Twitter最佳发布时间、小红书标签策略）

### 生产环境准备

**服务器配置**:

```bash
# 1. 基础环境
apt update && apt install -y docker.io docker-compose nginx certbot

# 2. 创建应用目录
mkdir -p /opt/mp-publisher
cd /opt/mp-publisher
git clone <repo> .
cp .env.example .env
# 手动填写生产环境变量（密钥、API key等）

# 3. 申请SSL证书
certbot certonly --nginx -d app.multiplatform.publisher

# 4. 启动服务
docker-compose -f docker-compose.prod.yml up -d

# 5. 运行迁移
docker-compose -f docker-compose.prod.yml exec backend npx prisma migrate deploy

# 6. 验证健康
curl https://app.multiplatform.publisher/health
```

### 监控配置

**Prometheus + Grafana**:

```yaml
# prometheus.yml
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: 'backend'
    static_configs:
      - targets: ['backend:3000']
    metrics_path: '/metrics'
  
  - job_name: 'postgres'
    static_configs:
      - targets: ['postgres-exporter:9187']
  
  - job_name: 'redis'
    static_configs:
      - targets: ['redis-exporter:9121']
```

Grafana Dashboard创建:
- 导入Node Exporter Dashboard (1860)
- 导入Postgres Dashboard (9628)
- 自定义应用Dashboard

---

## Week 9-10: 优化 + v1.0.0 正式发布

### 任务分解

| 周 | 任务 | 交付物 |
|----|------|--------|
| Week 9 | - Beta用户反馈分析<br>- Critical Bug修复<br>- 性能优化（SQL索引、缓存）<br>- 用户体验优化（加载速度、错误提示）<br>- 文档补充 | v1.0.0-rc.1 |
| Week 10 | - 最终回归测试<br>- 安全审计复检<br>- 生产灰度发布（10%用户）<br>- 全量发布<br>- Release Notes撰写<br>- 上线后监控（一周） | v1.0.0 |

### 性能优化重点

**数据库**:
- 慢查询日志分析 (`log_min_duration_statement=1000`)
- 添加缺失索引（根据`pg_stat_statements`）
- 查询优化（避免N+1，使用Prisma `include`）

**应用**:
- Redis缓存热点查询（工作区信息、用户权限）
- API响应压缩（gzip）
- 分页优化（游标分页替代offset）

**前端**:
- 路由懒加载 (`React.lazy`)
- 图片懒加载、WebP格式
- 树摇优化（tree-shaking）

### 灰度发布策略

**阶段1 (10%流量)**:
- 新Nginx upstream指向新版本（10%权重）
- 监控错误率、性能指标
- 收集日志

**阶段2 (50%流量)**:
- 如果没有问题，逐步提升至50%
- 继续监控3天

**阶段3 (100%流量)**:
- 全量切换
- 旧版本下线

**回滚计划**: 如有严重Bug，15分钟内切回旧版本。

---

## 跨职能协作

### 每日站会 (15分钟)

**日程**:
1. 昨天完成了什么？
2. 今天计划做什么？
3. 遇到什么阻塞？

**工具**: Sync daily standup notes in `memory/YYYY-MM-DD.md`.

### 代码审查

- 所有PR必须至少1人Review
- 重点关注: 安全性、错误处理、性能、测试覆盖率
- 使用GitLab/Github PR模板

### CI/CD 流程

```yaml
# .gitlab-ci.yml 或 GitHub Actions
stages:
  - test
  - build
  - deploy-staging
  - deploy-prod

# 1. 测试
test:
  stage: test
  script:
    - npm ci
    - npm run lint
    - npm run test:unit
    - npm run test:e2e
  artifacts:
    reports:
      junit: coverage/junit.xml
      coverage_report: coverage/coverage-final.json

# 2. 构建
build:
  stage: build
  script:
    - docker build -t registry.example.com/mp-backend:$CI_COMMIT_SHA ./backend
    - docker push registry.example.com/mp-backend:$CI_COMMIT_SHA

# 3. 部署Staging（自动）
deploy-staging:
  stage: deploy-staging
  script:
    - kubectl set image deployment/backend backend=registry.example.com/mp-backend:$CI_COMMIT_SHA -n mp-publisher-staging
    - kubectl rollout status deployment/backend -n mp-publisher-staging
  only:
    - merge_requests

# 4. 部署生产（手动）
deploy-prod:
  stage: deploy-prod
  script:
    - kubectl set image deployment/backend backend=registry.example.com/mp-backend:$CI_COMMIT_SHA -n mp-publisher
    - kubectl rollout status deployment/backend -n mp-publisher
  when: manual
  only:
    - main
```

### 发布清单 (Release Checklist)

**发布前**:
- [ ] 所有测试通过（单元、集成、E2E）
- [ ] 安全扫描无高危漏洞
- [ ] 性能测试达标（P95 < 500ms）
- [ ] 文档更新（API、用户手册）
- [ ] 备份生产数据库
- [ ] 通知用户（维护窗口）

**发布中**:
- [ ] 灰度发布监控（错误率、延迟）
- [ ] 准备回滚方案（旧镜像、DB备份）
- [ ] 团队待命（on-call）

**发布后**:
- [ ] 监控24小时（Sentry、Prometheus）
- [ ] 收集用户反馈
- [ ] 发布公告（Release Notes）

---

## 风险管理与应对

| 风险 | 概率 | 影响 | 缓解措施 | 负责人 |
|------|------|------|----------|--------|
| 小红书/抖音封号 | 高 | 中 | 使用测试账号逐步验证，行为模拟极致，准备备用账号池 | 后端A |
| OpenAI API成本超支 | 中 | 中 | 每日成本监控，硬配额，缓存复用 | 后端B |
| 第三方平台API变更 | 中 | 中 | 抽象适配层，版本锁定，监控API健康 | 后端A/B |
| 团队人员变动 | 低 | 高 | 文档完善，代码审查，知识共享（内部分享会） | 全员 |
| 关键Bug上线 | 中 | 高 | 灰度发布，快速回滚， hotfix流程 | DevOps |
| 合规法律风险 | 低 | 极高 | 法务审核，GDPR/CCPA合规设计，数据删除功能 | 产品+法务 |

---

## 成功标准 (Definition of Done)

每个用户故事完成必须:

- [ ] 代码审查通过（至少1人Review）
- [ ] 测试覆盖率≥80%（新增代码）
- [ ] 所有测试通过（本地 + CI）
- [ ] 文档已更新（API文档、用户指南）
- [ ] 安全审查通过（无SQL注入、XSS等）
- [ ] 代码合并到`main`分支
- [ ] 功能在Staging环境验证通过

---

## 关键指标 (Metrics)

| 指标 | 目标 | 测量方法 |
|------|------|----------|
| 发布成功率 | > 95% | 监控`PublishJob.status = 'completed'` |
| 平均发布延迟 | < 5秒（API平台）<br>< 2分钟（浏览器平台） | Bull队列耗时统计 |
| AI成本 | < $0.01/适配 | 成本报表 |
| 系统可用性 | 99.9% | 健康检查 + Uptime监控 |
| API P95延迟 | < 500ms | Prometheus直方图 |
| 用户留存（7日） | > 40% | 用户登录统计 |

---

**文档维护**: 项目经理  
**最后更新**: 2026-03-09  
**下一步**: 召开项目启动会，分配任务，设置CI/CD
