# Rate Limiting Implementation Guide

**Week 7 Task**: Add rate limiting to protect API endpoints  
**Dependency**: `@nestjs/throttler`  
**Status**: Configuration prepared, installation pending

---

## 1. Install Dependency

```bash
cd backend
npm install @nestjs/throttler
```

If `npm` fails, try:
```bash
pnpm add @nestjs/throttler
# or use a domestic mirror
npm install @nestjs/throttler --registry=https://registry.npmmirror.com
```

---

## 2. Configure Throttler in `app.module.ts`

Add import:
```typescript
import { ThrottlerModule } from '@nestjs/throttler';
```

In `imports` array:
```typescript
ThrottlerModule.forRoot([
  {
    ttl: 60000, // 1 minute
    limit: 100, // 100 requests per minute (global)
  },
  {
    ttl: 60000,
    limit: 5, // 5 requests per minute for auth endpoints
    prefix: 'auth', // custom prefix to distinguish rules
  },
  {
    ttl: 60000,
    limit: 30, // admin endpoints
    prefix: 'admin',
  },
]),
```

---

## 3. Apply Guards

**Global** (already covered by `forRoot` default), but you can also:

**Route-specific**:
```typescript
import { ThrottlerGuard } from '@nestjs/throttler';
import { UseGuards } from '@nestjs/common';

@UseGuards(ThrottlerGuard)
@Controller('auth')
export class AuthController {
  // endpoints automatically use the global rule
}
```

**Custom prefix** for module:
```typescript
@Controller('admin')
@UseGuards(ThrottlerGuard)
export class AdminController {}
```
Will match the `prefix: 'admin'` rule (if defined).

---

## 4. Rules Matrix

| Endpoint Pattern | Limit | TTL |
|------------------|-------|-----|
| Global (all) | 100 req/min | 60s |
| `POST /api/auth/login` | 5 req/min | 60s |
| `POST /api/auth/register` | 5 req/min | 60s |
| `POST /api/auth/refresh` | 30 req/min | 60s |
| Admin APIs (`/api/admin/*`) | 30 req/min | 60s |

---

## 5. Testing

After installation:
```bash
# Write a simple load test or use curl:
for i in {1..10}; do curl -X POST http://localhost:3000/api/auth/login -H "Content-Type: application/json" -d '{"email":"test@test.com","password":"123"}'; done
```

Should return `429 Too Many Requests` after exceeding limit.

---

## 6. Troubleshooting

- **Guard not applied**: Ensure `ThrottlerGuard` is in `@UseGuards()` or configured globally.
- **Memory leak**: Throttler uses in-memory store by default. For distributed systems, configure Redis store (`@nestjs/throttler` supports Redis via `cache-manager`).
- **False positives**: Check that `prefix` matches the controller route prefix.

---

**Once installed, update the security hardening report and QA checklist.** 🚀
