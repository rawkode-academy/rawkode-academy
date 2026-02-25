package flux

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"strings"
	"time"

	fluxinstall "github.com/fluxcd/flux2/v2/pkg/manifestgen/install"
	kustomizev1 "github.com/fluxcd/kustomize-controller/api/v1"
	sourcev1 "github.com/fluxcd/source-controller/api/v1"
	appsv1 "k8s.io/api/apps/v1"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	apimeta "k8s.io/apimachinery/pkg/api/meta"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/types"
	"k8s.io/apimachinery/pkg/util/wait"
	utilyaml "k8s.io/apimachinery/pkg/util/yaml"
	"k8s.io/client-go/discovery"
	"k8s.io/client-go/discovery/cached/memory"
	"k8s.io/client-go/dynamic"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/restmapper"
	"k8s.io/client-go/tools/clientcmd"
	ctrlclient "sigs.k8s.io/controller-runtime/pkg/client"
)

// BootstrapParams holds parameters for FluxCD bootstrap.
type BootstrapParams struct {
	Kubeconfig string
	OCIRepo    string // OCI repository URL (e.g. oci://ghcr.io/rawkode-academy/flux)
	Branch     string
	Version    string // Optional Flux version for install manifest generation.
}

const (
	fluxNamespace      = "flux-system"
	clusterConfigName  = "bootstrap"
	fluxFieldManager   = "rawkode-cloud3"
	readyConditionType = "Ready"
)

var fluxControllers = []string{
	"source-controller",
	"kustomize-controller",
	"helm-controller",
	"notification-controller",
}

// Bootstrap installs FluxCD into the cluster and configures an OCI source/Kustomization when provided.
// This implementation uses Flux and Kubernetes Go modules directly (no external flux CLI binary).
func Bootstrap(ctx context.Context, params BootstrapParams) error {
	if ctx == nil {
		ctx = context.Background()
	}

	cfg, err := kubeConfig(strings.TrimSpace(params.Kubeconfig))
	if err != nil {
		return fmt.Errorf("load kube config: %w", err)
	}

	if err := installComponents(ctx, cfg, strings.TrimSpace(params.Version)); err != nil {
		return err
	}

	if strings.TrimSpace(params.OCIRepo) == "" {
		slog.Info("fluxcd install complete (no OCI source configured)")
		return nil
	}

	if err := upsertOCIResources(ctx, cfg, strings.TrimSpace(params.OCIRepo)); err != nil {
		return err
	}

	slog.Info("fluxcd bootstrap complete", "oci_repo", strings.TrimSpace(params.OCIRepo))
	return nil
}

func installComponents(ctx context.Context, cfg *rest.Config, version string) error {
	opts := fluxinstall.MakeDefaultOptions()
	opts.Namespace = fluxNamespace
	if version != "" {
		opts.Version = version
	}

	slog.Info("installing flux components", "version", opts.Version, "namespace", opts.Namespace)

	manifest, err := fluxinstall.Generate(opts, "")
	if err != nil {
		return fmt.Errorf("generate flux install manifests: %w", err)
	}

	if err := applyManifest(ctx, cfg, manifest.Content); err != nil {
		return fmt.Errorf("apply flux install manifests: %w", err)
	}

	kubeClient, err := newFluxClient(cfg)
	if err != nil {
		return fmt.Errorf("create kubernetes client: %w", err)
	}

	if err := waitForFluxControllers(ctx, kubeClient, 5*time.Minute); err != nil {
		return fmt.Errorf("wait for flux controllers: %w", err)
	}

	slog.Info("flux components installed")
	return nil
}

func upsertOCIResources(ctx context.Context, cfg *rest.Config, ociRepo string) error {
	kubeClient, err := newFluxClient(cfg)
	if err != nil {
		return fmt.Errorf("create kubernetes client: %w", err)
	}

	if err := upsertOCIRepository(ctx, kubeClient, ociRepo); err != nil {
		return err
	}

	if err := upsertKustomization(ctx, kubeClient); err != nil {
		return err
	}

	if err := waitForOCIRepositoryReady(ctx, kubeClient, 5*time.Minute); err != nil {
		return err
	}

	if err := waitForKustomizationReady(ctx, kubeClient, 5*time.Minute); err != nil {
		return err
	}

	return nil
}

