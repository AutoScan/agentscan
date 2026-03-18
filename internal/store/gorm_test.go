package store

import (
	"context"
	"testing"

	"github.com/AutoScan/agentscan/internal/models"
	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func testStore(t *testing.T) Store {
	s, err := NewGormStoreSimple("sqlite", ":memory:")
	require.NoError(t, err)
	require.NoError(t, s.AutoMigrate())
	return s
}

func TestTaskCRUD(t *testing.T) {
	s := testStore(t)
	ctx := context.Background()

	task := &models.Task{
		ID:      uuid.New().String(),
		Name:    "test-scan",
		Targets: "192.168.1.0/24",
		Status:  models.TaskStatusPending,
		Type:    models.TaskTypeInstant,
	}

	err := s.CreateTask(ctx, task)
	assert.NoError(t, err)

	got, err := s.GetTask(ctx, task.ID)
	assert.NoError(t, err)
	assert.Equal(t, "test-scan", got.Name)
	assert.Equal(t, models.TaskStatusPending, got.Status)

	got.Status = models.TaskStatusRunning
	err = s.UpdateTask(ctx, got)
	assert.NoError(t, err)

	tasks, total, err := s.ListTasks(ctx, TaskFilter{})
	assert.NoError(t, err)
	assert.Equal(t, int64(1), total)
	assert.Equal(t, 1, len(tasks))

	err = s.DeleteTask(ctx, task.ID)
	assert.NoError(t, err)

	_, err = s.GetTask(ctx, task.ID)
	assert.Error(t, err)
}

func TestAssetUpsert(t *testing.T) {
	s := testStore(t)
	ctx := context.Background()

	asset := &models.Asset{
		ID:        uuid.New().String(),
		IP:        "192.168.1.1",
		Port:      18789,
		AgentType: "openclaw",
		Version:   "2026.3.13",
		RiskLevel: models.RiskCritical,
		Status:    models.AssetStatusActive,
	}

	err := s.UpsertAsset(ctx, asset)
	assert.NoError(t, err)

	asset2 := &models.Asset{
		ID:        uuid.New().String(),
		IP:        "192.168.1.1",
		Port:      18789,
		AgentType: "openclaw",
		Version:   "2026.3.14",
		RiskLevel: models.RiskLow,
		Status:    models.AssetStatusActive,
	}
	err = s.UpsertAsset(ctx, asset2)
	assert.NoError(t, err)

	assets, total, err := s.ListAssets(ctx, AssetFilter{})
	assert.NoError(t, err)
	assert.Equal(t, int64(1), total)
	assert.Equal(t, "2026.3.14", assets[0].Version)
}

func TestVulnerabilities(t *testing.T) {
	s := testStore(t)
	ctx := context.Background()

	vuln := &models.Vulnerability{
		ID:       uuid.New().String(),
		AssetID:  "asset-1",
		CVEID:    "CVE-2026-25253",
		Title:    "WebSocket Hijack",
		Severity: models.SeverityHigh,
		CVSS:     8.8,
	}

	err := s.CreateVulnerability(ctx, vuln)
	assert.NoError(t, err)

	vulns, total, err := s.ListVulnerabilities(ctx, VulnFilter{})
	assert.NoError(t, err)
	assert.Equal(t, int64(1), total)
	assert.Equal(t, "CVE-2026-25253", vulns[0].CVEID)
}

func TestDashboardStats(t *testing.T) {
	s := testStore(t)
	ctx := context.Background()

	s.CreateTask(ctx, &models.Task{ID: uuid.New().String(), Name: "t1", Status: models.TaskStatusCompleted, Type: models.TaskTypeInstant, Targets: "x"})
	s.CreateAsset(ctx, &models.Asset{ID: uuid.New().String(), IP: "1.1.1.1", Port: 18789, RiskLevel: models.RiskCritical, AgentType: "openclaw", Status: models.AssetStatusActive})
	s.CreateVulnerability(ctx, &models.Vulnerability{ID: uuid.New().String(), AssetID: "a1", Title: "test", Severity: models.SeverityHigh})

	stats, err := s.GetDashboardStats(ctx)
	assert.NoError(t, err)
	assert.Equal(t, int64(1), stats.TotalTasks)
	assert.Equal(t, int64(1), stats.TotalAssets)
	assert.Equal(t, int64(1), stats.TotalVulns)
}

func TestUserAuth(t *testing.T) {
	s := testStore(t)
	ctx := context.Background()

	user := &models.User{
		ID:       uuid.New().String(),
		Username: "admin",
		Password: "hashed",
		Role:     "admin",
	}

	err := s.CreateUser(ctx, user)
	assert.NoError(t, err)

	got, err := s.GetUserByUsername(ctx, "admin")
	assert.NoError(t, err)
	assert.Equal(t, "admin", got.Username)

	_, err = s.GetUserByUsername(ctx, "nonexist")
	assert.Error(t, err)
}
