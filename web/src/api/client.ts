const API_BASE = '/api/v1'

let navigateToLogin: (() => void) | null = null

export function setAuthNavigator(fn: () => void) {
  navigateToLogin = fn
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

export async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const token = localStorage.getItem('token')
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }

  const resp = await fetch(`${API_BASE}${path}`, { ...options, headers })

  if (resp.status === 401) {
    localStorage.removeItem('token')
    localStorage.removeItem('username')
    navigateToLogin?.()
    throw new ApiError(401, 'UNAUTHORIZED', 'Unauthorized')
  }

  if (!resp.ok) {
    const body = await resp.json().catch(() => ({ error: `HTTP ${resp.status}` }))
    throw new ApiError(resp.status, body.code || 'UNKNOWN', body.error || `HTTP ${resp.status}`)
  }

  if (resp.headers.get('content-type')?.includes('application/json')) {
    return resp.json()
  }
  return resp as unknown as T
}

export async function downloadFile(path: string, filename: string): Promise<void> {
  const token = localStorage.getItem('token')
  const resp = await fetch(`${API_BASE}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
  if (!resp.ok) throw new ApiError(resp.status, 'DOWNLOAD_FAILED', 'Download failed')
  const blob = await resp.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
