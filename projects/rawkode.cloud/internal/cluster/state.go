package cluster

import "time"

type NodeStatus string

const (
	NodeStatusProvisioning NodeStatus = "provisioning"
	NodeStatusReady        NodeStatus = "ready"
	NodeStatusFailed       NodeStatus = "failed"
	NodeStatusDeleted      NodeStatus = "deleted"
)

// NodeState describes a node's runtime state.
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
