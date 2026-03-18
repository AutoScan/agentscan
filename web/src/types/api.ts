export interface PaginatedResponse<T> {
  data: T[]
  total: number
}

export interface LoginResponse {
  token: string
}

export interface APIErrorResponse {
  code?: string
  error: string
  request_id?: string
}

export interface WSMessage<T = unknown> {
  type: string
  payload: T
  time: string
}

export interface TaskProgressPayload {
  task_id: string
  scanned: number
  progress: number
}
