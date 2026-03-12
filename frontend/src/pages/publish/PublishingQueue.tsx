import React from 'react';
import { Card, List, Tag, Button, Progress } from 'antd';
import { ClockCircleOutlined, CheckCircleOutlined, ExclamationCircleOutlined } from '@ant-design/icons';

const PublishingQueue: React.FC = () => {
  const jobs = [
    { id: '1', title: '示例发布任务', status: 'pending', progress: 0 },
    { id: '2', title: '另一任务', status: 'processing', progress: 45 },
    { id: '3', title: '已完成任务', status: 'completed', progress: 100 },
  ];

  const statusMap: Record<string, { color: string; icon: React.ReactNode; text: string }> = {
    pending: { color: 'default', icon: <ClockCircleOutlined />, text: '等待中' },
    processing: { color: 'processing', icon: <ExclamationCircleOutlined />, text: '处理中' },
    completed: { color: 'success', icon: <CheckCircleOutlined />, text: '已完成' },
  };

  return (
    <Card title="发布队列">
      <List
        itemLayout="horizontal"
        dataSource={jobs}
        renderItem={(job) => {
          const status = statusMap[job.status];
          return (
            <List.Item
              actions={[
                <Button key="cancel" size="small" type="link">取消</Button>,
                <Button key="retry" size="small" type="link">重试</Button>,
              ]}
            >
              <List.Item.Meta
                avatar={status.icon}
                title={job.title}
                description={<Tag color={status.color}>{status.text}</Tag>}
              />
              {job.status === 'processing' && <Progress percent={job.progress} />}
            </List.Item>
          );
        }}
      />
    </Card>
  );
};

export default PublishingQueue;
