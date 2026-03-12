import React, { useState } from 'react';
import { Form, Input, Button, Card, message, Select } from 'antd';
import { useNavigate } from 'react-router-dom';

const { TextArea } = Input;

const ContentCreate: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const onFinish = async (values: { title: string; content: string; tags?: string[]; platform: string }) => {
    setLoading(true);
    try {
      // TODO: 实际调用后端 API 创建内容
      console.log('Creating content:', values);
      await new Promise((resolve) => setTimeout(resolve, 1000));
      message.success('内容创建成功（模拟）');
      navigate('/content');
    } catch (error) {
      message.error('创建失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card title="创建内容">
      <Form layout="vertical" onFinish={onFinish}>
        <Form.Item name="title" label="标题" rules={[{ required: true, message: '请输入标题' }]}>
          <Input placeholder="内容标题" />
        </Form.Item>
        <Form.Item name="content" label="正文" rules={[{ required: true, message: '请输入正文' }]}>
          <TextArea rows={12} placeholder="内容正文（支持富文本标记）" />
        </Form.Item>
        <Form.Item name="tags" label="标签">
          <Select mode="tags" placeholder="添加标签">
            <Select.Option value="科技">科技</Select.Option>
            <Select.Option value="生活">生活</Select.Option>
            <Select.Option value="娱乐">娱乐</Select.Option>
          </Select>
        </Form.Item>
        <Form.Item name="platform" label="发布平台">
          <Select placeholder="选择目标平台">
            <Select.Option value="xiaohongshu">小红书</Select.Option>
            <Select.Option value="twitter">Twitter</Select.Option>
            <Select.Option value="linkedin">LinkedIn</Select.Option>
            <Select.Option value="reddit">Reddit</Select.Option>
          </Select>
        </Form.Item>
        <Form.Item>
          <Button type="primary" htmlType="submit" loading={loading} block>
            创建内容
          </Button>
        </Form.Item>
      </Form>
    </Card>
  );
};

export default ContentCreate;
