# Week 6 Mock 模式测试指南

## 环境配置

1. **确保 backend/.env 存在** 并包含 `MOCK_MODE=true`
2. **启动后端**：
   ```bash
   cd backend
   npm run start:dev
   ```
   等待编译完成，看到 `Application is running on: http://localhost:3000` 即可。

3. **启动前端**（独立运行，不需要后端打包）：
   ```bash
   cd frontend
   npm run dev
   ```
   或直接打开 `frontend/preview.html`（使用 CDN 单文件，但需配置 API 代理）

## 测试团队管理页面

1. 打开浏览器访问：`http://localhost:5173/login`（前端开发服务器默认端口 5173）
2. 登录：使用任意邮箱和密码（前端为演示模式，实际会调用 `/api/auth/login`，需后端提供 mock 登录）
   - 如果后端 mock 模式尚未实现登录，可暂时在 localStorage 手动设置 token：
     ```js
     localStorage.setItem('token', 'dev-token');
     localStorage.setItem('user', JSON.stringify({ id: 'u1', email: 'demo@example.com', defaultWorkspaceId: 'ws-mock-1' }));
     ```
3. 访问仪表盘：`http://localhost:5173/dashboard`
4. 进入团队管理：`http://localhost:5173/team/ws-mock-1`
   - 应看到成员列表（Alice, Bob, Charlie）
   - 邀请成员（输入邮箱，选择角色）
   - 修改角色（dropdown）
   - 移除成员
   - 活动日志面板（滚动显示 mock 活动）

## 后端 Mock 端点验证

- `GET /api/v1/workspaces` → 返回 mock workspace
- `GET /api/v1/workspaces/ws-mock-1/members` → 返回 mock 成员
- `GET /api/v1/workspaces/ws-mock-1/activity?limit=10` → 返回 mock 活动
- `POST /api/v1/workspaces/ws-mock-1/members` → 邀请（mock）
- `PUT /api/v1/workspaces/ws-mock-1/members/:userId/role` → 改角色（mock）
- `GET /api/analytics/daily?workspaceId=ws-mock-1&startDate=...&endDate=...` → mock 指标

## 常见问题

**Q: 登录失败 / 401**
A: Mock 模式尚未实现登录端点。手动在 localStorage 设置 token 和 user 对象（如上）。

**Q: 后端未编译通过**
A: 确保 `backend/tsconfig.json` 存在，且依赖安装完整（`node_modules` 包含 nest 相关包）。

**Q: 前端 API 请求 404**
A: 检查前端 `src/services/api.ts` 或环境变量 `VITE_API_URL` 是否指向 `http://localhost:3000`。

## 下一步

- 完善 mock 登录端点
- 集成前端 UI 与后端 mock 数据
- 添加更多自动化测试

---

**祝测试顺利！** 🚀
