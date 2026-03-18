package l3

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

var knownMaliciousSkills = map[string]string{
	"@evilcorp/data-exfil":     "Known data exfiltration skill",
	"@malware/cryptominer":     "Cryptocurrency mining skill",
	"@ghostsocks/proxy":        "GhostSocks C2 proxy skill",
	"@backdoor/reverse-shell":  "Reverse shell backdoor",
	"@fake-official/admin":     "Impersonating official admin skill",
	"openclaw-skill-stealer":   "Credential stealing skill",
	"skill-inject-rce":         "Remote code execution via skill injection",
}

type SkillInfo struct {
	Name        string `json:"name"`
	Version     string `json:"version,omitempty"`
	Author      string `json:"author,omitempty"`
	Description string `json:"description,omitempty"`
}

type SkillsCheckResult struct {
	Skills           []SkillInfo
	MaliciousMatches []MaliciousMatch
	TotalSkills      int
	Accessible       bool
	Error            string
}

type MaliciousMatch struct {
	SkillName   string
	Reason      string
	Severity    string
}

func CheckSkills(ip string, port int, timeout time.Duration) SkillsCheckResult {
	client := &http.Client{Timeout: timeout}
	result := SkillsCheckResult{}

	endpoints := []string{
		fmt.Sprintf("http://%s:%d/api/skills", ip, port),
		fmt.Sprintf("http://%s:%d/api/v1/skills", ip, port),
		fmt.Sprintf("http://%s:%d/__openclaw/skills", ip, port),
	}

	for _, url := range endpoints {
		resp, err := client.Get(url)
		if err != nil {
			continue
		}
		defer resp.Body.Close()

		if resp.StatusCode == http.StatusUnauthorized || resp.StatusCode == http.StatusForbidden {
			result.Accessible = false
			return result
		}

		if resp.StatusCode != http.StatusOK {
			continue
		}

		body, _ := io.ReadAll(io.LimitReader(resp.Body, 256*1024))

		var skills []SkillInfo
		if err := json.Unmarshal(body, &skills); err != nil {
			var wrapper struct {
				Skills []SkillInfo `json:"skills"`
				Tools  []SkillInfo `json:"tools"`
			}
			if err2 := json.Unmarshal(body, &wrapper); err2 == nil {
				skills = wrapper.Skills
				if len(skills) == 0 {
					skills = wrapper.Tools
				}
			}
		}

		if len(skills) > 0 {
			result.Skills = skills
			result.TotalSkills = len(skills)
			result.Accessible = true

			for _, skill := range skills {
				nameLower := strings.ToLower(skill.Name)
				for pattern, reason := range knownMaliciousSkills {
					if strings.Contains(nameLower, strings.ToLower(pattern)) {
						result.MaliciousMatches = append(result.MaliciousMatches, MaliciousMatch{
							SkillName: skill.Name,
							Reason:    reason,
							Severity:  "critical",
						})
					}
				}
			}
			return result
		}
	}

	result.Error = "skills endpoint not accessible or returned no data"
	return result
}
