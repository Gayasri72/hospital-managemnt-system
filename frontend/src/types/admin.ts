export interface Role {
  role_id: string;
  name: string;
  description: string;
  permissions: any[]; // JSON array of permission strings/objects
}

export interface User {
  user_id: string;
  hospital_id: string;
  name: string;
  email: string;
  role_id: string;
  status: 'ACTIVE' | 'INACTIVE';
  last_login: string;
  created_at: string;
  role?: Role;
}

export interface CreateUserRequest {
  name: string;
  email: string;
  password?: string;
  role_id: number;
}

export interface UpdateUserRequest {
  name?: string;
  email?: string;
  role_id?: number;
  status?: 'ACTIVE' | 'INACTIVE';
}
