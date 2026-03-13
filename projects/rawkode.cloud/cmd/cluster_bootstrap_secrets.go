package cmd

import (
	"context"
	"fmt"
	"log/slog"
	"os"
	"strings"
	"time"

	"github.com/rawkode-academy/rawkode-cloud3/internal/config"
	"github.com/rawkode-academy/rawkode-cloud3/internal/externalsecrets"
	"github.com/rawkode-academy/rawkode-cloud3/internal/infisical"
	"github.com/rawkode-academy/rawkode-cloud3/internal/operation"
	"github.com/spf13/cobra"
)

const (
	bootstrapManagedByValue                 = "rawkode-cloud"
	bootstrapSecretTagSlug                  = "kubernetes"
	bootstrapSecretTagColor                 = "#2563eb"
	bootstrapStorePathRoot                  = "/"
	bootstrapIdentityMetadataManagedByKey   = "managed-by"
	bootstrapIdentityMetadataComponentKey   = "component"
	bootstrapIdentityMetadataClusterKey     = "cluster"
	bootstrapIdentityMetadataProjectSlugKey = "project-slug"
	bootstrapIdentityMetadataEnvironmentKey = "environment"
	bootstrapManagedByAnnotation            = "app.kubernetes.io/managed-by"
	bootstrapIdentityIDAnnotation           = "rawkode.cloud/infisical-identity-id"
	bootstrapIdentityNameAnnotation         = "rawkode.cloud/infisical-identity-name"
	bootstrapClientIDAnnotation             = "rawkode.cloud/infisical-client-id"
	bootstrapClientSecretIDAnnotation       = "rawkode.cloud/infisical-client-secret-id"
	bootstrapRoleSlugAnnotation             = "rawkode.cloud/infisical-role-slug"
	bootstrapTagSlugAnnotation              = "rawkode.cloud/infisical-tag-slug"
	bootstrapProjectIDAnnotation            = "rawkode.cloud/infisical-project-id"
	bootstrapProjectSlugAnnotation          = "rawkode.cloud/infisical-project-slug"
)

var clusterBootstrapSecretsCmd = &cobra.Command{
	Use:   "bootstrap-secrets",
	Short: "Bootstrap Infisical Universal Auth for External Secrets Operator",
	RunE:  runClusterBootstrapSecrets,
}

type clusterBootstrapSecretsOptions struct {
	ControllerNamespace string
	StoreName           string
	AuthSecretName      string
	HostAPI             string
	ProjectSlug         string
	EnvironmentSlug     string
	StoreSecretsPath    string
}

var (
	clusterBootstrapSecretsBuildAccessMaterialsFn = buildClusterAccessMaterials
	clusterBootstrapSecretsLoadConfigFn           = config.Load
	clusterBootstrapSecretsPrepareKubeconfigFn    = prepareBootstrapKubeconfigWithRetry
	clusterBootstrapSecretsReadAuthAnnotationsFn  = externalsecrets.ReadAuthSecretAnnotations
	clusterBootstrapSecretsFn                     = externalsecrets.BootstrapUniversalAuth
	clusterBootstrapSecretsExecuteFn              = clusterBootstrapSecretsExecute
)

func init() {
	clusterCmd.AddCommand(clusterBootstrapSecretsCmd)

	clusterBootstrapSecretsCmd.Flags().String("cluster", "", "Cluster/environment name")
	clusterBootstrapSecretsCmd.Flags().StringP("file", "f", "", "Path to cluster config YAML")
	clusterBootstrapSecretsCmd.Flags().String("controller-namespace", externalsecrets.DefaultControllerNamespace, "Namespace where External Secrets Operator runs")
	clusterBootstrapSecretsCmd.Flags().String("store-name", externalsecrets.DefaultStoreName, "ClusterSecretStore name")
	clusterBootstrapSecretsCmd.Flags().String("auth-secret-name", externalsecrets.DefaultAuthSecretName, "Secret name storing Infisical Universal Auth credentials")
	clusterBootstrapSecretsCmd.Flags().String("host-api", "", "Infisical host API base URL (defaults to infisical.siteUrl with /api)")
	clusterBootstrapSecretsCmd.Flags().String("project-slug", "", "Infisical project slug (defaults to infisical.projectSlug)")
	clusterBootstrapSecretsCmd.Flags().String("environment-slug", "", "Infisical environment slug (defaults to infisical.environment)")
	clusterBootstrapSecretsCmd.Flags().String("store-secrets-path", bootstrapStorePathRoot, "Infisical secrets path for the ClusterSecretStore scope")
}

