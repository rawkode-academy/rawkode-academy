package cmd

import (
	"context"
	"os"
	"testing"

	"github.com/rawkode-academy/rawkode-cloud3/internal/config"
	"github.com/rawkode-academy/rawkode-cloud3/internal/externalsecrets"
	"github.com/rawkode-academy/rawkode-cloud3/internal/infisical"
	"github.com/rawkode-academy/rawkode-cloud3/internal/operation"
	"github.com/spf13/cobra"
)

func restoreClusterBootstrapSecretsFns() {
	clusterBootstrapSecretsBuildAccessMaterialsFn = buildClusterAccessMaterials
	clusterBootstrapSecretsLoadConfigFn = config.Load
	clusterBootstrapSecretsPrepareKubeconfigFn = prepareBootstrapKubeconfigWithRetry
	clusterBootstrapSecretsExecuteFn = clusterBootstrapSecretsExecute
}

func newClusterBootstrapSecretsTestCmd(clusterName, cfgFile string) *cobra.Command {
	cmd := &cobra.Command{}
	cmd.Flags().String("cluster", "", "")
	cmd.Flags().StringP("file", "f", "", "")
	cmd.Flags().String("controller-namespace", externalsecrets.DefaultControllerNamespace, "")
	cmd.Flags().String("store-name", externalsecrets.DefaultStoreName, "")
	cmd.Flags().String("auth-secret-name", externalsecrets.DefaultAuthSecretName, "")
	cmd.Flags().String("host-api", "", "")
	cmd.Flags().String("project-slug", "", "")
	cmd.Flags().String("environment-slug", "", "")
	cmd.Flags().String("store-secrets-path", bootstrapStorePathRoot, "")
	_ = cmd.Flags().Set("cluster", clusterName)
	_ = cmd.Flags().Set("file", cfgFile)
	return cmd
}

func bootstrapSecretsTestConfig() *config.Config {
	return &config.Config{
		Environment: "production",
		Infisical: config.InfisicalConfig{
			SiteURL:      "https://app.infisical.com",
			ProjectID:    "6575a392d7a5ef0555ade86b",
			ProjectSlug:  "rawkode-academy",
			Environment:  "production",
			SecretPath:   "/projects/rawkode-cloud",
			ClientID:     "bootstrap-client-id",
			ClientSecret: "bootstrap-client-secret",
		},
	}
}

func TestClusterBootstrapSecretsParamsDefaults(t *testing.T) {
	params, err := clusterBootstrapSecretsParams(
		bootstrapSecretsTestConfig(),
		"/tmp/bootstrap-kubeconfig",
		clusterBootstrapSecretsOptions{},
	)
	if err != nil {
		t.Fatalf("clusterBootstrapSecretsParams returned error: %v", err)
	}

	if params.ControllerNamespace != externalsecrets.DefaultControllerNamespace {
		t.Fatalf("controller namespace = %q, want %q", params.ControllerNamespace, externalsecrets.DefaultControllerNamespace)
	}
	if params.StoreName != externalsecrets.DefaultStoreName {
		t.Fatalf("store name = %q, want %q", params.StoreName, externalsecrets.DefaultStoreName)
	}
	if params.AuthSecretName != externalsecrets.DefaultAuthSecretName {
		t.Fatalf("auth secret name = %q, want %q", params.AuthSecretName, externalsecrets.DefaultAuthSecretName)
	}
	if params.HostAPI != "https://app.infisical.com/api" {
		t.Fatalf("host API = %q, want %q", params.HostAPI, "https://app.infisical.com/api")
	}
	if params.SecretsPath != "/" {
		t.Fatalf("secrets path = %q, want %q", params.SecretsPath, "/")
	}
}

func TestClusterBootstrapSecretsParamsRequireProjectSlug(t *testing.T) {
	cfg := bootstrapSecretsTestConfig()
	cfg.Infisical.ProjectSlug = ""

	_, err := clusterBootstrapSecretsParams(cfg, "/tmp/bootstrap-kubeconfig", clusterBootstrapSecretsOptions{})
	if err == nil {
		t.Fatal("expected project slug validation error, got nil")
	}
	if err.Error() != "infisical.projectSlug or --project-slug is required" {
		t.Fatalf("unexpected error: %v", err)
	}
}

