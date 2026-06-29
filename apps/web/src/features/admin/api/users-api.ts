/**
 * @file users-api.ts — admin User Management client.
 * Backed by /users (list/get/update/delete, cursor pagination in meta) and
 * /admin/users/:userId/roles (assign/remove) + /admin/roles (role list).
 */
import { api } from '@/lib/api/client';

export interface UserSummary {
  id: string;
  email: string;
  username?: string | null;
  displayName?: string | null;
  role: string;
  status: string;
  isVerified: boolean;
  isActive?: boolean;
  createdAt?: string;
}

export interface UserListResult {
  data: UserSummary[];
  pagination: { cursor: string | null; hasMore: boolean; total?: number };
}

export interface Role { id: string; slug: string; name: string; description?: string | null; isSystem?: boolean; }

export type UserListParams = Record<string, string | number | boolean | undefined>;

export const usersApi = {
  list: async (params?: UserListParams): Promise<UserListResult> => {
    const res = await api.get<UserSummary[]>('/users', { query: params });
    const p = res.meta?.pagination;
    return { data: res.data ?? [], pagination: { cursor: p?.cursor ?? null, hasMore: p?.hasMore ?? false, total: p?.total } };
  },
  get: (id: string) => api.data<UserSummary & { roles?: Role[] }>(api.get(`/users/${id}`)),
  update: (id: string, body: Record<string, unknown>) => api.data<UserSummary>(api.patch(`/users/${id}`, body)),
  remove: (id: string) => api.delete(`/users/${id}`),
  assignRole: (userId: string, roleId: string) => api.data(api.post(`/admin/users/${userId}/roles`, { roleId })),
  removeRole: (userId: string, roleId: string) => api.data(api.delete(`/admin/users/${userId}/roles/${roleId}`)),
};

export const rolesApi = {
  list: () => api.data<Role[]>(api.get('/admin/roles')),
};
