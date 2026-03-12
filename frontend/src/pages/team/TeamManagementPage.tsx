import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Card,
  Table,
  Button,
  Modal,
  Form,
  Select,
  Input,
  Tag,
  Space,
  Avatar,
  message,
  Spin,
  Alert,
  Popconfirm,
  Timeline,
  Typography,
  Row,
  Col,
} from 'antd';
import {
  UserOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  TeamOutlined,
  ActivityOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { workspaceApi, WorkspaceMember, ActivityLogEntry } from '../services/workspace.service';

const { Title, Text } = Typography;
const { Option } = Select;

const TeamManagementPage: React.FC = () => {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const navigate = useNavigate();

  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [activity, setActivity] = useState<ActivityLogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<WorkspaceMember | null>(null);
  const [roleModalOpen, setRoleModalOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState<string>('');
  const [inviteForm] = Form.useForm();
  const [roleForm] = Form.useForm();

  const fetchMembers = async () => {
    if (!workspaceId) return;
    setLoading(true);
    try {
      const res = await workspaceApi.getMembers(workspaceId);
      setMembers(res.data);
    } catch (error: any) {
      message.error('Failed to fetch members');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const fetchActivity = async () => {
    if (!workspaceId) return;
    try {
      const res = await workspaceApi.getActivity(workspaceId, 50);
      setActivity(res.data.logs || []);
    } catch (error) {
      console.error('Failed to fetch activity:', error);
    }
  };

  useEffect(() => {
    if (!workspaceId) {
      navigate('/dashboard');
      return;
    }
    fetchMembers();
    fetchActivity();
  }, [workspaceId, navigate]);

  const handleInvite = async (values: { email: string; role: string }) => {
    if (!workspaceId) return;
    try {
      await workspaceApi.inviteMember(workspaceId, values.email, values.role);
      message.success('Invitation sent successfully');
      setInviteModalOpen(false);
      inviteForm.resetFields();
      fetchMembers();
      fetchActivity();
    } catch (error: any) {
      message.error(error.response?.data?.message || 'Failed to invite member');
    }
  };

  const openRoleChange = (member: WorkspaceMember) => {
    setEditingMember(member);
    setSelectedRole(member.role);
    roleForm.setFieldsValue({ role: member.role });
    setRoleModalOpen(true);
  };

  const handleRoleChange = async () => {
    if (!workspaceId || !editingMember) return;
    try {
      await workspaceApi.updateMemberRole(workspaceId, editingMember.id, selectedRole);
      message.success('Member role updated');
      setRoleModalOpen(false);
      setEditingMember(null);
      fetchMembers();
      fetchActivity();
    } catch (error: any) {
      message.error(error.response?.data?.message || 'Failed to update role');
    }
  };

  const handleRemoveMember = async (userId: string) => {
    if (!workspaceId) return;
    try {
      await workspaceApi.removeMember(workspaceId, userId);
      message.success('Member removed');
      fetchMembers();
      fetchActivity();
    } catch (error: any) {
      message.error(error.response?.data?.message || 'Failed to remove member');
    }
  };

  const roleColorMap: Record<string, string> = {
    creator: 'gold',
    admin: 'red',
    approver: 'orange',
    editor: 'blue',
    viewer: 'green',
  };

  const memberColumns: ColumnsType<WorkspaceMember> = [
    {
      title: 'User',
      dataIndex: 'name',
      key: 'name',
      render: (_, record) => (
        <Space>
          <Avatar src={record.avatarUrl} icon={<UserOutlined />} />
          <div>
            <div>{record.name || 'No name'}</div>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {record.email}
            </Text>
          </div>
        </Space>
      ),
    },
    {
      title: 'Role',
      dataIndex: 'role',
      key: 'role',
      render: (role: string) => <Tag color={roleColorMap[role] || 'default'}>{role.toUpperCase()}</Tag>,
    },
    {
      title: 'Joined',
      dataIndex: 'joinedAt',
      key: 'joinedAt',
      render: (date: string) => new Date(date).toLocaleDateString(),
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record) => (
        <Space>
          <Button
            type="link"
            icon={<EditOutlined />}
            size="small"
            onClick={() => openRoleChange(record)}
            disabled={record.role === 'creator'} // Can't change owner role
          >
            Role
          </Button>
          <Popconfirm
            title="Remove Member"
            description="Are you sure you want to remove this member?"
            onConfirm={() => handleRemoveMember(record.id)}
            okText="Yes"
            cancelText="No"
            disabled={record.role === 'creator'}
          >
            <Button
              type="link"
              danger
              icon={<DeleteOutlined />}
              size="small"
              disabled={record.role === 'creator'}
            >
              Remove
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const activityColumns: ColumnsType<ActivityLogEntry> = [
    {
      title: 'Action',
      dataIndex: 'action',
      key: 'action',
      render: (action: string) => <Tag>{action}</Tag>,
    },
    {
      title: 'User',
      dataIndex: ['user', 'name'],
      key: 'user',
      render: (_, record) => record.user?.name || 'System',
    },
    {
      title: 'Time',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (date: string) => new Date(date).toLocaleString(),
    },
    {
      title: 'Details',
      dataIndex: 'metadata',
      key: 'metadata',
      render: (metadata: any) => (
        <pre style={{ margin: 0, fontSize: 12 }}>
          {JSON.stringify(metadata, null, 2)}
        </pre>
      ),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <Title level={2}>
        <TeamOutlined /> Team Management
      </Title>

      <Row gutter={24}>
        <Col xs={24} lg={12}>
          <Card
            title="Members"
            extra={
              <Button type="primary" icon={<PlusOutlined />} onClick={() => setInviteModalOpen(true)}>
                Invite Member
              </Button>
            }
          >
            <Spin spinning={loading}>
              <Table<WorkspaceMember>
                columns={memberColumns}
                dataSource={members}
                rowKey="id"
                pagination={false}
                locale={{ emptyText: 'No members found' }}
              />
            </Spin>
          </Card>
        </Col>

        <Col xs={24} lg={12}>
          <Card title={<><ActivityOutlined /> Activity Log</>}>
            <Table<ActivityLogEntry>
              columns={activityColumns}
              dataSource={activity}
              rowKey="id"
              pagination={false}
              size="small"
              locale={{ emptyText: 'No activity yet' }}
            />
          </Card>
        </Col>
      </Row>

      {/* Invite Member Modal */}
      <Modal
        title="Invite New Member"
        open={inviteModalOpen}
        onCancel={() => {
          setInviteModalOpen(false);
          inviteForm.resetFields();
        }}
        footer={null}
      >
        <Form form={inviteForm} layout="vertical" onFinish={handleInvite}>
          <Form.Item
            name="email"
            label="Email"
            rules={[
              { required: true, message: 'Please enter email' },
              { type: 'email', message: 'Invalid email address' },
            ]}
          >
            <Input placeholder="member@example.com" />
          </Form.Item>
          <Form.Item
            name="role"
            label="Role"
            initialValue="editor"
            rules={[{ required: true, message: 'Please select a role' }]}
          >
            <Select>
              <Option value="admin">Admin</Option>
              <Option value="editor">Editor</Option>
              <Option value="viewer">Viewer</Option>
              <Option value="approver">Approver</Option>
            </Select>
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" block>
              Send Invitation
            </Button>
          </Form.Item>
        </Form>
      </Modal>

      {/* Change Role Modal */}
      <Modal
        title="Change Member Role"
        open={roleModalOpen}
        onOk={handleRoleChange}
        onCancel={() => {
          setRoleModalOpen(false);
          setEditingMember(null);
        }}
        okText="Update"
      >
        <Form form={roleForm} layout="vertical">
          <Form.Item
            name="role"
            label="New Role"
            rules={[{ required: true, message: 'Please select a role' }]}
          >
            <Select value={selectedRole} onChange={setSelectedRole}>
              <Option value="admin">Admin</Option>
              <Option value="editor">Editor</Option>
              <Option value="viewer">Viewer</Option>
              <Option value="approver">Approver</Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default TeamManagementPage;
