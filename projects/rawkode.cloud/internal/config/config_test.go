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

func TestTeleportACMEEffectiveEnabled(t *testing.T) {
	if got := (TeleportACMEConfig{}).EffectiveEnabled(); got {
		t.Fatalf("TeleportACMEConfig{}.EffectiveEnabled() = %t, want false", got)
	}

	enabled := true
	if got := (TeleportACMEConfig{Enabled: &enabled}).EffectiveEnabled(); !got {
		t.Fatalf("TeleportACMEConfig{Enabled:true}.EffectiveEnabled() = %t, want true", got)
	}

	disabled := false
	if got := (TeleportACMEConfig{Enabled: &disabled}).EffectiveEnabled(); got {
		t.Fatalf("TeleportACMEConfig{Enabled:false}.EffectiveEnabled() = %t, want false", got)
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

func TestClusterEffectiveCiliumVersion(t *testing.T) {
	if got := (ClusterConfig{}).EffectiveCiliumVersion(); got != defaultCiliumVersion {
		t.Fatalf("ClusterConfig{}.EffectiveCiliumVersion() = %q, want %q", got, defaultCiliumVersion)
	}

	cfg := ClusterConfig{CiliumVersion: "v1.18.6"}
	if got := cfg.EffectiveCiliumVersion(); got != "v1.18.6" {
		t.Fatalf("ClusterConfig{CiliumVersion: v1.18.6}.EffectiveCiliumVersion() = %q, want %q", got, "v1.18.6")
	}
}

func TestClusterEffectiveFluxVersion(t *testing.T) {
	if got := (ClusterConfig{}).EffectiveFluxVersion(); got != defaultFluxVersion {
		t.Fatalf("ClusterConfig{}.EffectiveFluxVersion() = %q, want %q", got, defaultFluxVersion)
	}

	cfg := ClusterConfig{FluxVersion: "v2.8.0"}
	if got := cfg.EffectiveFluxVersion(); got != "v2.8.0" {
		t.Fatalf("ClusterConfig{FluxVersion: v2.8.0}.EffectiveFluxVersion() = %q, want %q", got, "v2.8.0")
	}
}

func TestClusterEffectiveTeleportVersion(t *testing.T) {
	if got := (ClusterConfig{}).EffectiveTeleportVersion(); got != defaultTeleportVersion {
		t.Fatalf("ClusterConfig{}.EffectiveTeleportVersion() = %q, want %q", got, defaultTeleportVersion)
	}

	cfg := ClusterConfig{TeleportVersion: "18"}
	if got := cfg.EffectiveTeleportVersion(); got != "18" {
		t.Fatalf("ClusterConfig{TeleportVersion: 18}.EffectiveTeleportVersion() = %q, want %q", got, "18")
	}
}

func TestClusterEffectiveControlPlaneTaints(t *testing.T) {
	if got := (ClusterConfig{}).EffectiveControlPlaneTaints(); !got {
		t.Fatalf("ClusterConfig{}.EffectiveControlPlaneTaints() = %t, want true", got)
	}

	keepTaints := true
	cfgKeep := ClusterConfig{ControlPlaneTaints: &keepTaints}
	if got := cfgKeep.EffectiveControlPlaneTaints(); !got {
		t.Fatalf("ClusterConfig{ControlPlaneTaints:true}.EffectiveControlPlaneTaints() = %t, want true", got)
	}

	removeTaints := false
	cfgRemove := ClusterConfig{ControlPlaneTaints: &removeTaints}
	if got := cfgRemove.EffectiveControlPlaneTaints(); got {
		t.Fatalf("ClusterConfig{ControlPlaneTaints:false}.EffectiveControlPlaneTaints() = %t, want false", got)
	}
}
