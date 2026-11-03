import { apiClient } from '../client';
import {
  AuthMeResponse,
  LoginResponse,
  RegisterResponse,
  Organization,
} from '../types';

export interface RegisterDto {
  name: string;
  email: string;
  password: string;
  orgName: string;
}

export interface LoginDto {
  email: string;
  password: string;
}

export interface PasswordResetRequestDto {
  email: string;
}

export interface PasswordResetConfirmDto {
  token: string;
  newPassword: string;
}

export interface AcceptInvitationDto {
  token: string;
  name?: string;
  password?: string;
}

export const authApi = {
  me: () => apiClient.get<AuthMeResponse>('/auth/me'),

  register: (dto: RegisterDto) =>
    apiClient.post<RegisterResponse>('/auth/register', dto),

  login: (dto: LoginDto) => apiClient.post<LoginResponse>('/auth/login', dto),

  logout: () => apiClient.post<{ success: boolean; message: string }>('/auth/logout'),

  refresh: () => apiClient.post<{ success: boolean }>('/auth/refresh'),

  requestPasswordReset: (dto: PasswordResetRequestDto) =>
    apiClient.post<{ message: string; resetToken?: string }>('/auth/password-reset/request', dto),

  confirmPasswordReset: (dto: PasswordResetConfirmDto) =>
    apiClient.post<{ success: boolean; message: string }>('/auth/password-reset/confirm', dto),

  acceptInvitation: (dto: AcceptInvitationDto) =>
    apiClient.post<{ success: boolean; message: string }>('/invitations/accept', dto),

  getUserOrganizations: () => apiClient.get<Organization[]>('/organizations'),
};
