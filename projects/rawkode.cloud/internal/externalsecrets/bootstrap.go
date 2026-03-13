package externalsecrets

import (
	"context"
	"fmt"
	"log/slog"
	"strings"
	"time"

	appsv1 "k8s.io/api/apps/v1"
	corev1 "k8s.io/api/core/v1"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	apimeta "k8s.io/apimachinery/pkg/api/meta"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/types"
	"k8s.io/apimachinery/pkg/util/wait"
	"k8s.io/client-go/discovery"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/tools/clientcmd"
	ctrlclient "sigs.k8s.io/controller-runtime/pkg/client"
)

const (
	DefaultControllerNamespace = "external-secrets"
	DefaultStoreName           = "infisical"
	DefaultAuthSecretName      = "infisical-universal-auth"
	defaultBootstrapTimeout    = 5 * time.Minute
	clusterSecretStoreKind     = "ClusterSecretStore"
	readyConditionType         = "Ready"
)

var clusterSecretStoreGVK = schema.GroupVersionKind{
	Group:   "external-secrets.io",
	Version: "v1",
	Kind:    clusterSecretStoreKind,
}

// BootstrapUniversalAuthParams describes the ESO Universal Auth bootstrap resources.
type BootstrapUniversalAuthParams struct {
	Kubeconfig          string
	ControllerNamespace string
	StoreName           string
	AuthSecretName      string
	HostAPI             string
	ProjectSlug         string
	EnvironmentSlug     string
	SecretsPath         string
	ClientID            string
	ClientSecret        string
	Annotations         map[string]string
	Timeout             time.Duration
}

// BootstrapUniversalAuth creates or updates the auth Secret and ClusterSecretStore used by ESO.
func BootstrapUniversalAuth(ctx context.Context, params BootstrapUniversalAuthParams) error {
	if ctx == nil {
		ctx = context.Background()
	}

	if err := validateBootstrapUniversalAuthParams(&params); err != nil {
		return err
	}

	cfg, err := clientcmd.BuildConfigFromFlags("", strings.TrimSpace(params.Kubeconfig))
	if err != nil {
		return fmt.Errorf("load kubeconfig: %w", err)
	}

	timeout := params.Timeout
	if timeout <= 0 {
		timeout = defaultBootstrapTimeout
	}

	if err := waitForClusterSecretStoreCRD(ctx, cfg, timeout); err != nil {
		return err
	}

	kubeClient, err := newBootstrapClient(cfg)
	if err != nil {
		return fmt.Errorf("create kubernetes client: %w", err)
	}

	if err := waitForExternalSecretsDeployment(ctx, kubeClient, params.ControllerNamespace, timeout); err != nil {
		return err
	}

	if err := upsertAuthSecret(ctx, kubeClient, params); err != nil {
		return err
	}

	if err := upsertClusterSecretStore(ctx, kubeClient, params); err != nil {
		return err
	}

	if err := waitForClusterSecretStoreReady(ctx, kubeClient, params.StoreName, timeout); err != nil {
		return err
	}

	slog.Info(
		"bootstrapped external secrets universal auth",
		"namespace", params.ControllerNamespace,
		"secret", params.AuthSecretName,
		"store", params.StoreName,
		"project_slug", params.ProjectSlug,
		"environment_slug", params.EnvironmentSlug,
		"secrets_path", params.SecretsPath,
	)

	return nil
}