func upsertOCIRepository(ctx context.Context, kubeClient ctrlclient.Client, ociRepo string) error {
	desired := &sourcev1.OCIRepository{
		ObjectMeta: metav1.ObjectMeta{
			Name:      clusterConfigName,
			Namespace: fluxNamespace,
		},
		Spec: sourcev1.OCIRepositorySpec{
			URL: ociRepo,
			Interval: metav1.Duration{
				Duration: 5 * time.Minute,
			},
			Reference: &sourcev1.OCIRepositoryRef{
				Tag: "latest",
			},
		},
	}

	var existing sourcev1.OCIRepository
	key := ctrlclient.ObjectKeyFromObject(desired)
	err := kubeClient.Get(ctx, key, &existing)
	if apierrors.IsNotFound(err) {
		slog.Info("creating flux OCI source", "repo", ociRepo)
		if err := kubeClient.Create(ctx, desired); err != nil {
			return fmt.Errorf("create OCIRepository %s: %w", key.String(), err)
		}
		return nil
	}
	if err != nil {
		return fmt.Errorf("get OCIRepository %s: %w", key.String(), err)
	}

	existing.Spec = desired.Spec
	if err := kubeClient.Update(ctx, &existing); err != nil {
		return fmt.Errorf("update OCIRepository %s: %w", key.String(), err)
	}

	slog.Info("updated flux OCI source", "repo", ociRepo)
	return nil
}

func upsertKustomization(ctx context.Context, kubeClient ctrlclient.Client) error {
	desired := &kustomizev1.Kustomization{
		ObjectMeta: metav1.ObjectMeta{
			Name:      clusterConfigName,
			Namespace: fluxNamespace,
		},
		Spec: kustomizev1.KustomizationSpec{
			Interval: metav1.Duration{
				Duration: 5 * time.Minute,
			},
			Path:  "./",
			Prune: true,
			Wait:  true,
			SourceRef: kustomizev1.CrossNamespaceSourceReference{
				Kind: sourcev1.OCIRepositoryKind,
				Name: clusterConfigName,
			},
		},
	}

	var existing kustomizev1.Kustomization
	key := ctrlclient.ObjectKeyFromObject(desired)
	err := kubeClient.Get(ctx, key, &existing)
	if apierrors.IsNotFound(err) {
		slog.Info("creating flux kustomization")
		if err := kubeClient.Create(ctx, desired); err != nil {
			return fmt.Errorf("create Kustomization %s: %w", key.String(), err)
		}
		return nil
	}
	if err != nil {
		return fmt.Errorf("get Kustomization %s: %w", key.String(), err)
	}

	existing.Spec = desired.Spec
	if err := kubeClient.Update(ctx, &existing); err != nil {
		return fmt.Errorf("update Kustomization %s: %w", key.String(), err)
	}

	slog.Info("updated flux kustomization")
	return nil
}

func waitForOCIRepositoryReady(ctx context.Context, kubeClient ctrlclient.Client, timeout time.Duration) error {
	key := ctrlclient.ObjectKey{Name: clusterConfigName, Namespace: fluxNamespace}
	return waitForReadyCondition(ctx, timeout, "OCIRepository/"+key.String(), func(ctx context.Context) ([]metav1.Condition, error) {
		var repo sourcev1.OCIRepository
		if err := kubeClient.Get(ctx, key, &repo); err != nil {
			return nil, err
		}
		return repo.Status.Conditions, nil
	})
}

func waitForKustomizationReady(ctx context.Context, kubeClient ctrlclient.Client, timeout time.Duration) error {
	key := ctrlclient.ObjectKey{Name: clusterConfigName, Namespace: fluxNamespace}
	return waitForReadyCondition(ctx, timeout, "Kustomization/"+key.String(), func(ctx context.Context) ([]metav1.Condition, error) {
		var ks kustomizev1.Kustomization
		if err := kubeClient.Get(ctx, key, &ks); err != nil {
			return nil, err
		}
		return ks.Status.Conditions, nil
	})
}

