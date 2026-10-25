package talos

import (
	"bytes"
	"context"
	"io"
	"testing"

	talosk8s "github.com/siderolabs/talos/pkg/machinery/config/types/k8s"
	"gopkg.in/yaml.v3"
)

func TestResolveInstallDisk(t *testing.T) {
	tests := []struct {
		name  string
		input string
		want  string
	}{
		{
			name:  "configured disk",
			input: "/dev/vda",
			want:  "/dev/vda",
		},
		{
			name:  "configured disk with whitespace",
			input: "  /dev/sda  ",
			want:  "/dev/sda",
		},
		{
			name:  "empty falls back to default",
			input: "",
			want:  defaultOSDisk,
		},
		{
			name:  "whitespace falls back to default",
			input: "   ",
			want:  defaultOSDisk,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := resolveInstallDisk(tt.input); got != tt.want {
				t.Fatalf("resolveInstallDisk(%q) = %q, want %q", tt.input, got, tt.want)
			}
		})
	}
}

func TestAllowSchedulingOnControlPlanes(t *testing.T) {
	tests := []struct {
		name               string
		controlPlaneTaints bool
		want               bool
	}{
		{
			name:               "taints enabled keeps control plane isolated",
			controlPlaneTaints: true,
			want:               false,
		},
		{
			name:               "taints disabled allows control plane scheduling",
			controlPlaneTaints: false,
			want:               true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := allowSchedulingOnControlPlanes(tt.controlPlaneTaints); got != tt.want {
				t.Fatalf("allowSchedulingOnControlPlanes(%t) = %t, want %t", tt.controlPlaneTaints, got, tt.want)
			}
		})
	}
}

func TestGenerateConfigDisablesTalosManagedCNI(t *testing.T) {
	ctx := context.Background()
	secrets, err := GenerateSecretsYAML(ctx)
	if err != nil {
		t.Fatalf("generate secrets: %v", err)
	}

	versions := []struct {
		name         string
		talosVersion string
		legacyCNI    bool
	}{
		{name: "talos 1.12", talosVersion: "v1.12.4", legacyCNI: true},
		{name: "talos 1.14", talosVersion: "v1.14.4", legacyCNI: false},
	}

	for _, version := range versions {
		t.Run(version.name, func(t *testing.T) {
			result, err := GenerateConfig(ctx, GenConfigParams{
				ClusterName:       "cni-test",
				Endpoint:          "192.0.2.10",
				TalosVersion:      version.talosVersion,
				KubernetesVersion: "v1.35.0",
				InstallDisk:       defaultOSDisk,
				SecretsYAML:       secrets,
			})
			if err != nil {
				t.Fatalf("generate config: %v", err)
			}

			for _, machineConfig := range []struct {
				role string
				raw  []byte
			}{
				{role: "control-plane", raw: result.ControlPlane},
				{role: "worker", raw: result.Worker},
			} {
				documents := decodeConfigDocuments(t, machineConfig.raw)
				assertTalosDoesNotInstallCNI(t, machineConfig.role, documents, version.legacyCNI)
			}
		})
	}
}

func decodeConfigDocuments(t *testing.T, raw []byte) []map[string]any {
	t.Helper()

	decoder := yaml.NewDecoder(bytes.NewReader(raw))
	var documents []map[string]any
	for {
		var document map[string]any
		err := decoder.Decode(&document)
		if err == io.EOF {
			return documents
		}
		if err != nil {
			t.Fatalf("decode config document: %v", err)
		}
		if document != nil {
			documents = append(documents, document)
		}
	}
}

func assertTalosDoesNotInstallCNI(t *testing.T, role string, documents []map[string]any, legacyCNI bool) {
	t.Helper()

	foundLegacyCNI := false
	for _, document := range documents {
		if kind, _ := document["kind"].(string); kind == talosk8s.KubeFlannelCNIConfig {
			t.Fatalf("%s config includes %s; Talos would install Flannel", role, kind)
		}

		network, ok := clusterNetwork(document)
		if !ok {
			continue
		}

		cni, ok := network["cni"].(map[string]any)
		if !ok {
			t.Fatalf("%s cluster.network omits cni; Talos defaults that to Flannel", role)
		}
		name, _ := cni["name"].(string)
		if name != "none" {
			t.Fatalf("%s cluster.network.cni.name = %q, want none", role, name)
		}
		if len(cni) != 1 {
			t.Fatalf("%s cluster.network.cni = %#v, want only name=none", role, cni)
		}
		foundLegacyCNI = true
	}

	if legacyCNI && !foundLegacyCNI {
		t.Fatalf("%s config missing cluster.network.cni.name=none", role)
	}
}

func clusterNetwork(document map[string]any) (map[string]any, bool) {
	cluster, ok := document["cluster"].(map[string]any)
	if !ok {
		return nil, false
	}
	network, ok := cluster["network"].(map[string]any)
	return network, ok
}
