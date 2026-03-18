package l3

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

type AuthCheckResult struct {
	AuthMode    string
	Severity    string
	Description string
	Evidence    string
}

func CheckAuth(ip string, port int, timeout time.Duration) AuthCheckResult {
	client := &http.Client{Timeout: timeout}

	url := fmt.Sprintf("http://%s:%d/health", ip, port)
	resp, err := client.Get(url)
	if err != nil {
		return AuthCheckResult{
			AuthMode:    "unknown",
			Severity:    "info",
			Description: "Cannot determine authentication status",
			Evidence:    err.Error(),
		}
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(io.LimitReader(resp.Body, 64*1024))
	var health map[string]any
	if err := json.Unmarshal(body, &health); err != nil {
		return AuthCheckResult{
			AuthMode:    "unknown",
			Severity:    "info",
			Description: "Non-JSON health response",
		}
	}

	authMode := "unknown"
	if am, ok := health["auth_mode"].(string); ok {
		authMode = am
	}

	switch authMode {
	case "none", "open":
		return AuthCheckResult{
			AuthMode:    authMode,
			Severity:    "critical",
			Description: "Agent has NO authentication - fully accessible to anyone on the network",
			Evidence:    fmt.Sprintf("auth_mode=%s from /health endpoint", authMode),
		}
	case "token":
		return AuthCheckResult{
			AuthMode:    authMode,
			Severity:    "low",
			Description: "Token-based authentication enabled",
			Evidence:    "auth_mode=token",
		}
	case "device_auth":
		return AuthCheckResult{
			AuthMode:    authMode,
			Severity:    "low",
			Description: "Device-based authentication (ed25519) enabled",
			Evidence:    "auth_mode=device_auth",
		}
	default:
		return AuthCheckResult{
			AuthMode:    authMode,
			Severity:    "medium",
			Description: "Unknown authentication mode",
			Evidence:    fmt.Sprintf("auth_mode=%s", authMode),
		}
	}
}
