import { useEffect, useMemo, useState } from 'react'
import type { ColumnsType } from 'antd/es/table'
import { Table, Typography, Select, Space, Descriptions, Input, Tooltip, Tag, Button } from 'antd'
import { BugOutlined, WarningOutlined, SafetyCertificateOutlined, SearchOutlined } from '@ant-design/icons'
import { useVulnList } from '@/api/vulns'
import StatCards from '@/components/StatCards'
import RiskTag from '@/components/RiskTag'
import { cvssColor, getRiskOptions } from '@/constants'
import { CHECK_TYPE_LABELS, getCheckTypeOptions } from '@/constants/check'
import { useURLQueryState } from '@/hooks/useURLQueryState'
import type { Vulnerability, VulnListParams } from '@/types'

type VulnerabilityQueryState = {
  page: number
  limit: number
  cve_id: string
  severity: string
  check_type: string
}

const VULN_QUERY_DEFAULTS: VulnerabilityQueryState = {
  page: 1,
  limit: 20,
  cve_id: '',
  severity: '',
  check_type: '',
}

export default function Vulnerabilities() {
  const { params, setParams, resetParams } = useURLQueryState(VULN_QUERY_DEFAULTS)
  const [searchCVE, setSearchCVE] = useState(params.cve_id)

  useEffect(() => {
    setSearchCVE(params.cve_id)
  }, [params.cve_id])

  const queryParams: VulnListParams = {
    page: params.page,
    limit: params.limit,
    cve_id: params.cve_id || undefined,
    severity: params.severity ? (params.severity as Vulnerability['severity']) : undefined,
    check_type: params.check_type ? (params.check_type as Vulnerability['check_type']) : undefined,
  }

  const { data, isLoading } = useVulnList(queryParams)

  const vulns = data?.data ?? []
  const total = data?.total ?? 0

  const sevStats = useMemo(
    () =>
      vulns.reduce(
        (acc, vuln) => {
          acc[vuln.severity] = (acc[vuln.severity] || 0) + 1
          return acc
        },
        {} as Record<string, number>,
      ),
    [vulns],
  )

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

  const columns: ColumnsType<Vulnerability> = [
    {
      title: 'CVE编号',
      dataIndex: 'cve_id',
      key: 'cve_id',
      width: 160,
      render: (value: string) =>
        value ? (
          <Tooltip title="点击查看NVD详情">
            <Typography.Link href={`https://nvd.nist.gov/vuln/detail/${value}`} target="_blank">
              {value}
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
      render: (value: string) => (
        <Tooltip title={value}>
          <Typography.Text strong>{value}</Typography.Text>
        </Tooltip>
      ),
    },
    {
      title: '严重等级',
      dataIndex: 'severity',
      key: 'severity',
      width: 100,
      render: (value: string) => <RiskTag level={value} />,
    },
    {
      title: 'CVSS',
      dataIndex: 'cvss',
      key: 'cvss',
      width: 80,
      align: 'right',
      render: (value: number) => (
        <Typography.Text style={{ color: cvssColor(value), fontWeight: 'bold' }}>{value?.toFixed(1)}</Typography.Text>
      ),
    },
    {
      title: '检测类型',
      dataIndex: 'check_type',
      key: 'check_type',
      width: 120,
      render: (value: string) => <Tag color="geekblue">{CHECK_TYPE_LABELS[value] || value}</Tag>,
    },
    {
      title: '修复建议',
      dataIndex: 'remediation',
      key: 'remediation',
      width: 220,
      ellipsis: true,
      render: (value: string) => <Typography.Text type="success">{value || '-'}</Typography.Text>,
    },
  ]

  const hasFilters = Boolean(params.cve_id || params.severity || params.check_type)

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
          style={{ width: 220 }}
          prefix={<SearchOutlined />}
          value={searchCVE}
          onChange={(event) => setSearchCVE(event.target.value)}
          onSearch={(value) => setParams({ cve_id: value.trim(), page: 1 }, { replace: false })}
        />
        <Select
          placeholder="严重等级"
          allowClear
          style={{ width: 140 }}
          value={params.severity || undefined}
          options={getRiskOptions()}
          onChange={(value) => setParams({ severity: value ?? '', page: 1 }, { replace: false })}
        />
        <Select
          placeholder="检测类型"
          allowClear
          style={{ width: 160 }}
          value={params.check_type || undefined}
          options={getCheckTypeOptions()}
          onChange={(value) => setParams({ check_type: value ?? '', page: 1 }, { replace: false })}
        />
        {hasFilters && (
          <Button onClick={() => resetParams({}, { replace: false })}>
            清空筛选
          </Button>
        )}
      </Space>

      <Table
        columns={columns}
        dataSource={vulns}
        rowKey="id"
        loading={isLoading}
        expandable={{ expandedRowRender: expandedRow }}
        pagination={{
          current: params.page,
          pageSize: params.limit,
          total,
          showSizeChanger: true,
          showTotal: (value) => `共 ${value} 条`,
          onChange: (page, pageSize) => setParams({ page, limit: pageSize }, { replace: false }),
        }}
        size="middle"
        scroll={{ x: 1200 }}
      />
    </div>
  )
}
