# 部署架构

**文档签名**: maichanks <hankan1993@gmail.com>

## 部署策略总体

**目标**:
- 开发环境: 快速启动，1分钟内完整环境
- 生产初期: 单服务器Docker Compose，<5000用户
- 生产增长期: Kubernetes微服务，<50000用户
- 零停机更新: 滚动更新、蓝绿部署

**服务器规格** (单服务器阶段):

| 配置 | 推荐 | 最低 |
|------|------|------|
| CPU | 8核 | 4核 |
| RAM | 32GB | 16GB |
| 磁盘 | 500GB SSD | 200GB SSD |
| 带宽 | 100Mbps | 50Mbps |
| 操作系统 | Ubuntu 22.04 LTS | Debian 11 |

## 1. 开发环境 - Docker Compose

### 目录结构

```
.
├── docker-compose.yml
├── docker-compose.override.yml  # 开发机特定覆盖
├── .env                        # 开发环境变量
├── .env.example
├── docker/
│   ├── backend/
│   │   └── Dockerfile
│   ├── frontend/
│   │   └── Dockerfile
│   └── nginx/
│       └── Dockerfile
├── backend/
├── frontend/
├── prisma/
└── scripts/
```

### docker-compose.yml (开发)

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:15-alpine
    container_name: mp-postgres
    environment:
      POSTGRES_USER: ${POSTGRES_USER:-mp_user}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: ${POSTGRES_DB:-mp_publisher_dev}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER:-mp_user}"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    container_name: mp-redis
    command: redis-server --appendonly yes
    volumes:
      - redis_data:/data
    ports:
      - "6379:6379"
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s

  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    container_name: mp-backend
    environment:
      DATABASE_URL: postgresql://${POSTGRES_USER:-mp_user}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB:-mp_publisher_dev}?schema=public
      REDIS_URL: redis://redis:6379
      ENCRYPTION_KEY: ${ENCRYPTION_KEY}
      OPENROUTER_API_KEY: ${OPENROUTER_API_KEY}
      NODE_ENV: development
    volumes:
      - ./backend:/app
      - /app/node_modules
      - ./prisma:/app/prisma
    ports:
      - "3000:3000"
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    command: npm run start:dev  # 热重载

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    container_name: mp-frontend
    environment:
      VITE_API_URL: http://localhost:3000
    volumes:
      - ./frontend:/app
      - /app/node_modules
    ports:
      - "5173:5173"
    depends_on:
      - backend

  pgadmin:
    image: dpage/pgadmin4
    container_name: mp-pgadmin
    environment:
      PGADMIN_DEFAULT_EMAIL: admin@example.com
      PGADMIN_DEFAULT_PASSWORD: admin
    volumes:
      - pgadmin_data:/var/lib/pgadmin
    ports:
      - "8080:80"
    profiles: ["tools"]  # 按需启动

volumes:
  postgres_data:
  redis_data:
  pgadmin_data:
```

### 前端Dockerfile (开发)

```dockerfile
# frontend/Dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY package*.json ./
RUN npm ci --only=production
EXPOSE 5173
CMD ["npm", "run", "preview"]
```

### 后端Dockerfile

```dockerfile
# backend/Dockerfile
FROM node:20-alpine

WORKDIR /app

# 复制依赖文件
COPY package*.json ./
RUN npm ci --only=production

# 复制源代码
COPY . .

# Prisma生成客户端
RUN npx prisma generate

# 暴露端口
EXPOSE 3000

CMD ["node", "dist/main"]
```

### 启动开发环境

```bash
# 1. 克隆项目
git clone <repo>
cd multi-platform-publisher

# 2. 复制环境配置
cp .env.example .env
# 编辑.env，填写ENCRYPTION_KEY、OPENROUTER_API_KEY等

# 3. 启动所有服务
docker-compose up -d

# 4. 运行数据库迁移
docker-compose exec backend npx prisma migrate deploy

# 5. 种子数据（可选）
docker-compose exec backend npx prisma db seed

# 查看日志
docker-compose logs -f backend

# 停止
docker-compose down
```

## 2. 生产环境 - 单服务器 Docker Compose

### docker-compose.prod.yml

```yaml
version: '3.8'

