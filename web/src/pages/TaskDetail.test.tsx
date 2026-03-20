import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import TaskDetail from './TaskDetail'
import { useAssetList } from '@/api/assets'
import { exportExcel } from '@/api/reports'
import { useTask } from '@/api/tasks'
import { useVulnList } from '@/api/vulns'
import { useWebSocket } from '@/hooks/useWebSocket'
import { makeAsset, makeTask, makeVulnerability } from '@/test-utils/fixtures'
import { renderWithProviders } from '@/test-utils/render'

vi.mock('@/api/tasks', () => ({
  useTask: vi.fn(),
}))

vi.mock('@/api/assets', () => ({
  useAssetList: vi.fn(),
}))

vi.mock('@/api/vulns', () => ({
  useVulnList: vi.fn(),
}))

vi.mock('@/api/reports', () => ({
  exportExcel: vi.fn(),
}))

vi.mock('@/hooks/useWebSocket', () => ({
  useWebSocket: vi.fn(),
}))

describe('TaskDetail page', () => {
  it('renders details and exports report for completed tasks', async () => {
    const user = userEvent.setup()
    vi.mocked(useTask).mockReturnValue({
      data: makeTask({ id: 'task-1', name: '扫描任务A', status: 'completed' }),
      isLoading: false,
      refetch: vi.fn(),
    } as never)
    vi.mocked(useAssetList).mockReturnValue({
      data: { data: [makeAsset()], total: 1 },
    } as never)
    vi.mocked(useVulnList).mockReturnValue({
      data: { data: [makeVulnerability()], total: 1 },
    } as never)
    vi.mocked(useWebSocket).mockImplementation(() => {})

    renderWithProviders(
      <Routes>
        <Route path="/tasks/:id" element={<TaskDetail />} />
      </Routes>,
      '/tasks/task-1',
    )

    expect(screen.getByText('扫描任务A')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /导出报告/ })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /导出报告/ }))
    expect(exportExcel).toHaveBeenCalledWith('task-1')
  })

  it('shows error message and hides report button for failed tasks', () => {
    vi.mocked(useTask).mockReturnValue({
      data: makeTask({ status: 'failed', error_message: 'network timeout' }),
      isLoading: false,
      refetch: vi.fn(),
    } as never)
    vi.mocked(useAssetList).mockReturnValue({
      data: { data: [], total: 0 },
    } as never)
    vi.mocked(useVulnList).mockReturnValue({
      data: { data: [], total: 0 },
    } as never)
    vi.mocked(useWebSocket).mockImplementation(() => {})

    renderWithProviders(
      <Routes>
        <Route path="/tasks/:id" element={<TaskDetail />} />
      </Routes>,
      '/tasks/task-1',
    )

    expect(screen.getByText('错误: network timeout')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /导出报告/ })).not.toBeInTheDocument()
  })
})
