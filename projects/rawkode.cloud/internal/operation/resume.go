package operation

import (
	"fmt"
	"log/slog"
)

// CheckResume scans for incomplete operations matching the given type and cluster.
// Returns the operation to resume, or nil if no incomplete operations exist.
func CheckResume(store *Store, opType Type, cluster string) (*Operation, error) {
	incomplete, err := store.FindIncomplete(opType, cluster)
	if err != nil {
		return nil, fmt.Errorf("check for incomplete operations: %w", err)
	}

	if len(incomplete) == 0 {
		return nil, nil
	}

	// Return the most recent incomplete operation
	op := incomplete[0]
	resumePhase := op.ResumePhase()

	slog.Info("found incomplete operation",
		"id", op.ID,
		"type", op.Type,
		"cluster", op.Cluster,
		"resume_phase", resumePhase,
		"updated_at", op.UpdatedAt,
	)

	fmt.Printf("Found incomplete operation %s (type=%s, phase=%s)\n", op.ID, op.Type, resumePhase)
	fmt.Printf("Resuming from phase: %s\n", resumePhase)

	return op, nil
}
