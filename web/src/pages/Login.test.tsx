import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { message } from 'antd'
import { Route, Routes } from 'react-router-dom'
import { describe, expect, it, beforeEach, vi } from 'vitest'
import Login from './Login'
import { login } from '@/api/auth'
import { useAuthStore } from '@/store/auth'
import { renderWithProviders } from '@/test-utils/render'

vi.mock('@/api/auth', () => ({
  login: vi.fn(),
}))

describe('Login page', () => {
  beforeEach(() => {
    vi.spyOn(message, 'success').mockImplementation(() => ({}) as never)
    vi.spyOn(message, 'error').mockImplementation(() => ({}) as never)
  })

  it('renders login form', () => {
    renderWithProviders(<Login />)

    expect(screen.getByRole('heading', { name: 'AgentScan' })).toBeInTheDocument()
    expect(screen.getByPlaceholderText('用户名')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('密码')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /登\s*录/ })).toBeInTheDocument()
  })

  it('submits successfully and navigates to home', async () => {
    const user = userEvent.setup()
    vi.mocked(login).mockResolvedValue({ token: 'token-123' })

    renderWithProviders(
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<div>home page</div>} />
      </Routes>,
      '/login',
    )

    await user.type(screen.getByPlaceholderText('用户名'), 'admin')
    await user.type(screen.getByPlaceholderText('密码'), 'agentscan')
    await user.click(screen.getByRole('button', { name: /登\s*录/ }))

    await screen.findByText('home page')
    expect(useAuthStore.getState().token).toBe('token-123')
    expect(useAuthStore.getState().username).toBe('admin')
    expect(message.success).toHaveBeenCalledWith('登录成功')
  })

  it('shows error message when login fails', async () => {
    const user = userEvent.setup()
    vi.mocked(login).mockRejectedValue(new Error('invalid credentials'))

    renderWithProviders(<Login />)

    await user.type(screen.getByPlaceholderText('用户名'), 'admin')
    await user.type(screen.getByPlaceholderText('密码'), 'wrong-password')
    await user.click(screen.getByRole('button', { name: /登\s*录/ }))

    await waitFor(() => {
      expect(message.error).toHaveBeenCalledWith('用户名或密码错误')
    })
  })
})
