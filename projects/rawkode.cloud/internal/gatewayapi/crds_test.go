package gatewayapi

import (
	"strings"
	"testing"
)

func TestCrdURL(t *testing.T) {
	url := crdURL("v1.4.1")
	if url != "https://github.com/kubernetes-sigs/gateway-api/releases/download/v1.4.1/experimental-install.yaml" {
		t.Fatalf("unexpected CRD URL: %s", url)
	}
}

func TestCrdURLCustomVersion(t *testing.T) {
	url := crdURL("v1.3.0")
	if !strings.Contains(url, "v1.3.0") {
		t.Fatalf("expected version v1.3.0 in URL: %s", url)
	}
}

func TestDecodeManifestParsesCRDs(t *testing.T) {
	manifest := `
apiVersion: apiextensions.k8s.io/v1
kind: CustomResourceDefinition
metadata:
  name: gateways.gateway.networking.k8s.io
spec:
  group: gateway.networking.k8s.io
---
apiVersion: apiextensions.k8s.io/v1
kind: CustomResourceDefinition
metadata:
  name: httproutes.gateway.networking.k8s.io
spec:
  group: gateway.networking.k8s.io
`
	objects, err := decodeManifest(manifest)
	if err != nil {
		t.Fatalf("decodeManifest returned error: %v", err)
	}
	if len(objects) != 2 {
		t.Fatalf("expected 2 objects, got %d", len(objects))
	}
	if objects[0].GetName() != "gateways.gateway.networking.k8s.io" {
		t.Fatalf("expected first object name gateways.gateway.networking.k8s.io, got %s", objects[0].GetName())
	}
	if objects[1].GetName() != "httproutes.gateway.networking.k8s.io" {
		t.Fatalf("expected second object name httproutes.gateway.networking.k8s.io, got %s", objects[1].GetName())
	}
}

func TestDecodeManifestSkipsEmptyDocuments(t *testing.T) {
	manifest := `
---
---
apiVersion: apiextensions.k8s.io/v1
kind: CustomResourceDefinition
metadata:
  name: gateways.gateway.networking.k8s.io
spec:
  group: gateway.networking.k8s.io
---
`
	objects, err := decodeManifest(manifest)
	if err != nil {
		t.Fatalf("decodeManifest returned error: %v", err)
	}
	if len(objects) != 1 {
		t.Fatalf("expected 1 object, got %d", len(objects))
	}
}

func TestDecodeManifestSkipsObjectsWithoutNameOrKind(t *testing.T) {
	manifest := `
apiVersion: v1
kind: ""
metadata:
  name: something
---
apiVersion: v1
kind: ConfigMap
metadata:
  name: ""
---
apiVersion: apiextensions.k8s.io/v1
kind: CustomResourceDefinition
metadata:
  name: gateways.gateway.networking.k8s.io
`
	objects, err := decodeManifest(manifest)
	if err != nil {
		t.Fatalf("decodeManifest returned error: %v", err)
	}
	if len(objects) != 1 {
		t.Fatalf("expected 1 object, got %d", len(objects))
	}
}

func TestDefaultGatewayAPIVersion(t *testing.T) {
	if DefaultGatewayAPIVersion != "v1.4.1" {
		t.Fatalf("DefaultGatewayAPIVersion = %q, want %q", DefaultGatewayAPIVersion, "v1.4.1")
	}
}
