# 技术栈选择

**文档签名**: maichanks <hankan1993@gmail.com>

## 总体原则

针对多平台内容发布系统的需求（1000+并发用户，支持中国平台，AI驱动），我们选择了现代化、高性能、易维护的技术栈。所有选择均基于以下考量：

- **开发效率**: 快速迭代，团队协作顺畅
- **性能可扩展**: 单服务器支持1000+用户，平滑扩展到10k
- **中国平台支持**: 需要浏览器自动化、特殊协议处理
- **AI集成**: 智能内容适配、合规扫描
- **运维友好**: 容器化部署，监控完善

## 后端框架: Node.js + NestJS

### 选择理由

| 对比项 | NestJS | Python FastAPI | 结论 |
|--------|--------|----------------|------|
| TypeScript支持 | 原生支持，类型安全 | 需要mypy，配置复杂 | NestJS胜出 |
| 架构模式 | 内置模块化、依赖注入 | 需要第三方库 | NestJS胜出 |
| 生态丰富度 | npm生态丰富，HTTP/队列/缓存库齐全 | Python生态好但Web相对弱 | 平手 |
| 性能 | Node.js 20+ 性能优秀，异步I/O强 | ASGI性能好，CPU密集型强 | NestJS胜出（I/O密集型） |
| 中国社区 | 活跃，中文文档完善 | 非常活跃 | 平手 |
| 学习曲线 | 中等（Angular风格） | 低（Python简洁） | FastAPI略胜 |
| 团队协作 | 严格架构约束，代码一致性强 | 灵活但易混乱 | NestJS胜出 |

### 最终决定: **NestJS**

**关键优势**:
1. **企业级架构**: 模块(Module)、控制器(Controller)、服务(Service)分层清晰，强制依赖注入，适合大型团队协作
2. **TypeScript一等公民**: 编译时类型检查，减少运行时错误，提升代码可维护性
3. **内置功能丰富**: Guards、Interceptors、Pipes、Filters 等AOP特性，便于实现认证、限流、日志等横切关注点
4. **微服务友好**: 内置gRPC、MQTT、Redis适配器，未来拆分微服务容易
5. **中国社区成熟**: B站、掘金教程丰富，问题易解决

### 版本选择

- **Node.js**: v20.x LTS（2024-2026支持）
- **NestJS**: v10.x（最新稳定版）
- **TypeScript**: v5.x（自带装饰器元数据优化）

## 前端框架: React + Vite + Ant Design

### 框架选择: React vs Vue

| 对比项 | React 18+ | Vue 3+ | 结论 |
|--------|-----------|--------|------|
| 生态丰富度 | npm最大生态，UI库最多 | 生态活跃但小于React | React胜出 |
| TypeScript支持 | 完美 | 完美 | 平手 |
| 团队人才供给 | 市场上React开发者最多 | Vue也有但略少 | React胜出 |
| 学习成本 | 中等（Hooks概念） | 低（模板语法简单） | Vue略胜 |
| 企业采用 | Meta、阿里、字节等大厂 | 阿里、B站等 | React更广泛 |

**决定: React 18+**

### 构建工具: Vite vs Webpack

| 对比项 | Vite 5+ | Webpack 5 | 结论 |
|--------|---------|-----------|------|
| 冷启动速度 | <100ms（原生ESM） | 1-3秒 | Vite大胜 |
| HMR速度 | 毫秒级 | 数百ms | Vite胜出 |
| 配置复杂度 | 零配置即用 | 需复杂配置 | Vite胜出 |
| 生态 | 已全面支持主流库 | 成熟但老化 | Vite胜出 |
| 生产构建 | 使用Rollup，速度快 | 慢但可优化 | Vite胜出 |

**决定: Vite 5+**

### UI组件库: Ant Design vs Element Plus vs Headless UI

