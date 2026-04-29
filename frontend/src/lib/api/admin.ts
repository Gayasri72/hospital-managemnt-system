import { apiClient } from './client';
import { ApiResponse, PaginatedResponse } from '../../types/api';
import { User, Role, CreateUserRequest, UpdateUserRequest } from '../../types/admin';

export const adminApi = {
  // Users Management
  getUsers: async (params?: { page?: number; limit?: number; search?: string; role_id?: string }) => {
    const { data } = await apiClient.get<PaginatedResponse<User>>('/admin/users', { params });
    return data;
  },

  getUserById: async (id: string) => {
    const { data } = await apiClient.get<ApiResponse<User>>(`/admin/users/${id}`);
    return data;
  },

  createUser: async (userData: CreateUserRequest) => {
    const { data } = await apiClient.post<ApiResponse<User>>('/admin/users', userData);
    return data;
  },

  updateUser: async (id: string, userData: UpdateUserRequest) => {
    const { data } = await apiClient.put<ApiResponse<User>>(`/admin/users/${id}`, userData);
    return data;
  },

  updateUserStatus: async (id: string, status: string) => {
    const { data } = await apiClient.patch<ApiResponse<User>>(`/admin/users/${id}/status`, { status });
    return data;
  },

  updateUserPassword: async (id: string, passwordData: any) => {
    const { data } = await apiClient.patch<ApiResponse<any>>(`/admin/users/${id}/password`, passwordData);
    return data;
  },

  // Roles Management
  getRoles: async () => {
    const { data } = await apiClient.get<ApiResponse<Role[]>>('/admin/roles');
    return data;
  },

  getRoleById: async (id: string) => {
    const { data } = await apiClient.get<ApiResponse<Role>>(`/admin/roles/${id}`);
    return data;
  },

  createRole: async (roleData: any) => {
    const { data } = await apiClient.post<ApiResponse<Role>>('/admin/roles', roleData);
    return data;
  },

  updateRole: async (id: string, roleData: any) => {
    const { data } = await apiClient.put<ApiResponse<Role>>(`/admin/roles/${id}`, roleData);
    return data;
  },

  deleteRole: async (id: string) => {
    const { data } = await apiClient.delete<ApiResponse<null>>(`/admin/roles/${id}`);
    return data;
  },

  // Permissions Management
  getPermissions: async () => {
    const { data } = await apiClient.get<ApiResponse<any[]>>('/admin/permissions');
    return data;
  },
};