services:
  nginx:
    image: nginx:alpine
    container_name: mp-nginx
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./docker/nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./docker/nginx/ssl:/etc/nginx/ssl:ro  # Let's Encrypt证书
      - ./frontend/dist:/usr/share/nginx/html:ro  # 静态前端
      - ./logs/nginx:/var/log/nginx
    depends_on:
      - backend
    restart: always

  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile.prod
    container_name: mp-backend
    environment:
      NODE_ENV: production
      DATABASE_URL: ${DATABASE_URL}
      REDIS_URL: ${REDIS_URL}
      ENCRYPTION_KEY: ${ENCRYPTION_KEY}
      OPENROUTER_API_KEY: ${OPENROUTER_API_KEY}
      # OAuth secrets
      OAUTH_TWITTER_CLIENT_ID: ${OAUTH_TWITTER_CLIENT_ID}
      OAUTH_TWITTER_CLIENT_SECRET: ${OAUTH_TWITTER_CLIENT_SECRET}
      # ...
      LOG_LEVEL: info
    volumes:
      - ./logs/backend:/app/logs
      - ./backups:/app/backups  # 备份目录挂载
    restart: always
    # 资源限制
    deploy:
      resources:
        limits:
          cpus: '4'
          memory: 8G
        reservations:
          cpus: '2'
          memory: 4G
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

  postgres:
    image: postgres:15-alpine
    container_name: mp-postgres
    environment:
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./backups/postgres:/backups
      - ./docker/postgres/backup.sh:/docker-entrypoint-initdb.d/backup.sh
    command: >
      postgres 
      -c max_connections=200
      -c shared_buffers=4GB
      -c effective_cache_size=12GB
      -c maintenance_work_mem=256MB
      -c wal_buffers=16MB
      -c default_statistics_target=100
    restart: always
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER}"]
      interval: 30s

  redis:
    image: redis:7-alpine
    container_name: mp-redis
    command: redis-server --maxmemory 8gb --maxmemory-policy allkeys-lru --save 60 1 --appendonly yes
    volumes:
      - redis_data:/data
    restart: always
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 30s

  bull-board:
    image:自行构建/bull-board:latest  # 可选： bull-board监控面板
    container_name: mp-bull-board
    environment:
      REDIS_URL: redis://redis:6379
      PORT: 3000
    ports:
      - "3010:3000"  # 内部访问
    restart: always

volumes:
  postgres_data:
  redis_data:
```

### Nginx配置

```nginx
# docker/nginx/nginx.conf
events {
  worker_connections 1024;
}

http {
  upstream backend {
    server backend:3000;
  }

  # 限流 - 全局
  limit_req_zone $binary_remote_addr zone=global:10m rate=10r/s;
  limit_req_zone $server_name zone=server:10m rate=100r/s;

  # 日志格式
  log_format json_combined escape=json
    '{"time_local":"$time_local",'
    '"remote_addr":"$remote_addr",'
    '"request":"$request",'
    '"status":"$status",'
    '"body_bytes_sent":"$body_bytes_sent",'
    '"request_time":"$request_time",'
    '"http_referrer":"$http_referer",'
    '"http_user_agent":"$http_user_agent"}';

  access_log /var/log/nginx/access.log json_combined;
  error_log /var/log/nginx/error.log warn;

  # 启用gzip压缩
  gzip on;
  gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;

  # HTTP重定向到HTTPS
  server {
    listen 80;
    server_name app.multiplatform.publisher;
    return 301 https://$server_name$request_uri;
  }

  # HTTPS主要配置
  server {
    listen 443 ssl http2;
    server_name app.multiplatform.publisher;

    ssl_certificate /etc/nginx/ssl/fullchain.pem;
    ssl_certificate_key /etc/nginx/ssl/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512;

    # 安全头
    add_header X-Frame-Options SAMEORIGIN;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    add_header Referrer-Policy "strict-origin-when-cross-origin";

    location / {
      proxy_pass http://backend;
      proxy_http_version 1.1;
      proxy_set_header Upgrade $http_upgrade;
      proxy_set_header Connection 'upgrade';
      proxy_set_header Host $host;
      proxy_cache_bypass $http_upgrade;
      proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
      proxy_set_header X-Forwarded-Proto $scheme;
      
      # 限流应用
      limit_req zone=server burst=20 nodelay;
    }

    location /health {
      proxy_pass http://backend/health;
      access_log off;  # 不记录健康检查日志
    }

    location /metrics {
      proxy_pass http://backend/metrics;
      allow 10.0.0.0/8;  # 仅内网监控系统
      deny all;
    }

    # 静态文件缓存
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
      expires 1y;
      add_header Cache-Control "public, immutable";
      root /usr/share/nginx/html;
    }
  }
}
```

### Let's Encrypt自动配置

```bash
# 使用certbot获取证书
certbot certonly \
  --nginx \
  -d app.multiplatform.publisher \
  --email admin@example.com \
  --agree-tos \
  --no-eff-email

