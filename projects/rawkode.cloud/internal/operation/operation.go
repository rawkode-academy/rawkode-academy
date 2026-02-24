package operation

import (
	"encoding/json"
	"fmt"
	"time"
)

// Type identifies the kind of operation.
type Type string

const (
	TypeCreateCluster Type = "create-cluster"
	TypeAddNode       Type = "add-node"
	TypeRemoveNode    Type = "remove-node"
	TypeUpgradeTalos  Type = "upgrade-talos"
	TypeUpgradeK8s    Type = "upgrade-k8s"
)

// PhaseStatus tracks the state of a single phase.
type PhaseStatus string

const (
	PhasePending    PhaseStatus = "pending"
	PhaseInProgress PhaseStatus = "in-progress"
	PhaseCompleted  PhaseStatus = "completed"
	PhaseFailed     PhaseStatus = "failed"
	PhaseSkipped    PhaseStatus = "skipped"
)

// Phase tracks the status of a single phase within an operation.
type Phase struct {
	Status      PhaseStatus     `json:"status"`
	StartedAt   *time.Time      `json:"startedAt,omitempty"`
	CompletedAt *time.Time      `json:"completedAt,omitempty"`
	Error       string          `json:"error,omitempty"`
	Data        json.RawMessage `json:"data,omitempty"`
}

// CleanupAction describes a rollback action to execute on abort.
type CleanupAction struct {
	Type string          `json:"type"`
	Data json.RawMessage `json:"data,omitempty"`
}

// Operation is the full state of a resumable provisioning operation.
type Operation struct {
	ID           string                `json:"id"`
	Type         Type                  `json:"type"`
	Cluster      string                `json:"cluster"`
	CreatedAt    time.Time             `json:"createdAt"`
	UpdatedAt    time.Time             `json:"updatedAt"`
	CurrentPhase string                `json:"currentPhase"`
	PhaseOrder   []string              `json:"phaseOrder"`
	Phases       map[string]*Phase     `json:"phases"`
	Context      map[string]any        `json:"context"`
	Cleanup      []CleanupAction       `json:"cleanup"`
}

// New creates a new operation with the given phases in order.
func New(id string, opType Type, cluster string, phases []string) *Operation {
	now := time.Now().UTC()
	phaseMap := make(map[string]*Phase, len(phases))
	for _, name := range phases {
		phaseMap[name] = &Phase{Status: PhasePending}
	}

	currentPhase := ""
	if len(phases) > 0 {
		currentPhase = phases[0]
	}

	return &Operation{
		ID:           id,
		Type:         opType,
		Cluster:      cluster,
		CreatedAt:    now,
		UpdatedAt:    now,
		CurrentPhase: currentPhase,
		PhaseOrder:   phases,
		Phases:       phaseMap,
		Context:      make(map[string]any),
		Cleanup:      nil,
	}
}

// IsComplete returns true if all phases are completed or skipped.
func (o *Operation) IsComplete() bool {
	for _, phase := range o.Phases {
		if phase.Status != PhaseCompleted && phase.Status != PhaseSkipped {
			return false
		}
	}
	return true
}

// StartPhase marks a phase as in-progress.
func (o *Operation) StartPhase(name string) error {
	phase, ok := o.Phases[name]
	if !ok {
		return fmt.Errorf("unknown phase %q", name)
	}

	now := time.Now().UTC()
	phase.Status = PhaseInProgress
	phase.StartedAt = &now
	o.CurrentPhase = name
	o.UpdatedAt = now
	return nil
}

// CompletePhase marks a phase as completed with optional data.
func (o *Operation) CompletePhase(name string, data any) error {
	phase, ok := o.Phases[name]
	if !ok {
		return fmt.Errorf("unknown phase %q", name)
	}

	now := time.Now().UTC()
	phase.Status = PhaseCompleted
	phase.CompletedAt = &now
	o.UpdatedAt = now

	if data != nil {
		encoded, err := json.Marshal(data)
		if err != nil {
			return fmt.Errorf("encode phase data: %w", err)
		}
		phase.Data = encoded
	}

	// Advance to next phase
	for i, phaseName := range o.PhaseOrder {
		if phaseName == name && i+1 < len(o.PhaseOrder) {
			o.CurrentPhase = o.PhaseOrder[i+1]
			break
		}
	}

	return nil
}

// FailPhase marks a phase as failed with an error message.
func (o *Operation) FailPhase(name string, err error) error {
	phase, ok := o.Phases[name]
	if !ok {
		return fmt.Errorf("unknown phase %q", name)
	}

	now := time.Now().UTC()
	phase.Status = PhaseFailed
	phase.Error = err.Error()
	o.UpdatedAt = now
	return nil
}

// AddCleanup appends a cleanup action to the LIFO stack.
func (o *Operation) AddCleanup(actionType string, data any) error {
	encoded, err := json.Marshal(data)
	if err != nil {
		return fmt.Errorf("encode cleanup data: %w", err)
	}

	o.Cleanup = append(o.Cleanup, CleanupAction{
		Type: actionType,
		Data: encoded,
	})
	return nil
}

// SetContext stores a value in the operation context.
func (o *Operation) SetContext(key string, value any) {
	o.Context[key] = value
	o.UpdatedAt = time.Now().UTC()
}

// GetContext retrieves a value from the operation context.
func (o *Operation) GetContext(key string) (any, bool) {
	v, ok := o.Context[key]
	return v, ok
}

// GetContextString retrieves a string value from the operation context.
func (o *Operation) GetContextString(key string) string {
	v, ok := o.Context[key]
	if !ok {
		return ""
	}
	s, _ := v.(string)
	return s
}

// PhaseData unmarshals the data stored in a completed phase.
func (o *Operation) PhaseData(name string, dst any) error {
	phase, ok := o.Phases[name]
	if !ok {
		return fmt.Errorf("unknown phase %q", name)
	}
	if len(phase.Data) == 0 {
		return nil
	}
	return json.Unmarshal(phase.Data, dst)
}

// ResumePhase returns the name of the first non-completed phase to resume from.
func (o *Operation) ResumePhase() string {
	for _, name := range o.PhaseOrder {
		phase := o.Phases[name]
		if phase.Status != PhaseCompleted && phase.Status != PhaseSkipped {
			return name
		}
	}
	return ""
}

// GenerateID creates a unique operation ID.
func GenerateID() string {
	return fmt.Sprintf("op-%d", time.Now().UnixNano())
}
