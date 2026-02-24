package cluster

import (
	"context"
	"errors"
	"fmt"
	"os"
	"time"

	"github.com/rawkode-academy/rawkode-cloud3/internal/config"
	"github.com/rawkode-academy/rawkode-cloud3/internal/operation"
	"gopkg.in/yaml.v3"
)

type NodeStatus string

const (
	NodeStatusProvisioning NodeStatus = "provisioning"
	NodeStatusReady        NodeStatus = "ready"
	NodeStatusFailed       NodeStatus = "failed"
	NodeStatusDeleted      NodeStatus = "deleted"
)

// NodeState describes a node's runtime state (stored in S3, not config YAML).
type NodeState struct {
	Name      string     `json:"name" yaml:"name"`
	Role      string     `json:"role" yaml:"role"`
	PublicIP  string     `json:"public_ip,omitempty" yaml:"public_ip,omitempty"`
	PrivateIP string     `json:"private_ip,omitempty" yaml:"private_ip,omitempty"`
	ServerID  string     `json:"server_id,omitempty" yaml:"server_id,omitempty"`
	Pool      string     `json:"pool,omitempty" yaml:"pool,omitempty"`
	Status    NodeStatus `json:"status" yaml:"status"`
	CreatedAt time.Time  `json:"created_at" yaml:"created_at"`
	UpdatedAt time.Time  `json:"updated_at" yaml:"updated_at"`
}

// NodesState is the cluster-level runtime node inventory.
type NodesState struct {
	Environment string      `json:"environment" yaml:"environment"`
	UpdatedAt   time.Time   `json:"updated_at" yaml:"updated_at"`
	Nodes       []NodeState `json:"nodes" yaml:"nodes"`
}

// NodeStore persists and loads cluster node state in the shared S3 bucket.
type NodeStore struct {
	operationStore *operation.Store
	environment    string
	key            string
}

// NewNodeStore creates a cluster node-state store.
func NewNodeStore(operationStore *operation.Store, environment string) *NodeStore {
	return &NodeStore{
		operationStore: operationStore,
		environment:    environment,
		key:            fmt.Sprintf("clusters/%s/nodes.json", environment),
	}
}

// Load fetches current node inventory, returning an empty state if none exists.
func (s *NodeStore) Load(_ context.Context) (*NodesState, error) {
	var state NodesState
	if err := s.operationStore.GetJSON(s.key, &state); err != nil {
		if errors.Is(err, operation.ErrNotFound) {
			return &NodesState{
				Environment: s.environment,
				Nodes:       []NodeState{},
			}, nil
		}
		return nil, fmt.Errorf("load node state: %w", err)
	}

	if state.Environment == "" {
		state.Environment = s.environment
	}
	if state.Nodes == nil {
		state.Nodes = []NodeState{}
	}

	return &state, nil
}

// Save writes the full inventory document.
func (s *NodeStore) Save(_ context.Context, state *NodesState) error {
	state.Environment = s.environment
	state.UpdatedAt = time.Now().UTC()
	if state.Nodes == nil {
		state.Nodes = []NodeState{}
	}

	if err := s.operationStore.PutJSON(s.key, state); err != nil {
		return fmt.Errorf("save node state: %w", err)
	}
	return nil
}

// Upsert merges a node record and persists the updated state.
func (s *NodeStore) Upsert(ctx context.Context, patch NodeState) error {
	if patch.Name == "" {
		return fmt.Errorf("node name is required")
	}

	state, err := s.Load(ctx)
	if err != nil {
		return err
	}

	upsertNode(state, patch)
	return s.Save(ctx, state)
}

func upsertNode(state *NodesState, patch NodeState) {
	now := time.Now().UTC()

	for i := range state.Nodes {
		if state.Nodes[i].Name != patch.Name {
			continue
		}
		existing := state.Nodes[i]
		if patch.Role != "" {
			existing.Role = patch.Role
		}
		if patch.PublicIP != "" {
			existing.PublicIP = patch.PublicIP
		}
		if patch.PrivateIP != "" {
			existing.PrivateIP = patch.PrivateIP
		}
		if patch.ServerID != "" {
			existing.ServerID = patch.ServerID
		}
		if patch.Pool != "" {
			existing.Pool = patch.Pool
		}
		if patch.Status != "" {
			existing.Status = patch.Status
		}
		if !patch.CreatedAt.IsZero() {
			existing.CreatedAt = patch.CreatedAt
		}
		if existing.CreatedAt.IsZero() {
			existing.CreatedAt = now
		}
		existing.UpdatedAt = now
		state.Nodes[i] = existing
		return
	}

	newNode := NodeState{
		Name:      patch.Name,
		Role:      patch.Role,
		PublicIP:  patch.PublicIP,
		PrivateIP: patch.PrivateIP,
		ServerID:  patch.ServerID,
		Pool:      patch.Pool,
		Status:    patch.Status,
		CreatedAt: patch.CreatedAt,
		UpdatedAt: now,
	}
	if newNode.CreatedAt.IsZero() {
		newNode.CreatedAt = now
	}
	state.Nodes = append(state.Nodes, newNode)
}

// ReadConfig loads a cluster config from a YAML file.
func ReadConfig(path string) (*config.Config, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("read cluster config %s: %w", path, err)
	}

	var cfg config.Config
	if err := yaml.Unmarshal(data, &cfg); err != nil {
		return nil, fmt.Errorf("parse cluster config %s: %w", path, err)
	}

	return &cfg, nil
}