# 自动续期（crontab）
0 3 * * * certbot renew --quiet --post-hook "docker-compose -f /path/to/docker-compose.prod.yml restart nginx"
```

## 3. Kubernetes 部署

### K8s清单结构

```
k8s/
├── base/
│   ├── namespace.yaml
│   ├── configmap.yaml
│   ├── secret.yaml (加密)
│   ├── pvc.yaml
│   ├── postgres.yaml
│   ├── redis.yaml
│   └── backend.yaml
├── overlays/
│   ├── production/
│   │   ├── kustomization.yaml
│   │   ├── configmap-patch.yaml
│   │   └── hpa.yaml
│   └── staging/
└── ingress.yaml
```

**使用Kustomize管理环境差异**.

### 基础部署 (base/)

```yaml
# k8s/base/namespace.yaml
apiVersion: v1
kind: Namespace
metadata:
  name: mp-publisher
  labels:
    name: mp-publisher
```

```yaml
# k8s/base/configmap.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: mp-config
  namespace: mp-publisher
data:
  NODE_ENV: "production"
  DATABASE_URL: "postgresql://mp_user:${POSTGRES_PASSWORD}@postgres.mp-publisher.svc.cluster.local:5432/mp_publisher?schema=public"
  REDIS_URL: "redis://redis-master.mp-publisher.svc.cluster.local:6379"
  LOG_LEVEL: "info"
```

```yaml
# k8s/base/secret.yaml
apiVersion: v1
kind: Secret
metadata:
  name: mp-secrets
  namespace: mp-publisher
type: Opaque
stringData:
  ENCRYPTION_KEY: ${ENCRYPTION_KEY}
  OPENROUTER_API_KEY: ${OPENROUTER_API_KEY}
  OAUTH_TWITTER_CLIENT_ID: ${OAUTH_TWITTER_CLIENT_ID}
  OAUTH_TWITTER_CLIENT_SECRET: ${OAUTH_TWITTER_CLIENT_SECRET}
  POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
```

```yaml
# k8s/base/postgres.yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: postgres-pvc
  namespace: mp-publisher
spec:
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 100Gi
---
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: postgres
  namespace: mp-publisher
spec:
  serviceName: postgres
  replicas: 1
  selector:
    matchLabels:
      app: postgres
  template:
    metadata:
      labels:
        app: postgres
    spec:
      containers:
        - name: postgres
          image: postgres:15-alpine
          env:
            - name: POSTGRES_USER
              valueFrom:
                configMapKeyRef:
                  name: mp-config
                  key: POSTGRES_USER
            - name: POSTGRES_PASSWORD
              valueFrom:
                secretKeyRef:
                  name: mp-secrets
                  key: POSTGRES_PASSWORD
            - name: POSTGRES_DB
              value: "mp_publisher"
          ports:
            - containerPort: 5432
          volumeMounts:
            - name: postgres-data
              mountPath: /var/lib/postgresql/data
          resources:
            requests:
              memory: "2Gi"
              cpu: "1000m"
            limits:
              memory: "4Gi"
              cpu: "2000m"
      volumes:
        - name: postgres-data
          persistentVolumeClaim:
            claimName: postgres-pvc
---
apiVersion: v1
kind: Service
metadata:
  name: postgres
  namespace: mp-publisher
