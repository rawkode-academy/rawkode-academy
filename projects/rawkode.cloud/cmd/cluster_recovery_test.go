package cmd

import (
	"errors"
	"testing"

	clusterstate "github.com/rawkode-academy/rawkode-cloud3/internal/cluster"
	"github.com/rawkode-academy/rawkode-cloud3/internal/config"
	"github.com/rawkode-academy/rawkode-cloud3/internal/operation"
)

func TestShouldCleanupIncompleteCreateOperation(t *testing.T) {
	t.Run("force cleanup always wins", func(t *testing.T) {
		op := operation.New("op-1", operation.TypeCreateCluster, "production", createClusterPhases)
		shouldCleanup, _ := shouldCleanupIncompleteCreateOperation(op, true, nil)
		if !shouldCleanup {
			t.Fatalf("expected cleanup when --cleanup is requested")
		}
	})

	t.Run("pre talos phase resumes by default", func(t *testing.T) {
		op := operation.New("op-2", operation.TypeCreateCluster, "production", createClusterPhases)
		if err := op.CompletePhase("init", nil); err != nil {
			t.Fatalf("complete init: %v", err)
		}

		shouldCleanup, _ := shouldCleanupIncompleteCreateOperation(op, false, nil)
		if shouldCleanup {
			t.Fatalf("did not expect cleanup for pre-Talos phase %q", op.ResumePhase())
		}
	})

	t.Run("apply-config completion resumes", func(t *testing.T) {
		op := operation.New("op-3", operation.TypeCreateCluster, "production", createClusterPhases)
		for _, phase := range []string{"init", "generate-config", "order-server", "wait-server", "wait-talos", "apply-config"} {
			if err := op.CompletePhase(phase, nil); err != nil {
				t.Fatalf("complete %s: %v", phase, err)
			}
		}

		shouldCleanup, _ := shouldCleanupIncompleteCreateOperation(op, false, nil)
		if shouldCleanup {
			t.Fatalf("did not expect cleanup after apply-config completion")
		}
	})

	t.Run("post-apply failure resumes", func(t *testing.T) {
		op := operation.New("op-4", operation.TypeCreateCluster, "production", createClusterPhases)
		for _, phase := range []string{"init", "generate-config", "order-server", "wait-server", "wait-talos", "apply-config"} {
			if err := op.CompletePhase(phase, nil); err != nil {
				t.Fatalf("complete %s: %v", phase, err)
			}
		}
		if err := op.FailPhase("bootstrap", errors.New("bootstrap failed")); err != nil {
			t.Fatalf("fail bootstrap: %v", err)
		}

		shouldCleanup, _ := shouldCleanupIncompleteCreateOperation(op, false, nil)
		if shouldCleanup {
			t.Fatalf("did not expect cleanup for post-apply failure")
		}
	})

	t.Run("apply-config resume without activation marker resumes", func(t *testing.T) {
		op := operation.New("op-5", operation.TypeCreateCluster, "production", createClusterPhases)
		for _, phase := range []string{"init", "generate-config", "order-server", "wait-server", "wait-talos"} {
			if err := op.CompletePhase(phase, nil); err != nil {
				t.Fatalf("complete %s: %v", phase, err)
			}
		}

		shouldCleanup, _ := shouldCleanupIncompleteCreateOperation(op, false, nil)
		if shouldCleanup {
			t.Fatalf("did not expect cleanup when resuming apply-config phase")
		}
	})

	t.Run("post-activation with no active node in state cleans up", func(t *testing.T) {
		op := operation.New("op-6", operation.TypeCreateCluster, "production", createClusterPhases)
		for _, phase := range []string{"init", "generate-config", "order-server", "wait-server", "wait-talos", "apply-config"} {
			if err := op.CompletePhase(phase, nil); err != nil {
				t.Fatalf("complete %s: %v", phase, err)
			}
		}
		op.SetContext("serverId", "srv-123")
		op.SetContext("nodeName", "production-control-plane-01")

		state := &clusterstate.NodesState{
			Nodes: []clusterstate.NodeState{
				{
					Name:     "production-control-plane-01",
					Role:     config.NodeTypeControlPlane,
					ServerID: "srv-123",
					Status:   clusterstate.NodeStatusDeleted,
				},
			},
		}

		shouldCleanup, _ := shouldCleanupIncompleteCreateOperation(op, false, state)
		if !shouldCleanup {
			t.Fatalf("expected cleanup for stale post-activation operation with no active node in state")
		}
	})

	t.Run("post-activation with active node in state resumes", func(t *testing.T) {
		op := operation.New("op-7", operation.TypeCreateCluster, "production", createClusterPhases)
		for _, phase := range []string{"init", "generate-config", "order-server", "wait-server", "wait-talos", "apply-config"} {
			if err := op.CompletePhase(phase, nil); err != nil {
				t.Fatalf("complete %s: %v", phase, err)
			}
		}
		op.SetContext("serverId", "srv-456")
		op.SetContext("nodeName", "production-control-plane-01")

		state := &clusterstate.NodesState{
			Nodes: []clusterstate.NodeState{
				{
					Name:     "production-control-plane-01",
					Role:     config.NodeTypeControlPlane,
					ServerID: "srv-456",
					Status:   clusterstate.NodeStatusReady,
				},
			},
		}

		shouldCleanup, _ := shouldCleanupIncompleteCreateOperation(op, false, state)
		if shouldCleanup {
			t.Fatalf("did not expect cleanup when operation node is active in state")
		}
	})
}
