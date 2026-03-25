import React from 'react';
import { render, type RenderOptions } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ToastProvider } from '../components/ui/Toast';

interface WrapperOptions extends Omit<RenderOptions, 'wrapper'> {
  route?: string;
}

export function renderWithProviders(
  ui: React.ReactElement,
  { route = '/', ...options }: WrapperOptions = {},
) {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <ToastProvider>{ui}</ToastProvider>
    </MemoryRouter>,
    options,
  );
}

export const ADMIN_USER = {
  id: 'admin-001',
  email: 'admin@test.com',
  name: 'Admin User',
  role: 'admin' as const,
};

export const RIDER_USER = {
  id: 'user-001',
  email: 'rider@test.com',
  name: 'Test Rider',
  role: 'rider' as const,
};
