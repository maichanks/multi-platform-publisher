import React from 'react';
import { Card, Button, message } from 'antd';

const ContentEdit: React.FC = () => {
  return (
    <Card
      title="编辑内容"
      extra={<Button onClick={() => message.info('保存功能开发中')}>保存</Button>}
    >
      <p>内容编辑表单（待实现）</p>
    </Card>
  );
};

export default ContentEdit;
