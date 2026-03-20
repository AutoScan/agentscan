import { useState, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  Card,
  Descriptions,
  Tag,
  Progress,
  Table,
  Button,
  Space,
  Typography,
  Tabs,
  Spin,
  Row,
  Col,
  Statistic,
  Timeline,
} from 'antd'
import { ArrowLeftOutlined, DownloadOutlined, ReloadOutlined } from '@ant-design/icons'
import { useTask } from '@/api/tasks'
import { useAssetList } from '@/api/assets'
import { useVulnList } from '@/api/vulns'
import { exportExcel } from '@/api/reports'
import { useWebSocket } from '@/hooks/useWebSocket'
import StatusBadge from '@/components/StatusBadge'
import RiskTag from '@/components/RiskTag'
import AuthTag from '@/components/AuthTag'
import StatCards from '@/components/StatCards'
import type { Asset, Vulnerability, WSMessage, TaskProgressPayload } from '@/types'

export default function TaskDetail() {
  const { id } = useParams<{ id: string }>()
  const [events, setEvents] = useState<Array<{ time: string; msg: string; type: string }>>([])

  const { data: task, isLoading, refetch } = useTask(id!)
  const { data: assetsData } = useAssetList(id ? { task_id: id } : undefined)
  const { data: vulnsData } = useVulnList(id ? { task_id: id } : undefined)

  const assets = assetsData?.data ?? []
  const vulns = vulnsData?.data ?? []

  const onWSMessage = useCallback(
    (msg: WSMessage) => {
      if (msg.type === 'agent.identified' || msg.type === 'vuln.detected') {
        const payloadStr = typeof msg.payload === 'string' ? msg.payload : JSON.stringify(msg.payload)
        setEvents((prev) => [
          { time: msg.time, msg: payloadStr.slice(0, 100), type: msg.type },
          ...prev.slice(0, 49),
        ])
      }
    },
    [],
  )

  useWebSocket(onWSMessage)

  if (isLoading) return <Spin size="large" style={{ display: 'block', margin: '100px auto' }} />
  if (!task) return <Typography.Text>任务未找到</Typography.Text>

  const assetColumns = [
    { title: 'IP', dataIndex: 'ip', key: 'ip', width: 130 },
    { title: '端口', dataIndex: 'port', key: 'port', width: 70 },
    {
      title: 'Agent',
      dataIndex: 'agent_type',
      key: 'type',
      width: 100,
      render: (v: string) => <Tag color="blue">{v}</Tag>,
    },
    { title: '版本', dataIndex: 'version', key: 'ver', width: 110 },
    {
      title: '认证',
      dataIndex: 'auth_mode',
      key: 'auth',
      width: 110,
      render: (v: string) => <AuthTag mode={v} />,
    },
    {
      title: '风险',
      dataIndex: 'risk_level',
      key: 'risk',
      width: 80,
      render: (v: string) => <RiskTag level={v} />,
    },
    {
      title: '置信度',
      dataIndex: 'confidence',
      key: 'conf',
      width: 80,
      render: (v: number) => `${Math.round(v)}%`,
    },
  ]

  const vulnColumns = [
    { title: 'CVE', dataIndex: 'cve_id', key: 'cve', width: 150, render: (v: string) => v || '-' },
    { title: '标题', dataIndex: 'title', key: 'title', width: 300, ellipsis: true },
    {
      title: '等级',
      dataIndex: 'severity',
      key: 'sev',
      width: 80,
      render: (v: string) => <RiskTag level={v} />,
    },
    { title: 'CVSS', dataIndex: 'cvss', key: 'cvss', width: 70, render: (v: number) => v?.toFixed(1) },
    { title: '类型', dataIndex: 'check_type', key: 'type', width: 100 },
    { title: '修复', dataIndex: 'remediation', key: 'fix', ellipsis: true },
  ]

  return (
    <div>
      <Space style={{ marginBottom: 16 }}>
        <Link to="/tasks">
          <Button icon={<ArrowLeftOutlined />}>返回列表</Button>
        </Link>
        <Button icon={<ReloadOutlined />} onClick={() => refetch()}>
          刷新
        </Button>
        {(task.status === 'completed' || task.status === 'cancelled') && (
          <Button icon={<DownloadOutlined />} type="primary" onClick={() => exportExcel(id!)}>
            导出报告
          </Button>
        )}
      </Space>

      <Card style={{ marginBottom: 16 }}>
        <Descriptions title={task.name} column={3} bordered size="small">
          <Descriptions.Item label="状态">
            <StatusBadge status={task.status} />
          </Descriptions.Item>
          <Descriptions.Item label="扫描深度">{task.scan_depth?.toUpperCase()}</Descriptions.Item>
          <Descriptions.Item label="目标数">{task.total_targets}</Descriptions.Item>
          <Descriptions.Item label="已扫描">{task.scanned_targets}</Descriptions.Item>
          <Descriptions.Item label="开放端口">{task.open_ports}</Descriptions.Item>
          <Descriptions.Item label="发现Agent">{task.found_agents}</Descriptions.Item>
          <Descriptions.Item label="发现漏洞">{task.found_vulns}</Descriptions.Item>
          <Descriptions.Item label="创建时间">{task.created_at}</Descriptions.Item>
          <Descriptions.Item label="目标">{task.targets}</Descriptions.Item>
        </Descriptions>
        {task.status === 'running' && (
          <Progress percent={Math.round(task.progress_percent)} style={{ marginTop: 16 }} status="active" />
        )}
        {task.status === 'completed' && <Progress percent={100} style={{ marginTop: 16 }} />}
        {task.error_message && (
          <Typography.Text type="danger" style={{ display: 'block', marginTop: 8 }}>
            错误: {task.error_message}
          </Typography.Text>
        )}
      </Card>

      <StatCards
        items={[
          { title: '目标总数', value: task.total_targets },
          { title: '开放端口', value: task.open_ports, valueStyle: { color: '#1677ff' } },
          { title: 'Agent实例', value: task.found_agents, valueStyle: { color: '#fa8c16' } },
          { title: '安全漏洞', value: task.found_vulns, valueStyle: { color: '#f5222d' } },
        ]}
      />

      <Tabs
        style={{ marginTop: 16 }}
        items={[
          {
            key: 'assets',
            label: `资产 (${assets.length})`,
            children: (
              <Table
                columns={assetColumns}
                dataSource={assets}
                rowKey="id"
                size="small"
                pagination={{ pageSize: 10 }}
              />
            ),
          },
          {
            key: 'vulns',
            label: `漏洞 (${vulns.length})`,
            children: (
              <Table
                columns={vulnColumns}
                dataSource={vulns}
                rowKey="id"
                size="small"
                pagination={{ pageSize: 10 }}
              />
            ),
          },
          {
            key: 'events',
            label: `事件 (${events.length})`,
            children: (
              <Timeline
                items={events.map((e) => ({
                  color: e.type.includes('vuln') ? 'red' : 'blue',
                  children: (
                    <>
                      <Typography.Text type="secondary">{e.time}</Typography.Text> <Tag>{e.type}</Tag> {e.msg}
                    </>
                  ),
                }))}
              />
            ),
          },
        ]}
      />
    </div>
  )
}
