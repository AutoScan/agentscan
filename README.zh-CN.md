# AgentScan

[English](README.md)

**AI Agent 网络资产发现与安全审计平台**

> 检测、识别和评估网络中暴露的 AI Agent 实例 —— 从内网到公网。

---

## 为什么需要 AgentScan？

2026 年初，以 OpenClaw 为代表的开源 AI Agent 平台爆发式增长，大量非技术用户在主力电脑上以高权限、默认配置部署，导致严重的安全危机：

- **4.29 万+** OpenClaw 实例暴露在公网，93% 存在认证绕过
- **默认绑定 `0.0.0.0:18789`**，85% 部署直接暴露至公网
- **341+ 恶意技能包**投毒官方市场
- **150 万 API Token 泄露**，3.5 万用户邮箱曝光
- 工信部发布安全预警，银行/国企/券商全面禁用

与此同时，clawhive、GoGogot、Hermes Agent、Pincer 等同类平台层出不穷，安全隐患更加隐蔽。

AgentScan 为组织提供一站式 AI Agent 暴露面发现、漏洞检测与合规审计能力。

## 核心特性

- **分层扫描** —— L1 端口发现 → L2 指纹识别 → L3 漏洞验证
- **多平台支持** —— OpenClaw（全版本）+ clawhive + GoGogot + Hermes + Pincer
- **CVE 检测** —— 7 个已知 CVE、认证绕过检查、Skills 枚举、PoC 验证
- **实时大屏** —— React + ECharts，WebSocket 实时更新
- **任务管理** —— 单次/定时/周期扫描任务，Cron 调度
- **告警引擎** —— 可配规则 + Webhook 通知 + 历史记录持久化
- **Excel 报告** —— 4 张工作表导出（概况/资产/漏洞/修复清单）
- **威胁情报** —— FOFA 集成，支持互联网规模发现
- **GeoIP 就绪** —— MaxMind GeoLite2 接口，支持按区域扫描

## 快速开始

### 环境要求

- Go 1.23+（需启用 CGO 以支持 SQLite）
- Node.js 18+（前端）

### 1. 克隆仓库

```bash
git clone https://github.com/AutoScan/agentscan.git
cd agentscan
```

### 2. 配置

```bash
cp configs/config.yaml.example _data/config.yaml
# 根据需要编辑 _data/config.yaml
```

### 3. 启动后端

```bash
go run cmd/agentscan/main.go server
```

### 4. 启动前端（开发模式）

```bash
cd web && npm install && npm run dev
```

### 5. 登录

打开 `http://localhost:5173`，使用默认账号登录：
- 用户名：`admin`
- 密码：`agentscan`

### Docker 快速启动

```bash
docker run -d --name agentscan -p 8080:8080 \
  -v agentscan-data:/data \
  -e AGENTSCAN_AUTH_JWT_SECRET=my-secret \
  ghcr.io/autoscan/agentscan:latest
```

或使用 Docker Compose：

```bash
curl -O https://raw.githubusercontent.com/AutoScan/agentscan/main/docker-compose.yml
docker compose up -d
```

打开 `http://localhost:8080` 即可访问。

### 命令行扫描

```bash
go run cmd/agentscan/main.go scan --targets 192.168.1.0/24
```

## 架构概览

```
┌─────────────┐     ┌──────────────────────────────────────────┐
│  React SPA  │────▶│  Gin REST API + WebSocket                │
│  Ant Design │◀────│  JWT 认证 · CORS · RequestID · 访问日志   │
│  ECharts    │     └──────────┬───────────────────────────────┘
└─────────────┘                │
                    ┌──────────▼───────────────┐
                    │      扫描流水线引擎       │
                    │  L1 端口 → L2 指纹 → L3 漏洞│
                    └──────────┬───────────────┘
                               │
              ┌────────────────┼────────────────┐
              ▼                ▼                ▼
        ┌──────────┐   ┌───────────┐   ┌──────────────┐
        │  事件总线  │   │  数据存储  │   │   告警引擎   │
        │ (发布/订阅)│   │(GORM/SQL) │   │  (Webhook)   │
        └──────────┘   └───────────┘   └──────────────┘
```

### 扫描层级

