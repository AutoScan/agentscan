package engine

import (
	"context"
	"fmt"
	"sync"
	"sync/atomic"
	"time"

	"github.com/AutoScan/agentscan/internal/core/eventbus"
	"github.com/AutoScan/agentscan/internal/models"
	"github.com/AutoScan/agentscan/internal/scanner"
	"github.com/AutoScan/agentscan/internal/scanner/l1"
	"github.com/AutoScan/agentscan/internal/scanner/l2"
	"github.com/AutoScan/agentscan/internal/scanner/l3"
	"github.com/AutoScan/agentscan/internal/utils/iputil"
	"github.com/google/uuid"
)

type PipelineConfig struct {
	Ports       []int
	ScanDepth   models.ScanDepth
	Timeout     time.Duration
	Concurrency int
	EnableMDNS  bool
	MDNSTimeout time.Duration
	EnablePoC   bool
	TaskID      string
}

type PipelineResult struct {
	Assets          []models.Asset
	Vulnerabilities []models.Vulnerability
	OpenPorts       int
	TotalScanned    int
}

type ProgressCallback func(scanned, total int, phase string)

type Pipeline struct {
	bus        eventbus.EventBus
	onProgress ProgressCallback
}

func NewPipeline(bus eventbus.EventBus) *Pipeline {
	return &Pipeline{bus: bus}
}

func (p *Pipeline) SetProgressCallback(cb ProgressCallback) {
	p.onProgress = cb
}

func (p *Pipeline) Run(ctx context.Context, targets string, cfg PipelineConfig) (*PipelineResult, error) {
	ips, err := iputil.ParseTargets(targets)
	if err != nil {
		return nil, fmt.Errorf("parse targets: %w", err)
	}

	result := &PipelineResult{TotalScanned: len(ips)}
	ports := cfg.Ports
	if len(ports) == 0 {
		ports = []int{18789, 18792, 3000, 8080, 8888}
	}

	// --- L1: Port Discovery ---
	var scannedCount int64
	tcpScanner := l1.NewTCPScanner(cfg.Timeout, cfg.Concurrency)
	var openPorts []scanner.PortResult
	var mu sync.Mutex
	var wg sync.WaitGroup
	sem := make(chan struct{}, cfg.Concurrency)
	var cancelled bool

	for _, ip := range ips {
		if ctx.Err() != nil {
			cancelled = true
			break
		}
		wg.Add(1)
		sem <- struct{}{}
		go func(ip string) {
			defer wg.Done()
			defer func() { <-sem }()

			results := tcpScanner.ScanPorts(ip, ports)
			var found []scanner.PortResult
			for _, r := range results {
				if r.Open {
					found = append(found, r)
				}
			}
			if len(found) > 0 {
				mu.Lock()
				openPorts = append(openPorts, found...)
				mu.Unlock()

				if p.bus != nil {
					p.bus.Publish(ctx, eventbus.Event{
						Topic:   eventbus.TopicPortDiscovered,
						Payload: found,
					})
				}
			}

			n := atomic.AddInt64(&scannedCount, 1)
			if p.onProgress != nil {
				p.onProgress(int(n), len(ips), "l1")
			}
		}(ip)
	}
	wg.Wait()
	result.OpenPorts = len(openPorts)

	if cancelled {
		return result, ctx.Err()
	}

	if cfg.ScanDepth == models.ScanDepthL1 || len(openPorts) == 0 {
		return result, nil
	}

	// --- mDNS Discovery ---
	mdnsEntries := make(map[string]l2.MDNSEntry)
	if cfg.EnableMDNS {
		mdnsTimeout := cfg.MDNSTimeout
		if mdnsTimeout == 0 {
			mdnsTimeout = 5 * time.Second
		}
		prober := l2.NewMDNSProber(mdnsTimeout)
		entries, _ := prober.Browse()
		for _, e := range entries {
			mdnsEntries[e.IP] = e
		}
	}

	// --- L2: Fingerprinting ---
	type endpoint struct {
		ip   string
		port int
	}
	seen := make(map[endpoint]bool)
	var l2Targets []endpoint
	for _, pr := range openPorts {
		ep := endpoint{pr.IP, pr.Port}
		if !seen[ep] {
			seen[ep] = true
			l2Targets = append(l2Targets, ep)
		}
	}
	for ip, e := range mdnsEntries {
		ep := endpoint{ip, e.Port}
		if !seen[ep] {
			seen[ep] = true
			l2Targets = append(l2Targets, ep)
		}
	}

	httpProber := l2.NewHTTPProber(cfg.Timeout)
	wsProber := l2.NewWSProber(cfg.Timeout)

	for i, ep := range l2Targets {
		if ctx.Err() != nil {
			return result, ctx.Err()
		}
		agent := fingerprint(ep.ip, ep.port, httpProber, wsProber, mdnsEntries)
		if agent.Score > 0 {
			asset := agentToAsset(agent, cfg.TaskID)

			if cfg.ScanDepth == models.ScanDepthL3 && agent.AgentType == "openclaw" {
				vulns := p.validateL3(asset, agent, cfg)
				result.Vulnerabilities = append(result.Vulnerabilities, vulns...)
			}

			result.Assets = append(result.Assets, asset)

			if p.bus != nil {
				p.bus.Publish(ctx, eventbus.Event{
					Topic:   eventbus.TopicAgentIdentified,
					Payload: asset,
				})
			}
		}

		if p.onProgress != nil {
			p.onProgress(i+1, len(l2Targets), "l2")
		}
	}

	return result, nil
}

