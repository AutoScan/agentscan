import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { request } from './client'
import type { Task, CreateTaskRequest, PaginatedResponse } from '@/types'

export const taskKeys = {
  all: ['tasks'] as const,
  lists: () => [...taskKeys.all, 'list'] as const,
  list: (params?: Record<string, string>) => [...taskKeys.lists(), params ?? {}] as const,
  details: () => [...taskKeys.all, 'detail'] as const,
  detail: (id: string) => [...taskKeys.details(), id] as const,
}

function buildQS(params?: Record<string, string>): string {
  if (!params) return ''
  const filtered = Object.fromEntries(Object.entries(params).filter(([, v]) => v !== ''))
  return Object.keys(filtered).length ? '?' + new URLSearchParams(filtered).toString() : ''
}

export function useTaskList(params?: Record<string, string>) {
  return useQuery({
    queryKey: taskKeys.list(params),
    queryFn: () => request<PaginatedResponse<Task>>(`/tasks${buildQS(params)}`),
    refetchInterval: 10_000,
  })
}

export function useTask(id: string) {
  return useQuery({
    queryKey: taskKeys.detail(id),
    queryFn: () => request<Task>(`/tasks/${id}`),
    enabled: !!id,
  })
}

export function useCreateTask() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateTaskRequest) =>
      request<Task>('/tasks', { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: taskKeys.lists() })
    },
  })
}

export function useStartTask() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => request<Task>(`/tasks/${id}/start`, { method: 'POST' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: taskKeys.all })
    },
  })
}

export function useStopTask() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => request<Task>(`/tasks/${id}/stop`, { method: 'POST' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: taskKeys.all })
    },
  })
}

export function useDeleteTask() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => request<void>(`/tasks/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: taskKeys.lists() })
    },
  })
}
