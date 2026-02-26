package cmd

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestRunClusterScaffoldDefaultsFluxOCIRepo(t *testing.T) {
	outputFile := filepath.Join(t.TempDir(), "staging.yaml")

	if err := runClusterScaffold("staging", outputFile); err != nil {
		t.Fatalf("runClusterScaffold returned error: %v", err)
	}

	content, err := os.ReadFile(outputFile)
	if err != nil {
		t.Fatalf("read scaffolded config: %v", err)
	}

	if !strings.Contains(
		string(content),
		`ociRepo: "oci://ghcr.io/rawkode-academy/rawkode-academy/gitops"`,
	) {
		t.Fatalf("scaffolded config missing default flux ociRepo:\n%s", string(content))
	}
}
