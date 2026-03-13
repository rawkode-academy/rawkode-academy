package cmd

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"strings"

	clusterstate "github.com/rawkode-academy/rawkode-cloud3/internal/cluster"
	"github.com/rawkode-academy/rawkode-cloud3/internal/config"
	"github.com/rawkode-academy/rawkode-cloud3/internal/infisical"
	"github.com/spf13/cobra"
)

var clusterDeleteCmd = &cobra.Command{
	Use:   "delete",
	Short: "Delete tracked cluster servers",
	RunE:  runClusterDelete,
}

var (
	clusterDeleteLoadConfigFn       = loadConfigForClusterOrFile
	clusterDeleteLoadNodeStateFn    = loadNodeState
	clusterDeleteServerCleanupFn    = runDeleteServerCleanupAction
	clusterDeleteInfisicalCleanupFn = cleanupClusterDeleteInfisical
)

type clusterDeleteInfisicalClient interface {
	GetProject(context.Context, string) (*infisical.Project, error)
	ListMachineIdentities(context.Context, string) ([]infisical.MachineIdentity, error)
	GetMachineIdentity(context.Context, string) (*infisical.MachineIdentity, error)
	DeleteUniversalAuth(context.Context, string) error
	DeleteProjectIdentityMembership(context.Context, string, string) error
	UpdateMachineIdentity(context.Context, string, string, bool, []infisical.MetadataEntry) (*infisical.MachineIdentity, error)
	DeleteMachineIdentity(context.Context, string) error
}

func runClusterDelete(cmd *cobra.Command, args []string) error {
	ctx := context.Background()
	clusterName, _ := cmd.Flags().GetString("environment")
	cfgPathFlag, _ := cmd.Flags().GetString("file")

	cfg, cfgPath, err := clusterDeleteLoadConfigFn(clusterName, cfgPathFlag)
	if err != nil {
		return err
	}

	state, err := clusterDeleteLoadNodeStateFn(ctx, cfg)
	if err != nil {
		return err
	}

	deletedCount := 0
	alreadyDeletedCount := 0
	var errs []error

	if len(state.Nodes) == 0 {
		fmt.Printf("No nodes found in Scaleway inventory for cluster %q (config=%s)\n", cfg.Environment, cfgPath)
	} else {
		for _, node := range state.Nodes {
			if node.Status == clusterstate.NodeStatusDeleted {
				alreadyDeletedCount++
				continue
			}

			if serverID := strings.TrimSpace(node.ServerID); serverID != "" {
				zone, err := resolveClusterDeleteZoneForNode(cfg, node)
				if err != nil {
					errs = append(errs, fmt.Errorf("resolve cleanup zone for node %q: %w", node.Name, err))
					continue
				}

				payload := cleanupDeleteServer{
					ServerID: serverID,
					Zone:     zone,
				}

				if err := clusterDeleteServerCleanupFn(ctx, cfg, payload); err != nil {
					errs = append(errs, fmt.Errorf("cleanup server %s for node %q: %w", serverID, node.Name, err))
					continue
				}
			}

			deletedCount++
		}
	}

	if err := clusterDeleteInfisicalCleanupFn(ctx, cfg); err != nil {
		errs = append(errs, fmt.Errorf("cleanup infisical resources for cluster %q: %w", cfg.Environment, err))
	}

	if len(state.Nodes) > 0 && deletedCount == 0 && alreadyDeletedCount == len(state.Nodes) && len(errs) == 0 {
		fmt.Printf("All discovered nodes for cluster %q are already deleting/deleted (config=%s)\n", cfg.Environment, cfgPath)
		return nil
	}

	if len(state.Nodes) > 0 {
		fmt.Printf(
			"Cluster delete processed %d nodes for cluster %q (already_deleted=%d, config=%s)\n",
			deletedCount,
			cfg.Environment,
			alreadyDeletedCount,
			cfgPath,
		)
	}

	if len(errs) > 0 {
		return fmt.Errorf("cluster delete completed with errors: %w", errors.Join(errs...))
	}

	return nil
}

