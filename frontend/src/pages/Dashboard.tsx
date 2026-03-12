import React from 'react';
import { Card, Row, Col, Statistic } from 'antd';
import { UserOutlined, FileTextOutlined, CalendarOutlined } from '@ant-design/icons';

const Dashboard: React.FC = () => {
  return (
    <div>
      <h2>仪表盘</h2>
      <Row gutter={16}>
        <Col span={8}>
          <Card>
            <Statistic
              title="总内容数"
              value={0}
              prefix={<FileTextOutlined />}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic
              title="本月发布"
              value={0}
              prefix={<CalendarOutlined />}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic
              title="活跃用户"
              value={0}
              prefix={<UserOutlined />}
            />
          </Card>
        </Col>
      </Row>
      <Card title="快速操作" style={{ marginTop: 24 }}>
        <p>创建内容、查看队列、平台配置等（开发中）</p>
      </Card>
    </div>
  );
};

export default Dashboard;
