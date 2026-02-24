package teleport

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
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
	"k8s.io/client-go/rest"
	"k8s.io/client-go/restmapper"
	"k8s.io/client-go/tools/clientcmd"
)

const teleportFieldManager = "rawkode-cloud3-teleport"

// DeployKubeAgentParams defines parameters for deploying the external Teleport kube agent.
type DeployKubeAgentParams struct {
	Kubeconfig  string
	ProxyAddr   string
	ClusterName string
	JoinToken   string
}

// DeploySelfHostedParams defines parameters for deploying self-hosted Teleport.
type DeploySelfHostedParams struct {
	Kubeconfig         string
	ClusterName        string
	Domain             string
	GitHubOrganization string
	GitHubTeams        []string
	GitHubClientID     string
	GitHubClientSecret string
}

// DeployKubeAgent applies the Teleport kube-agent manifests for external Teleport mode.
func DeployKubeAgent(ctx context.Context, params DeployKubeAgentParams) error {
	if strings.TrimSpace(params.ProxyAddr) == "" {
		return fmt.Errorf("proxy address is required")
	}
	if strings.TrimSpace(params.ClusterName) == "" {
		return fmt.Errorf("cluster name is required")
	}
	if strings.TrimSpace(params.JoinToken) == "" {
		return fmt.Errorf("join token is required")
	}

	return applyKubernetesManifest(ctx, strings.TrimSpace(params.Kubeconfig), KubeAgentManifest(
		strings.TrimSpace(params.ProxyAddr),
		strings.TrimSpace(params.ClusterName),
		strings.TrimSpace(params.JoinToken),
	))
}

// DeploySelfHosted applies a single-node self-hosted Teleport deployment with GitHub auth.
func DeploySelfHosted(ctx context.Context, params DeploySelfHostedParams) error {
	if strings.TrimSpace(params.ClusterName) == "" {
		return fmt.Errorf("cluster name is required")
	}
	if strings.TrimSpace(params.Domain) == "" {
		return fmt.Errorf("domain is required")
	}
	if strings.TrimSpace(params.GitHubOrganization) == "" {
		return fmt.Errorf("github organization is required")
	}
	if strings.TrimSpace(params.GitHubClientID) == "" || strings.TrimSpace(params.GitHubClientSecret) == "" {
		return fmt.Errorf("github client credentials are required")
	}

	teams := make([]string, 0, len(params.GitHubTeams))
	for _, team := range params.GitHubTeams {
		if trimmed := strings.TrimSpace(team); trimmed != "" {
			teams = append(teams, trimmed)
		}
	}
	if len(teams) == 0 {
		return fmt.Errorf("at least one github team is required")
	}

	manifest := SelfHostedManifest(
		strings.TrimSpace(params.ClusterName),
		strings.TrimSpace(params.Domain),
		strings.TrimSpace(params.GitHubOrganization),
		teams,
		strings.TrimSpace(params.GitHubClientID),
		strings.TrimSpace(params.GitHubClientSecret),
	)

	return applyKubernetesManifest(ctx, strings.TrimSpace(params.Kubeconfig), manifest)
}

func applyKubernetesManifest(ctx context.Context, kubeconfigPath, manifest string) error {
	cfg, err := kubeConfig(kubeconfigPath)
	if err != nil {
		return fmt.Errorf("load kube config: %w", err)
	}

	objects, err := decodeManifest(manifest)
	if err != nil {
		return err
	}
	if len(objects) == 0 {
		return fmt.Errorf("no Kubernetes objects found in manifest")
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

	return nil
}

func decodeManifest(manifest string) ([]*unstructured.Unstructured, error) {
	decoder := utilyaml.NewYAMLOrJSONDecoder(bytes.NewReader([]byte(manifest)), 4096)
	objects := make([]*unstructured.Unstructured, 0)

	for {
		var raw map[string]interface{}
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
			namespace = metav1.NamespaceDefault
		}
		resourceClient = dynamicClient.Resource(mapping.Resource).Namespace(namespace)
	} else {
		resourceClient = dynamicClient.Resource(mapping.Resource)
	}

	force := true
	if _, err := resourceClient.Patch(ctx, obj.GetName(), types.ApplyPatchType, payload, metav1.PatchOptions{
		FieldManager: teleportFieldManager,
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

func kubeConfig(kubeconfig string) (*rest.Config, error) {
	if kubeconfig != "" {
		return clientcmd.BuildConfigFromFlags("", kubeconfig)
	}

	loadingRules := clientcmd.NewDefaultClientConfigLoadingRules()
	return clientcmd.NewNonInteractiveDeferredLoadingClientConfig(loadingRules, &clientcmd.ConfigOverrides{}).ClientConfig()
}
