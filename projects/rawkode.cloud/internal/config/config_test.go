package config

import "testing"

func TestNormalizeNodePoolType(t *testing.T) {
	tests := []struct {
		input string
		want  string
	}{
		{input: "", want: NodeTypeControlPlane},
		{input: "controlplane", want: NodeTypeControlPlane},
		{input: "control-plane", want: NodeTypeControlPlane},
		{input: "cp", want: NodeTypeControlPlane},
		{input: "worker", want: NodeTypeWorker},
		{input: "unknown", want: ""},
	}

	for _, tt := range tests {
		if got := NormalizeNodePoolType(tt.input); got != tt.want {
			t.Fatalf("NormalizeNodePoolType(%q) = %q, want %q", tt.input, got, tt.want)
		}
	}
}

func TestFirstNodePoolByType(t *testing.T) {
	cfg := &Config{
		NodePools: []NodePoolConfig{
			{Name: "workers", Type: "worker"},
			{Name: "cp-main", Type: "controlplane"},
		},
	}

	cp, err := cfg.FirstNodePoolByType(NodeTypeControlPlane)
	if err != nil {
		t.Fatalf("FirstNodePoolByType(controlplane) returned error: %v", err)
	}
	if cp.Name != "cp-main" {
		t.Fatalf("FirstNodePoolByType(controlplane) returned %q, want %q", cp.Name, "cp-main")
	}

	worker, err := cfg.FirstNodePoolByType(NodeTypeWorker)
	if err != nil {
		t.Fatalf("FirstNodePoolByType(worker) returned error: %v", err)
	}
	if worker.Name != "workers" {
		t.Fatalf("FirstNodePoolByType(worker) returned %q, want %q", worker.Name, "workers")
	}
}

func TestNormalizeTeleportMode(t *testing.T) {
	tests := []struct {
		input string
		want  string
	}{
		{input: "", want: TeleportModeSelfHosted},
		{input: "self-hosted", want: TeleportModeSelfHosted},
		{input: "self_hosted", want: TeleportModeSelfHosted},
		{input: "external", want: TeleportModeExternal},
		{input: "disabled", want: TeleportModeDisabled},
		{input: "unknown", want: ""},
	}

	for _, tt := range tests {
		if got := NormalizeTeleportMode(tt.input); got != tt.want {
			t.Fatalf("NormalizeTeleportMode(%q) = %q, want %q", tt.input, got, tt.want)
		}
	}
}

func TestTeleportEffectiveModeDefaultsToSelfHosted(t *testing.T) {
	if got := (TeleportConfig{}).EffectiveMode(); got != TeleportModeSelfHosted {
		t.Fatalf("TeleportConfig{}.EffectiveMode() = %q, want %q", got, TeleportModeSelfHosted)
	}
}

func TestScalewayNetworkNameDerivation(t *testing.T) {
	cfg := &Config{Environment: "rawkode-cloud"}

	vpcName, err := cfg.ScalewayVPCName()
	if err != nil {
		t.Fatalf("ScalewayVPCName returned error: %v", err)
	}
	if vpcName != "rawkode-cloud" {
		t.Fatalf("ScalewayVPCName() = %q, want %q", vpcName, "rawkode-cloud")
	}

	privateName, err := cfg.ScalewayPrivateNetworkName()
	if err != nil {
		t.Fatalf("ScalewayPrivateNetworkName returned error: %v", err)
	}
	if privateName != "rawkode-cloud-private" {
		t.Fatalf("ScalewayPrivateNetworkName() = %q, want %q", privateName, "rawkode-cloud-private")
	}
}

func TestNodePoolEffectiveZone(t *testing.T) {
	pool := NodePoolConfig{Zone: " fr-par-1 "}
	if got := pool.EffectiveZone(); got != "fr-par-1" {
		t.Fatalf("NodePoolConfig.EffectiveZone() = %q, want %q", got, "fr-par-1")
	}
}
