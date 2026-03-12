import React, { useState } from 'react';
import { Table, Button, Space, Popconfirm, message } from 'antd';
import { DeleteOutlined, EditOutlined } from '@ant-design/icons';

interface ContentItem {
  id: string;
  title: string;
  status: 'draft' | 'published' | 'scheduled';
  createdAt: string;
}

const ContentList: React.FC = () => {
  const [data] = useState<ContentItem[]>([
    { id: '1', title: '示例内容', status: 'draft', createdAt: '2026-03-10' },
  ]);

  const columns = [
    { title: 'ID', dataIndex: 'id', key: 'id' },
    { title: '标题', dataIndex: 'title', key: 'title' },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (status === 'draft' ? '草稿' : status === 'published' ? '已发布' : '定时'),
    },
    { title: '创建时间', dataIndex: 'createdAt', key: 'createdAt' },
    {
      title: '操作',
      key: 'actions',
      render: (_: unknown, _record: ContentItem) => (
        <Space>
          <Button type="link" icon={<EditOutlined />} onClick={() => message.info('编辑功能开发中')}>
            编辑
          </Button>
          <Popconfirm title="确定删除?" onConfirm={() => message.info('删除功能开发中')}>
            <Button type="link" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
        <h2>内容管理</h2>
        <Button type="primary" onClick={() => message.info('创建功能开发中')}>
          创建内容
        </Button>
      </div>
      <Table rowKey="id" columns={columns} dataSource={data} pagination={{ pageSize: 10 }} />
    </div>
  );
};

export default ContentList;