func TestBootstrapProjectRolePermissions(t *testing.T) {
	permissions := bootstrapProjectRolePermissions("production", "kubernetes")
	if len(permissions) != 1 {
		t.Fatalf("permissions length = %d, want 1", len(permissions))
	}

	actions, ok := permissions[0]["action"].([]string)
	if !ok {
		t.Fatalf("actions type = %T, want []string", permissions[0]["action"])
	}
	if len(actions) != 2 || actions[0] != "describeSecret" || actions[1] != "readValue" {
		t.Fatalf("actions = %v, want [describeSecret readValue]", actions)
	}

	conditions, ok := permissions[0]["conditions"].(map[string]any)
	if !ok {
		t.Fatalf("conditions type = %T, want map[string]any", permissions[0]["conditions"])
	}
	if conditions["environment"] != "production" {
		t.Fatalf("environment condition = %v, want production", conditions["environment"])
	}

	tags, ok := conditions["secretTags"].(map[string]any)
	if !ok {
		t.Fatalf("secretTags type = %T, want map[string]any", conditions["secretTags"])
	}
	values, ok := tags["$in"].([]string)
	if !ok {
		t.Fatalf("secretTags.$in type = %T, want []string", tags["$in"])
	}
	if len(values) != 1 || values[0] != "kubernetes" {
		t.Fatalf("secretTags.$in = %v, want [kubernetes]", values)
	}
}

func TestBootstrapProjectRoleSlugAndNameUseScopeName(t *testing.T) {
	slug := bootstrapProjectRoleSlug("rawkode-cloud", "production")
	if slug != "rawkode-cloud-production-kubernetes-read" {
		t.Fatalf("role slug = %q, want %q", slug, "rawkode-cloud-production-kubernetes-read")
	}

	name := bootstrapProjectRoleName("rawkode-cloud", "production")
	if name != slug {
		t.Fatalf("role name = %q, want %q", name, slug)
	}
}

func TestBootstrapScopeNameUsesSecretPathLeaf(t *testing.T) {
	scopeName := bootstrapScopeName("/projects/rawkode-cloud", "rawkode-academy")
	if scopeName != "rawkode-cloud" {
		t.Fatalf("scope name = %q, want %q", scopeName, "rawkode-cloud")
	}
}

func TestBootstrapMachineIdentityNameUsesScopeName(t *testing.T) {
	name := bootstrapMachineIdentityName("rawkode-cloud", "production")
	if name != "rawkode-cloud-production" {
		t.Fatalf("machine identity name = %q, want %q", name, "rawkode-cloud-production")
	}
}

func TestBootstrapMachineIdentityMatchesMetadata(t *testing.T) {
	identity := &infisical.MachineIdentity{
		Metadata: bootstrapMachineIdentityMetadata("rawkode-academy", "production", "production"),
	}

	if !bootstrapMachineIdentityMatchesMetadata(identity, "rawkode-academy", "production", "production") {
		t.Fatal("expected identity metadata to match bootstrap ownership")
	}
	if bootstrapMachineIdentityMatchesMetadata(identity, "rawkode-academy", "staging", "production") {
		t.Fatal("expected cluster mismatch to fail metadata match")
	}
}

func TestPhaseBootstrapSecretsSkipsWithoutProjectSlug(t *testing.T) {
	restoreClusterBootstrapSecretsFns()
	t.Cleanup(restoreClusterBootstrapSecretsFns)

	clusterBootstrapSecretsPrepareKubeconfigFn = func(context.Context, *operation.Operation, *config.Config) (string, func(), error) {
		t.Fatal("prepare kubeconfig should not be called when project slug is missing")
		return "", nil, nil
	}
	clusterBootstrapSecretsExecuteFn = func(context.Context, *config.Config, string, clusterBootstrapSecretsOptions) error {
		t.Fatal("execute function should not be called when project slug is missing")
		return nil
	}

	cfg := bootstrapSecretsTestConfig()
	cfg.Infisical.ProjectSlug = ""

	if err := phaseBootstrapSecrets(context.Background(), newPostBootstrapOperation(), cfg); err != nil {
		t.Fatalf("phaseBootstrapSecrets returned error: %v", err)
	}
}

func TestPhaseBootstrapSecretsExecutesWhenConfigured(t *testing.T) {
	restoreClusterBootstrapSecretsFns()
	t.Cleanup(restoreClusterBootstrapSecretsFns)

	const kubeconfigPath = "/tmp/bootstrap-kubeconfig"
	clusterBootstrapSecretsPrepareKubeconfigFn = func(context.Context, *operation.Operation, *config.Config) (string, func(), error) {
		return kubeconfigPath, func() {}, nil
	}

	var (
		gotCfg        *config.Config
		gotKubeconfig string
		gotOptions    clusterBootstrapSecretsOptions
	)
	clusterBootstrapSecretsExecuteFn = func(_ context.Context, cfg *config.Config, kubeconfig string, options clusterBootstrapSecretsOptions) error {
		gotCfg = cfg
		gotKubeconfig = kubeconfig
		gotOptions = options
		return nil
	}

	cfg := bootstrapSecretsTestConfig()
	if err := phaseBootstrapSecrets(context.Background(), newPostBootstrapOperation(), cfg); err != nil {
		t.Fatalf("phaseBootstrapSecrets returned error: %v", err)
	}

	if gotCfg != cfg {
		t.Fatalf("cfg pointer mismatch")
	}
	if gotKubeconfig != kubeconfigPath {
		t.Fatalf("kubeconfig = %q, want %q", gotKubeconfig, kubeconfigPath)
	}
	if gotOptions != (clusterBootstrapSecretsOptions{}) {
		t.Fatalf("options = %+v, want zero-value defaults", gotOptions)
	}
}

