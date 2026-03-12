import React from 'react';
import { Form, Input, Button, Card, message } from 'antd';
import { UserOutlined, LockOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { authService } from '../services/auth.service';

const Login: React.FC = () => {
  const navigate = useNavigate();
  const onFinish = async (values: { email: string; password: string }) => {
    try {
      await authService.login(values.email, values.password);
      message.success('登录成功');
      navigate('/dashboard');
    } catch (error) {
      message.error('登录失败');
    }
  };
  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
      <Card title="管理员登录" style={{ width: 400 }}>
        <Form onFinish={onFinish} autoComplete="off">
          <Form.Item name="email" rules={[{ required: true, message: '请输入邮箱' }]}>
            <Input prefix={<UserOutlined />} placeholder="邮箱" />
          </Form.Item>
          <Form.Item name="password" rules={[{ required: true, message: '请输入密码' }]}>
            <Input.Password prefix={<LockOutlined />} placeholder="密码" />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" block>
              登录
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
};
export default Login;
