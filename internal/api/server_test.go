package api

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/AutoScan/agentscan/internal/core/config"
	"github.com/AutoScan/agentscan/internal/core/eventbus"
	"github.com/AutoScan/agentscan/internal/store"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func setupTestServer(t *testing.T) (*Server, string) {
	cfg := config.Default()
	cfg.Auth.Username = "test"
	cfg.Auth.Password = "test123"

	s, err := store.NewGormStoreSimple("sqlite", ":memory:")
	require.NoError(t, err)
	require.NoError(t, s.AutoMigrate())

	bus := eventbus.NewLocal()
	srv := NewServer(cfg, s, bus, nil)

	require.NoError(t, srv.auth.EnsureAdminUser(context.Background()))

	// Login to get token
	body, _ := json.Marshal(map[string]string{"username": "test", "password": "test123"})
	req := httptest.NewRequest("POST", "/api/v1/auth/login", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	srv.router.ServeHTTP(w, req)
	require.Equal(t, http.StatusOK, w.Code)

	var loginResp map[string]string
	json.Unmarshal(w.Body.Bytes(), &loginResp)
	token := loginResp["token"]
	require.NotEmpty(t, token)

	return srv, token
}

func TestLoginFlow(t *testing.T) {
	cfg := config.Default()
	cfg.Auth.Username = "admin"
	cfg.Auth.Password = "pass"

	s, _ := store.NewGormStoreSimple("sqlite", ":memory:")
	s.AutoMigrate()
	bus := eventbus.NewLocal()
	srv := NewServer(cfg, s, bus, nil)
	srv.auth.EnsureAdminUser(context.Background())

	body, _ := json.Marshal(map[string]string{"username": "admin", "password": "wrong"})
	req := httptest.NewRequest("POST", "/api/v1/auth/login", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	srv.router.ServeHTTP(w, req)
	assert.Equal(t, http.StatusUnauthorized, w.Code)

	body, _ = json.Marshal(map[string]string{"username": "admin", "password": "pass"})
	req = httptest.NewRequest("POST", "/api/v1/auth/login", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w = httptest.NewRecorder()
	srv.router.ServeHTTP(w, req)
	assert.Equal(t, http.StatusOK, w.Code)
}

func TestTaskAPI(t *testing.T) {
	srv, token := setupTestServer(t)

	// Create task (type=scheduled so it doesn't auto-start)
	taskBody, _ := json.Marshal(map[string]any{
		"name":       "test-scan",
		"targets":    "127.0.0.1",
		"scan_depth": "l1",
		"type":       "scheduled",
		"cron_expr":  "0 */6 * * *",
	})
	req := httptest.NewRequest("POST", "/api/v1/tasks", bytes.NewReader(taskBody))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+token)
	w := httptest.NewRecorder()
	srv.router.ServeHTTP(w, req)
	assert.Equal(t, http.StatusCreated, w.Code)

	var created map[string]any
	json.Unmarshal(w.Body.Bytes(), &created)
	taskID := created["id"].(string)
	assert.NotEmpty(t, taskID)

	// List tasks
	req = httptest.NewRequest("GET", "/api/v1/tasks", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	w = httptest.NewRecorder()
	srv.router.ServeHTTP(w, req)
	assert.Equal(t, http.StatusOK, w.Code)

	var listResp map[string]any
	json.Unmarshal(w.Body.Bytes(), &listResp)
	assert.GreaterOrEqual(t, listResp["total"].(float64), float64(1))

	// Get task
	req = httptest.NewRequest("GET", "/api/v1/tasks/"+taskID, nil)
	req.Header.Set("Authorization", "Bearer "+token)
	w = httptest.NewRecorder()
	srv.router.ServeHTTP(w, req)
	assert.Equal(t, http.StatusOK, w.Code)

	// Delete task
	req = httptest.NewRequest("DELETE", "/api/v1/tasks/"+taskID, nil)
	req.Header.Set("Authorization", "Bearer "+token)
	w = httptest.NewRecorder()
	srv.router.ServeHTTP(w, req)
	assert.Equal(t, http.StatusOK, w.Code)
}

func TestDashboardAPI(t *testing.T) {
	srv, token := setupTestServer(t)

	req := httptest.NewRequest("GET", "/api/v1/dashboard/stats", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	w := httptest.NewRecorder()
	srv.router.ServeHTTP(w, req)
	assert.Equal(t, http.StatusOK, w.Code)

	var stats map[string]any
	json.Unmarshal(w.Body.Bytes(), &stats)
	assert.Contains(t, stats, "total_tasks")
	assert.Contains(t, stats, "total_assets")
	assert.Contains(t, stats, "total_vulns")
}

func TestProtectedEndpointsRequireAuth(t *testing.T) {
	cfg := config.Default()
	s, _ := store.NewGormStoreSimple("sqlite", ":memory:")
	s.AutoMigrate()
	srv := NewServer(cfg, s, eventbus.NewLocal(), nil)

	endpoints := []string{"/api/v1/tasks", "/api/v1/assets", "/api/v1/vulns", "/api/v1/dashboard/stats"}
	for _, ep := range endpoints {
		req := httptest.NewRequest("GET", ep, nil)
		w := httptest.NewRecorder()
		srv.router.ServeHTTP(w, req)
		assert.Equal(t, http.StatusUnauthorized, w.Code, "endpoint %s should require auth", ep)
	}
}