func TestRunClusterBootstrapSecretsUsesOverridesAndWritesTempKubeconfig(t *testing.T) {
	restoreClusterBootstrapSecretsFns()
	t.Cleanup(restoreClusterBootstrapSecretsFns)

	clusterBootstrapSecretsBuildAccessMaterialsFn = func(_ context.Context, clusterName, cfgFile string) (*clusterAccessMaterials, error) {
		if clusterName != "production" {
			t.Fatalf("clusterName = %q, want %q", clusterName, "production")
		}
		if cfgFile != "./clusters/production.yaml" {
			t.Fatalf("cfgFile = %q, want %q", cfgFile, "./clusters/production.yaml")
		}

		return &clusterAccessMaterials{
			ConfigPath:     cfgFile,
			TalosEndpoint:  "203.0.113.10",
			KubeconfigYAML: []byte("apiVersion: v1\nkind: Config\n"),
		}, nil
	}
	clusterBootstrapSecretsLoadConfigFn = func(path string) (*config.Config, error) {
		if path != "./clusters/production.yaml" {
			t.Fatalf("config path = %q, want %q", path, "./clusters/production.yaml")
		}
		return bootstrapSecretsTestConfig(), nil
	}

	var (
		gotCfg        *config.Config
		gotKubeconfig string
		gotOptions    clusterBootstrapSecretsOptions
	)
	clusterBootstrapSecretsExecuteFn = func(_ context.Context, cfg *config.Config, kubeconfig string, options clusterBootstrapSecretsOptions) error {
		gotCfg = cfg
		gotKubeconfig = kubeconfig
		gotOptions = options

		data, err := os.ReadFile(kubeconfig)
		if err != nil {
			t.Fatalf("read temporary kubeconfig: %v", err)
		}
		if string(data) != "apiVersion: v1\nkind: Config\n" {
			t.Fatalf("temporary kubeconfig content = %q", string(data))
		}

		return nil
	}

	cmd := newClusterBootstrapSecretsTestCmd("production", "./clusters/production.yaml")
	_ = cmd.Flags().Set("controller-namespace", "external-secrets")
	_ = cmd.Flags().Set("store-name", "platform-infisical")
	_ = cmd.Flags().Set("auth-secret-name", "infisical-auth")
	_ = cmd.Flags().Set("project-slug", "platform")
	_ = cmd.Flags().Set("environment-slug", "prod")
	_ = cmd.Flags().Set("store-secrets-path", "/")

	if err := runClusterBootstrapSecrets(cmd, nil); err != nil {
		t.Fatalf("runClusterBootstrapSecrets returned error: %v", err)
	}

	if gotCfg == nil {
		t.Fatal("expected config to be passed to execute function")
	}
	if gotKubeconfig == "" {
		t.Fatal("expected temporary kubeconfig path")
	}
	if gotOptions.ControllerNamespace != "external-secrets" {
		t.Fatalf("controller namespace = %q, want %q", gotOptions.ControllerNamespace, "external-secrets")
	}
	if gotOptions.StoreName != "platform-infisical" {
		t.Fatalf("store name = %q, want %q", gotOptions.StoreName, "platform-infisical")
	}
	if gotOptions.AuthSecretName != "infisical-auth" {
		t.Fatalf("auth secret name = %q, want %q", gotOptions.AuthSecretName, "infisical-auth")
	}
	if gotOptions.ProjectSlug != "platform" {
		t.Fatalf("project slug = %q, want %q", gotOptions.ProjectSlug, "platform")
	}
	if gotOptions.EnvironmentSlug != "prod" {
		t.Fatalf("environment slug = %q, want %q", gotOptions.EnvironmentSlug, "prod")
	}
	if gotOptions.StoreSecretsPath != "/" {
		t.Fatalf("store secrets path = %q, want %q", gotOptions.StoreSecretsPath, "/")
	}
	if _, err := os.Stat(gotKubeconfig); !os.IsNotExist(err) {
		t.Fatalf("expected temporary kubeconfig to be cleaned up, stat err=%v", err)
	}
}