| 对比项 | Ant Design | Element Plus | Headless UI | 结论 |
|--------|------------|--------------|-------------|------|
| 组件完备性 | 极全（50+组件） | 全（40+组件） | 只有基础 | Ant Design胜出 |
| 国际化 | 完善（含中文） | 完善 | 需要自己实现 | Ant Design胜出 |
| 定制灵活性 | 中等（主题系统） | 高（CSS变量） | 完全自由 | 视需求而定 |
| 文档质量 | 优秀（中英） | 优秀（中文） | - | Ant Design胜出 |
| 企业案例 | 阿里、蚂蚁金服 | 饿了么、Vue官网 | - | Ant Design更成熟 |

**决定: Ant Design 5.x**

**理由**:
- 组件齐全，开箱即用，覆盖企业级应用所有场景
- 支持暗黑模式、国际化、主题定制
- 中国社区最活跃，中文文档完善
- Design Token系统便于品牌一致性

### 状态管理: Zustand vs Redux Toolkit

避免Redux的样板代码过多，选择**Zustand**：

- API极简，学习成本低
- 无需Provider包装
- TypeScript支持完美
- 性能优秀（不可变更新）
- 适合中小型应用（我们的状态管理不算复杂）

### 路由: React Router v6

- 行业标准，生态完善
- 支持懒加载、数据加载、嵌套路由
- 与Vite无缝集成

## 数据库: PostgreSQL 15 + Prisma

### 数据库选择: PostgreSQL vs MySQL

| 对比项 | PostgreSQL 15 | MySQL 8.0 | 结论 |
|--------|---------------|-----------|------|
| 功能完备性 | 支持JSONB、数组、GIS、全文检索等 | 功能较基础 | PostgreSQL大胜 |
| 事务支持 | 完整ACID，MVCC | 完整ACID | 平手 |
| 性能 | 复杂查询强，并发好 | 简单查询快 | PostgreSQL胜出（复杂分析） |
| 数据类型 | 丰富（UUID、JSON、几何等） | 基础 | PostgreSQL胜出 |
| 扩展性 | 支持自定义函数、聚合、索引类型 | 插件系统 | PostgreSQL胜出 |
| 复制高可用 | 流复制、逻辑复制成熟 | 组复制成熟 | 平手 |
| 中国生态 | 阿里RDS、腾讯云均支持 | 更普遍 | MySQL略胜 |

**决定: PostgreSQL 15**

**关键原因**:
1. **JSONB支持**: AI适配结果、元数据存储需要半结构化数据，JSONB提供索引和查询能力
2. **全文检索**: 未来可能需要站内搜索
3. **复杂查询**: 统一分析需要多维聚合，PostgreSQL窗口函数更强大
4. **GIS支持**: 如未来需要地理位置功能（如本地化内容）
5. **数据完整性**: 约束、检查约束更严格

### ORM: Prisma vs TypeORM vs Drizzle

| 对比项 | Prisma | TypeORM | Drizzle | 结论 |
|--------|--------|---------|---------|------|
| TypeScript体验 | 极佳（代码生成，类型完美） | 好（装饰器，但有时类型丢失） | 很好（类型安全查询） | Prisma胜出 |
| 迁移管理 | 内置（prisma migrate） | 独立（CLI） | 内置（drizzle-kit） | Prisma & Drizzle胜出 |
| 查询灵活性 | DSL查询语言，直观但略受限 | 完整QueryBuilder | SQL-like，灵活 | TypeORM/Drizzle略胜 |
| 性能 | 优秀（优化的查询） | 一般（装饰器开销） | 优秀（接近原生） | Prisma/Drizzle胜出 |
| 学习成本 | 低（声明式Schema） | 中（装饰器+查询构造器） | 中（SQL-ish） | Prisma胜出 |
| 社区活跃度 | 非常活跃（Vercel维护） | 活跃但稍弱 | 新兴快速增长 | Prisma胜出 |

**决定: Prisma**

