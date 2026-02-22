package talos

import (
	"testing"
)

func TestGenerateConfig_Success(t *testing.T) {
	cfg := ClusterConfig{
		ClusterName:       "test-cluster",
		ServerPublicIP:    "1.2.3.4",
		TeleportToken:     "test-token-abc",
		TeleportProxyAddr: "teleport.example.com:443",
		InfisicalToken:    "inf-token-xyz",
		OperatorIP:        "5.6.7.8",
	}

	genCfg, err := GenerateConfig(cfg)
	if err != nil {
		t.Fatalf("GenerateConfig failed: %v", err)
	}

	if genCfg.MachineConfig == nil {
		t.Fatal("MachineConfig should not be nil")
	}

	if genCfg.TalosConfig == nil {
		t.Fatal("TalosConfig should not be nil")
	}
}

func TestGenerateConfig_ContainsInlineManifests(t *testing.T) {
	cfg := ClusterConfig{
		ClusterName:       "test-cluster",
		ServerPublicIP:    "1.2.3.4",
		TeleportToken:     "test-token-abc",
		TeleportProxyAddr: "teleport.example.com:443",
		InfisicalToken:    "inf-token-xyz",
		OperatorIP:        "5.6.7.8",
	}

	genCfg, err := GenerateConfig(cfg)
	if err != nil {
		t.Fatalf("GenerateConfig failed: %v", err)
	}

	// Extract v1alpha1 config to check inline manifests
	v1cfg := genCfg.MachineConfig.RawV1Alpha1()
	if v1cfg == nil {
		t.Fatal("RawV1Alpha1 should not be nil")
	}

	manifests := v1cfg.ClusterConfig.ClusterInlineManifests
	if len(manifests) < 2 {
		t.Fatalf("expected at least 2 inline manifests, got %d", len(manifests))
	}

	foundInfisical := false
	foundTeleport := false
	for _, m := range manifests {
		switch m.InlineManifestName {
		case "infisical-machine-identity":
			foundInfisical = true
		case "teleport-join-token":
			foundTeleport = true
		}
	}

	if !foundInfisical {
		t.Error("missing infisical-machine-identity inline manifest")
	}
	if !foundTeleport {
		t.Error("missing teleport-join-token inline manifest")
	}
}

func TestGenerateConfig_Serializable(t *testing.T) {
	cfg := ClusterConfig{
		ClusterName:       "test-cluster",
		ServerPublicIP:    "1.2.3.4",
		TeleportToken:     "test-token",
		TeleportProxyAddr: "teleport.example.com:443",
		InfisicalToken:    "inf-token",
		OperatorIP:        "5.6.7.8",
	}

	genCfg, err := GenerateConfig(cfg)
	if err != nil {
		t.Fatalf("GenerateConfig failed: %v", err)
	}

	bytes, err := genCfg.MachineConfig.Bytes()
	if err != nil {
		t.Fatalf("Bytes() failed: %v", err)
	}

	if len(bytes) == 0 {
		t.Error("serialized config should not be empty")
	}
}
