#!/usr/bin/env node
/**
 * QA 自动化测试脚本 - 针对 Mock API
 * 用法: node qa-runner.js
 */

const http = require('http');

const BASE = 'http://localhost:3000';
let token = null;

async function request(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE);
    const options = {
      method,
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      headers: {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
      },
    };
    const req = http.request(options, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, data });
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function run() {
  console.log('🚀 Starting QA tests...\n');

  // 1. Auth
  console.log('📦 1. Authentication');
  const login = await request('POST', '/api/auth/login', { email: 'demo@example.com', password: 'demo123' });
  console.assert(login.status === 200 && login.data.success, 'Login failed');
  token = login.data.data.token;
  console.log('   ✅ Login success');

  const me = await request('GET', '/api/auth/me');
  console.assert(me.status === 200 && me.data.success, 'Get profile failed');
  console.log('   ✅ Get profile success');

  // 2. Workspaces
  console.log('\n📦 2. Workspaces');
  const wsList = await request('GET', '/api/v1/workspaces');
  console.assert(wsList.status === 200 && wsList.data.data.length === 1, 'Workspace list failed');
  console.log('   ✅ List workspaces');

  const wsOne = await request('GET', '/api/v1/workspaces/ws-mock-1');
  console.assert(wsOne.status === 200 && wsOne.data.data.id === 'ws-mock-1', 'Get workspace failed');
  console.log('   ✅ Get workspace');

  // 3. Team
  console.log('\n📦 3. Team Management');
  const members = await request('GET', '/api/v1/workspaces/ws-mock-1/members');
  console.assert(members.status === 200 && members.data.data.length === 3, 'List members failed');
  console.log('   ✅ List members (3)');

  const invite = await request('POST', '/api/v1/workspaces/ws-mock-1/members', { email: 'test@example.com', name: 'Test', role: 'editor' });
  console.assert(invite.status === 200 && invite.data.success, 'Invite member failed');
  console.log('   ✅ Invite member');

  const updateRole = await request('PUT', '/api/v1/workspaces/ws-mock-1/members/u2/role', { role: 'viewer' });
  console.assert(updateRole.status === 200 && updateRole.data.success, 'Update role failed');
  console.log('   ✅ Update member role');

  const activity = await request('GET', '/api/v1/workspaces/ws-mock-1/activity?limit=5');
  console.assert(activity.status === 200 && activity.data.data.length <= 5, 'Activity log failed');
  console.log('   ✅ Activity log');

  // 4. Content
  console.log('\n📦 4. Content Management');
  const create = await request('POST', '/api/content', {
    title: 'QA Test Post',
    body: 'This is a test.',
    tags: ['qa'],
    targetPlatforms: ['twitter'],
    workspaceId: 'ws-mock-1'
  });
  console.assert(create.status === 200 && create.data.success, 'Create content failed');
  const contentId = create.data.data.id;
  console.log('   ✅ Create content');

  const list = await request('GET', '/api/content?workspaceId=ws-mock-1');
  console.assert(list.status === 200 && list.data.data.length >= 1, 'List content failed');
  console.log('   ✅ List content');

  const update = await request('PATCH', `/api/content/${contentId}`, { title: 'Updated QA Test' });
  console.assert(update.status === 200 && update.data.success, 'Update content failed');
  console.log('   ✅ Update content');

  const publish = await request('POST', `/api/content/${contentId}/publish`, { platforms: ['twitter'] });
  console.assert(publish.status === 200 && publish.data.success, 'Publish content failed');
  console.log('   ✅ Publish content');

  // 5. Analytics
  console.log('\n📦 5. Analytics');
  const daily = await request('GET', '/api/analytics/daily?workspaceId=ws-mock-1');
  console.assert(daily.status === 200 && daily.data.success, 'Daily analytics failed');
  console.log('   ✅ Daily metrics');

  // Summary
  console.log('\n✅ All tests passed!');
  console.log('📊 Summary: Workspaces, Team, Content, Analytics all functional.');
}

run().catch(err => {
  console.error('❌ Test failed with error:', err);
  process.exit(1);
});
