package cmd

import (
	"testing"

	"github.com/rawkode-academy/rawkode-cloud3/internal/operation"
)

func TestResetOperationFromPhase(t *testing.T) {
	op := operation.New("op-1", operation.TypeCreateCluster, "production", createClusterPhases)

	for _, phase := range []string{"init", "generate-config", "order-server", "wait-server", "wait-talos", "apply-config", "bootstrap", "dns", "post-bootstrap", "verify"} {
		if err := op.CompletePhase(phase, map[string]string{"phase": phase}); err != nil {
			t.Fatalf("complete %s: %v", phase, err)
		}
	}

	if err := resetOperationFromPhase(op, "post-bootstrap"); err != nil {
		t.Fatalf("reset from phase: %v", err)
	}

	for _, phase := range []string{"init", "generate-config", "order-server", "wait-server", "wait-talos", "apply-config", "bootstrap", "dns"} {
		if got := op.Phases[phase].Status; got != operation.PhaseCompleted {
			t.Fatalf("phase %s status = %s, want %s", phase, got, operation.PhaseCompleted)
		}
	}

	for _, phase := range []string{"post-bootstrap", "verify"} {
		got := op.Phases[phase]
		if got.Status != operation.PhasePending {
			t.Fatalf("phase %s status = %s, want %s", phase, got.Status, operation.PhasePending)
		}
		if got.StartedAt != nil || got.CompletedAt != nil || got.Error != "" || len(got.Data) != 0 {
			t.Fatalf("phase %s not fully reset: %+v", phase, got)
		}
	}

	if op.CurrentPhase != "post-bootstrap" {
		t.Fatalf("current phase = %q, want %q", op.CurrentPhase, "post-bootstrap")
	}
}

func TestResetOperationFromPhaseUnknownPhase(t *testing.T) {
	op := operation.New("op-2", operation.TypeCreateCluster, "production", createClusterPhases)
	err := resetOperationFromPhase(op, "cilium")
	if err == nil {
		t.Fatal("expected error for unknown phase")
	}
}

func TestResetOperationFromPhaseRequiresOperation(t *testing.T) {
	err := resetOperationFromPhase(nil, "post-bootstrap")
	if err == nil {
		t.Fatal("expected error for nil operation")
	}
}

func TestResetOperationFromPhaseRequiresPhase(t *testing.T) {
	op := operation.New("op-3", operation.TypeCreateCluster, "production", createClusterPhases)
	err := resetOperationFromPhase(op, "")
	if err == nil {
		t.Fatal("expected error for empty phase")
	}
}
