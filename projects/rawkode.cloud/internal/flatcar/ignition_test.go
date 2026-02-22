package flatcar

import (
	"encoding/json"
	"strings"
	"testing"
)

func TestGenerateIgnitionConfig_Init(t *testing.T) {
	cfg := NodeConfig{
		Role:              "control-plane",
		ClusterName:       "test-cluster",
		ServerPublicIP:    "1.2.3.4",
		KubernetesVersion: "v1.33.2",
		CiliumVersion:     "1.17.3",
		SSHPublicKey:      "ssh-ed25519 AAAA...",
		OperatorIP:        "5.6.7.8",
		TeleportToken:     "test-token",
		TeleportProxyAddr: "teleport.example.com:443",
	}

	genCfg, err := GenerateIgnitionConfig(cfg)
	if err != nil {
		t.Fatalf("GenerateIgnitionConfig failed: %v", err)
	}

	if !genCfg.IsInit {
		t.Error("expected IsInit=true for init node (no JoinToken)")
	}

	if len(genCfg.IgnitionJSON) == 0 {
		t.Fatal("IgnitionJSON should not be empty")
	}

	if len(genCfg.SSHPrivateKey) == 0 {
		t.Fatal("SSHPrivateKey should not be empty")
	}

	if len(genCfg.SSHPublicKey) == 0 {
		t.Fatal("SSHPublicKey should not be empty")
	}

	// Verify it's valid JSON
	var parsed map[string]any
	if err := json.Unmarshal(genCfg.IgnitionJSON, &parsed); err != nil {
		t.Fatalf("IgnitionJSON is not valid JSON: %v", err)
	}

	// Check Ignition version
	ignition, ok := parsed["ignition"].(map[string]any)
	if !ok {
		t.Fatal("missing ignition key in config")
	}
	if ignition["version"] != "3.4.0" {
		t.Errorf("expected ignition version 3.4.0, got %v", ignition["version"])
	}
}

func TestGenerateIgnitionConfig_Join(t *testing.T) {
	cfg := NodeConfig{
		Role:                 "control-plane",
		ClusterName:          "test-cluster",
		ServerPublicIP:       "1.2.3.4",
		KubernetesVersion:    "v1.33.2",
		CiliumVersion:        "1.17.3",
		OperatorIP:           "5.6.7.8",
		JoinToken:            "abc123.def456ghi789",
		CACertHash:           "sha256:abcdef1234567890",
		CertificateKey:       "certkey123",
		ControlPlaneEndpoint: "10.0.0.1",
	}

	genCfg, err := GenerateIgnitionConfig(cfg)
	if err != nil {
		t.Fatalf("GenerateIgnitionConfig failed: %v", err)
	}

	if genCfg.IsInit {
		t.Error("expected IsInit=false for join node")
	}
}

func TestGenerateIgnitionConfig_WorkerJoin(t *testing.T) {
	cfg := NodeConfig{
		Role:                 "worker",
		ClusterName:          "test-cluster",
		ServerPublicIP:       "1.2.3.4",
		KubernetesVersion:    "v1.33.2",
		CiliumVersion:        "1.17.3",
		OperatorIP:           "5.6.7.8",
		JoinToken:            "abc123.def456ghi789",
		CACertHash:           "sha256:abcdef1234567890",
		ControlPlaneEndpoint: "10.0.0.1",
	}

	genCfg, err := GenerateIgnitionConfig(cfg)
	if err != nil {
		t.Fatalf("GenerateIgnitionConfig failed: %v", err)
	}

	if genCfg.IsInit {
		t.Error("expected IsInit=false for worker join")
	}

	// Verify ignition contains kubeadm join
	content := string(genCfg.IgnitionJSON)
	if !strings.Contains(content, "join") {
		t.Error("worker join ignition should reference join")
	}
}

