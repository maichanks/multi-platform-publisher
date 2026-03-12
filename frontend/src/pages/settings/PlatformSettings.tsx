import React, { useState } from 'react';
import { Card, Form, Input, Button, message, Tabs, Alert } from 'antd';

const PlatformSettings: React.FC = () => {
  const [activeTab, setActiveTab] = useState('xiaohongshu');
  const [loading, setLoading] = useState(false);

  const onSave = async () => {
    setLoading(true);
    try {
      // TODO: 保存配置到后端
      await new Promise((resolve) => setTimeout(resolve, 800));
      message.success('配置已保存（模拟）');
    } catch (error) {
      message.error('保存失败');
    } finally {
      setLoading(false);
    }
  };

  const renderPlatformForm = (platform: string) => {
    switch (platform) {
      case 'xiaohongshu':
        return (
          <>
            <Form.Item name="appId" label="App ID" rules={[{ required: true }]}>
              <Input placeholder="小红书 App ID" />
            </Form.Item>
            <Form.Item name="appSecret" label="App Secret" rules={[{ required: true }]}>
              <Input.Password placeholder="小红书 App Secret" />
            </Form.Item>
            <Form.Item name="loginMode" label="登录方式">
              <Input placeholder="qr 或 credentials" />
            </Form.Item>
          </>
        );
      case 'twitter':
        return (
          <>
            <Form.Item name="apiKey" label="API Key" rules={[{ required: true }]}>
              <Input placeholder="Twitter API Key" />
            </Form.Item>
            <Form.Item name="apiSecret" label="API Secret" rules={[{ required: true }]}>
              <Input.Password placeholder="Twitter API Secret" />
            </Form.Item>
            <Form.Item name="accessToken" label="Access Token">
              <Input placeholder="Twitter Access Token" />
            </Form.Item>
          </>
        );
      case 'linkedin':
        return (
          <>
            <Form.Item name="clientId" label="Client ID" rules={[{ required: true }]}>
              <Input placeholder="LinkedIn Client ID" />
            </Form.Item>
            <Form.Item name="clientSecret" label="Client Secret" rules={[{ required: true }]}>
              <Input.Password placeholder="LinkedIn Client Secret" />
            </Form.Item>
          </>
        );
      case 'reddit':
        return (
          <>
            <Form.Item name="clientId" label="Client ID" rules={[{ required: true }]}>
              <Input placeholder="Reddit Client ID" />
            </Form.Item>
            <Form.Item name="clientSecret" label="Client Secret" rules={[{ required: true }]}>
              <Input.Password placeholder="Reddit Client Secret" />
            </Form.Item>
            <Form.Item name="userAgent" label="User Agent">
              <Input placeholder="Reddit User Agent" />
            </Form.Item>
          </>
        );
      default:
        return <p>平台配置开发中</p>;
    }
  };

  const tabItems = [
    { key: 'xiaohongshu', label: '小红书' },
    { key: 'twitter', label: 'Twitter' },
    { key: 'linkedin', label: 'LinkedIn' },
    { key: 'reddit', label: 'Reddit' },
  ];

  return (
    <Card title="平台设置">
      <Alert
        message="配置说明"
        description="填写各平台的 API 凭证以启用发布功能。完成后点击保存并测试连接。"
        type="info"
        style={{ marginBottom: 16 }}
      />
      <Tabs activeKey={activeTab} onChange={setActiveTab} items={tabItems} />
      <Form layout="vertical" onFinish={onSave} style={{ marginTop: 24 }}>
        {renderPlatformForm(activeTab)}
        <Form.Item>
          <Button type="primary" htmlType="submit" loading={loading}>
            保存配置
          </Button>
          <Button style={{ marginLeft: 8 }} onClick={() => message.info('测试连接功能开发中')}>
            测试连接
          </Button>
        </Form.Item>
      </Form>
    </Card>
  );
};

export default PlatformSettings;
