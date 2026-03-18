import { useQuery } from '@tanstack/react-query'
import { request } from './client'
import type { Vulnerability, PaginatedResponse } from '@/types'

export const vulnKeys = {
  all: ['vulns'] as const,
  lists: () => [...vulnKeys.all, 'list'] as const,
  list: (params?: Record<string, string>) => [...vulnKeys.lists(), params ?? {}] as const,
  details: () => [...vulnKeys.all, 'detail'] as const,
  detail: (id: string) => [...vulnKeys.details(), id] as const,
}

function buildQS(params?: Record<string, string>): string {
  if (!params) return ''
  const filtered = Object.fromEntries(Object.entries(params).filter(([, v]) => v !== ''))
  return Object.keys(filtered).length ? '?' + new URLSearchParams(filtered).toString() : ''
}

export function useVulnList(params?: Record<string, string>) {
  return useQuery({
    queryKey: vulnKeys.list(params),
    queryFn: () => request<PaginatedResponse<Vulnerability>>(`/vulns${buildQS(params)}`),
  })
}

export function useVuln(id: string) {
  return useQuery({
    queryKey: vulnKeys.detail(id),
    queryFn: () => request<Vulnerability>(`/vulns/${id}`),
    enabled: !!id,
  })
}
