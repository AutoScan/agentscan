package l3

import (
	"github.com/AutoScan/agentscan/internal/utils/version"
)

type CVEEntry struct {
	ID             string
	Title          string
	Severity       string
	CVSS           float64
	AffectedBefore string // versions below this are affected
	Description    string
	Remediation    string
}

var OpenClawCVEs = []CVEEntry{
	{
		ID: "CVE-2026-25253", Title: "ClawJacked: WebSocket Hijack → RCE",
		Severity: "high", CVSS: 8.8, AffectedBefore: "2026.2.25",
		Description: "Malicious websites can hijack local OpenClaw Gateway via WebSocket without Origin validation, enabling brute-force of auth token and full agent takeover.",
		Remediation: "Upgrade to >= 2026.2.25",
	},
	{
		ID: "CVE-2026-26972", Title: "Path Traversal via crafted skill paths",
		Severity: "high", CVSS: 7.5, AffectedBefore: "2026.3.2",
		Description: "Crafted skill installation path allows reading arbitrary files outside the skills directory.",
		Remediation: "Upgrade to >= 2026.3.2",
	},
	{
		ID: "CVE-2026-28470", Title: "Exec Whitelist Bypass",
		Severity: "critical", CVSS: 9.8, AffectedBefore: "2026.3.2",
		Description: "Bypass of command execution whitelist allows running arbitrary shell commands through the agent.",
		Remediation: "Upgrade to >= 2026.3.2",
	},
	{
		ID: "CVE-2026-26327", Title: "mDNS Gateway Spoofing",
		Severity: "high", CVSS: 7.2, AffectedBefore: "2026.2.25",
		Description: "Unauthenticated mDNS service advertisement allows gateway spoofing on local network.",
		Remediation: "Upgrade to >= 2026.2.25 and disable mDNS in production",
	},
	{
		ID: "CVE-2026-24163", Title: "Remote Code Execution via Skill Installation",
		Severity: "critical", CVSS: 9.8, AffectedBefore: "2026.1.24",
		Description: "Malicious skills can execute arbitrary code during installation without proper sandboxing.",
		Remediation: "Upgrade to >= 2026.1.24",
	},
	{
		ID: "CVE-2026-22234", Title: "Server-Side Request Forgery (SSRF)",
		Severity: "high", CVSS: 7.5, AffectedBefore: "2026.2.14",
		Description: "Agent can be tricked into making requests to internal network resources.",
		Remediation: "Upgrade to >= 2026.2.14",
	},
	{
		ID: "CVE-2026-21980", Title: "Authentication Bypass via Token Prediction",
		Severity: "critical", CVSS: 9.1, AffectedBefore: "2026.2.25",
		Description: "Weak token generation allows prediction and brute-force of authentication tokens.",
		Remediation: "Upgrade to >= 2026.2.25",
	},
}

type CVEMatchResult struct {
	CVE      CVEEntry
	Matched  bool
	Evidence string
}

func MatchCVEs(agentVersion string) []CVEMatchResult {
	var results []CVEMatchResult
	for _, cve := range OpenClawCVEs {
		matched := version.LessThan(agentVersion, cve.AffectedBefore)
		results = append(results, CVEMatchResult{
			CVE:      cve,
			Matched:  matched,
			Evidence: agentVersion + " < " + cve.AffectedBefore,
		})
	}
	return results
}