spec:
  ports:
    - port: 5432
      targetPort: 5432
  selector:
    app: postgres
  type: ClusterIP
```

```yaml
# k8s/base/redis.yaml (使用Bitnami Redis Helm或手动部署)
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: redis-master
  namespace: mp-publisher
spec:
  serviceName: redis-master
  replicas: 1
  selector:
    matchLabels:
      app: redis
      role: master
  template:
    metadata:
      labels:
        app: redis
        role: master
    spec:
      containers:
        - name: redis
          image: redis:7-alpine
          command: ["redis-server", "--appendonly", "yes", "--maxmemory", "4gb", "--maxmemory-policy", "allkeys-lru"]
          ports:
            - containerPort: 6379
          volumeMounts:
            - name: redis-data
              mountPath: /data
          resources:
            requests:
              memory: "2Gi"
              cpu: "500m"
            limits:
              memory: "4Gi"
              cpu: "1000m"
      volumes:
        - name: redis-data
          emptyDir: {}  # 生产环境用PVC或云存储
---
apiVersion: v1
kind: Service
metadata:
  name: redis-master
  namespace: mp-publisher
spec:
  ports:
    - port: 6379
      targetPort: 6379
  selector:
    app: redis
    role: master
  type: ClusterIP
```

```yaml
# k8s/base/backend.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: backend
  namespace: mp-publisher
spec:
  replicas: 3
  selector:
    matchLabels:
      app: backend
  template:
    metadata:
      labels:
        app: backend
    spec:
      containers:
        - name: backend
          image: ${BACKEND_IMAGE:-mp-backend:latest}
          imagePullPolicy: IfNotPresent
          ports:
            - containerPort: 3000
          envFrom:
            - configMapRef:
                name: mp-config
            - secretRef:
                name: mp-secrets
          readinessProbe:
            httpGet:
              path: /health
              port: 3000
            initialDelaySeconds: 30
            periodSeconds: 10
            timeoutSeconds: 5
            failureThreshold: 3
          livenessProbe:
            httpGet:
              path: /health
              port: 3000
            initialDelaySeconds: 60
            periodSeconds: 20
            timeoutSeconds: 10
            failureThreshold: 3
          resources:
            requests:
              memory: "1Gi"
              cpu: "500m"
            limits:
              memory: "2Gi"
              cpu: "1000m"
---
apiVersion: v1
kind: Service
metadata:
  name: backend
  namespace: mp-publisher
spec:
  selector:
    app: backend
  ports:
    - port: 3000
      targetPort: 3000
  type: ClusterIP
```

### Horizontal Pod Autoscaler (HPA)

```yaml
# k8s/overlays/production/hpa.yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: backend-hpa
  namespace: mp-publisher
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: backend
  minReplicas: 3
  maxReplicas: 10
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70
    - type: Resource
      resource:
        name: memory
        target:
          type: Utilization
          averageUtilization: 80
    # 自定义指标 - 基于队列长度（需安装Prometheus Adapter）
    - type: External
      external:
        metric:
          name: bull_queue_length
        target:
          type: AverageValue
          averageValue: 100
```

### Ingress (Nginx Ingress Controller)

```yaml
# k8s/ingress.yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: mp-ingress
  namespace: mp-publisher
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod
    nginx.ingress.kubernetes.io/rewrite-target: /
    nginx.ingress.kubernetes.io/limit-rps: "100"
spec:
  tls:
    - hosts:
        - app.multiplatform.publisher
      secretName: mp-tls
  rules:
    - host: app.multiplatform.publisher
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: backend
                port:
                  number: 3000
```

### 部署命令

```bash
# 构建并推送镜像
docker build -t registry.example.com/mp-backend:1.0.0 ./backend
docker push registry.example.com/mp-backend:1.0.0

# 设置环境变量
export BACKEND_IMAGE=registry.example.com/mp-backend:1.0.0
export ENCRYPTION_KEY=$(openssl rand -base64 32)
export POSTGRES_PASSWORD=$(openssl rand -base64 32)
# ... 其他secret

# 创建命名空间和基础资源
kubectl apply -f k8s/base/

# 应用生产配置覆盖
kustomize build k8s/overlays/production | kubectl apply -f -