func waitForReadyCondition(
	ctx context.Context,
	timeout time.Duration,
	resource string,
	conditionsFn func(context.Context) ([]metav1.Condition, error),
) error {
	return wait.PollUntilContextTimeout(ctx, 2*time.Second, timeout, true, func(ctx context.Context) (bool, error) {
		conditions, err := conditionsFn(ctx)
		if err != nil {
			if apierrors.IsNotFound(err) {
				return false, nil
			}
			return false, err
		}

		readyCondition := apimeta.FindStatusCondition(conditions, readyConditionType)
		if readyCondition == nil {
			return false, nil
		}

		switch readyCondition.Status {
		case metav1.ConditionTrue:
			return true, nil
		case metav1.ConditionFalse:
			return false, fmt.Errorf("%s not ready: %s", resource, readyCondition.Message)
		default:
			return false, nil
		}
	})
}

func waitForFluxControllers(ctx context.Context, kubeClient ctrlclient.Client, timeout time.Duration) error {
	for _, controller := range fluxControllers {
		key := ctrlclient.ObjectKey{Name: controller, Namespace: fluxNamespace}
		err := wait.PollUntilContextTimeout(ctx, 2*time.Second, timeout, true, func(ctx context.Context) (bool, error) {
			var deployment appsv1.Deployment
			if err := kubeClient.Get(ctx, key, &deployment); err != nil {
				if apierrors.IsNotFound(err) {
					return false, nil
				}
				return false, err
			}
			return deploymentReady(&deployment), nil
		})
		if err != nil {
			return fmt.Errorf("controller %s not ready: %w", key.String(), err)
		}
	}

	return nil
}

func deploymentReady(deployment *appsv1.Deployment) bool {
	if deployment == nil || deployment.Spec.Replicas == nil {
		return false
	}

	desired := *deployment.Spec.Replicas
	if desired == 0 {
		return true
	}

	return deployment.Status.UpdatedReplicas >= desired &&
		deployment.Status.AvailableReplicas >= desired &&
		deployment.Status.ObservedGeneration >= deployment.Generation
}