**核心理由**:
1. **类型安全**: Schema定义后自动生成TypeScript类型，前端也能共享类型（通过生成客户端）
2. **迁移自动化**: `prisma migrate dev` 自动生成迁移SQL，团队协作友好
3. **演示数据生成**: `prisma db seed` 便于测试环境数据准备
4. **中国社区**: 中文文档完善，教程丰富

### 版本选择

- **PostgreSQL**: 15.x（最新稳定，性能更优）
- **Prisma**: 5.x（最新）

## 缓存与队列: Redis + Bull

### 缓存选择: Redis vs Memcached

| 对比项 | Redis 7 | Memcached 1.6 | 结论 |
|--------|---------|---------------|------|
| 数据结构 | 丰富（String、Hash、List、Set、SortedSet、Stream等） | 仅String | Redis大胜 |
| 持久化 | RDB快照 + AOF日志 | 无 | Redis胜出（缓存可持久化，防止雪崩后冷启动慢） |
| 集群方案 | Redis Cluster、Sentinel | 客户端分片 | Redis更成熟 |
| Lua脚本 | 支持 | 不支持 | Redis胜出（用于原子操作） |
| 中国云服务 | 阿里云、腾讯云完整支持 | 支持 | 平手 |

**决定: Redis 7+**

**用途**:
- 会话缓存
- API响应缓存（热点内容）
- 速率限制计数器（滑动窗口）
- 队列存储（Bull使用Redis Streams）
- 分布式锁（Redlock算法）
- 实时统计数据（HyperLogLog、位图）

### 队列系统: Bull vs Bee-Queue vs RabbitMQ

| 对比项 | Bull MQ | Bee-Queue | RabbitMQ | 结论 |
|--------|---------|-----------|----------|------|
| 实现方式 | Redis Streams（Bull基于bull库） | Redis Streams | 独立Broker（AMQP协议） | Bull胜出（无需额外服务） |
| 延迟任务 | 支持（精确到ms） | 支持 | 支持 | 平手 |
| 优先级队列 | 支持（多优先级） | 不支持 | 支持 | Bull/RabbitMQ胜出 |
| 重复任务 | 去重机制 | 无 | 需插件 | Bull胜出 |
| 监控面板 | 内置Web UI（bull-board） | 无 | 管理插件 | Bull胜出 |
| 可靠性 | ACK机制、重试、死信队列 | 简单重试 | 高（持久化、确认机制） | Bull可满足需求 |
| 运维成本 | 低（复用Redis） | 低 | 高（独立服务） | Bull胜出 |

**决定: Bull + Redis Streams**

**理由**:
- 与现有Redis复用，减少服务数量
- API设计简洁，JavaScript原生友好
- 内置重试、指数退避、死信队列
- 配合`bull-board`提供实时监控面板
- 足够支撑我们的异步任务（AI适配、媒体处理、发布队列）

### 版本

- **Redis**: 7.x（支持Streams）
- **Bull**: 基于`bull`库，使用最新4.x版本

## 浏览器自动化: Puppeteer + stealth-plugin

### 为什么需要浏览器自动化

中国平台（小红书、抖音）不提供公开API或API限制极严，必须模拟真实用户行为，通过浏览器访问Web端发布内容。

### 工具选择: Puppeteer vs Playwright

| 对比项 | Puppeteer | Playwright | 结论 |
|--------|-----------|------------|------|
| 维护方 | 谷歌（Chrome官方） | 微软 | 平手 |
| 浏览器支持 | 仅Chrome/Chromium | Chrome/Firefox/WebKit | Playwright胜出 |
| API易用性 | 简洁直观 | 类似Puppeteer但更强大 | 平手 |
| 自动等待 | 智能等待（元素可见/可点击） | 更强（多种策略） | Playwright略胜 |
| 录制功能 | 无内置 | 有Codegen | Playwright胜出 |
| 移动模拟 | 需要DeviceDescriptors | 内置移动视口、地理位置 | Playwright胜出 |
| 网络拦截 | 支持 | 支持 | 平手 |
| 中国生态 | 成熟，中文资料多 | 较新但增长快 | Puppeteer略胜 |
| Stealth支持 | puppeteer-extra-plugin-stealth成熟 | playwright-stealth同样可用 | 平手 |