# 等待部署完成
kubectl rollout status deployment/backend -n mp-publisher

# 验证服务
kubectl get pods,svc -n mp-publisher
```

## 4. 备份与恢复

### PostgreSQL备份

**每日自动全量备份 + WAL归档**:

```bash
# docker/postgres/backup.sh
#!/bin/bash
set -e

BACKUP_DIR="/backups/postgres"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/full_${DATE}.dump"

# 全量备份
pg_dump -Fc -U ${POSTGRES_USER} mp_publisher > ${BACKUP_FILE}

# 上传到云存储（阿里云OSS、AWS S3、Backblaze B2）
aws s3 cp ${BACKUP_FILE} s3://mp-backups/postgres/full_${DATE}.dump

# 清理7天前的本地备份
find ${BACKUP_DIR} -name "*.dump" -mtime +7 -delete

# 备份元数据记录
echo "${DATE}:${BACKUP_FILE}" >> /backups/backup_index.log
```

**crontab**:
```
0 2 * * * docker-compose -f /opt/mp-publisher/docker-compose.prod.yml exec postgres /docker-entrypoint-initdb.d/backup.sh
```

### Redis备份

Redis RDB文件（默认每小时）自动持久化到云存储:

```bash
# redis.conf 配置
save 3600 1
save 300 10
save 60 10000
dir /data
rdbcompression yes
```

```bash
# 备份脚本
redis-cli save  # 手动触发BGSAVE
cp /data/dump.rdb /backups/redis/dump_$(date +%Y%m%d).rdb
```

### 恢复流程

**PostgreSQL恢复**:

```bash
# 1. 停止应用（避免写入冲突）
docker-compose stop backend

# 2. 恢复最新备份
pg_restore -U mp_user -d mp_publisher /backups/postgres/full_20250309_020000.dump

# 3. 如果有WAL归档，重放至最新
# pg_wal目录下应用归档

# 4. 重启应用
docker-compose start backend
```

**Redis恢复**:

```bash
# 停止Redis
docker-compose stop redis

# 替换RDB文件
cp /backups/redis/dump_20250308.rdb /var/lib/redis/dump.rdb

# 重启Redis自动加载
docker-compose start redis
```

## 5. 监控与告警

### 应用指标 (Prometheus + Grafana)

后端使用`@nestjs/prometheus`暴露指标:

```typescript
// metrics.module.ts
import { PrometheusModule } from '@willsoto/nestjs-prometheus';

@Module({
  imports: [
    PrometheusModule.register({
      path: '/metrics',
      collectDefaultMetrics: {
        prefix: 'mp_',
        config: {
          cpu: true,
          mem: true,
          heap: true,
          gc: true,
        },
      },
    }),
  ],
})
export class MetricsModule {}
```

**核心指标**:
- `http_requests_total` (method, route, status_code)
- `http_request_duration_seconds` (buckets)
- `content_published_total` (platform, status)
- `ai_adaptation_cost_cents` (model)
- `queue_job_duration_seconds` (queue, status)
- `database_query_duration_seconds` (query_type)
- `redis_hits_total`, `redis_misses_total`
- `rate_limit_triggered_total` (endpoint)

### 系统指标

Node Exporter (K8s DaemonSet):
- CPU、内存、磁盘、网络

PostgreSQL Exporter:
- 连接数、慢查询、复制延迟、缓冲命中率

Redis Exporter:
- 内存使用、命中率、键数量

### Grafana仪表板

导入社区模板 + 自定义仪表板:

1. **应用健康** (请求量、错误率、延迟)
2. **发布成功率** (按平台)
3. **AI成本趋势** (按天、模型)
4. **队列深度** (Bull队列长度、处理速度)
5. **数据库性能** (QPS、慢查询、连接池)

### 告警规则 (Alertmanager)

```yaml
# alerts.yml
groups:
  - name: mp-publisher-alerts
    rules:
      - alert: HighErrorRate
        expr: rate(http_requests_total{status=~"5.."}[5m]) / rate(http_requests_total[5m]) > 0.05
        for: 2m
        labels:
          severity: critical
        annotations:
          summary: "错误率超过5%"
          description: "应用 {{ $labels.app }} 错误率 {{ $value }}"

      - alert: QueueBacklog
        expr: bull_queue_length > 1000
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "发布队列积压超过1000"
          description: "队列 {{ $labels.queue }} 长度 {{ $value }}"

      - alert: DatabaseDown
        expr: up{job="postgres"} == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "PostgreSQL宕机"

      - alert: HighAICost
        expr: sum(rate(ai_adaptation_cost_cents[1d])) * 1440 > 10000  # 日成本>100美元
        for: 1h
        labels:
          severity: warning
        annotations:
          summary: "AI成本超预算"
          description: "日成本 {{ $value }} 美分"
