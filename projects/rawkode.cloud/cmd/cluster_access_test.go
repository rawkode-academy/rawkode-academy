package cmd

import (
	"testing"

	clusterstate "github.com/rawkode-academy/rawkode-cloud3/internal/cluster"
)

func TestTalosAccessEndpointsPrefersNodeFQDN(t *testing.T) {
	t.Setenv("TALOS_NODE_FQDN_SUFFIX", "rka.internal")

	node := &clusterstate.NodeState{
		Name:      "production-control-plane-01",
		PublicIP:  "62.210.216.62",
		PrivateIP: "172.16.16.16",
	}

	got := talosAccessEndpoints(node)
	want := []string{
		"production-control-plane-01.rka.internal",
		"production-control-plane-01",
		"62.210.216.62",
		"172.16.16.16",
	}

	if len(got) != len(want) {
		t.Fatalf("talosAccessEndpoints() length = %d, want %d (got %v)", len(got), len(want), got)
	}
	for i := range want {
		if got[i] != want[i] {
			t.Fatalf("talosAccessEndpoints()[%d] = %q, want %q (got %v)", i, got[i], want[i], got)
		}
	}
}

func TestTalosAccessEndpointsFQDNNodeName(t *testing.T) {
	node := &clusterstate.NodeState{
		Name:      "production-control-plane-01.rka.internal",
		PublicIP:  "62.210.216.62",
		PrivateIP: "172.16.16.16",
	}

	got := talosAccessEndpoints(node)
	want := []string{
		"production-control-plane-01.rka.internal",
		"62.210.216.62",
		"172.16.16.16",
	}

	if len(got) != len(want) {
		t.Fatalf("talosAccessEndpoints() length = %d, want %d (got %v)", len(got), len(want), got)
	}
	for i := range want {
		if got[i] != want[i] {
			t.Fatalf("talosAccessEndpoints()[%d] = %q, want %q (got %v)", i, got[i], want[i], got)
		}
	}
}
