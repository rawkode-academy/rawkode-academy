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

func TestTeleportEffectiveModeRejectsUnsupportedExplicitMode(t *testing.T) {
	cfg := TeleportConfig{Mode: "external"}
	if got := cfg.EffectiveMode(); got != "" {
		t.Fatalf("TeleportConfig{Mode: external}.EffectiveMode() = %q, want empty", got)
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

func TestTeleportEffectiveAdminTeams(t *testing.T) {
	cfg := TeleportConfig{
		GitHub: TeleportGitHubConfig{
			Teams: []string{"legacy-team"},
		},
		Access: TeleportAccessConfig{
			AdminTeams: []string{" platform ", "Platform", "ops"},
		},
	}

	got := cfg.EffectiveAdminTeams()
	want := []string{"platform", "ops"}
	if len(got) != len(want) {
		t.Fatalf("TeleportConfig.EffectiveAdminTeams() len = %d, want %d (%v)", len(got), len(want), got)
	}
	for i := range want {
		if got[i] != want[i] {
			t.Fatalf("TeleportConfig.EffectiveAdminTeams()[%d] = %q, want %q", i, got[i], want[i])
		}
	}
}

func TestTeleportEffectiveAdminTeamsFallsBackToGitHubTeams(t *testing.T) {
	cfg := TeleportConfig{
		GitHub: TeleportGitHubConfig{
			Teams: []string{"platform"},
		},
	}

	got := cfg.EffectiveAdminTeams()
	if len(got) != 1 || got[0] != "platform" {
		t.Fatalf("TeleportConfig.EffectiveAdminTeams() = %v, want [platform]", got)
	}
}

func TestTeleportEffectiveKubernetesUsers(t *testing.T) {
	cfg := TeleportConfig{
		Access: TeleportAccessConfig{
			KubernetesUsers: []string{"ops-admin", " ops-admin ", "breakglass"},
		},
	}

	got := cfg.EffectiveKubernetesUsers()
	want := []string{"ops-admin", "breakglass"}
	if len(got) != len(want) {
		t.Fatalf("TeleportConfig.EffectiveKubernetesUsers() len = %d, want %d (%v)", len(got), len(want), got)
	}
	for i := range want {
		if got[i] != want[i] {
			t.Fatalf("TeleportConfig.EffectiveKubernetesUsers()[%d] = %q, want %q", i, got[i], want[i])
		}
	}
}

func TestTeleportEffectiveKubernetesUsersDefaults(t *testing.T) {
	got := (TeleportConfig{}).EffectiveKubernetesUsers()
	if len(got) != 1 || got[0] != "teleport-admin" {
		t.Fatalf("TeleportConfig{}.EffectiveKubernetesUsers() = %v, want [teleport-admin]", got)
	}
}

func TestTeleportEffectiveKubernetesGroups(t *testing.T) {
	cfg := TeleportConfig{
		Access: TeleportAccessConfig{
			KubernetesGroups: []string{"system:masters", " SYSTEM:MASTERS ", "platform-admins"},
		},
	}

	got := cfg.EffectiveKubernetesGroups()
	want := []string{"system:masters", "platform-admins"}
	if len(got) != len(want) {
		t.Fatalf("TeleportConfig.EffectiveKubernetesGroups() len = %d, want %d (%v)", len(got), len(want), got)
	}
	for i := range want {
		if got[i] != want[i] {
			t.Fatalf("TeleportConfig.EffectiveKubernetesGroups()[%d] = %q, want %q", i, got[i], want[i])
		}
	}
}

func TestTeleportEffectiveKubernetesGroupsDefaults(t *testing.T) {
	got := (TeleportConfig{}).EffectiveKubernetesGroups()
	if len(got) != 1 || got[0] != "system:masters" {
		t.Fatalf("TeleportConfig{}.EffectiveKubernetesGroups() = %v, want [system:masters]", got)
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
