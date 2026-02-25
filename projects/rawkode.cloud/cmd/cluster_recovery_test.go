package cmd

import (
	"errors"
	"testing"

	"github.com/rawkode-academy/rawkode-cloud3/internal/operation"
)

func TestShouldCleanupIncompleteCreateOperation(t *testing.T) {
	t.Run("force cleanup always wins", func(t *testing.T) {
		op := operation.New("op-1", operation.TypeCreateCluster, "production", createClusterPhases)
		shouldCleanup, _ := shouldCleanupIncompleteCreateOperation(op, true)
		if !shouldCleanup {
			t.Fatalf("expected cleanup when --cleanup is requested")
		}
	})

	t.Run("pre talos phase resumes by default", func(t *testing.T) {
		op := operation.New("op-2", operation.TypeCreateCluster, "production", createClusterPhases)
		if err := op.CompletePhase("init", nil); err != nil {
			t.Fatalf("complete init: %v", err)
		}

		shouldCleanup, _ := shouldCleanupIncompleteCreateOperation(op, false)
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

		shouldCleanup, _ := shouldCleanupIncompleteCreateOperation(op, false)
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

		shouldCleanup, _ := shouldCleanupIncompleteCreateOperation(op, false)
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

		shouldCleanup, _ := shouldCleanupIncompleteCreateOperation(op, false)
		if shouldCleanup {
			t.Fatalf("did not expect cleanup when resuming apply-config phase")
		}
	})
}
