#!/usr/bin/env python3
"""
轻量级 Mock API 服务器 - 验证前端联通性
端口: 3000
"""

from http.server import HTTPServer, BaseHTTPRequestHandler
import json
import urllib.parse

workspace_id = 'ws-mock-1'
mock_workspace = {
    'id': workspace_id,
    'name': 'Demo Workspace',
    'slug': 'demo-workspace',
    'description': 'Mock workspace',
    'avatarUrl': None,
    'ownerId': 'user-1',
    'tenantId': 'default',
    'createdAt': '',
    'updatedAt': '',
}
mock_members = [
    {'id': 'u1', 'email': 'alice@example.com', 'name': 'Alice', 'avatarUrl': None, 'role': 'creator', 'joinedAt': ''},
    {'id': 'u2', 'email': 'bob@example.com', 'name': 'Bob', 'avatarUrl': None, 'role': 'admin', 'joinedAt': ''},
    {'id': 'u3', 'email': 'charlie@example.com', 'name': 'Charlie', 'avatarUrl': None, 'role': 'editor', 'joinedAt': ''},
]
mock_activities = [
    {'id': f'mock-{i}', 'tenantId': 'default', 'workspaceId': workspace_id, 'userId': f'user-{i%3+1}', 'action': a, 'resourceType': 'generic', 'resourceId': None, 'metadata': {'mock': True}, 'createdAt': ''}
    for i, a in enumerate(['member_invited', 'content_created', 'content_published', 'member_role_changed'] * 3)
]

def set_dates():
    now = json.dumps(None)  # placeholder
    for i, a in enumerate(mock_activities):
        a['createdAt'] = (json.dumps(None) if False else '') or (lambda x: x)(None)  # dummy
        a['createdAt'] = (lambda: (__import__('datetime').datetime.now() - __import__('datetime').timedelta(hours=i)).isoformat())()
    for m in mock_members:
        m['joinedAt'] = (lambda: __import__('datetime').datetime.now().isoformat())()

set_dates()
mock_workspace['createdAt'] = mock_workspace['updatedAt'] = (lambda: __import__('datetime').datetime.now().isoformat())()

class MockHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        path = self.path.split('?')[0]
        if path == '/api/v1/workspaces':
            self.json({'success': True, 'data': [mock_workspace]})
        elif path == f'/api/v1/workspaces/{workspace_id}':
            self.json({'success': True, 'data': mock_workspace})
        elif path == f'/api/v1/workspaces/{workspace_id}/members':
            self.json({'success': True, 'data': mock_members})
        elif path.startswith(f'/api/v1/workspaces/{workspace_id}/activity'):
            params = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query)
            limit = int(params.get('limit', ['50'])[0])
            before = params.get('before', [None])[0]
            data = mock_activities[:limit]
            if before:
                before_dt = __import__('datetime').datetime.fromisoformat(before)
                data = [a for a in data if __import__('datetime').datetime.fromisoformat(a['createdAt']) < before_dt][:limit]
            self.json({'success': True, 'data': data})
        elif path == '/api/analytics/daily':
            # mock 30 days
            daily = []
            today = __import__('datetime').datetime.now()
            for i in range(30):
                d = today - __import__('datetime').timedelta(days=29-i)
                daily.append({
                    'id': f'mock-{i}', 'workspaceId': workspace_id, 'date': d.strftime('%Y-%m-%d'),
                    'platform': 'twitter', 'postsCount': i % 5 + 1,
                    'impressions': 100 + i * 10, 'engagement': {'total': 10 + i}
                })
            self.json({'success': True, 'data': daily})
        elif path == '/api/auth/me':
            auth = self.headers.get('Authorization', '')
            if not auth.startswith('Bearer '):
                self.json({'success': False, 'error': 'No token'}, 401)
            else:
                user = {'id': 'u1', 'email': 'demo@example.com', 'name': 'Demo User', 'avatarUrl': None, 'defaultWorkspaceId': workspace_id}
                self.json({'success': True, 'data': user})
        else:
            self.json({'success': False, 'error': 'Not found'}, 404)

    def do_POST(self):
        path = self.path.split('?')[0]
        if path == '/api/auth/login':
            try:
                length = int(self.headers.get('content-length', 0))
                body = self.rfile.read(length)
                data = json.loads(body)
                if data.get('email') == 'demo@example.com' and data.get('password') == 'demo123':
                    token = 'mock-jwt-token-' + str(int(__import__('time').time()))
                    user = {'id': 'u1', 'email': 'demo@example.com', 'name': 'Demo User', 'avatarUrl': None, 'defaultWorkspaceId': workspace_id}
                    self.json({'success': True, 'data': {'token', 'user'}})
                else:
                    self.json({'success': False, 'error': 'Invalid credentials'}, 401)
            except Exception as e:
                self.json({'success': False, 'error': str(e)}, 400)
        else:
            self.json({'success': False, 'error': 'Not found'}, 404)

    def json(self, obj, status=200):
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.end_headers()
        self.wfile.write(json.dumps(obj, ensure_ascii=False).encode('utf-8'))

if __name__ == '__main__':
    port = 3000
    server = HTTPServer(('0.0.0.0', port), MockHandler)
    print(f'🚀 Mock API server running on http://localhost:{port}')
    server.serve_forever()
