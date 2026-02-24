package cmd

import (
	"testing"

	clusterstate "github.com/rawkode-academy/rawkode-cloud3/internal/cluster"
	"github.com/rawkode-academy/rawkode-cloud3/internal/config"
)

func TestInfisicalSecretPathForCluster(t *testing.T) {
	cfg := &config.Config{
		Environment: "production",
		Infisical: config.InfisicalConfig{
			SecretPath: "/projects/rawkode-cloud",
		},
	}

	got := infisicalSecretPathForCluster(cfg)
	want := "/projects/rawkode-cloud/production"
	if got != want {
		t.Fatalf("infisicalSecretPathForCluster() = %q, want %q", got, want)
	}
}

func TestControlPlaneReservedIPForSlot(t *testing.T) {
	pool := &config.NodePoolConfig{
		Name: "main",
		ReservedPrivateIPs: []string{
			"172.16.16.16",
			"172.16.16.17",
		},
	}

	got, err := controlPlaneReservedIPForSlot(pool, 2)
	if err != nil {
		t.Fatalf("controlPlaneReservedIPForSlot returned error: %v", err)
	}
	if got != "172.16.16.17" {
		t.Fatalf("controlPlaneReservedIPForSlot() = %q, want %q", got, "172.16.16.17")
	}
}

func TestNextControlPlaneSlot(t *testing.T) {
	state := &clusterstate.NodesState{
		Nodes: []clusterstate.NodeState{
			{Name: "main-01", Role: config.NodeTypeControlPlane, Pool: "main", Status: clusterstate.NodeStatusReady},
			{Name: "main-02", Role: config.NodeTypeControlPlane, Pool: "main", Status: clusterstate.NodeStatusDeleted},
			{Name: "workers-01", Role: config.NodeTypeWorker, Pool: "workers", Status: clusterstate.NodeStatusReady},
		},
	}

	if got := nextControlPlaneSlot(state, "main"); got != 2 {
		t.Fatalf("nextControlPlaneSlot() = %d, want %d", got, 2)
	}
}

func TestNextControlPlaneSlotReservesLegacyUnnamedSlots(t *testing.T) {
	state := &clusterstate.NodesState{
		Nodes: []clusterstate.NodeState{
			{Name: "legacy-cp", Role: config.NodeTypeControlPlane, Pool: "main", Status: clusterstate.NodeStatusReady},
			{Name: "main-01", Role: config.NodeTypeControlPlane, Pool: "main", Status: clusterstate.NodeStatusReady},
		},
	}

	if got := nextControlPlaneSlot(state, "main"); got != 3 {
		t.Fatalf("nextControlPlaneSlot() = %d, want %d", got, 3)
	}
}

func TestControlPlaneEndpointFromStatePrefersPrivateIP(t *testing.T) {
	state := &clusterstate.NodesState{
		Nodes: []clusterstate.NodeState{
			{
				Name:      "main-01",
				Role:      config.NodeTypeControlPlane,
				Pool:      "main",
				Status:    clusterstate.NodeStatusReady,
				PublicIP:  "203.0.113.10",
				PrivateIP: "172.16.16.16",
			},
		},
	}

	endpoint, err := controlPlaneEndpointFromState(state)
	if err != nil {
		t.Fatalf("controlPlaneEndpointFromState returned error: %v", err)
	}
	if endpoint != "172.16.16.16" {
		t.Fatalf("controlPlaneEndpointFromState() = %q, want %q", endpoint, "172.16.16.16")
	}
}