func TestGenerateIgnitionConfig_ContainsKubernetesVersion(t *testing.T) {
	cfg := NodeConfig{
		Role:              "control-plane",
		ClusterName:       "test-cluster",
		ServerPublicIP:    "1.2.3.4",
		KubernetesVersion: "v1.33.2",
		CiliumVersion:     "1.17.3",
		OperatorIP:        "5.6.7.8",
	}

	genCfg, err := GenerateIgnitionConfig(cfg)
	if err != nil {
		t.Fatalf("GenerateIgnitionConfig failed: %v", err)
	}

	// The version without 'v' prefix should appear in the sysext download URL
	content := string(genCfg.IgnitionJSON)
	if !strings.Contains(content, "1.33.2") {
		t.Error("ignition config should contain kubernetes version (bare, without v prefix)")
	}
}

func TestGenerateIgnitionConfig_ContainsCiliumVersion(t *testing.T) {
	cfg := NodeConfig{
		Role:              "control-plane",
		ClusterName:       "test-cluster",
		ServerPublicIP:    "1.2.3.4",
		KubernetesVersion: "v1.33.2",
		CiliumVersion:     "1.17.3",
		OperatorIP:        "5.6.7.8",
	}

	genCfg, err := GenerateIgnitionConfig(cfg)
	if err != nil {
		t.Fatalf("GenerateIgnitionConfig failed: %v", err)
	}

	content := string(genCfg.IgnitionJSON)
	if !strings.Contains(content, "1.17.3") {
		t.Error("ignition config should contain cilium version")
	}
}

func TestGenerateIgnitionConfig_ContainsFirewallRules(t *testing.T) {
	cfg := NodeConfig{
		Role:              "control-plane",
		ClusterName:       "test-cluster",
		ServerPublicIP:    "1.2.3.4",
		KubernetesVersion: "v1.33.2",
		CiliumVersion:     "1.17.3",
		OperatorIP:        "5.6.7.8",
	}

	genCfg, err := GenerateIgnitionConfig(cfg)
	if err != nil {
		t.Fatalf("GenerateIgnitionConfig failed: %v", err)
	}

	content := string(genCfg.IgnitionJSON)
	if !strings.Contains(content, "5.6.7.8") {
		t.Error("ignition config should contain operator IP in firewall rules")
	}
}

func TestGenerateManifests_WithInfisical(t *testing.T) {
	cfg := ManifestConfig{
		ClusterName:                  "test-cluster",
		TeleportToken:                "test-token",
		TeleportProxyAddr:            "teleport.example.com:443",
		InfisicalClusterClientID:     "inf-client-id",
		InfisicalClusterClientSecret: "inf-client-secret",
	}

	manifests := GenerateManifests(cfg)
	if len(manifests) < 4 {
		t.Fatalf("expected at least 4 manifests, got %d", len(manifests))
	}

	// Check Infisical secret is present
	foundInfisical := false
	for _, m := range manifests {
		if strings.Contains(m, "infisical-machine-identity") {
			foundInfisical = true
			if !strings.Contains(m, "clientId") {
				t.Error("infisical manifest should contain clientId")
			}
		}
	}
	if !foundInfisical {
		t.Error("missing infisical-machine-identity manifest")
	}
}

func TestGenerateManifests_WithoutInfisical(t *testing.T) {
	cfg := ManifestConfig{
		ClusterName:       "test-cluster",
		TeleportToken:     "test-token",
		TeleportProxyAddr: "teleport.example.com:443",
	}

	manifests := GenerateManifests(cfg)

	for _, m := range manifests {
		if strings.Contains(m, "infisical-machine-identity") {
			t.Error("infisical manifest should NOT be present when credentials are empty")
		}
	}

	// Teleport manifests should still be present
	foundTeleport := false
	for _, m := range manifests {
		if strings.Contains(m, "teleport-join-token") {
			foundTeleport = true
		}
	}
	if !foundTeleport {
		t.Error("teleport-join-token manifest should always be present")
	}
}

func TestGenerateSSHKeypair(t *testing.T) {
	pub, priv, err := generateSSHKeypair()
	if err != nil {
		t.Fatalf("generateSSHKeypair failed: %v", err)
	}

	if !strings.HasPrefix(string(pub), "ssh-ed25519 ") {
		t.Error("public key should start with ssh-ed25519")
	}

	if !strings.Contains(string(priv), "OPENSSH PRIVATE KEY") {
		t.Error("private key should be in OpenSSH format")
	}
}