func applyManifest(ctx context.Context, cfg *rest.Config, manifest string) error {
	objects, err := decodeManifest(manifest)
	if err != nil {
		return err
	}
	if len(objects) == 0 {
		return fmt.Errorf("no Kubernetes objects found in Flux install manifest")
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

	stageOne := make([]*unstructured.Unstructured, 0, len(objects))
	stageTwo := make([]*unstructured.Unstructured, 0, len(objects))

	for _, obj := range objects {
		if isClusterDefinition(obj) {
			stageOne = append(stageOne, obj)
			continue
		}
		stageTwo = append(stageTwo, obj)
	}

	if err := applyObjects(ctx, dynamicClient, mapper, stageOne); err != nil {
		return err
	}

	if err := waitForRequiredCRDs(ctx, mapper); err != nil {
		return err
	}

	if err := applyObjects(ctx, dynamicClient, mapper, stageTwo); err != nil {
		return err
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

func applyObjects(
	ctx context.Context,
	dynamicClient dynamic.Interface,
	mapper *restmapper.DeferredDiscoveryRESTMapper,
	objects []*unstructured.Unstructured,
) error {
	for _, obj := range objects {
		if err := applyObject(ctx, dynamicClient, mapper, obj); err != nil {
			return err
		}
	}

	return nil
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
			namespace = fluxNamespace
		}
		resourceClient = dynamicClient.Resource(mapping.Resource).Namespace(namespace)
	} else {
		resourceClient = dynamicClient.Resource(mapping.Resource)
	}

	force := true
	if _, err := resourceClient.Patch(ctx, obj.GetName(), types.ApplyPatchType, payload, metav1.PatchOptions{
		FieldManager: fluxFieldManager,
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

func waitForRequiredCRDs(ctx context.Context, mapper *restmapper.DeferredDiscoveryRESTMapper) error {
	required := []schema.GroupVersionKind{
		sourcev1.GroupVersion.WithKind(sourcev1.OCIRepositoryKind),
		kustomizev1.GroupVersion.WithKind(kustomizev1.KustomizationKind),
	}

	for _, gvk := range required {
		err := wait.PollUntilContextTimeout(ctx, 2*time.Second, time.Minute, true, func(context.Context) (bool, error) {
			_, err := restMapping(mapper, gvk)
			return err == nil, nil
		})
		if err != nil {
			return fmt.Errorf("wait for CRD %s: %w", gvk.String(), err)
		}
	}

	return nil
}

func isClusterDefinition(obj *unstructured.Unstructured) bool {
	if obj == nil {
		return false
	}

	gvk := obj.GroupVersionKind()
	if gvk.Kind == "Namespace" && gvk.Group == "" {
		return true
	}

	return gvk.Kind == "CustomResourceDefinition" && gvk.Group == "apiextensions.k8s.io"
}

func kubeConfig(kubeconfig string) (*rest.Config, error) {
	if kubeconfig != "" {
		return clientcmd.BuildConfigFromFlags("", kubeconfig)
	}

	loadingRules := clientcmd.NewDefaultClientConfigLoadingRules()
	return clientcmd.NewNonInteractiveDeferredLoadingClientConfig(loadingRules, &clientcmd.ConfigOverrides{}).ClientConfig()
}

func newFluxClient(cfg *rest.Config) (ctrlclient.Client, error) {
	return ctrlclient.New(cfg, ctrlclient.Options{Scheme: newFluxScheme()})
}

func newFluxScheme() *runtime.Scheme {
	scheme := runtime.NewScheme()
	_ = appsv1.AddToScheme(scheme)
	_ = sourcev1.AddToScheme(scheme)
	_ = kustomizev1.AddToScheme(scheme)
	return scheme
}

// Status checks FluxCD reconciliation status.
func Status(ctx context.Context, kubeconfig string) error {
	if ctx == nil {
		ctx = context.Background()
	}

	cfg, err := kubeConfig(strings.TrimSpace(kubeconfig))
	if err != nil {
		return fmt.Errorf("load kube config: %w", err)
	}

	kubeClient, err := newFluxClient(cfg)
	if err != nil {
		return fmt.Errorf("create kubernetes client: %w", err)
	}

	for _, controller := range fluxControllers {
		var deployment appsv1.Deployment
		key := ctrlclient.ObjectKey{Name: controller, Namespace: fluxNamespace}
		if err := kubeClient.Get(ctx, key, &deployment); err != nil {
			return fmt.Errorf("get deployment %s: %w", key.String(), err)
		}
		if !deploymentReady(&deployment) {
			return fmt.Errorf("deployment %s is not ready", key.String())
		}
	}

	var repositories sourcev1.OCIRepositoryList
	if err := kubeClient.List(ctx, &repositories, ctrlclient.InNamespace(fluxNamespace)); err != nil {
		return fmt.Errorf("list OCIRepositories: %w", err)
	}
	for _, repo := range repositories.Items {
		if readyCondition := apimeta.FindStatusCondition(repo.Status.Conditions, readyConditionType); readyCondition != nil && readyCondition.Status == metav1.ConditionFalse {
			return fmt.Errorf("OCIRepository %s/%s not ready: %s", repo.Namespace, repo.Name, readyCondition.Message)
		}
	}

	var kustomizations kustomizev1.KustomizationList
	if err := kubeClient.List(ctx, &kustomizations, ctrlclient.InNamespace(fluxNamespace)); err != nil {
		return fmt.Errorf("list Kustomizations: %w", err)
	}
	for _, ks := range kustomizations.Items {
		if readyCondition := apimeta.FindStatusCondition(ks.Status.Conditions, readyConditionType); readyCondition != nil && readyCondition.Status == metav1.ConditionFalse {
			return fmt.Errorf("Kustomization %s/%s not ready: %s", ks.Namespace, ks.Name, readyCondition.Message)
		}
	}

	slog.Info("fluxcd status healthy")
	return nil
}

// IsInstalled is retained for compatibility and always returns true because Flux integration is in-process.
func IsInstalled() bool {
	return true
}
