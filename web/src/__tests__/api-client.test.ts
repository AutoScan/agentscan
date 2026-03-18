import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { request, ApiError, setAuthNavigator } from '@/api/client'

beforeEach(() => {
  localStorage.setItem('token', 'test-token')
})

afterEach(() => {
  vi.restoreAllMocks()
  localStorage.clear()
})

describe('API client', () => {
  it('sends authorization header when token exists', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: () => Promise.resolve({ data: 'test' }),
    })

    await request('/test')

    expect(globalThis.fetch).toHaveBeenCalledWith(
      '/api/v1/test',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer test-token',
        }),
      }),
    )
  })

  it('throws ApiError on non-OK response', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: () => Promise.resolve({ error: 'Internal Server Error' }),
    })

    await expect(request('/test')).rejects.toThrow(ApiError)
  })

  it('calls auth navigator on 401', async () => {
    const navigator = vi.fn()
    setAuthNavigator(navigator)

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: () => Promise.resolve({ error: 'Unauthorized' }),
    })

    await expect(request('/test')).rejects.toThrow(ApiError)
    expect(navigator).toHaveBeenCalled()
  })
})
