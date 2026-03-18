# AgentScan

[中文文档](README.zh-CN.md)

**AI Agent Network Asset Discovery & Security Audit Platform**

> Detect, fingerprint, and assess exposed AI Agent instances across your network — from LAN to the public internet.

---

## Why AgentScan?

In early 2026, platforms like OpenClaw, clawhive, GoGogot, Hermes Agent, and Pincer exploded in popularity. Non-technical users deployed AI agents on personal machines with high privileges and default configs, creating a massive attack surface:

- **42,000+** OpenClaw instances exposed on the public internet, 93% with auth bypass
- **Default bind `0.0.0.0:18789`**, 85% directly reachable from the internet
- **341+ malicious skill packages** poisoning the official marketplace
- **1.5M API tokens leaked**, 35K user emails exposed
- Government agencies in China issued formal security advisories; banks and state enterprises banned usage

AgentScan provides organizations with end-to-end AI Agent exposure discovery, vulnerability detection, and compliance auditing.

## Features

- **Layered Scanning** — L1 port discovery → L2 fingerprinting → L3 vulnerability verification
- **Multi-Agent Support** — OpenClaw (all versions) + clawhive + GoGogot + Hermes + Pincer
- **CVE Detection** — 7 known CVEs, auth bypass checks, Skills enumeration, PoC validation
- **Real-time Dashboard** — React + ECharts with WebSocket live updates
- **Task Management** — One-time, scheduled (cron), and recurring scan tasks
- **Alert Engine** — Configurable rules with Webhook notification + DB-persisted history
- **Excel Reports** — 4-sheet export (summary, assets, vulnerabilities, remediation)
- **Threat Intelligence** — FOFA integration for internet-scale discovery
- **GeoIP Ready** — MaxMind GeoLite2 interface for region-based scanning

## Quick Start

### Prerequisites

- Go 1.23+ (with CGO enabled for SQLite)
- Node.js 18+ (for frontend)

### 1. Clone

```bash
git clone https://github.com/AutoScan/agentscan.git
cd agentscan
```

### 2. Configure

```bash
cp configs/config.yaml.example _data/config.yaml
# Edit _data/config.yaml as needed
```

### 3. Run Backend

```bash
go run cmd/agentscan/main.go server
```

### 4. Run Frontend (development)

```bash
cd web && npm install && npm run dev
```

### 5. Login

Open `http://localhost:5173` and sign in with:
- Username: `admin`
- Password: `agentscan`

### Quick Start with Docker

```bash
docker run -d --name agentscan -p 8080:8080 \
  -v agentscan-data:/data \
  -e AGENTSCAN_AUTH_JWT_SECRET=my-secret \
  ghcr.io/autoscan/agentscan:latest
```

Or use Docker Compose:

```bash
curl -O https://raw.githubusercontent.com/AutoScan/agentscan/main/docker-compose.yml
docker compose up -d
```

Open `http://localhost:8080`.

### Run a Scan (CLI)

```bash
go run cmd/agentscan/main.go scan --targets 192.168.1.0/24
```

## Architecture

```
┌─────────────┐     ┌──────────────────────────────────────────┐
│  React SPA  │────▶│  Gin REST API + WebSocket                │
│  Ant Design │◀────│  JWT Auth · CORS · RequestID · AccessLog │
│  ECharts    │     └──────────┬───────────────────────────────┘
└─────────────┘                │
                    ┌──────────▼───────────────┐
                    │    Scan Pipeline Engine   │
                    │  L1 Port → L2 FP → L3 Vuln│
                    └──────────┬───────────────┘
                               │
              ┌────────────────┼────────────────┐
              ▼                ▼                ▼
        ┌──────────┐   ┌───────────┐   ┌──────────────┐
        │  EventBus │   │   Store   │   │  Alert Engine│
        │ (pub/sub) │   │(GORM/SQL) │   │  (Webhook)   │
        └──────────┘   └───────────┘   └──────────────┘
```

