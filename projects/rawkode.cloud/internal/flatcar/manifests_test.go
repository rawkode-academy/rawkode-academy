package flatcar

import (
	"strings"
	"testing"
)

func TestGenerateManifestsSkipsTeleportWhenNotConfigured(t *testing.T) {
	manifests := GenerateManifests(ManifestConfig{
		InfisicalClusterClientID:     "client-id",
		InfisicalClusterClientSecret: "client-secret",
	})

	if len(manifests) != 1 {
		t.Fatalf("expected only Infisical manifest, got %d", len(manifests))
	}

	if !strings.Contains(manifests[0], "infisical-machine-identity") {
		t.Fatalf("expected Infisical manifest, got: %s", manifests[0])
	}
}

func TestGenerateManifestsIncludesTeleportWhenConfigured(t *testing.T) {
	manifests := GenerateManifests(ManifestConfig{
		ClusterName:       "prod",
		TeleportToken:     "token-123",
		TeleportProxyAddr: "teleport.example.com:443",
	})

	if len(manifests) != 4 {
		t.Fatalf("expected 4 Teleport manifests, got %d", len(manifests))
	}

	if !strings.Contains(manifests[0], "teleport-join-token") {
		t.Fatalf("expected teleport join-token secret first, got: %s", manifests[0])
	}
}