**决定: Puppeteer**

**关键因素**:
1. **更成熟的中国社区**: puppeteer-extra插件体系完善，`puppeteer-extra-plugin-stealth`是行业标准反检测方案
2. **Chrome专属优化**: 深度集成Chrome DevTools Protocol，对最新Chrome特性支持最快
3. **团队已有经验**: 如果团队熟悉Puppeteer，迁移成本低
4. **小红书/抖音主要用Chrome内核**: WebView基于Chromium，Puppeteer足够

### 关键插件

- **puppeteer-extra**: 插件化扩展框架
- **puppeteer-extra-plugin-stealth**: 自动隐藏自动化特征（navigator.webdriver、插件列表等）
- **puppeteer-cluster**: 集群管理，提高并发效率
- **puppeteer-screen-recorder**: 录屏用于调试（可选）

### 部署方式

- **无头模式运行**: `headless: 'new'` 性能最佳
- **Xvfb虚拟显示**: 如需截图或视觉验证，使用Xvfb虚拟显示服务器
- **容器化**: Chrome需特殊capabilities（--no-sandbox等）
- **IP轮换**: 使用代理池防止IP封禁（中国平台需要）

## AI集成: OpenRouter + 多模型降级策略

### AI需求场景

1. **内容智能适配**: 针对不同平台的风格、字数、标签习惯重写内容
2. **合规扫描**: 自动检测敏感词、违规内容、版权风险
3. **智能标签生成**: 提取关键词，自动打标签
4. **图像OCR与描述**: 提取图片文字，生成Alt文本
5. **多语言翻译**: 针对国际化平台的内容本地化

### API选择: OpenRouter vs 直接API vs 自建模型

| 方案 | 成本 | 质量 | 控制力 | 延迟 | 可靠性 | 结论 |
|------|------|------|--------|------|--------|------|
| OpenRouter | 中（按token计费） | 高（多种顶级模型） | 中（通过API参数调优） | 中（网络延迟） | 高（多源冗余） | 推荐 |
| 直接OpenAI/Claude | 中高 | 高 | 中 | 中 | 单点故障 | 可作备份 |
| 自建Qwen/DeepSeek | 高（硬件/GPU） | 中高 | 高 | 低（内网） | 自控 | 长期考虑 |
| 本地小模型 Ollama | 低（硬件一次性） | 中 | 高 | 低 | 自控 | 合规场景可用 |

**决定: OpenRouter为主，多模型降级策略**

**理由**:
1. **模型选择自由**: OpenRouter聚合OpenAI GPT-4/4o、Claude 3.5 Sonnet、Qwen 2.5、DeepSeek V3等，针对任务选最优
2. **成本优化**: 简单任务用小模型（GPT-4o-mini），复杂任务用大模型
3. **降级路由**: 主模型限流/故障时自动切换到备选（GPT-4o → Claude 3.5 → Qwen-max）
4. **统一API**: 供应商锁定风险低，切换模型只需改配置
5. **中国合规**: OpenRouter支持中国可访问模型（Qwen、DeepSeek），减少GFW影响

### 具体模型配置

```typescript
// config/ai-models.ts
export const AI_MODELS = {
  content_adaptation: {
    primary: 'openai/gpt-4o',      // 高质量重写
    fallback: 'anthropic/claude-3-5-sonnet',
    budget: 'openai/gpt-4o-mini'   // 简单适配用
  },
  compliance_scan: {
    primary: 'qwen/qwen-2.5-72b',  // 中文理解强，合规知识丰富
    fallback: 'deepseek/deepseek-chat',
    budget: 'qwen/qwen-2.5-14b'
  },
  tag_generation: {
    primary: 'openai/gpt-4o-mini', // 速度快，成本低
    fallback: 'deepseek/deepseek-chat'
  },
  translation: {
    primary: 'openai/gpt-4o',
    fallback: 'anthropic/claude-3-haiku'
  }
}
```

