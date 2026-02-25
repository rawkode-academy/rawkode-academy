package talos

import (
	"strings"
	"testing"

	"gopkg.in/yaml.v3"
)

func TestWithNodeNameSetsHostnameAndKubeletOverride(t *testing.T) {
	input := []byte(`
version: v1alpha1
machine:
  type: worker
`)

	out, err := WithNodeName(input, "production-worker-01")
	if err != nil {
		t.Fatalf("WithNodeName returned error: %v", err)
	}

	var cfg map[string]any
	if err := yaml.Unmarshal(out, &cfg); err != nil {
		t.Fatalf("unmarshal output: %v", err)
	}

	machine := mustMap(t, cfg, "machine")
	network := mustMap(t, machine, "network")
	if got := network["hostname"]; got != "production-worker-01" {
		t.Fatalf("machine.network.hostname = %v, want %q", got, "production-worker-01")
	}

	kubelet := mustMap(t, machine, "kubelet")
	extraArgs := mustMap(t, kubelet, "extraArgs")
	if got := extraArgs["hostname-override"]; got != "production-worker-01" {
		t.Fatalf("machine.kubelet.extraArgs.hostname-override = %v, want %q", got, "production-worker-01")
	}
}

func TestWithNodeNamePreservesExistingKubeletExtraArgs(t *testing.T) {
	input := []byte(`
machine:
  kubelet:
    extraArgs:
      rotate-server-certificates: "true"
`)

	out, err := WithNodeName(input, "production-control-plane-01")
	if err != nil {
		t.Fatalf("WithNodeName returned error: %v", err)
	}

	var cfg map[string]any
	if err := yaml.Unmarshal(out, &cfg); err != nil {
		t.Fatalf("unmarshal output: %v", err)
	}

	machine := mustMap(t, cfg, "machine")
	kubelet := mustMap(t, machine, "kubelet")
	extraArgs := mustMap(t, kubelet, "extraArgs")
	if got := extraArgs["rotate-server-certificates"]; got != "true" {
		t.Fatalf("machine.kubelet.extraArgs.rotate-server-certificates = %v, want %q", got, "true")
	}
	if got := extraArgs["hostname-override"]; got != "production-control-plane-01" {
		t.Fatalf("machine.kubelet.extraArgs.hostname-override = %v, want %q", got, "production-control-plane-01")
	}
}

func TestWithNodeNameValidatesInputs(t *testing.T) {
	if _, err := WithNodeName(nil, "node-01"); err == nil {
		t.Fatalf("expected error for empty machine config")
	}

	if _, err := WithNodeName([]byte("machine: {}"), ""); err == nil {
		t.Fatalf("expected error for empty node name")
	}

	if _, err := WithNodeName([]byte("machine: ["), "node-01"); err == nil {
		t.Fatalf("expected error for invalid YAML input")
	}
}

func mustMap(t *testing.T, parent map[string]any, key string) map[string]any {
	t.Helper()

	v, ok := parent[key]
	if !ok {
		t.Fatalf("missing key %q", key)
	}

	out, ok := v.(map[string]any)
	if !ok {
		t.Fatalf("key %q has unexpected type %T", key, v)
	}

	return out
}

func TestWithNodeNameTrimsNodeName(t *testing.T) {
	out, err := WithNodeName([]byte("machine: {}"), "  production-worker-02  ")
	if err != nil {
		t.Fatalf("WithNodeName returned error: %v", err)
	}
	if !strings.Contains(string(out), "production-worker-02") {
		t.Fatalf("expected output to include trimmed node name, got:\n%s", string(out))
	}
}