func resolveClusterDeleteZoneForNode(cfg *config.Config, node clusterstate.NodeState) (string, error) {
	poolName := strings.TrimSpace(node.Pool)
	if poolName == "" {
		inferredPool, err := cfg.FirstNodePoolByType(node.Role)
		if err != nil {
			return "", fmt.Errorf("node has no pool and no matching pool could be inferred for role %q: %w", node.Role, err)
		}
		poolName = inferredPool.Name
	}

	pool, err := cfg.FindNodePool(poolName)
	if err != nil {
		return "", err
	}

	zone := strings.TrimSpace(pool.EffectiveZone())
	if zone == "" {
		return "", fmt.Errorf("node pool %q must define zone", pool.Name)
	}

	return zone, nil
}

func cleanupClusterDeleteInfisical(ctx context.Context, cfg *config.Config) error {
	if cfg == nil {
		return fmt.Errorf("config is required")
	}

	infClient, err := getOrCreateInfisicalClient(ctx, cfg)
	if err != nil {
		return fmt.Errorf("create infisical client: %w", err)
	}

	return cleanupClusterDeleteInfisicalWithClient(ctx, cfg, infClient)
}

func cleanupClusterDeleteInfisicalWithClient(ctx context.Context, cfg *config.Config, infClient clusterDeleteInfisicalClient) error {
	if cfg == nil {
		return fmt.Errorf("config is required")
	}
	if infClient == nil {
		return fmt.Errorf("infisical client is required")
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

	projectSlug := strings.TrimSpace(project.Slug)
	if projectSlug == "" {
		projectSlug = strings.TrimSpace(cfg.Infisical.ProjectSlug)
	}
	if projectSlug == "" {
		return fmt.Errorf("infisical project %s did not return a slug and infisical.projectSlug is not set", projectID)
	}

	identities, err := infClient.ListMachineIdentities(ctx, project.OrgID)
	if err != nil {
		return fmt.Errorf("list infisical machine identities: %w", err)
	}

	identityName := bootstrapMachineIdentityName(bootstrapScopeName(cfg.Infisical.SecretPath, projectSlug), cfg.Environment)
	identity := findMachineIdentityByName(identities, identityName)
	if identity == nil {
		slog.Info("cluster delete: no Infisical machine identity found for cluster", "cluster", cfg.Environment, "identity", identityName)
		return nil
	}

	identity, err = infClient.GetMachineIdentity(ctx, identity.ID)
	if err != nil {
		if infisical.IsNotFound(err) {
			slog.Info("cluster delete: Infisical machine identity disappeared before cleanup", "cluster", cfg.Environment, "identity", identityName)
			return nil
		}
		return fmt.Errorf("load infisical machine identity %s: %w", identityName, err)
	}
	if !bootstrapMachineIdentityMatchesMetadata(identity, projectSlug, cfg.Environment, defaultString(cfg.Infisical.Environment, cfg.Environment)) {
		return fmt.Errorf(
			"refusing to delete infisical machine identity %q (%s): metadata does not match rawkode-cloud bootstrap ownership",
			strings.TrimSpace(identity.Name),
			strings.TrimSpace(identity.ID),
		)
	}

	if err := infClient.DeleteUniversalAuth(ctx, identity.ID); err != nil && !infisical.IsNotFound(err) {
		return fmt.Errorf("delete universal auth for identity %s: %w", identity.ID, err)
	}
	if err := infClient.DeleteProjectIdentityMembership(ctx, projectID, identity.ID); err != nil && !infisical.IsNotFound(err) {
		return fmt.Errorf("delete identity membership for identity %s: %w", identity.ID, err)
	}
	if _, err := infClient.UpdateMachineIdentity(ctx, identity.ID, identity.Name, false, nil); err != nil && !infisical.IsNotFound(err) {
		return fmt.Errorf("disable delete protection for identity %s: %w", identity.ID, err)
	}
	if err := infClient.DeleteMachineIdentity(ctx, identity.ID); err != nil && !infisical.IsNotFound(err) {
		return fmt.Errorf("delete machine identity %s: %w", identity.ID, err)
	}

	slog.Info(
		"cluster delete: cleaned up Infisical machine identity",
		"cluster", cfg.Environment,
		"identity", identity.Name,
		"project_slug", projectSlug,
	)

	return nil
}
