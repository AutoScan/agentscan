import { useState, useMemo } from 'react'
import { Table, Typography, Select, Space, Descriptions, Input, Tooltip, Tag } from 'antd'
import { BugOutlined, WarningOutlined, SafetyCertificateOutlined, SearchOutlined } from '@ant-design/icons'
import { useVulnList } from '@/api/vulns'
import StatCards from '@/components/StatCards'
import RiskTag from '@/components/RiskTag'
import { RISK_LABELS, getRiskOptions, cvssColor } from '@/constants'
import { CHECK_TYPE_LABELS, getCheckTypeOptions } from '@/constants/check'
import type { Vulnerability } from '@/types'

export default function Vulnerabilities() {
  const [filters, setFilters] = useState<Record<string, string>>({})
  const { data, isLoading } = useVulnList(filters)

  const vulns = data?.data ?? []
  const total = data?.total ?? 0

  const sevStats = useMemo(
    () =>
      vulns.reduce(
        (acc, v) => {
          acc[v.severity] = (acc[v.severity] || 0) + 1
          return acc
        },
        {} as Record<string, number>,
      ),
    [vulns],
  )

  const updateFilter = (key: string, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }))
  }

  const expandedRow = (record: Vulnerability) => (
    <Descriptions size="small" column={2} bordered>
      <Descriptions.Item label="完整描述" span={2}>
        {record.description || '-'}
      </Descriptions.Item>
      <Descriptions.Item label="修复建议" span={2}>
        <Typography.Text type="success">{record.remediation || '-'}</Typography.Text>
      </Descriptions.Item>
      <Descriptions.Item label="证据" span={2}>
        <Typography.Text code style={{ fontSize: 12, wordBreak: 'break-all' }}>
          {record.evidence || '-'}
        </Typography.Text>
      </Descriptions.Item>
      <Descriptions.Item label="检测时间">
        {record.detected_at ? new Date(record.detected_at).toLocaleString('zh-CN') : '-'}
      </Descriptions.Item>
      <Descriptions.Item label="关联资产">{record.asset_id || '-'}</Descriptions.Item>
    </Descriptions>
  )

  const columns = [
    {
      title: 'CVE编号',
      dataIndex: 'cve_id',
      key: 'cve_id',
      width: 160,
      render: (v: string) =>
        v ? (
          <Tooltip title="点击查看NVD详情">
            <Typography.Link href={`https://nvd.nist.gov/vuln/detail/${v}`} target="_blank">
              {v}
            </Typography.Link>
          </Tooltip>
        ) : (
          '-'
        ),
    },
    {
      title: '标题',
      dataIndex: 'title',
      key: 'title',
      width: 300,
      ellipsis: true,
      render: (v: string) => (
        <Tooltip title={v}>
          <Typography.Text strong>{v}</Typography.Text>
        </Tooltip>
      ),
    },
    {
      title: '严重等级',
      dataIndex: 'severity',
      key: 'severity',
      width: 100,
      render: (v: string) => <RiskTag level={v} />,
      filters: Object.entries(RISK_LABELS).map(([k, v]) => ({ text: v, value: k })),
      onFilter: (value: unknown, record: Vulnerability) => record.severity === value,
    },
    {
      title: 'CVSS',
      dataIndex: 'cvss',
      key: 'cvss',
      width: 80,
      align: 'right' as const,
      render: (v: number) => (
        <Typography.Text style={{ color: cvssColor(v), fontWeight: 'bold' }}>{v?.toFixed(1)}</Typography.Text>
      ),
      sorter: (a: Vulnerability, b: Vulnerability) => a.cvss - b.cvss,
      defaultSortOrder: 'descend' as const,
    },
    {
      title: '检测类型',
      dataIndex: 'check_type',
      key: 'check_type',
      width: 120,
      render: (v: string) => <Tag color="geekblue">{CHECK_TYPE_LABELS[v] || v}</Tag>,
    },
    {
      title: '修复建议',
      dataIndex: 'remediation',
      key: 'remediation',
      width: 220,
      ellipsis: true,
      render: (v: string) => <Typography.Text type="success">{v || '-'}</Typography.Text>,
    },
  ]

  return (
    <div>
      <Typography.Title level={4}>漏洞列表</Typography.Title>

      <StatCards
        loading={isLoading}
        items={[
          { title: '总漏洞', value: total, prefix: <BugOutlined /> },
          {
            title: '严重',
            value: sevStats.critical || 0,
            valueStyle: { color: '#f5222d' },
            prefix: <WarningOutlined />,
          },
          { title: '高危', value: sevStats.high || 0, valueStyle: { color: '#fa8c16' } },
          {
            title: '中/低危',
            value: (sevStats.medium || 0) + (sevStats.low || 0) + (sevStats.info || 0),
            valueStyle: { color: '#52c41a' },
            prefix: <SafetyCertificateOutlined />,
          },
        ]}
      />

      <Space style={{ marginTop: 16, marginBottom: 16 }} wrap>
        <Input.Search
          placeholder="搜索CVE编号"
          allowClear
          style={{ width: 200 }}
          prefix={<SearchOutlined />}
          onSearch={(v) => updateFilter('cve_id', v)}
        />
        <Select
          placeholder="严重等级"
          allowClear
          style={{ width: 120 }}
          options={getRiskOptions()}
          onChange={(v) => updateFilter('severity', v || '')}
        />
        <Select
          placeholder="检测类型"
          allowClear
          style={{ width: 140 }}
          options={getCheckTypeOptions()}
          onChange={(v) => updateFilter('check_type', v || '')}
        />
      </Space>

      <Table
        columns={columns}
        dataSource={vulns}
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
