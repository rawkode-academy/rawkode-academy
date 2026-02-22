package state

import (
	"context"
	"testing"
)

func TestValidateConfigAllowsMissingTeleportProxy(t *testing.T) {
	cfg := Config{
		ClusterName:       "test-cluster",
		OfferID:           "offer-id",
		OSID:              "os-id",
		Role:              "control-plane",
		KubernetesVersion: "v1.35.1",
		CiliumVersion:     "1.19.1",
	}

	if err := validateConfig(&cfg); err != nil {
		t.Fatalf("validateConfig should allow missing teleport proxy: %v", err)
	}
}

func TestValidateInfectConfigAllowsMissingTeleportProxy(t *testing.T) {
	cfg := InfectConfig{
		Host:              "192.0.2.10",
		ClusterName:       "test-cluster",
		Role:              "control-plane",
		KubernetesVersion: "v1.35.1",
		CiliumVersion:     "1.19.1",
	}

	if err := validateInfectConfig(&cfg); err != nil {
		t.Fatalf("validateInfectConfig should allow missing teleport proxy: %v", err)
	}
}

func TestResolveCloudflareZoneIDUsesExplicitZoneID(t *testing.T) {
	got, err := resolveCloudflareZoneID(context.Background(), "", "zone-id", "account-id", "rawkode.cloud")
	if err != nil {
		t.Fatalf("expected no error when zone ID is explicit: %v", err)
	}
	if got != "zone-id" {
		t.Fatalf("expected explicit zone ID, got %q", got)
	}
}
