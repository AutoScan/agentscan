import { request } from './client'

export function testWebhook() {
  return request<{ message: string }>('/alert/test', { method: 'POST' })
}
