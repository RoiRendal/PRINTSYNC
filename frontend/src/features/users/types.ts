import type { PageAccessKey } from '../../shared/constants/navigation';

export type UserRole = 'admin' | 'staff';

export interface UserSummary {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: UserRole;
  position: string;
  createdAt: string;
  access: PageAccessKey[];
}

export interface CreateUserInput {
  name: string;
  email: string;
  phone: string;
  role: UserRole;
  position: string;
  createdAt?: string;
  password: string;
  access: PageAccessKey[];
}

export type UpdateUserInput = Partial<Omit<CreateUserInput, 'password'>> & {
  password?: string;
};

export interface LoginInput {
  email: string;
  password: string;
}

export interface SessionUser extends UserSummary {}
