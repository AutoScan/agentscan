import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Table,
  Button,
  Modal,
  Form,
  Input,
  Select,
  Space,
  Tag,
  Typography,
  message,
  Popconfirm,
  InputNumber,
  Switch,
  Progress,
  Tooltip,
} from 'antd'
import { PlusOutlined, PlayCircleOutlined, DeleteOutlined, DownloadOutlined, StopOutlined, EyeOutlined } from '@ant-design/icons'
import { useTaskList, useCreateTask, useStartTask, useStopTask, useDeleteTask } from '@/api/tasks'
import { exportExcel } from '@/api/reports'
import StatusBadge from '@/components/StatusBadge'
import type { Task, CreateTaskRequest, TaskStatus, TaskType } from '@/types'

export default function Tasks() {
  const [modalOpen, setModalOpen] = useState(false)
  const [taskType, setTaskType] = useState<TaskType>('instant')
  const [form] = Form.useForm<CreateTaskRequest>()

  const { data, isLoading } = useTaskList()
  const createTask = useCreateTask()
  const startTask = useStartTask()
  const stopTask = useStopTask()
  const deleteTask = useDeleteTask()

  const tasks = data?.data ?? []
  const total = data?.total ?? 0

  const handleCreate = async () => {
    try {
      const values = await form.validateFields()
      await createTask.mutateAsync(values)
      message.success(values.type === 'scheduled' ? '定时任务已创建' : '任务已创建并开始执行')
      setModalOpen(false)
      form.resetFields()
      setTaskType('instant')
    } catch (e: unknown) {
      if (e instanceof Error && e.message) message.error(e.message)
    }
  }

  const columns = [
    {
      title: '任务名',
      dataIndex: 'name',
      key: 'name',
      width: 200,
      render: (v: string, r: Task) => (
        <Link to={`/tasks/${r.id}`}>
          <Typography.Link strong>{v}</Typography.Link>
        </Link>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (s: TaskStatus) => <StatusBadge status={s} />,
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      width: 90,
      render: (v: string, r: Task) =>
        v === 'scheduled' ? (
          <Tooltip title={r.cron_expr}><Tag color="blue">定时</Tag></Tooltip>
        ) : (
          <Tag>即时</Tag>
        ),
    },
    {
      title: '深度',
      dataIndex: 'scan_depth',
      key: 'scan_depth',
      width: 70,
      render: (v: string) => <Tag>{v?.toUpperCase()}</Tag>,
    },
    { title: '目标', dataIndex: 'total_targets', key: 'total_targets', width: 70, align: 'right' as const },
    {
      title: '端口',
      dataIndex: 'open_ports',
      key: 'open_ports',
      width: 70,
      align: 'right' as const,
      render: (v: number) => (v > 0 ? <Typography.Text type="success">{v}</Typography.Text> : '-'),
    },
    {
      title: 'Agent',
      dataIndex: 'found_agents',
      key: 'found_agents',
      width: 70,
      align: 'right' as const,
      render: (v: number) => (v > 0 ? <Typography.Text style={{ color: '#1677ff' }}>{v}</Typography.Text> : '-'),
    },
    {
      title: '漏洞',
      dataIndex: 'found_vulns',
      key: 'found_vulns',
      width: 70,
      align: 'right' as const,
      render: (v: number) => (v > 0 ? <Typography.Text type="danger">{v}</Typography.Text> : '-'),
    },
    {
      title: '进度',
      dataIndex: 'progress_percent',
      key: 'progress',
      width: 160,
      render: (v: number, r: Task) =>
        r.status === 'running' ? (
          <Progress percent={Math.round(v)} size="small" status="active" />
        ) : r.status === 'completed' ? (
          <Progress percent={100} size="small" />
        ) : r.status === 'failed' ? (
          <Progress percent={Math.round(v)} size="small" status="exception" />
        ) : r.status === 'cancelled' ? (
          <Tooltip title="已取消">
            <Progress percent={Math.round(v)} size="small" status="exception" strokeColor="#999" />
          </Tooltip>
        ) : (
          '-'
        ),
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 160,
      render: (v: string) => (v ? new Date(v).toLocaleString('zh-CN') : '-'),
    },
    {
      title: '操作',
      key: 'actions',
      width: 220,
      fixed: 'right' as const,
      render: (_: unknown, r: Task) => (
        <Space size="small">
          <Tooltip title="查看详情">
            <Link to={`/tasks/${r.id}`}>
              <Button size="small" icon={<EyeOutlined />} />
            </Link>
          </Tooltip>
          {r.status === 'pending' && (
            <Tooltip title="启动">
              <Button
                size="small"
                type="primary"
                ghost
                icon={<PlayCircleOutlined />}
                onClick={() => startTask.mutate(r.id)}
              />
            </Tooltip>
          )}
          {r.status === 'running' && (
            <Tooltip title="停止">
              <Button size="small" danger icon={<StopOutlined />} onClick={() => stopTask.mutate(r.id)} />
            </Tooltip>
          )}
          {(r.status === 'completed' || r.status === 'cancelled') && (
            <Tooltip title="导出报告">
              <Button size="small" icon={<DownloadOutlined />} onClick={() => exportExcel(r.id)} />
            </Tooltip>
          )}
          <Popconfirm title="确认删除该任务?" onConfirm={() => deleteTask.mutate(r.id)}>
            <Button size="small" icon={<DeleteOutlined />} danger />
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Typography.Title level={4} style={{ margin: 0 }}>
          扫描任务
        </Typography.Title>
        <Space>
          <Typography.Text type="secondary">{total} 个任务</Typography.Text>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalOpen(true)}>
            新建任务
          </Button>
        </Space>
      </div>

      <Table
        columns={columns}
        dataSource={tasks}
        rowKey="id"
        loading={isLoading}
        pagination={{ total, pageSize: 20, showSizeChanger: true, showTotal: (t) => `共 ${t} 条` }}
        size="middle"
        scroll={{ x: 1300 }}
      />

      <Modal
        title="新建扫描任务"
        open={modalOpen}
        onOk={handleCreate}
        onCancel={() => setModalOpen(false)}
        width={640}
        okText="创建并执行"
        confirmLoading={createTask.isPending}
        destroyOnClose
      >
        <Form
          form={form}
          layout="vertical"
          initialValues={{ scan_depth: 'l3', concurrency: 100, timeout: 3, enable_mdns: true, type: 'instant' }}
        >
          <Form.Item name="name" label="任务名称" rules={[{ required: true, message: '请输入任务名称' }]}>
            <Input placeholder="如: 内网Agent排查-2026Q1" />
          </Form.Item>
          <Space size="large">
            <Form.Item name="type" label="任务类型">
              <Select
                style={{ width: 140 }}
                onChange={(v: TaskType) => setTaskType(v)}
                options={[
                  { label: '即时执行', value: 'instant' },
                  { label: '定时执行', value: 'scheduled' },
                ]}
              />
            </Form.Item>
            {taskType === 'scheduled' && (
              <Form.Item
                name="cron_expr"
                label="Cron 表达式"
                rules={[{ required: true, message: '请输入 Cron 表达式' }]}
                extra="标准 5 字段: 分 时 日 月 周 (如 0 */6 * * *)"
              >
                <Input placeholder="0 */6 * * *" style={{ width: 200 }} />
              </Form.Item>
            )}
          </Space>
          <Form.Item
            name="targets"
            label="扫描目标"
            rules={[{ required: true, message: '请输入扫描目标' }]}
            extra="支持: 单IP, CIDR (192.168.1.0/24), 范围 (10.0.0.1-10.0.0.255), 逗号分隔多段"
          >
            <Input.TextArea rows={3} placeholder="192.168.1.0/24, 10.0.0.1" />
          </Form.Item>
          <Form.Item name="description" label="任务描述">
            <Input.TextArea rows={2} placeholder="可选描述信息" />
          </Form.Item>
          <Form.Item name="ports" label="端口" extra="留空使用默认端口: 18789,18792,3000,8080,8888">
            <Input placeholder="18789,18792,3000,8080,8888" />
          </Form.Item>
          <Space size="large" wrap>
            <Form.Item name="scan_depth" label="扫描深度">
              <Select
                style={{ width: 140 }}
                options={[
                  { label: 'L1 端口扫描', value: 'l1' },
                  { label: 'L2 指纹识别', value: 'l2' },
                  { label: 'L3 漏洞验证', value: 'l3' },
                ]}
              />
            </Form.Item>
            <Form.Item name="concurrency" label="并发数">
              <InputNumber min={1} max={10000} style={{ width: 100 }} />
            </Form.Item>
            <Form.Item name="timeout" label="超时(秒)">
              <InputNumber min={1} max={60} style={{ width: 100 }} />
            </Form.Item>
            <Form.Item name="enable_mdns" label="mDNS发现" valuePropName="checked">
              <Switch />
            </Form.Item>
          </Space>
        </Form>
      </Modal>
    </div>
  )
}
