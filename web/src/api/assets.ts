import { useQuery } from '@tanstack/react-query'
import { request } from './client'
import type { Asset, Vulnerability, PaginatedResponse } from '@/types'

export const assetKeys = {
  all: ['assets'] as const,
  lists: () => [...assetKeys.all, 'list'] as const,
  list: (params?: Record<string, string>) => [...assetKeys.lists(), params ?? {}] as const,
  details: () => [...assetKeys.all, 'detail'] as const,
  detail: (id: string) => [...assetKeys.details(), id] as const,
  vulns: (id: string) => [...assetKeys.detail(id), 'vulns'] as const,
}

function buildQS(params?: Record<string, string>): string {
  if (!params) return ''
  const filtered = Object.fromEntries(Object.entries(params).filter(([, v]) => v !== ''))
  return Object.keys(filtered).length ? '?' + new URLSearchParams(filtered).toString() : ''
}

export function useAssetList(params?: Record<string, string>) {
  return useQuery({
    queryKey: assetKeys.list(params),
    queryFn: () => request<PaginatedResponse<Asset>>(`/assets${buildQS(params)}`),
  })
}

export function useAsset(id: string) {
  return useQuery({
    queryKey: assetKeys.detail(id),
    queryFn: () => request<Asset>(`/assets/${id}`),
    enabled: !!id,
  })
}

export function useAssetVulns(id: string) {
  return useQuery({
    queryKey: assetKeys.vulns(id),
    queryFn: () => request<{ data: Vulnerability[] }>(`/assets/${id}/vulns`),
    enabled: !!id,
  })
}
