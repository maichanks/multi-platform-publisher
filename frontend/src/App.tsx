import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AdminLayout } from './components/layout/AdminLayout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import ContentList from './pages/content/ContentList';
import ContentCreate from './pages/content/ContentCreate';
import ContentEdit from './pages/content/ContentEdit';
import PublishingQueue from './pages/publish/PublishingQueue';
import PlatformSettings from './pages/settings/PlatformSettings';
import TeamManagementPage from './pages/team/TeamManagementPage';

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const token = localStorage.getItem('token');
  if (!token) return <Navigate to="/login" replace />;
  return <>{children}</>;
};

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <AdminLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="content" element={<ContentList />} />
          <Route path="content/create" element={<ContentCreate />} />
          <Route path="content/edit/:id" element={<ContentEdit />} />
          <Route path="publish" element={<PublishingQueue />} />
          <Route path="team/:workspaceId" element={<TeamManagementPage />} />
          <Route path="settings/platforms" element={<PlatformSettings />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
