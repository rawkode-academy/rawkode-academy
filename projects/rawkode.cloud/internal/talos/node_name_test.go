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

func TestWithCertSANsAddsAndDeduplicates(t *testing.T) {
	input := []byte(`
machine:
  certSANs:
    - production-control-plane-01
`)

	out, err := WithCertSANs(input,
		"production-control-plane-01",
		" production-control-plane-01.rka.internal ",
		"",
	)
	if err != nil {
		t.Fatalf("WithCertSANs returned error: %v", err)
	}

	var cfg map[string]any
	if err := yaml.Unmarshal(out, &cfg); err != nil {
		t.Fatalf("unmarshal output: %v", err)
	}

	machine := mustMap(t, cfg, "machine")
	certSANs := mustStringSlice(t, machine, "certSANs")
	if len(certSANs) != 2 {
		t.Fatalf("machine.certSANs length = %d, want 2 (got %v)", len(certSANs), certSANs)
	}
	if certSANs[0] != "production-control-plane-01" {
		t.Fatalf("machine.certSANs[0] = %q, want %q", certSANs[0], "production-control-plane-01")
	}
	if certSANs[1] != "production-control-plane-01.rka.internal" {
		t.Fatalf("machine.certSANs[1] = %q, want %q", certSANs[1], "production-control-plane-01.rka.internal")
	}
}

func TestWithCertSANsValidatesInputs(t *testing.T) {
	if _, err := WithCertSANs(nil, "node-01"); err == nil {
		t.Fatalf("expected error for empty machine config")
	}

	if _, err := WithCertSANs([]byte("machine: ["), "node-01"); err == nil {
		t.Fatalf("expected error for invalid YAML input")
	}
}

func mustStringSlice(t *testing.T, parent map[string]any, key string) []string {
	t.Helper()

	value, ok := parent[key]
	if !ok {
		t.Fatalf("missing key %q", key)
	}

	items, ok := value.([]any)
	if !ok {
		t.Fatalf("key %q has unexpected type %T", key, value)
	}

	out := make([]string, 0, len(items))
	for _, item := range items {
		str, ok := item.(string)
		if !ok {
			t.Fatalf("key %q has non-string entry of type %T", key, item)
		}
		out = append(out, str)
	}

	return out
}
