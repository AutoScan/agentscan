import { useState, useMemo } from 'react'
import { Table, Typography, Input, Select, Space, Descriptions, Badge } from 'antd'
import { CloudServerOutlined, SafetyCertificateOutlined, WarningOutlined, SearchOutlined } from '@ant-design/icons'
import { useAssetList } from '@/api/assets'
import StatCards from '@/components/StatCards'
import RiskTag from '@/components/RiskTag'
import AuthTag from '@/components/AuthTag'
import { RISK_LABELS, getRiskOptions, confidenceColor } from '@/constants'
import type { Asset, RiskLevel } from '@/types'

export default function Assets() {
  const [filters, setFilters] = useState<Record<string, string>>({})
  const { data, isLoading } = useAssetList(filters)

  const assets = data?.data ?? []
  const total = data?.total ?? 0

  const riskStats = useMemo(
    () =>
      assets.reduce(
        (acc, a) => {
          acc[a.risk_level] = (acc[a.risk_level] || 0) + 1
          return acc
        },
        {} as Record<string, number>,
      ),
    [assets],
  )

  const updateFilter = (key: string, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }))
  }

  const expandedRow = (record: Asset) => (
    <Descriptions size="small" column={3} bordered>
      <Descriptions.Item label="Agent ID">{record.agent_id || '-'}</Descriptions.Item>
      <Descriptions.Item label="首次发现">
        {record.first_seen_at ? new Date(record.first_seen_at).toLocaleString('zh-CN') : '-'}
      </Descriptions.Item>
      <Descriptions.Item label="最后发现">
        {record.last_seen_at ? new Date(record.last_seen_at).toLocaleString('zh-CN') : '-'}
      </Descriptions.Item>
      <Descriptions.Item label="国家/地区">{record.country || '-'}</Descriptions.Item>
      <Descriptions.Item label="省份">{record.province || '-'}</Descriptions.Item>
      <Descriptions.Item label="城市">{record.city || '-'}</Descriptions.Item>
      <Descriptions.Item label="ISP">{record.isp || '-'}</Descriptions.Item>
      <Descriptions.Item label="ASN">{record.asn || '-'}</Descriptions.Item>
      <Descriptions.Item label="附加信息">
        {record.metadata
          ? 'raw' in record.metadata
            ? String(record.metadata.raw)
            : JSON.stringify(record.metadata, null, 2)
          : '-'}
      </Descriptions.Item>
    </Descriptions>
  )

  const columns = [
    {
      title: 'IP',
      dataIndex: 'ip',
      key: 'ip',
      width: 140,
      render: (v: string) => <Typography.Text copyable={{ text: v }}>{v}</Typography.Text>,
    },
    { title: '端口', dataIndex: 'port', key: 'port', width: 70, align: 'right' as const },
    {
      title: 'Agent类型',
      dataIndex: 'agent_type',
      key: 'agent_type',
      width: 120,
      render: (v: string) => (
        <Typography.Text style={{ color: '#1677ff' }}>{v}</Typography.Text>
      ),
    },
    { title: '版本', dataIndex: 'version', key: 'version', width: 120 },
    {
      title: '认证模式',
      dataIndex: 'auth_mode',
      key: 'auth_mode',
      width: 120,
      render: (v: string) => <AuthTag mode={v} />,
    },
    {
      title: '风险等级',
      dataIndex: 'risk_level',
      key: 'risk_level',
      width: 100,
      render: (v: string) => <RiskTag level={v} />,
      filters: Object.entries(RISK_LABELS).map(([k, v]) => ({ text: v, value: k })),
      onFilter: (value: unknown, record: Asset) => record.risk_level === value,
    },
    {
      title: '置信度',
      dataIndex: 'confidence',
      key: 'confidence',
      width: 90,
      align: 'right' as const,
      render: (v: number) => (
        <Typography.Text style={{ color: confidenceColor(v) }}>{Math.round(v)}%</Typography.Text>
      ),
      sorter: (a: Asset, b: Asset) => a.confidence - b.confidence,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 80,
      render: (v: string) => (
        <Badge status={v === 'active' ? 'success' : 'default'} text={v === 'active' ? '在线' : '离线'} />
      ),
    },
  ]

  return (
    <div>
      <Typography.Title level={4}>资产管理</Typography.Title>

      <StatCards
        loading={isLoading}
        items={[
          { title: '总资产', value: total, prefix: <CloudServerOutlined /> },
          {
            title: '严重风险',
            value: riskStats.critical || 0,
            valueStyle: { color: '#f5222d' },
            prefix: <WarningOutlined />,
          },
          { title: '高危', value: riskStats.high || 0, valueStyle: { color: '#fa8c16' } },
          {
            title: '安全',
            value: (riskStats.low || 0) + (riskStats.info || 0),
            valueStyle: { color: '#52c41a' },
            prefix: <SafetyCertificateOutlined />,
          },
        ]}
      />

      <Space style={{ marginTop: 16, marginBottom: 16 }} wrap>
        <Input.Search
          placeholder="搜索IP"
          allowClear
          style={{ width: 200 }}
          prefix={<SearchOutlined />}
          onSearch={(v) => updateFilter('ip', v)}
        />
        <Select
          placeholder="Agent类型"
          allowClear
          style={{ width: 140 }}
          options={[
            { label: 'OpenClaw', value: 'openclaw' },
            { label: 'Unknown', value: 'unknown' },
          ]}
          onChange={(v) => updateFilter('agent_type', v || '')}
        />
        <Select
          placeholder="风险等级"
          allowClear
          style={{ width: 120 }}
          options={getRiskOptions()}
          onChange={(v) => updateFilter('risk_level', v || '')}
        />
      </Space>

      <Table
        columns={columns}
        dataSource={assets}
        rowKey="id"
        loading={isLoading}
        expandable={{ expandedRowRender: expandedRow }}
        pagination={{ total, pageSize: 20, showSizeChanger: true, showTotal: (t) => `共 ${t} 条` }}
        size="middle"
        scroll={{ x: 1200 }}
      />
    </div>
  )
}