```

## 6. 日志管理

### 集中日志 (ELK / Loki)

**方案选择**:
- **ELK** (Elasticsearch + Logstash + Kibana): 功能全但重
- **Grafana Loki**: 轻量，与现有监控栈集成好

**选择Loki**:

```yaml
# docker-compose.prod.yml 添加
loki:
  image: grafana/loki:latest
  ports:
    - "3100:3100"
  command: -config.file=/etc/loki/local-config.yaml
  volumes:
    - ./docker/loki:/etc/loki
    - loki_data:/loki
```

应用日志输出为JSON格式，直接写入stdout，由Docker日志驱动收集。

```typescript
// Winston配置为控制台输出（K8s会自动收集stdout）
transports: [
  new transports.Console({
    format: winston.format.json(),
  }),
]
```

**Grafana配置Loki数据源**:
- 查询日志: `{namespace="mp-publisher", app="backend"}`
- 创建警报: Loki Ruler

## 7. 备份策略总结

| 数据源 | 频率 | 保留期 | 存储位置 | 恢复RTO |
|--------|------|--------|----------|---------|
| PostgreSQL全量 | 每日2AM | 30天 | 云存储(OSS/S3) | <1小时 |
| PostgreSQL WAL | 持续 | 7天 | 云存储 | <15分钟（Point-in-Time Recovery） |
| Redis RDB | 每小时 | 7天 | 云存储 | <10分钟 |
| 应用日志 | 轮转（每天） | 30天 | 本地 + Loki | n/a |
| 静态文件（用户上传媒体） | 实时同步 | 永久 | 云存储(OSS/CDN) | 即时 |

**恢复演练**: 每季度一次全量恢复测试，验证备份有效性。

## 8. 扩展性规划

### 水平扩展

**无状态层** (Backend, Frontend):
- K8s HPA自动扩缩
- 前端直接走CDN，无需应用服务器

**有状态层**:
- **PostgreSQL**: 主-从复制，读流量分流到只读副本
- **Redis**: Cluster模式（16384 slots），需3主3从
- ** Bull队列**: 使用Redis Cluster，队列共享

### 垂直扩展

- 单服务器配置升级（CPU、内存、磁盘）
- PostgreSQL参数调优（`shared_buffers`, `work_mem`）
- 应用层缓存优化（Redis内存增加）

### 微服务拆分（5000+用户）

按功能拆分:

```
┌─────────────┐
│   Ingress   │
└──────┬──────┘
       │
  ┌────┴─────────────┐
  │   API Gateway    │  (Kong/Traefik - 认证、限流、路由)
  └────┬─────────────┘
       │
  ┌────┼─────────────────────────────┐
  │    │                             │
  ▼    ▼                             ▼
Core  Publisher                    Analytics
(用户/工作区)                    (独立分析服务)
```

**拆分顺序**:
1. 将发布引擎（Publisher）拆分为独立服务（高I/O）
2. 将分析计算（Analytics）拆分为独立服务（CPU密集型）
3. 将AI适配（AI Service）拆分为独立服务（大模型调用）

### 数据分区

当单库超过1亿行:

- **Content表按workspace_id哈希分表**: `content_{hash}`（最多1024张表）
- **AnalyticsEvent按月分区**: `analytics_event_202503`
- **AuditLog归档到对象存储**: 仅保留热数据在DB

应用层通过`Prisma`的`$queryRaw`处理跨分片查询（或迁移到ClickHouse/BigQuery）。

---

**文档维护**: 运维团队  
**最后更新**: 2026-03-09  
**紧急联系**: devops@example.com
