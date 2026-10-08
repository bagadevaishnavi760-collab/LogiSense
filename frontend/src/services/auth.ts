import { apiConfig, ApiError } from './api'

export type UserRole = 'ADMIN' | 'CUSTOMER'

export interface AuthUser {
  id: string
  role: UserRole
  email: string
  customerId?: string
}

interface AuthResponse {
  user: AuthUser | null
}

async function authRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${apiConfig.baseUrl}${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...init?.headers,
    },
  })
  const body = (await response.json().catch(() => ({}))) as { error?: string } & T
  if (!response.ok) throw new ApiError(body.error ?? 'Authentication request failed.', response.status, path)
  return body
}

export async function login(identifier: string, password: string): Promise<AuthUser> {
  const response = await authRequest<AuthResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ identifier, password }),
  })
  if (!response.user) throw new Error('The authentication service returned no user.')
  return response.user
}

export async function getSession(): Promise<AuthUser | null> {
  const response = await authRequest<AuthResponse>('/auth/session')
  return response.user
}

export async function logout(): Promise<void> {
  await authRequest('/auth/logout', { method: 'POST' })
}