| 层级 | 功能 | 实现方式 |
|------|------|----------|
| **L1** | 端口发现 | TCP CONNECT 扫描，可配并发数 |
| **L2** | 指纹识别 | HTTP/WebSocket/mDNS 探针，Agent 类型识别 |
| **L3** | 漏洞验证 | CVE 匹配、认证绕过检测、Skills 枚举、PoC 验证 |

## 技术栈

| 组件 | 技术方案 |
|------|----------|
| 后端 | Go 1.23 · Gin · GORM · Cobra · Viper · zap |
| 前端 | React 18 · TypeScript · Ant Design · ECharts · Zustand · TanStack Query |
| 数据库 | SQLite（开发）/ PostgreSQL（生产） |
| 构建 | `go build`（后端）· Vite（前端） |

## 目录结构

```
AgentScan/
├── cmd/agentscan/          # CLI 入口（server/scan/migrate/version）
├── cmd/mock-openclaw/      # 测试用模拟目标服务器
├── configs/                # 配置模板（config.yaml.example）
├── _data/                  # 运行时数据 — 数据库和配置（已 gitignore）
├── internal/
│   ├── core/               # 基础设施（配置、事件总线、日志）
│   ├── utils/              # 纯工具函数（IP 解析、版本比较）
│   ├── models/             # GORM 数据模型
│   ├── store/              # 持久化层（SQLite/PostgreSQL）
│   ├── scanner/l1/         # TCP 端口扫描器
│   ├── scanner/l2/         # HTTP/WS/mDNS 指纹识别
│   ├── scanner/l3/         # CVE/认证/Skills/PoC 检测
│   ├── engine/             # L1→L2→L3 流水线编排
│   ├── api/                # REST API + WebSocket
│   ├── auth/               # JWT 认证
│   ├── task/               # 任务管理 + Cron 调度
│   ├── alert/              # 告警引擎
│   ├── report/             # Excel 报告生成
│   ├── intel/              # FOFA 威胁情报
│   └── geoip/              # GeoIP 服务
├── web/                    # React 前端
├── AGENTS.md               # AI 编码助手指南
└── scripts/                # 实用脚本
```

## 配置说明

AgentScan 使用 [Viper](https://github.com/spf13/viper) 进行配置管理，优先级如下：

1. CLI 参数（`--config path/to/config.yaml`）
2. 环境变量（`AGENTSCAN_SERVER_PORT=9090`）
3. 配置文件（搜索路径：`./` → `./configs/` → `./_data/` → `/etc/agentscan/`）
4. 内置默认值

完整配置项参见 `configs/config.yaml.example`。

## 开发指南

```bash
make build        # 构建前端 + 后端（单二进制 → bin/agentscan）
make dev          # 启动后端（go run 或 air 热重载）
make dev-web      # 启动前端 Vite 开发服务器
make dev-all      # 同时启动前后端
make test         # go test ./...
make lint         # go vet ./...
make docker       # 本地构建 Docker 镜像
make help         # 显示所有可用命令
```

### Docker

```bash
# 本地构建
make docker

# 使用 docker-compose 启动
docker compose up -d

# 停止
docker compose down
```

Docker 镜像采用多阶段构建，最终产出约 30 MB 的 Alpine 镜像，前端已静态嵌入。
数据存储在 `/data` 卷中，通过环境变量（`AGENTSCAN_*`）进行配置。

## 路线图

| 阶段 | 重点方向 | 状态 |
|------|---------|------|
| **P1** | L1/L2/L3 扫描流水线、REST API、React 大屏、JWT 认证、任务管理、告警引擎、Excel 报告 | 已完成 |
| **P2** | SYN 扫描、并发 L2、YAML 指纹/CVE 数据库、RBAC 权限、限流、Prometheus 指标、健康检查 | 计划中 |
| **P3** | Redis 事件总线、ClickHouse 时序存储、PDF/Word 报告、Swagger/OpenAPI 文档 | 计划中 |
| **P4** | 分布式 Worker（gRPC）、多租户、SSO（LDAP/OAuth2）、资产分组、合规模板、国际化 | 远期 |

## 参与贡献

欢迎提交贡献，请遵循以下流程：

1. Fork 本仓库
2. 创建功能分支（`git checkout -b feature/amazing-feature`）
3. 提交前运行 `go build ./...` 和 `go test ./...`
4. 使用清晰的提交信息（`模块: 操作描述`）
5. 提交 Pull Request

## 许可证

[MIT](LICENSE)
