import { request } from './client'

export function importFOFA(query: string, limit: number) {
  return request<{ task_id: string }>('/intel/fofa/import', {
    method: 'POST',
    body: JSON.stringify({ query, limit }),
  })
}
