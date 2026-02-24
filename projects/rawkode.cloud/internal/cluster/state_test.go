package cluster

import "testing"

func TestUpsertNodeCreatesAndMerges(t *testing.T) {
	state := &NodesState{
		Environment: "production",
		Nodes:       []NodeState{},
	}

	upsertNode(state, NodeState{
		Name:     "cp-1",
		Role:     "controlplane",
		Pool:     "main",
		ServerID: "server-1",
		Status:   NodeStatusProvisioning,
	})

	if len(state.Nodes) != 1 {
		t.Fatalf("expected 1 node after create, got %d", len(state.Nodes))
	}
	if state.Nodes[0].CreatedAt.IsZero() {
		t.Fatalf("expected CreatedAt to be set")
	}

	upsertNode(state, NodeState{
		Name:     "cp-1",
		PublicIP: "1.2.3.4",
		Status:   NodeStatusReady,
	})

	if len(state.Nodes) != 1 {
		t.Fatalf("expected 1 node after merge, got %d", len(state.Nodes))
	}
	node := state.Nodes[0]
	if node.ServerID != "server-1" {
		t.Fatalf("expected ServerID to be preserved, got %q", node.ServerID)
	}
	if node.PublicIP != "1.2.3.4" {
		t.Fatalf("expected PublicIP to be updated, got %q", node.PublicIP)
	}
	if node.Status != NodeStatusReady {
		t.Fatalf("expected status to be updated to ready, got %q", node.Status)
	}
}