func runClusterBootstrapSecrets(cmd *cobra.Command, args []string) error {
	ctx := context.Background()

	clusterName, _ := cmd.Flags().GetString("cluster")
	cfgFile, _ := cmd.Flags().GetString("file")

	materials, err := clusterBootstrapSecretsBuildAccessMaterialsFn(ctx, clusterName, cfgFile)
	if err != nil {
		return err
	}

	cfg, err := clusterBootstrapSecretsLoadConfigFn(materials.ConfigPath)
	if err != nil {
		return fmt.Errorf("load config %s: %w", materials.ConfigPath, err)
	}

	kubeconfigPath, cleanup, err := writeTemporaryKubeconfig(materials.KubeconfigYAML)
	if err != nil {
		return err
	}
	defer cleanup()

	return clusterBootstrapSecretsExecuteFn(ctx, cfg, kubeconfigPath, clusterBootstrapSecretsOptionsFromCommand(cmd))
}

func phaseBootstrapSecrets(ctx context.Context, op *operation.Operation, cfg *config.Config) error {
	if cfg == nil {
		return fmt.Errorf("config is required")
	}

	if strings.TrimSpace(cfg.Infisical.ProjectSlug) == "" {
		slog.Info("phase bootstrap-secrets: skipping because infisical.projectSlug is not set")
		return nil
	}

	kubeconfigPath, cleanup, err := clusterBootstrapSecretsPrepareKubeconfigFn(ctx, op, cfg)
	if err != nil {
		return err
	}
	defer cleanup()

	return clusterBootstrapSecretsExecuteFn(ctx, cfg, kubeconfigPath, clusterBootstrapSecretsOptions{})
}

func clusterBootstrapSecretsOptionsFromCommand(cmd *cobra.Command) clusterBootstrapSecretsOptions {
	options := clusterBootstrapSecretsOptions{}
	if cmd == nil {
		return options
	}

	options.ControllerNamespace, _ = cmd.Flags().GetString("controller-namespace")
	options.StoreName, _ = cmd.Flags().GetString("store-name")
	options.AuthSecretName, _ = cmd.Flags().GetString("auth-secret-name")
	options.HostAPI, _ = cmd.Flags().GetString("host-api")
	options.ProjectSlug, _ = cmd.Flags().GetString("project-slug")
	options.EnvironmentSlug, _ = cmd.Flags().GetString("environment-slug")
	options.StoreSecretsPath, _ = cmd.Flags().GetString("store-secrets-path")
	return options
}

