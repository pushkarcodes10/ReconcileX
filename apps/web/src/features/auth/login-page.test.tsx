import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { LoginPage } from './login-page';
import * as authContext from '../../auth/auth-provider';

describe('LoginPage', () => {
  it('renders sign in form with required fields', () => {
    vi.spyOn(authContext, 'useAuth').mockReturnValue({
      user: null,
      memberships: [],
      isAuthenticated: false,
      isLoading: false,
      login: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
      refetchUser: vi.fn(),
    });

    render(
      <BrowserRouter>
        <LoginPage />
      </BrowserRouter>
    );

    expect(screen.getByLabelText(/Email Address/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Sign In/i })).toBeInTheDocument();
  });

  it('displays error when credentials are empty', async () => {
    vi.spyOn(authContext, 'useAuth').mockReturnValue({
      user: null,
      memberships: [],
      isAuthenticated: false,
      isLoading: false,
      login: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
      refetchUser: vi.fn(),
    });

    render(
      <BrowserRouter>
        <LoginPage />
      </BrowserRouter>
    );

    const form = screen.getByRole('button', { name: /Sign In/i }).closest('form')!;
    fireEvent.submit(form);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/Please enter both email and password/i);
    });
  });
});
