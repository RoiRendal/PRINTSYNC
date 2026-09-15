export type UserRole = 'admin' | 'staff';

export interface UserSummary {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: UserRole;
  position: string;
  createdAt: string;
  access: string[];
}

export interface CreateUserInput {
  name: string;
  email: string;
  phone: string;
  role: UserRole;
  position: string;
  createdAt?: string;
  password: string;
  access: string[];
}

export type UpdateUserInput = Partial<Omit<CreateUserInput, 'password'>> & {
  password?: string;
};

export interface SessionUser extends UserSummary {
  roleId: string;
  permissions: string[];
}

export interface AuthResponse {
  user: SessionUser;
}
