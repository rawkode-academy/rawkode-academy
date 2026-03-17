package gatewayapi

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"strings"

	apimeta "k8s.io/apimachinery/pkg/api/meta"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/types"
	utilyaml "k8s.io/apimachinery/pkg/util/yaml"
	"k8s.io/client-go/discovery"
	"k8s.io/client-go/discovery/cached/memory"
	"k8s.io/client-go/dynamic"
	"k8s.io/client-go/restmapper"
	"k8s.io/client-go/tools/clientcmd"
)

const (
	DefaultGatewayAPIVersion = "v1.4.1"
	fieldManager             = "rawkode-cloud3"
)

// InstallCRDsParams holds parameters for Gateway API CRD installation.
type InstallCRDsParams struct {
	Kubeconfig        string
	GatewayAPIVersion string // e.g. "v1.4.1"
}

// crdURL returns the download URL for the experimental Gateway API CRD bundle.
// The experimental bundle includes TLSRoute, TCPRoute, and UDPRoute CRDs
// required for TLS passthrough (e.g. Teleport ACME TLS-ALPN-01).
func crdURL(version string) string {
	return fmt.Sprintf(
		"https://github.com/kubernetes-sigs/gateway-api/releases/download/%s/experimental-install.yaml",
		version,
	)
}

// httpGet is a package-level variable to allow test injection.
var httpGet = http.Get

// InstallCRDs downloads the Gateway API standard CRD bundle and applies it via server-side apply.
func InstallCRDs(ctx context.Context, params InstallCRDsParams) error {
	version := strings.TrimSpace(params.GatewayAPIVersion)
	if version == "" {
		version = DefaultGatewayAPIVersion
	}

	slog.Info("installing gateway API CRDs", "version", version)

	manifest, err := fetchManifest(ctx, crdURL(version))
	if err != nil {
		return fmt.Errorf("fetch gateway API CRDs: %w", err)
	}

	cfg, err := clientcmd.BuildConfigFromFlags("", strings.TrimSpace(params.Kubeconfig))
	if err != nil {
		return fmt.Errorf("load kube config: %w", err)
	}

	objects, err := decodeManifest(manifest)
	if err != nil {
		return fmt.Errorf("decode gateway API CRD manifest: %w", err)
	}
	if len(objects) == 0 {
		return fmt.Errorf("no Kubernetes objects found in Gateway API CRD manifest")
	}

	discoveryClient, err := discovery.NewDiscoveryClientForConfig(cfg)
	if err != nil {
		return fmt.Errorf("create discovery client: %w", err)
	}

	mapper := restmapper.NewDeferredDiscoveryRESTMapper(memory.NewMemCacheClient(discoveryClient))
	dynamicClient, err := dynamic.NewForConfig(cfg)
	if err != nil {
		return fmt.Errorf("create dynamic client: %w", err)
	}

	for _, obj := range objects {
		if err := applyObject(ctx, dynamicClient, mapper, obj); err != nil {
			return err
		}
	}

	slog.Info("gateway API CRDs installed", "version", version, "objects", len(objects))
	return nil
}

func fetchManifest(_ context.Context, url string) (string, error) {
	resp, err := httpGet(url)
	if err != nil {
		return "", fmt.Errorf("HTTP GET %s: %w", url, err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("HTTP GET %s returned status %d", url, resp.StatusCode)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", fmt.Errorf("read response body from %s: %w", url, err)
	}

	return string(body), nil
}

func decodeManifest(manifest string) ([]*unstructured.Unstructured, error) {
	decoder := utilyaml.NewYAMLOrJSONDecoder(bytes.NewReader([]byte(manifest)), 4096)
	var objects []*unstructured.Unstructured

	for {
		var raw map[string]any
		err := decoder.Decode(&raw)
		if err == io.EOF {
			break
		}
		if err != nil {
			return nil, fmt.Errorf("decode manifest: %w", err)
		}
		if len(raw) == 0 {
			continue
		}

		obj := &unstructured.Unstructured{Object: raw}
		if obj.GetName() == "" || obj.GetKind() == "" {
			continue
		}

		objects = append(objects, obj)
	}

	return objects, nil
}

func applyObject(
	ctx context.Context,
	dynamicClient dynamic.Interface,
	mapper *restmapper.DeferredDiscoveryRESTMapper,
	obj *unstructured.Unstructured,
) error {
	mapping, err := restMapping(mapper, obj.GroupVersionKind())
	if err != nil {
		return fmt.Errorf("resolve REST mapping for %s %s: %w", obj.GetKind(), obj.GetName(), err)
	}

	payload, err := json.Marshal(obj.Object)
	if err != nil {
		return fmt.Errorf("marshal object %s/%s: %w", obj.GetKind(), obj.GetName(), err)
	}

	var resourceClient dynamic.ResourceInterface
	if mapping.Scope.Name() == apimeta.RESTScopeNameNamespace {
		namespace := obj.GetNamespace()
		if namespace == "" {
			namespace = "default"
		}
		resourceClient = dynamicClient.Resource(mapping.Resource).Namespace(namespace)
	} else {
		resourceClient = dynamicClient.Resource(mapping.Resource)
	}

	force := true
	if _, err := resourceClient.Patch(ctx, obj.GetName(), types.ApplyPatchType, payload, metav1.PatchOptions{
		FieldManager: fieldManager,
		Force:        &force,
	}); err != nil {
		return fmt.Errorf("server-side apply %s/%s: %w", obj.GetKind(), obj.GetName(), err)
	}

	return nil
}

func restMapping(mapper *restmapper.DeferredDiscoveryRESTMapper, gvk schema.GroupVersionKind) (*apimeta.RESTMapping, error) {
	mapping, err := mapper.RESTMapping(gvk.GroupKind(), gvk.Version)
	if err == nil {
		return mapping, nil
	}

	mapper.Reset()
	return mapper.RESTMapping(gvk.GroupKind(), gvk.Version)
}