func validateBootstrapUniversalAuthParams(params *BootstrapUniversalAuthParams) error {
	if params == nil {
		return fmt.Errorf("bootstrap params are required")
	}

	params.Kubeconfig = strings.TrimSpace(params.Kubeconfig)
	params.ControllerNamespace = strings.TrimSpace(params.ControllerNamespace)
	params.StoreName = strings.TrimSpace(params.StoreName)
	params.AuthSecretName = strings.TrimSpace(params.AuthSecretName)
	params.HostAPI = normalizeHostAPI(params.HostAPI)
	params.ProjectSlug = strings.TrimSpace(params.ProjectSlug)
	params.EnvironmentSlug = strings.TrimSpace(params.EnvironmentSlug)
	params.SecretsPath = strings.TrimSpace(params.SecretsPath)
	params.ClientID = strings.TrimSpace(params.ClientID)
	params.ClientSecret = strings.TrimSpace(params.ClientSecret)

	if params.ControllerNamespace == "" {
		params.ControllerNamespace = DefaultControllerNamespace
	}
	if params.StoreName == "" {
		params.StoreName = DefaultStoreName
	}
	if params.AuthSecretName == "" {
		params.AuthSecretName = DefaultAuthSecretName
	}

	switch {
	case params.Kubeconfig == "":
		return fmt.Errorf("kubeconfig is required")
	case params.ControllerNamespace == "":
		return fmt.Errorf("controller namespace is required")
	case params.StoreName == "":
		return fmt.Errorf("store name is required")
	case params.AuthSecretName == "":
		return fmt.Errorf("auth secret name is required")
	case params.HostAPI == "":
		return fmt.Errorf("host API is required")
	case params.ProjectSlug == "":
		return fmt.Errorf("infisical project slug is required")
	case params.EnvironmentSlug == "":
		return fmt.Errorf("infisical environment slug is required")
	case params.SecretsPath == "":
		return fmt.Errorf("infisical secrets path is required")
	case params.ClientID == "":
		return fmt.Errorf("INFISICAL_CLIENT_ID is required")
	case params.ClientSecret == "":
		return fmt.Errorf("INFISICAL_CLIENT_SECRET is required")
	default:
		return nil
	}
}

func normalizeHostAPI(hostAPI string) string {
	hostAPI = strings.TrimRight(strings.TrimSpace(hostAPI), "/")
	if hostAPI == "" {
		return ""
	}
	if strings.HasSuffix(hostAPI, "/api") {
		return hostAPI
	}
	return hostAPI + "/api"
}

func waitForClusterSecretStoreCRD(ctx context.Context, cfg *rest.Config, timeout time.Duration) error {
	discoveryCfg := rest.CopyConfig(cfg)
	discoveryCfg.Timeout = 10 * time.Second

	discoveryClient, err := discovery.NewDiscoveryClientForConfig(discoveryCfg)
	if err != nil {
		return fmt.Errorf("create kubernetes discovery client: %w", err)
	}

	return wait.PollUntilContextTimeout(ctx, 2*time.Second, timeout, true, func(ctx context.Context) (bool, error) {
		resourceList, err := discoveryClient.ServerResourcesForGroupVersion(clusterSecretStoreGVK.GroupVersion().String())
		if err != nil {
			if apierrors.IsNotFound(err) || discovery.IsGroupDiscoveryFailedError(err) || strings.Contains(strings.ToLower(err.Error()), "not found") {
				return false, nil
			}
			return false, err
		}

		for _, resource := range resourceList.APIResources {
			if resource.Name == "clustersecretstores" {
				return true, nil
			}
		}

		return false, nil
	})
}

func newBootstrapClient(cfg *rest.Config) (ctrlclient.Client, error) {
	scheme := runtime.NewScheme()
	_ = corev1.AddToScheme(scheme)
	_ = appsv1.AddToScheme(scheme)
	return ctrlclient.New(cfg, ctrlclient.Options{Scheme: scheme})
}

func waitForExternalSecretsDeployment(ctx context.Context, kubeClient ctrlclient.Client, namespace string, timeout time.Duration) error {
	key := ctrlclient.ObjectKey{Name: "external-secrets", Namespace: namespace}
	return wait.PollUntilContextTimeout(ctx, 2*time.Second, timeout, true, func(ctx context.Context) (bool, error) {
		var deployment appsv1.Deployment
		if err := kubeClient.Get(ctx, key, &deployment); err != nil {
			if apierrors.IsNotFound(err) {
				return false, nil
			}
			return false, err
		}

		if deployment.Spec.Replicas == nil {
			return false, nil
		}

		desired := *deployment.Spec.Replicas
		if desired == 0 {
			return true, nil
		}

		return deployment.Status.UpdatedReplicas >= desired &&
			deployment.Status.AvailableReplicas >= desired &&
			deployment.Status.ObservedGeneration >= deployment.Generation, nil
	})
}

