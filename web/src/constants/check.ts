import type { CheckType } from '@/types'

export const CHECK_TYPE_LABELS: Record<CheckType | string, string> = {
  cve_match: 'CVE匹配',
  auth_check: '认证检查',
  skills_check: 'Skills检查',
  poc_verify: 'PoC验证',
  ws_hijack: 'WS劫持',
  path_traversal: '路径穿越',
  ssrf: 'SSRF',
}

export function getCheckTypeOptions() {
  return Object.entries(CHECK_TYPE_LABELS).map(([k, v]) => ({ label: v, value: k }))
}