func fingerprint(ip string, port int, hp *l2.HTTPProber, wp *l2.WSProber, mdns map[string]l2.MDNSEntry) scanner.AgentInfo {
	var probes []scanner.ProbeResult
	var score float64

	healthResult := hp.ProbeHealth(ip, port)
	probes = append(probes, healthResult)
	if healthResult.Matched {
		score += 30
	}

	htmlResult := hp.ProbeRootHTML(ip, port)
	probes = append(probes, htmlResult)
	if htmlResult.Matched {
		score += 20
	}

	configResult := hp.ProbeControlUIConfig(ip, port)
	probes = append(probes, configResult)
	if configResult.Matched {
		score += 20
	}

	wsResult := wp.Probe(ip, port)
	probes = append(probes, wsResult)
	if wsResult.Matched {
		score += 15
	}

	if entry, ok := mdns[ip]; ok {
		mdnsResult := scanner.ProbeResult{
			Type: "mdns", Success: true, Matched: true,
			Details: map[string]string{
				"agent_type": "openclaw",
				"version":    entry.Version,
				"agent_id":   entry.AgentID,
			},
		}
		probes = append(probes, mdnsResult)
		score += 15
	}

	if score > 100 {
		score = 100
	}

	agentType, ver, authMode, agentID := "unknown", "", "", ""
	for _, pr := range probes {
		if pr.Matched {
			if t, ok := pr.Details["agent_type"]; ok {
				agentType = t
			}
			if v, ok := pr.Details["version"]; ok && v != "" && ver == "" {
				ver = v
			}
			if a, ok := pr.Details["auth_mode"]; ok {
				authMode = a
			}
			if id, ok := pr.Details["agent_id"]; ok && id != "" && agentID == "" {
				agentID = id
			}
			if wa, ok := pr.Details["ws_auth"]; ok && authMode == "" {
				authMode = wa
			}
		}
	}

	return scanner.AgentInfo{
		IP: ip, Port: port,
		AgentType: agentType, Version: ver,
		AuthMode: authMode, AgentID: agentID,
		Probes: probes, Score: score,
	}
}

func (p *Pipeline) validateL3(asset models.Asset, agent scanner.AgentInfo, cfg PipelineConfig) []models.Vulnerability {
	input := l3.ValidationInput{
		IP: agent.IP, Port: agent.Port,
		AgentType: agent.AgentType, Version: agent.Version,
		AuthMode: agent.AuthMode, TaskID: cfg.TaskID, AssetID: asset.ID,
	}
	output := l3.Validate(input, l3.ValidatorConfig{Timeout: cfg.Timeout, EnablePoC: cfg.EnablePoC})

	if p.bus != nil {
		for _, v := range output.Vulnerabilities {
			p.bus.Publish(context.Background(), eventbus.Event{
				Topic:   eventbus.TopicVulnDetected,
				Payload: v,
			})
		}
	}

	return output.Vulnerabilities
}

func agentToAsset(agent scanner.AgentInfo, taskID string) models.Asset {
	probeMap := models.JSONMap{"probes": agent.Probes}

	meta := models.JSONMap{}
	for _, pr := range agent.Probes {
		if pr.Matched {
			for k, v := range pr.Details {
				if k != "agent_type" && k != "version" && k != "auth_mode" && k != "agent_id" {
					meta[k] = v
				}
			}
		}
	}

	return models.Asset{
		ID:           uuid.New().String(),
		TaskID:       taskID,
		IP:           agent.IP,
		Port:         agent.Port,
		AgentType:    agent.AgentType,
		Version:      agent.Version,
		AuthMode:     agent.AuthMode,
		AgentID:      agent.AgentID,
		Confidence:   agent.Score,
		RiskLevel:    models.RiskFromAuthMode(agent.AuthMode),
		Status:       models.AssetStatusActive,
		ProbeDetails: probeMap,
		Metadata:     meta,
	}
}