func upsertAuthSecret(ctx context.Context, kubeClient ctrlclient.Client, params BootstrapUniversalAuthParams) error {
	key := types.NamespacedName{Name: params.AuthSecretName, Namespace: params.ControllerNamespace}
	var existing corev1.Secret
	err := kubeClient.Get(ctx, key, &existing)
	if apierrors.IsNotFound(err) {
		secret := &corev1.Secret{
			ObjectMeta: metav1.ObjectMeta{
				Name:        params.AuthSecretName,
				Namespace:   params.ControllerNamespace,
				Annotations: copyStringMap(params.Annotations),
			},
			Type: corev1.SecretTypeOpaque,
			Data: map[string][]byte{
				"clientId":     []byte(params.ClientID),
				"clientSecret": []byte(params.ClientSecret),
			},
		}
		if err := kubeClient.Create(ctx, secret); err != nil {
			return fmt.Errorf("create auth secret %s/%s: %w", params.ControllerNamespace, params.AuthSecretName, err)
		}
		return nil
	}
	if err != nil {
		return fmt.Errorf("get auth secret %s/%s: %w", params.ControllerNamespace, params.AuthSecretName, err)
	}

	if existing.Data == nil {
		existing.Data = map[string][]byte{}
	}
	if existing.Annotations == nil {
		existing.Annotations = map[string]string{}
	}
	existing.Type = corev1.SecretTypeOpaque
	existing.Data["clientId"] = []byte(params.ClientID)
	existing.Data["clientSecret"] = []byte(params.ClientSecret)
	for key, value := range params.Annotations {
		existing.Annotations[key] = value
	}
	if err := kubeClient.Update(ctx, &existing); err != nil {
		return fmt.Errorf("update auth secret %s/%s: %w", params.ControllerNamespace, params.AuthSecretName, err)
	}

	return nil
}

func upsertClusterSecretStore(ctx context.Context, kubeClient ctrlclient.Client, params BootstrapUniversalAuthParams) error {
	desired := desiredClusterSecretStore(params)

	var existing unstructured.Unstructured
	existing.SetGroupVersionKind(clusterSecretStoreGVK)
	err := kubeClient.Get(ctx, types.NamespacedName{Name: params.StoreName}, &existing)
	if apierrors.IsNotFound(err) {
		if err := kubeClient.Create(ctx, desired); err != nil {
			return fmt.Errorf("create ClusterSecretStore %s: %w", params.StoreName, err)
		}
		return nil
	}
	if err != nil {
		return fmt.Errorf("get ClusterSecretStore %s: %w", params.StoreName, err)
	}

	existing.Object["spec"] = desired.Object["spec"]
	annotations, _, err := unstructured.NestedStringMap(existing.Object, "metadata", "annotations")
	if err != nil {
		return fmt.Errorf("read ClusterSecretStore %s annotations: %w", params.StoreName, err)
	}
	if annotations == nil {
		annotations = map[string]string{}
	}
	for key, value := range params.Annotations {
		annotations[key] = value
	}
	if err := unstructured.SetNestedStringMap(existing.Object, annotations, "metadata", "annotations"); err != nil {
		return fmt.Errorf("set ClusterSecretStore %s annotations: %w", params.StoreName, err)
	}
	if err := kubeClient.Update(ctx, &existing); err != nil {
		return fmt.Errorf("update ClusterSecretStore %s: %w", params.StoreName, err)
	}

	return nil
}

