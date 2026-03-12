#!/usr/bin/env node
/**
 * 简易 Mock API 服务器 - 用于验证前端联通性
 * 端口: 3000
 * 提供: /api/v1/workspaces, /api/v1/workspaces/:id/members, /api/v1/workspaces/:id/activity
 */

const http = require('http');

const PORT = 3000;

const workspaceId = 'ws-mock-1';
const mockWorkspace = {
  id: workspaceId,
  name: 'Demo Workspace',
  slug: 'demo-workspace',
  description: 'Mock workspace',
  avatarUrl: null,
  ownerId: 'user-1',
  tenantId: 'default',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const mockMembers = [
  { id: 'u1', email: 'alice@example.com', name: 'Alice', avatarUrl: null, role: 'creator', joinedAt: new Date().toISOString() },
  { id: 'u2', email: 'bob@example.com', name: 'Bob', avatarUrl: null, role: 'admin', joinedAt: new Date().toISOString() },
  { id: 'u3', email: 'charlie@example.com', name: 'Charlie', avatarUrl: null, role: 'editor', joinedAt: new Date().toISOString() },
];

const mockActivities = Array.from({ length: 10 }, (_, i) => ({
  id: `mock-${i}`,
  tenantId: 'default',
  workspaceId,
  userId: `user-${i % 3 + 1}`,
  action: ['member_invited', 'content_created', 'content_published', 'member_role_changed'][i % 4],
  resourceType: 'generic',
  resourceId: null,
  metadata: { mock: true },
  createdAt: new Date(Date.now() - i * 3600000).toISOString(),
}));

const mockUsers = [
  { id: 'u1', email: 'demo@example.com', password: 'demo123', name: 'Demo User', avatarUrl: null, defaultWorkspaceId: workspaceId, roles: ['admin'] },
];

const routes = {
  'POST /api/auth/login': (req, res) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const { email, password } = JSON.parse(body);
        const user = mockUsers.find(u => u.email === email && u.password === password);
        if (!user) {
          res.statusCode = 401;
          return res.json({ success: false, error: 'Invalid credentials' });
        }
        const token = 'mock-jwt-token-' + Date.now();
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({
          success: true,
          data: { token, user: { id: user.id, email: user.email, name: user.name, avatarUrl: user.avatarUrl, defaultWorkspaceId: user.defaultWorkspaceId } },
        }));
      } catch (e) {
        res.statusCode = 400;
        res.json({ success: false, error: 'Invalid JSON' });
      }
    });
    return; // async response
  },
  'GET /api/auth/me': (req) => {
    const auth = req.headers.authorization || '';
    if (!auth.startsWith('Bearer ')) {
      return { success: false, error: 'No token' };
    }
    const user = mockUsers[0];
    return { success: true, data: { id: user.id, email: user.email, name: user.name, avatarUrl: user.avatarUrl, defaultWorkspaceId: user.defaultWorkspaceId } };
  },
  'GET /api/v1/workspaces': () => ({
    success: true,
    data: [mockWorkspace],
  }),
  'GET /api/v1/workspaces/ws-mock-1': () => ({
    success: true,
    data: mockWorkspace,
  }),
  'GET /api/v1/workspaces/ws-mock-1/members': () => ({
    success: true,
    data: mockMembers,
  }),
  'GET /api/v1/workspaces/ws-mock-1/activity': (req, res) => {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const limit = parseInt(url.searchParams.get('limit') || '50', 10);
    const before = url.searchParams.get('before');
    let data = mockActivities;
    if (before) {
      const beforeDate = new Date(before);
      data = mockActivities.filter(a => new Date(a.createdAt) < beforeDate);
    }
    data = data.slice(0, limit);
    res.json({ success: true, data });
  },
  'POST /api/v1/workspaces/ws-mock-1/members': (req) => {
    return { success: true, message: 'Member invited (mock)' };
  },
  'PUT /api/v1/workspaces/ws-mock-1/members/u2/role': (req) => {
    return { success: true, message: 'Member role updated (mock)' };
  },
  'DELETE /api/v1/workspaces/ws-mock-1/members/u3': (req) => {
    return { success: true, message: 'Member removed (mock)' };
  },
  'GET /api/analytics/daily': (req) => {
    const start = new Date();
    start.setDate(start.getDate() - 30);
    const daily = Array.from({ length: 30 }, (_, i) => ({
      id: `mock-${i}`,
      workspaceId,
      date: new Date(start.getTime() + i * 86400000).toISOString().split('T')[0],
      platform: 'twitter',
      postsCount: Math.floor(Math.random() * 10) + 1,
      impressions: Math.floor(Math.random() * 1000) + 100,
      engagement: { total: Math.floor(Math.random() * 100) + 10 },
    }));
    return { success: true, data: daily };
  },
};

const server = http.createServer((req, res) => {
  const key = `${req.method} ${req.url.split('?')[0]}`;
  const handler = routes[key];
  if (handler) {
    try {
      const result = handler(req, res);
      if (result) {
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(result));
      }
    } catch (e) {
      res.statusCode = 500;
      res.end(JSON.stringify({ success: false, error: e.message }));
    }
  } else {
    res.statusCode = 404;
    res.end(JSON.stringify({ success: false, error: 'Not found' }));
  }
});

server.listen(PORT, () => {
  console.log(`🚀 Mock API server running on http://localhost:${PORT}`);
  console.log(`📊 Endpoints:`);
  Object.keys(routes).forEach(k => console.log(`   ${k}`));
});