func clusterBootstrapSecretsExecute(
	ctx context.Context,
	cfg *config.Config,
	kubeconfigPath string,
	options clusterBootstrapSecretsOptions,
) error {
	params, err := clusterBootstrapSecretsParams(cfg, kubeconfigPath, options)
	if err != nil {
		return err
	}

	infClient, err := getOrCreateInfisicalClient(ctx, cfg)
	if err != nil {
		return fmt.Errorf("create infisical client: %w", err)
	}

	project, err := infClient.GetProject(ctx, strings.TrimSpace(cfg.Infisical.ProjectID))
	if err != nil {
		return fmt.Errorf("load infisical project %s: %w", strings.TrimSpace(cfg.Infisical.ProjectID), err)
	}
	if project == nil {
		return fmt.Errorf("infisical project %s was not returned", strings.TrimSpace(cfg.Infisical.ProjectID))
	}
	projectID := strings.TrimSpace(project.ID)
	if projectID == "" {
		projectID = strings.TrimSpace(cfg.Infisical.ProjectID)
	}
	if projectID == "" {
		return fmt.Errorf("infisical.projectId is required")
	}
	if strings.TrimSpace(project.OrgID) == "" {
		return fmt.Errorf("infisical project %s did not return an organization ID", projectID)
	}
	if strings.TrimSpace(project.Slug) != "" && project.Slug != params.ProjectSlug {
		return fmt.Errorf(
			"infisical project slug mismatch: config/flag resolved %q but project %s is %q",
			params.ProjectSlug,
			projectID,
			project.Slug,
		)
	}

	currentAnnotations, err := clusterBootstrapSecretsReadAuthAnnotationsFn(
		ctx,
		kubeconfigPath,
		params.ControllerNamespace,
		params.AuthSecretName,
	)
	if err != nil {
		return err
	}

	tag, err := ensureBootstrapSecretTag(ctx, infClient, projectID)
	if err != nil {
		return err
	}

	role, err := ensureBootstrapProjectRole(
		ctx,
		infClient,
		projectID,
		bootstrapScopeName(cfg.Infisical.SecretPath, params.ProjectSlug),
		params.EnvironmentSlug,
		tag.Slug,
	)
	if err != nil {
		return err
	}

	identity, err := ensureBootstrapMachineIdentity(
		ctx,
		infClient,
		project.OrgID,
		bootstrapScopeName(cfg.Infisical.SecretPath, params.ProjectSlug),
		params.ProjectSlug,
		cfg.Environment,
		params.EnvironmentSlug,
		currentAnnotations,
	)
	if err != nil {
		return err
	}

	if err := ensureBootstrapIdentityMembership(ctx, infClient, projectID, identity.ID, role.Slug); err != nil {
		return err
	}

	uaConfig, err := ensureBootstrapUniversalAuth(ctx, infClient, identity.ID)
	if err != nil {
		return err
	}
	if strings.TrimSpace(uaConfig.ClientID) == "" {
		return fmt.Errorf("universal auth for identity %s did not return a client ID", identity.ID)
	}

	clientSecret, err := infClient.CreateUniversalAuthClientSecret(
		ctx,
		identity.ID,
		bootstrapClientSecretDescription(params.ProjectSlug, cfg.Environment),
	)
	if err != nil {
		return fmt.Errorf("create universal auth client secret for identity %s: %w", identity.ID, err)
	}
	if strings.TrimSpace(clientSecret.ClientSecret) == "" {
		return fmt.Errorf("universal auth client secret for identity %s was empty", identity.ID)
	}
	if strings.TrimSpace(clientSecret.Data.ID) == "" {
		return fmt.Errorf("universal auth client secret for identity %s did not return a secret ID", identity.ID)
	}

	params.ClientID = uaConfig.ClientID
	params.ClientSecret = clientSecret.ClientSecret
	params.Annotations = bootstrapResourceAnnotations(
		project,
		params.ProjectSlug,
		tag.Slug,
		role.Slug,
		identity,
		uaConfig.ClientID,
		clientSecret.Data.ID,
	)

	if err := clusterBootstrapSecretsFn(ctx, params); err != nil {
		return err
	}

	if err := revokeStaleBootstrapClientSecrets(ctx, infClient, identity.ID, clientSecret.Data.ID); err != nil {
		return err
	}

	slog.Info(
		"bootstrapped infisical universal auth for external secrets",
		"cluster", cfg.Environment,
		"store", params.StoreName,
		"controller_namespace", params.ControllerNamespace,
		"identity", identity.Name,
		"role_slug", role.Slug,
		"tag_slug", tag.Slug,
		"environment_slug", params.EnvironmentSlug,
		"secrets_path", params.SecretsPath,
	)

	return nil
}