func desiredClusterSecretStore(params BootstrapUniversalAuthParams) *unstructured.Unstructured {
	store := &unstructured.Unstructured{
		Object: map[string]any{
			"apiVersion": "external-secrets.io/v1",
			"kind":       clusterSecretStoreKind,
			"metadata": map[string]any{
				"name":        params.StoreName,
				"annotations": stringMap(params.Annotations),
			},
			"spec": map[string]any{
				"provider": map[string]any{
					"infisical": map[string]any{
						"hostAPI": params.HostAPI,
						"auth": map[string]any{
							"universalAuthCredentials": map[string]any{
								"clientId": map[string]any{
									"name":      params.AuthSecretName,
									"namespace": params.ControllerNamespace,
									"key":       "clientId",
								},
								"clientSecret": map[string]any{
									"name":      params.AuthSecretName,
									"namespace": params.ControllerNamespace,
									"key":       "clientSecret",
								},
							},
						},
						"secretsScope": map[string]any{
							"projectSlug":     params.ProjectSlug,
							"environmentSlug": params.EnvironmentSlug,
							"secretsPath":     params.SecretsPath,
							"recursive":       false,
						},
					},
				},
			},
		},
	}
	store.SetGroupVersionKind(clusterSecretStoreGVK)
	return store
}

func waitForClusterSecretStoreReady(ctx context.Context, kubeClient ctrlclient.Client, name string, timeout time.Duration) error {
	key := types.NamespacedName{Name: name}
	return wait.PollUntilContextTimeout(ctx, 2*time.Second, timeout, true, func(ctx context.Context) (bool, error) {
		var store unstructured.Unstructured
		store.SetGroupVersionKind(clusterSecretStoreGVK)
		if err := kubeClient.Get(ctx, key, &store); err != nil {
			if apierrors.IsNotFound(err) {
				return false, nil
			}
			return false, err
		}

		conditions, _, err := unstructured.NestedSlice(store.Object, "status", "conditions")
		if err != nil {
			return false, fmt.Errorf("read ClusterSecretStore conditions: %w", err)
		}
		if len(conditions) == 0 {
			return false, nil
		}

		metav1Conditions := make([]metav1.Condition, 0, len(conditions))
		for _, raw := range conditions {
			conditionMap, ok := raw.(map[string]any)
			if !ok {
				continue
			}
			metav1Conditions = append(metav1Conditions, metav1.Condition{
				Type:    stringValue(conditionMap["type"]),
				Status:  metav1.ConditionStatus(stringValue(conditionMap["status"])),
				Message: stringValue(conditionMap["message"]),
				Reason:  stringValue(conditionMap["reason"]),
			})
		}

		readyCondition := apimeta.FindStatusCondition(metav1Conditions, readyConditionType)
		if readyCondition == nil {
			return false, nil
		}

		switch readyCondition.Status {
		case metav1.ConditionTrue:
			return true, nil
		case metav1.ConditionFalse:
			return false, fmt.Errorf("ClusterSecretStore %s not ready: %s", name, readyCondition.Message)
		default:
			return false, nil
		}
	})
}

func stringValue(value any) string {
	s, _ := value.(string)
	return s
}

// ReadAuthSecretAnnotations returns the current auth secret annotations, or nil if the secret does not exist.
func ReadAuthSecretAnnotations(ctx context.Context, kubeconfigPath, namespace, name string) (map[string]string, error) {
	cfg, err := clientcmd.BuildConfigFromFlags("", strings.TrimSpace(kubeconfigPath))
	if err != nil {
		return nil, fmt.Errorf("load kubeconfig: %w", err)
	}

	kubeClient, err := newBootstrapClient(cfg)
	if err != nil {
		return nil, fmt.Errorf("create kubernetes client: %w", err)
	}

	var secret corev1.Secret
	if err := kubeClient.Get(ctx, types.NamespacedName{Name: name, Namespace: namespace}, &secret); err != nil {
		if apierrors.IsNotFound(err) {
			return nil, nil
		}
		return nil, fmt.Errorf("get auth secret %s/%s: %w", namespace, name, err)
	}

	return copyStringMap(secret.Annotations), nil
}

func stringMap(values map[string]string) map[string]any {
	if len(values) == 0 {
		return nil
	}

	out := make(map[string]any, len(values))
	for key, value := range values {
		out[key] = value
	}

	return out
}

func copyStringMap(values map[string]string) map[string]string {
	if len(values) == 0 {
		return nil
	}

	out := make(map[string]string, len(values))
	for key, value := range values {
		out[key] = value
	}

	return out
}
