import { axiosInstance } from '../interceptors/axios';

export interface WorkspaceMember {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string;
  role: 'creator' | 'admin' | 'approver' | 'editor' | 'viewer';
  joinedAt: string;
}

export interface ActivityResponse {
  logs: ActivityLogEntry[];
  total: number;
  limit?: number;
}

export interface ActivityLogEntry {
  id: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  metadata?: any;
  createdAt: string;
  user?: {
    id: string;
    email: string;
    name: string;
    avatarUrl?: string;
  };
}

export const workspaceApi = {
  // Get members of a workspace
  getMembers(workspaceId: string) {
    return axiosInstance.get<WorkspaceMember[]>(`/workspaces/${workspaceId}/members`);
  },

  // Invite a member
  inviteMember(workspaceId: string, email: string, role: string = 'editor') {
    return axiosInstance.post<{ message: string }>(`/workspaces/${workspaceId}/members`, { email, role });
  },

  // Update member role
  updateMemberRole(
    workspaceId: string,
    userId: string,
    role: string,
  ) {
    return axiosInstance.put<{ message: string }>(`/workspaces/${workspaceId}/members/${userId}/role`, { role });
  },

  // Remove member
  removeMember(workspaceId: string, userId: string) {
    return axiosInstance.delete<void>(`/workspaces/${workspaceId}/members/${userId}`);
  },

  // Get activity logs for workspace
  getActivity(
    workspaceId: string,
    limit?: number,
    before?: string,
  ) {
    const params: any = {};
    if (limit) params.limit = limit;
    if (before) params.before = before;
    return axiosInstance.get<ActivityResponse>(`/workspaces/${workspaceId}/activity`, { params });
  },
};