func clusterBootstrapSecretsParams(
	cfg *config.Config,
	kubeconfigPath string,
	options clusterBootstrapSecretsOptions,
) (externalsecrets.BootstrapUniversalAuthParams, error) {
	if cfg == nil {
		return externalsecrets.BootstrapUniversalAuthParams{}, fmt.Errorf("config is required")
	}

	params := externalsecrets.BootstrapUniversalAuthParams{
		Kubeconfig:          strings.TrimSpace(kubeconfigPath),
		ControllerNamespace: defaultString(strings.TrimSpace(options.ControllerNamespace), externalsecrets.DefaultControllerNamespace),
		StoreName:           defaultString(strings.TrimSpace(options.StoreName), externalsecrets.DefaultStoreName),
		AuthSecretName:      defaultString(strings.TrimSpace(options.AuthSecretName), externalsecrets.DefaultAuthSecretName),
		HostAPI:             bootstrapHostAPI(strings.TrimSpace(options.HostAPI), strings.TrimSpace(cfg.Infisical.SiteURL)),
		ProjectSlug:         defaultString(strings.TrimSpace(options.ProjectSlug), strings.TrimSpace(cfg.Infisical.ProjectSlug)),
		EnvironmentSlug:     defaultString(strings.TrimSpace(options.EnvironmentSlug), strings.TrimSpace(cfg.Infisical.Environment)),
		SecretsPath:         normalizeBootstrapStorePath(resolveBootstrapStorePath(options)),
	}

	switch {
	case params.Kubeconfig == "":
		return externalsecrets.BootstrapUniversalAuthParams{}, fmt.Errorf("kubeconfig is required")
	case params.HostAPI == "":
		return externalsecrets.BootstrapUniversalAuthParams{}, fmt.Errorf("infisical.siteUrl or --host-api is required")
	case params.ProjectSlug == "":
		return externalsecrets.BootstrapUniversalAuthParams{}, fmt.Errorf("infisical.projectSlug or --project-slug is required")
	case params.EnvironmentSlug == "":
		return externalsecrets.BootstrapUniversalAuthParams{}, fmt.Errorf("infisical.environment or --environment-slug is required")
	default:
		return params, nil
	}
}

func ensureBootstrapSecretTag(ctx context.Context, client *infisical.Client, projectID string) (*infisical.SecretTag, error) {
	tag, err := client.GetSecretTagBySlug(ctx, projectID, bootstrapSecretTagSlug)
	if err == nil {
		return tag, nil
	}
	if !infisical.IsNotFound(err) {
		return nil, fmt.Errorf("load infisical tag %q: %w", bootstrapSecretTagSlug, err)
	}

	tag, err = client.CreateSecretTag(ctx, projectID, bootstrapSecretTagSlug, bootstrapSecretTagColor)
	if err != nil {
		return nil, fmt.Errorf("create infisical tag %q: %w", bootstrapSecretTagSlug, err)
	}

	return tag, nil
}

func ensureBootstrapProjectRole(
	ctx context.Context,
	client *infisical.Client,
	projectID,
	roleScopeName,
	environmentSlug,
	tagSlug string,
) (*infisical.ProjectRole, error) {
	roleSlug := bootstrapProjectRoleSlug(roleScopeName, environmentSlug)
	roleName := bootstrapProjectRoleName(roleScopeName, environmentSlug)
	permissions := bootstrapProjectRolePermissions(environmentSlug, tagSlug)
	description := fmt.Sprintf(
		"Managed by rawkode-cloud: read-only access to %s secrets tagged %s.",
		environmentSlug,
		tagSlug,
	)

	role, err := client.GetProjectRoleBySlug(ctx, projectID, roleSlug)
	if err == nil {
		role, err = client.UpdateProjectRole(ctx, projectID, role.ID, roleSlug, roleName, description, permissions)
		if err != nil {
			return nil, fmt.Errorf("update infisical project role %q: %w", roleSlug, err)
		}
		return role, nil
	}
	if !infisical.IsNotFound(err) {
		return nil, fmt.Errorf("load infisical project role %q: %w", roleSlug, err)
	}

	role, err = client.CreateProjectRole(ctx, projectID, roleSlug, roleName, description, permissions)
	if err != nil {
		return nil, fmt.Errorf("create infisical project role %q: %w", roleSlug, err)
	}

	return role, nil
}

