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

func TestWithMayastorControlPlaneAddsOpenEBSExemption(t *testing.T) {
	input := []byte(`
cluster:
  apiServer:
    admissionControl:
      - name: PodSecurity
        configuration:
          exemptions:
            namespaces:
              - kube-system
`)

	out, err := WithMayastorControlPlane(input)
	if err != nil {
		t.Fatalf("WithMayastorControlPlane returned error: %v", err)
	}

	var cfg map[string]any
	if err := yaml.Unmarshal(out, &cfg); err != nil {
		t.Fatalf("unmarshal output: %v", err)
	}

	cluster := mustMap(t, cfg, "cluster")
	apiServer := mustMap(t, cluster, "apiServer")
	admissionControl := mustSlice(t, apiServer, "admissionControl")
	podSecurity := mustAdmissionController(t, admissionControl, "PodSecurity")
	configuration := mustMap(t, podSecurity, "configuration")
	exemptions := mustMap(t, configuration, "exemptions")
	namespaces := mustStringSlice(t, exemptions, "namespaces")
	if len(namespaces) != 2 {
		t.Fatalf("exemptions.namespaces length = %d, want 2 (got %v)", len(namespaces), namespaces)
	}
	if namespaces[0] != "kube-system" {
		t.Fatalf("exemptions.namespaces[0] = %q, want %q", namespaces[0], "kube-system")
	}
	if namespaces[1] != "openebs" {
		t.Fatalf("exemptions.namespaces[1] = %q, want %q", namespaces[1], "openebs")
	}
}

func TestWithMayastorControlPlaneValidatesInputs(t *testing.T) {
	if _, err := WithMayastorControlPlane(nil); err == nil {
		t.Fatalf("expected error for empty machine config")
	}

	if _, err := WithMayastorControlPlane([]byte("cluster: [")); err == nil {
		t.Fatalf("expected error for invalid YAML input")
	}
}

func TestWithMayastorNodeAddsPrerequisites(t *testing.T) {
	out, err := WithMayastorNode([]byte("machine: {}"))
	if err != nil {
		t.Fatalf("WithMayastorNode returned error: %v", err)
	}

	var cfg map[string]any
	if err := yaml.Unmarshal(out, &cfg); err != nil {
		t.Fatalf("unmarshal output: %v", err)
	}

	machine := mustMap(t, cfg, "machine")
	sysctls := mustMap(t, machine, "sysctls")
	if got := sysctls["vm.nr_hugepages"]; got != "1024" {
		t.Fatalf("machine.sysctls.vm.nr_hugepages = %v, want %q", got, "1024")
	}

	nodeLabels := mustMap(t, machine, "nodeLabels")
	if got := nodeLabels["openebs.io/engine"]; got != "mayastor" {
		t.Fatalf("machine.nodeLabels.openebs.io/engine = %v, want %q", got, "mayastor")
	}

	kubelet := mustMap(t, machine, "kubelet")
	extraMounts := mustSlice(t, kubelet, "extraMounts")
	mount := mustMount(t, extraMounts, "/var/local", "/var/local")
	if got := mount["type"]; got != "bind" {
		t.Fatalf("extraMounts /var/local type = %v, want %q", got, "bind")
	}
	options := mustStringSlice(t, mount, "options")
	wantOptions := []string{"bind", "rshared", "rw"}
	if strings.Join(options, ",") != strings.Join(wantOptions, ",") {
		t.Fatalf("extraMounts /var/local options = %v, want %v", options, wantOptions)
	}
}

func TestWithMayastorNodePreservesExistingMounts(t *testing.T) {
	input := []byte(`
machine:
  kubelet:
    extraMounts:
      - source: /var/lib/foo
        destination: /var/lib/foo
        type: bind
        options:
          - bind
`)

	out, err := WithMayastorNode(input)
	if err != nil {
		t.Fatalf("WithMayastorNode returned error: %v", err)
	}

	var cfg map[string]any
	if err := yaml.Unmarshal(out, &cfg); err != nil {
		t.Fatalf("unmarshal output: %v", err)
	}

	machine := mustMap(t, cfg, "machine")
	kubelet := mustMap(t, machine, "kubelet")
	extraMounts := mustSlice(t, kubelet, "extraMounts")
	if len(extraMounts) != 2 {
		t.Fatalf("machine.kubelet.extraMounts length = %d, want 2", len(extraMounts))
	}
	_ = mustMount(t, extraMounts, "/var/lib/foo", "/var/lib/foo")
	_ = mustMount(t, extraMounts, "/var/local", "/var/local")
}

func TestWithMayastorNodeValidatesInputs(t *testing.T) {
	if _, err := WithMayastorNode(nil); err == nil {
		t.Fatalf("expected error for empty machine config")
	}

	if _, err := WithMayastorNode([]byte("machine: [")); err == nil {
		t.Fatalf("expected error for invalid YAML input")
	}
}

func mustSlice(t *testing.T, parent map[string]any, key string) []any {
	t.Helper()

	value, ok := parent[key]
	if !ok {
		t.Fatalf("missing key %q", key)
	}

	items, ok := value.([]any)
	if !ok {
		t.Fatalf("key %q has unexpected type %T", key, value)
	}

	return items
}

func mustAdmissionController(t *testing.T, admissionControl []any, name string) map[string]any {
	t.Helper()

	for _, item := range admissionControl {
		controller, ok := item.(map[string]any)
		if !ok {
			continue
		}
		if controller["name"] == name {
			return controller
		}
	}

	t.Fatalf("admission controller %q not found", name)
	return nil
}

func mustMount(t *testing.T, extraMounts []any, source, destination string) map[string]any {
	t.Helper()

	for _, item := range extraMounts {
		mount, ok := item.(map[string]any)
		if !ok {
			continue
		}
		if mount["source"] == source && mount["destination"] == destination {
			return mount
		}
	}

	t.Fatalf("extraMount source=%q destination=%q not found", source, destination)
	return nil
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
