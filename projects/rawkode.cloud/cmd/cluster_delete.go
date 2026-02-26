package cmd

import (
	"context"
	"errors"
	"fmt"
	"strings"

	clusterstate "github.com/rawkode-academy/rawkode-cloud3/internal/cluster"
	"github.com/rawkode-academy/rawkode-cloud3/internal/config"
	"github.com/spf13/cobra"
)

var clusterDeleteCmd = &cobra.Command{
	Use:   "delete",
	Short: "Delete tracked cluster servers",
	RunE:  runClusterDelete,
}

func runClusterDelete(cmd *cobra.Command, args []string) error {
	ctx := context.Background()
	clusterName, _ := cmd.Flags().GetString("environment")
	cfgPathFlag, _ := cmd.Flags().GetString("file")

	cfg, cfgPath, err := loadConfigForClusterOrFile(clusterName, cfgPathFlag)
	if err != nil {
		return err
	}

	state, err := loadNodeState(ctx, cfg)
	if err != nil {
		return err
	}

	if len(state.Nodes) == 0 {
		fmt.Printf("No nodes found in Scaleway inventory for cluster %q (config=%s)\n", cfg.Environment, cfgPath)
		return nil
	}

	deletedCount := 0
	alreadyDeletedCount := 0
	var errs []error

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

			if err := runDeleteServerCleanupAction(ctx, cfg, payload); err != nil {
				errs = append(errs, fmt.Errorf("cleanup server %s for node %q: %w", serverID, node.Name, err))
				continue
			}
		}

		deletedCount++
	}

	if deletedCount == 0 && alreadyDeletedCount == len(state.Nodes) {
		fmt.Printf("All discovered nodes for cluster %q are already deleting/deleted (config=%s)\n", cfg.Environment, cfgPath)
		return nil
	}

	fmt.Printf(
		"Cluster delete processed %d nodes for cluster %q (already_deleted=%d, config=%s)\n",
		deletedCount,
		cfg.Environment,
		alreadyDeletedCount,
		cfgPath,
	)

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