func ensureBootstrapMachineIdentity(
	ctx context.Context,
	client *infisical.Client,
	orgID,
	scopeName,
	projectSlug,
	clusterName,
	environmentSlug string,
	currentAnnotations map[string]string,
) (*infisical.MachineIdentity, error) {
	identities, err := client.ListMachineIdentities(ctx, orgID)
	if err != nil {
		return nil, fmt.Errorf("list infisical machine identities: %w", err)
	}

	desiredName := bootstrapMachineIdentityName(scopeName, clusterName)
	metadata := bootstrapMachineIdentityMetadata(projectSlug, clusterName, environmentSlug)

	var existing *infisical.MachineIdentity
	if identityID := strings.TrimSpace(currentAnnotations[bootstrapIdentityIDAnnotation]); identityID != "" {
		existing = findMachineIdentityByID(identities, identityID)
	}
	if existing == nil {
		existing = findMachineIdentityByName(identities, desiredName)
	}

	if existing == nil {
		identity, err := client.CreateMachineIdentity(ctx, orgID, desiredName, true, metadata)
		if err != nil {
			return nil, fmt.Errorf("create infisical machine identity %q: %w", desiredName, err)
		}
		return identity, nil
	}

	existing, err = client.GetMachineIdentity(ctx, existing.ID)
	if err != nil {
		return nil, fmt.Errorf("load infisical machine identity %q: %w", desiredName, err)
	}
	if !bootstrapMachineIdentityMatchesMetadata(existing, projectSlug, clusterName, environmentSlug) {
		return nil, fmt.Errorf(
			"refusing to manage infisical machine identity %q: metadata does not match rawkode-cloud bootstrap ownership",
			strings.TrimSpace(existing.Name),
		)
	}

	identity, err := client.UpdateMachineIdentity(ctx, existing.ID, desiredName, true, metadata)
	if err != nil {
		return nil, fmt.Errorf("update infisical machine identity %q: %w", desiredName, err)
	}

	return identity, nil
}

func ensureBootstrapIdentityMembership(
	ctx context.Context,
	client *infisical.Client,
	projectID,
	identityID,
	roleSlug string,
) error {
	membership, err := client.GetProjectIdentityMembership(ctx, projectID, identityID)
	if err == nil {
		if bootstrapIdentityMembershipHasRole(membership, roleSlug) && len(membership.Roles) == 1 {
			return nil
		}

		if _, err := client.UpdateProjectIdentityMembership(ctx, projectID, identityID, roleSlug); err != nil {
			return fmt.Errorf("update infisical identity membership %s: %w", identityID, err)
		}
		return nil
	}
	if !infisical.IsNotFound(err) {
		return fmt.Errorf("load infisical identity membership %s: %w", identityID, err)
	}

	if _, err := client.CreateProjectIdentityMembership(ctx, projectID, identityID, roleSlug); err != nil {
		return fmt.Errorf("create infisical identity membership %s: %w", identityID, err)
	}

	return nil
}

func ensureBootstrapUniversalAuth(
	ctx context.Context,
	client *infisical.Client,
	identityID string,
) (*infisical.UniversalAuthConfig, error) {
	uaConfig, err := client.GetUniversalAuth(ctx, identityID)
	if err == nil {
		return uaConfig, nil
	}
	if !infisical.IsNotFound(err) {
		return nil, fmt.Errorf("load infisical universal auth for identity %s: %w", identityID, err)
	}

	uaConfig, err = client.AttachUniversalAuth(ctx, identityID)
	if err != nil {
		return nil, fmt.Errorf("attach infisical universal auth for identity %s: %w", identityID, err)
	}

	return uaConfig, nil
}

func revokeStaleBootstrapClientSecrets(
	ctx context.Context,
	client *infisical.Client,
	identityID,
	currentClientSecretID string,
) error {
	secrets, err := client.ListUniversalAuthClientSecrets(ctx, identityID)
	if err != nil {
		return fmt.Errorf("list universal auth client secrets for identity %s: %w", identityID, err)
	}

	revoked := 0
	for _, secret := range secrets {
		if secret.Revoked || strings.TrimSpace(secret.ID) == "" || secret.ID == currentClientSecretID {
			continue
		}
		if err := client.RevokeUniversalAuthClientSecret(ctx, identityID, secret.ID); err != nil {
			return fmt.Errorf("revoke universal auth client secret %s for identity %s: %w", secret.ID, identityID, err)
		}
		revoked++
	}

	if revoked > 0 {
		slog.Info("revoked stale infisical universal auth client secrets", "identity_id", identityID, "count", revoked)
	}

	return nil
}