### Scan Layers

| Layer | Purpose | Implementation |
|-------|---------|----------------|
| **L1** | Port discovery | TCP CONNECT scan, configurable concurrency |
| **L2** | Fingerprinting | HTTP/WebSocket/mDNS probes, agent type identification |
| **L3** | Vulnerability check | CVE matching, auth bypass, Skills enum, PoC |

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Backend | Go 1.23 · Gin · GORM · Cobra · Viper · zap |
| Frontend | React 18 · TypeScript · Ant Design · ECharts · Zustand · TanStack Query |
| Database | SQLite (dev) / PostgreSQL (prod) |
| Build | `go build` (backend) · Vite (frontend) |

## Project Structure

```
AgentScan/
├── cmd/agentscan/          # CLI entry (server/scan/migrate/version)
├── cmd/mock-openclaw/      # Mock target server for testing
├── configs/                # Config template (config.yaml.example)
├── _data/                  # Runtime data — db & config (gitignored)
├── internal/
│   ├── core/               # Infrastructure (config, eventbus, logger)
│   ├── utils/              # Pure utilities (iputil, version)
│   ├── models/             # GORM data models
│   ├── store/              # Persistence layer (SQLite/PostgreSQL)
│   ├── scanner/l1/         # TCP port scanner
│   ├── scanner/l2/         # HTTP/WS/mDNS fingerprinting
│   ├── scanner/l3/         # CVE/Auth/Skills/PoC checks
│   ├── engine/             # L1→L2→L3 pipeline orchestration
│   ├── api/                # REST API + WebSocket
│   ├── auth/               # JWT authentication
│   ├── task/               # Task manager + cron scheduler
│   ├── alert/              # Alert engine
│   ├── report/             # Excel report generator
│   ├── intel/              # FOFA threat intelligence
│   └── geoip/              # GeoIP service
├── web/                    # React frontend
├── AGENTS.md               # AI coding assistant guidelines
└── scripts/                # Utility scripts
```

## Configuration

AgentScan uses [Viper](https://github.com/spf13/viper) for configuration with the following priority:

1. CLI flags (`--config path/to/config.yaml`)
2. Environment variables (`AGENTSCAN_SERVER_PORT=9090`)
3. Config file (searched in `./`, `./configs/`, `./_data/`, `/etc/agentscan/`)
4. Built-in defaults

See `configs/config.yaml.example` for all available options.

## Development

```bash
make build        # Build frontend + backend (single binary → bin/agentscan)
make dev          # Run backend (go run or air)
make dev-web      # Run frontend Vite dev server
make dev-all      # Run both in parallel
make test         # go test ./...
make lint         # go vet ./...
make docker       # Build Docker image locally
make help         # Show all targets
```

### Docker

```bash
# Build locally
make docker

# Run with docker-compose
docker compose up -d

# Stop
docker compose down
```

The Docker image is a multi-stage build producing a ~30 MB Alpine image with the frontend embedded.
Data is stored in the `/data` volume. Configure via environment variables (`AGENTSCAN_*`).

## Roadmap

| Phase | Focus | Status |
|-------|-------|--------|
| **P1** | L1/L2/L3 scan pipeline, REST API, React dashboard, JWT auth, task management, alerts, Excel reports | Done |
| **P2** | SYN scan, concurrent L2, YAML fingerprint/CVE databases, RBAC, rate limiting, Prometheus metrics, health checks | Planned |
| **P3** | Redis EventBus, ClickHouse time-series, PDF/Word reports, Swagger/OpenAPI | Planned |
| **P4** | Distributed workers (gRPC), multi-tenancy, SSO (LDAP/OAuth2), asset groups, compliance templates, i18n | Future |

## Contributing

Contributions are welcome. Please:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Run `go build ./...` and `go test ./...` before committing
4. Use descriptive commit messages (`module: action description`)
5. Open a Pull Request

## License

[MIT](LICENSE)
