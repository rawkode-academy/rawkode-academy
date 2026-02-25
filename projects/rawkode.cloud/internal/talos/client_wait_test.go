package talos

import (
	"context"
	"errors"
	"strings"
	"testing"
	"time"
)

func TestWaitForMaintenanceRetriesUntilProbeSucceeds(t *testing.T) {
	originalProbe := waitForMaintenanceProbeFn
	originalInterval := waitForMaintenancePollInterval
	originalProbeTimeout := waitForMaintenanceProbeTimeout
	t.Cleanup(func() {
		waitForMaintenanceProbeFn = originalProbe
		waitForMaintenancePollInterval = originalInterval
		waitForMaintenanceProbeTimeout = originalProbeTimeout
	})

	waitForMaintenancePollInterval = time.Millisecond
	waitForMaintenanceProbeTimeout = 50 * time.Millisecond

	attempts := 0
	waitForMaintenanceProbeFn = func(_ context.Context, endpoint string) error {
		attempts++
		if endpoint != "203.0.113.10" {
			t.Fatalf("probe endpoint = %q, want %q", endpoint, "203.0.113.10")
		}
		if attempts < 3 {
			return errors.New("talos api not ready")
		}
		return nil
	}

	if err := WaitForMaintenance(context.Background(), "203.0.113.10", 100*time.Millisecond); err != nil {
		t.Fatalf("WaitForMaintenance returned error: %v", err)
	}
	if attempts != 3 {
		t.Fatalf("probe attempts = %d, want %d", attempts, 3)
	}
}

func TestWaitForMaintenanceTimesOutWhenProbeNeverSucceeds(t *testing.T) {
	originalProbe := waitForMaintenanceProbeFn
	originalInterval := waitForMaintenancePollInterval
	originalProbeTimeout := waitForMaintenanceProbeTimeout
	t.Cleanup(func() {
		waitForMaintenanceProbeFn = originalProbe
		waitForMaintenancePollInterval = originalInterval
		waitForMaintenanceProbeTimeout = originalProbeTimeout
	})

	waitForMaintenancePollInterval = time.Millisecond
	waitForMaintenanceProbeTimeout = 50 * time.Millisecond

	attempts := 0
	waitForMaintenanceProbeFn = func(context.Context, string) error {
		attempts++
		return errors.New("still booting ubuntu")
	}

	err := WaitForMaintenance(context.Background(), "203.0.113.11", 20*time.Millisecond)
	if err == nil {
		t.Fatal("expected timeout error, got nil")
	}
	if !strings.Contains(err.Error(), "talos maintenance mode not reachable") {
		t.Fatalf("expected timeout error message, got %q", err)
	}
	if attempts == 0 {
		t.Fatal("expected at least one probe attempt")
	}
}