func bootstrapProjectRolePermissions(environmentSlug, tagSlug string) []map[string]any {
	return []map[string]any{
		{
			"subject": "secrets",
			"action":  []string{"describeSecret", "readValue"},
			"conditions": map[string]any{
				"environment": environmentSlug,
				"secretTags": map[string]any{
					"$in": []string{tagSlug},
				},
			},
		},
	}
}

func bootstrapProjectRoleSlug(roleScopeName, environmentSlug string) string {
	return sanitizeInfisicalName(roleScopeName + "-" + environmentSlug + "-kubernetes-read")
}

func bootstrapProjectRoleName(roleScopeName, environmentSlug string) string {
	return bootstrapProjectRoleSlug(roleScopeName, environmentSlug)
}

func bootstrapMachineIdentityName(scopeName, clusterName string) string {
	return sanitizeInfisicalName(scopeName + "-" + clusterName)
}

func bootstrapScopeName(secretPath, fallback string) string {
	secretPath = strings.Trim(strings.TrimSpace(secretPath), "/")
	if secretPath != "" {
		segments := strings.Split(secretPath, "/")
		if name := strings.TrimSpace(segments[len(segments)-1]); name != "" {
			return name
		}
	}

	return strings.TrimSpace(fallback)
}

func bootstrapMachineIdentityMetadata(projectSlug, clusterName, environmentSlug string) []infisical.MetadataEntry {
	return []infisical.MetadataEntry{
		{Key: bootstrapIdentityMetadataManagedByKey, Value: bootstrapManagedByValue},
		{Key: bootstrapIdentityMetadataComponentKey, Value: "external-secrets"},
		{Key: bootstrapIdentityMetadataClusterKey, Value: strings.TrimSpace(clusterName)},
		{Key: bootstrapIdentityMetadataProjectSlugKey, Value: strings.TrimSpace(projectSlug)},
		{Key: bootstrapIdentityMetadataEnvironmentKey, Value: strings.TrimSpace(environmentSlug)},
	}
}

func bootstrapClientSecretDescription(projectSlug, clusterName string) string {
	return fmt.Sprintf(
		"%s %s external-secrets bootstrap %s",
		strings.TrimSpace(projectSlug),
		strings.TrimSpace(clusterName),
		time.Now().UTC().Format(time.RFC3339),
	)
}

func bootstrapResourceAnnotations(
	project *infisical.Project,
	projectSlug,
	tagSlug,
	roleSlug string,
	identity *infisical.MachineIdentity,
	clientID,
	clientSecretID string,
) map[string]string {
	annotations := map[string]string{
		bootstrapManagedByAnnotation:      bootstrapManagedByValue,
		bootstrapProjectSlugAnnotation:    strings.TrimSpace(projectSlug),
		bootstrapTagSlugAnnotation:        strings.TrimSpace(tagSlug),
		bootstrapRoleSlugAnnotation:       strings.TrimSpace(roleSlug),
		bootstrapClientIDAnnotation:       strings.TrimSpace(clientID),
		bootstrapClientSecretIDAnnotation: strings.TrimSpace(clientSecretID),
	}

	if project != nil {
		annotations[bootstrapProjectIDAnnotation] = strings.TrimSpace(project.ID)
		if annotations[bootstrapProjectSlugAnnotation] == "" {
			annotations[bootstrapProjectSlugAnnotation] = strings.TrimSpace(project.Slug)
		}
	}
	if identity != nil {
		annotations[bootstrapIdentityIDAnnotation] = strings.TrimSpace(identity.ID)
		annotations[bootstrapIdentityNameAnnotation] = strings.TrimSpace(identity.Name)
	}

	for key, value := range annotations {
		if strings.TrimSpace(value) == "" {
			delete(annotations, key)
		}
	}

	return annotations
}

func resolveBootstrapStorePath(options clusterBootstrapSecretsOptions) string {
	storePath := strings.TrimSpace(options.StoreSecretsPath)
	if storePath != "" {
		return storePath
	}
	return bootstrapStorePathRoot
}