### 成本控制策略

- **Token限制**: 每请求max_tokens硬限制（避免无限生成）
- **缓存层**: 相同内容适配结果缓存24h（Redis）
- **批处理**: 批量合规扫描减少API次数
- **预算告警**: 月消费达到阈值发送通知（80%, 100%）
- **异步队列**: 非实时任务使用Bull队列，平滑负载

### 本地备选方案（合规场景）

某些企业客户要求数据不出境，需部署本地模型：

- **Ollama**: 运行Qwen 2.5（14B或72B参数）
- **vLLM/TGI**: 高性能推理服务器（多GPU）
- **推理优化**: 量化（GGUF格式）、FlashAttention
- **降级机制**: 若OpenRouter不可用，自动路由到本地模型（质量稍低但可用）

## 部署架构: Docker Compose → Kubernetes

### 开发环境: Docker Compose

**单服务器部署方案**，包含以下服务：

```
docker-compose.yml
├── backend (NestJS)        - 3000
├── frontend (Vite dev)     - 5173
├── postgres (PostgreSQL)   - 5432
├── redis (Redis)           - 6379
├── pgadmin (Adminer可选)   - 8080
└── prometheus (监控可选)   - 9090
```

**优势**:
- 一键启动完整环境
- 数据持久化（volumes）
- 环境变量注入
- 跨平台一致（macOS/Windows/Linux）

### 生产环境路径

#### 阶段1: 单服务器Docker Compose（v1.0）

- 使用`docker-compose.prod.yml`
- Nginx反向代理 + SSL（Let's Encrypt）
- 数据库备份到云存储（MinIO或阿里云OSS）
- Prometheus + Grafana监控
- Logrotate日志轮转

#### 阶段2: Kubernetes（v1.5+）

当用户达到5000+时，拆分为微服务：

```
Deployments:
├── api-gateway (Nginx/Kong)
├── backend-core (用户、工作区管理)
├── backend-publisher (发布引擎)
├── backend-analytics (分析计算)
├── frontend (Vite构建的静态资源)
├── postgres (StatefulSet + 主从复制)
├── redis (Cluster模式)
├── bull-dashboard (队列监控)
├── prometheus + grafana
└── elasticsearch (可选，日志分析)
```

**K8s优势**:
- 自动扩缩容（HPA基于CPU/内存/Custom Metrics）
- 滚动更新零停机
- 服务发现与负载均衡
- 健康检查与自愈
- 配置管理（ConfigMap/Secret）

**迁移策略**: 单Docker Compose → K8s Deployment，逐步拆分，双写过渡。

## 版本总览

| 组件 | 版本 | 理由 |
|------|------|------|
| Node.js | 20.x LTS | 长期支持，性能优化，ESM成熟 |
| NestJS | 10.x | 最新稳定，架构清晰 |
| TypeScript | 5.x | 装饰器元数据优化 |
| React | 18.x | 并发特性，Hooks成熟 |
| Vite | 5.x | 极速构建，插件生态 |
| Ant Design | 5.x | Design Token系统 |
| Zustand | 4.x | 轻量状态管理 |
| PostgreSQL | 15.x | JSONB、窗口函数、性能 |
| Prisma | 5.x | 类型安全，迁移自动化 |
| Redis | 7.x | Streams、性能、持久化 |
| Bull | 4.x | 队列监控、重试机制 |
| Puppeteer | 22.x | Chrome最新API支持 |

---

**文档完成时间**: 2026-03-09  
**维护负责人**: 架构组  
**下次评审**: 2026-03-16
