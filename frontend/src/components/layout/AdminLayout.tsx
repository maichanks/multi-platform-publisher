import React from 'react';
import { Layout, Menu } from 'antd';
import { Outlet, useLocation } from 'react-router-dom';

const { Header, Sider, Content } = Layout;

export const AdminLayout: React.FC = () => {
  const location = useLocation();
  const menuItems = [
    { key: '/dashboard', label: '仪表盘' },
    { key: '/content', label: '内容管理' },
    { key: '/publish', label: '发布队列' },
    { key: '/settings/platforms', label: '平台设置' },
  ];
  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider theme="dark">
        <div style={{ height: 32, margin: 16, background: 'rgba(255,255,255,0.2)' }} />
        <Menu theme="dark" selectedKeys={[location.pathname]} items={menuItems} mode="inline" />
      </Sider>
      <Layout>
        <Header style={{ background: '#fff', padding: 0 }} />
        <Content style={{ margin: '24px 16px', padding: 24, background: '#fff', minHeight: 280 }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
};