func normalizeBootstrapStorePath(path string) string {
	path = strings.TrimSpace(path)
	if path == "" {
		return bootstrapStorePathRoot
	}
	if path == bootstrapStorePathRoot {
		return path
	}
	if !strings.HasPrefix(path, "/") {
		path = "/" + path
	}
	return strings.TrimRight(path, "/")
}

func bootstrapHostAPI(hostAPI, siteURL string) string {
	value := strings.TrimRight(strings.TrimSpace(hostAPI), "/")
	if value == "" {
		value = strings.TrimRight(strings.TrimSpace(siteURL), "/")
	}
	if value == "" {
		return ""
	}
	value = strings.TrimSuffix(value, "/api")
	return strings.TrimRight(value, "/") + "/api"
}

func writeTemporaryKubeconfig(kubeconfigYAML []byte) (string, func(), error) {
	file, err := os.CreateTemp("", "rawkode-cloud-kubeconfig-*.yaml")
	if err != nil {
		return "", nil, fmt.Errorf("create temporary kubeconfig: %w", err)
	}

	cleanup := func() {
		_ = os.Remove(file.Name())
	}

	if _, err := file.Write(kubeconfigYAML); err != nil {
		_ = file.Close()
		cleanup()
		return "", nil, fmt.Errorf("write temporary kubeconfig: %w", err)
	}
	if err := file.Close(); err != nil {
		cleanup()
		return "", nil, fmt.Errorf("close temporary kubeconfig: %w", err)
	}

	return file.Name(), cleanup, nil
}

func bootstrapIdentityMembershipHasRole(membership *infisical.IdentityMembership, roleSlug string) bool {
	if membership == nil {
		return false
	}

	roleSlug = strings.TrimSpace(roleSlug)
	for _, role := range membership.Roles {
		if strings.TrimSpace(role.Role) == roleSlug || strings.TrimSpace(role.CustomRoleSlug) == roleSlug {
			return true
		}
	}

	return false
}

func bootstrapMachineIdentityMatchesMetadata(
	identity *infisical.MachineIdentity,
	projectSlug,
	clusterName,
	environmentSlug string,
) bool {
	if identity == nil {
		return false
	}

	expected := bootstrapMachineIdentityMetadata(projectSlug, clusterName, environmentSlug)
	metadata := map[string]string{}
	for _, entry := range identity.Metadata {
		key := strings.TrimSpace(entry.Key)
		if key == "" {
			continue
		}
		metadata[key] = strings.TrimSpace(entry.Value)
	}

	for _, entry := range expected {
		if metadata[strings.TrimSpace(entry.Key)] != strings.TrimSpace(entry.Value) {
			return false
		}
	}

	return true
}

func findMachineIdentityByID(identities []infisical.MachineIdentity, identityID string) *infisical.MachineIdentity {
	identityID = strings.TrimSpace(identityID)
	if identityID == "" {
		return nil
	}

	for i := range identities {
		if strings.TrimSpace(identities[i].ID) == identityID {
			return &identities[i]
		}
	}

	return nil
}

func findMachineIdentityByName(identities []infisical.MachineIdentity, name string) *infisical.MachineIdentity {
	name = strings.TrimSpace(name)
	if name == "" {
		return nil
	}

	for i := range identities {
		if strings.TrimSpace(identities[i].Name) == name {
			return &identities[i]
		}
	}

	return nil
}

func defaultString(value, fallback string) string {
	if strings.TrimSpace(value) != "" {
		return strings.TrimSpace(value)
	}
	return strings.TrimSpace(fallback)
}

func sanitizeInfisicalName(value string) string {
	value = strings.ToLower(strings.TrimSpace(value))
	if value == "" {
		return "external-secrets"
	}

	var builder strings.Builder
	lastDash := false
	for _, r := range value {
		isAlphaNum := (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9')
		if isAlphaNum {
			builder.WriteRune(r)
			lastDash = false
			continue
		}
		if !lastDash {
			builder.WriteByte('-')
			lastDash = true
		}
	}

	out := strings.Trim(builder.String(), "-")
	if out == "" {
		return "external-secrets"
	}
	if len(out) > 64 {
		out = strings.Trim(out[:64], "-")
	}
	if out == "" {
		return "external-secrets"
	}
	return out
}
