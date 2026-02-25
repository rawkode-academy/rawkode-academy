package cmd

import (
	"context"
	"fmt"
	"strings"

	"github.com/rawkode-academy/rawkode-cloud3/internal/config"
	"github.com/rawkode-academy/rawkode-cloud3/internal/teleport"
	"github.com/spf13/cobra"
)

var clusterTeleportCmd = &cobra.Command{
	Use:   "teleport",
	Short: "Teleport management commands",
}

var clusterTeleportAccessCmd = &cobra.Command{
	Use:   "access",
	Short: "Manage Teleport Kubernetes access mappings",
}

var clusterTeleportAccessSyncCmd = &cobra.Command{
	Use:   "sync",
	Short: "Reconcile Teleport Kubernetes admin access from cluster config",
	RunE:  runClusterTeleportAccessSync,
}

func init() {
	clusterCmd.AddCommand(clusterTeleportCmd)
	clusterTeleportCmd.AddCommand(clusterTeleportAccessCmd)
	clusterTeleportAccessCmd.AddCommand(clusterTeleportAccessSyncCmd)

	clusterTeleportAccessSyncCmd.Flags().String("cluster", "", "Cluster/environment name")
	clusterTeleportAccessSyncCmd.Flags().StringP("file", "f", "", "Path to cluster config YAML")
	clusterTeleportAccessSyncCmd.Flags().Bool("verify-only", false, "Validate required Teleport access without changing Teleport resources")
}

func runClusterTeleportAccessSync(cmd *cobra.Command, args []string) error {
	ctx := context.Background()

	clusterName, _ := cmd.Flags().GetString("cluster")
	cfgFile, _ := cmd.Flags().GetString("file")
	verifyOnly, _ := cmd.Flags().GetBool("verify-only")

	cfg, cfgPath, err := loadConfigForClusterOrFile(clusterName, cfgFile)
	if err != nil {
		return err
	}

	if cfg.Teleport.EffectiveMode() == config.TeleportModeDisabled {
		return fmt.Errorf("teleport is disabled in %s", cfgPath)
	}
	if strings.TrimSpace(cfg.Teleport.Domain) == "" {
		return fmt.Errorf("teleport.domain is required in %s", cfgPath)
	}
	if strings.TrimSpace(cfg.Teleport.GitHub.Organization) == "" {
		return fmt.Errorf("teleport.github.organization is required in %s", cfgPath)
	}

	params := teleport.EnsureAccessParams{
		ProxyAddr:        strings.TrimSpace(cfg.Teleport.Domain),
		Organization:     strings.TrimSpace(cfg.Teleport.GitHub.Organization),
		AdminTeams:       cfg.Teleport.EffectiveAdminTeams(),
		KubernetesUsers:  cfg.Teleport.EffectiveKubernetesUsers(),
		KubernetesGroups: cfg.Teleport.EffectiveKubernetesGroups(),
	}

	if verifyOnly {
		if err := teleport.VerifyAdminAccess(ctx, params); err != nil {
			return err
		}

		fmt.Printf("Verified Teleport access policy from %s\n", cfgPath)
		fmt.Printf("  Proxy:             %s\n", params.ProxyAddr)
		fmt.Printf("  Organization:      %s\n", params.Organization)
		fmt.Printf("  Admin Teams:       %s\n", strings.Join(params.AdminTeams, ", "))
		fmt.Printf("  Kubernetes Users:  %s\n", strings.Join(params.KubernetesUsers, ", "))
		fmt.Printf("  Kubernetes Groups: %s\n", strings.Join(params.KubernetesGroups, ", "))
		return nil
	}

	if err := teleport.EnsureAdminAccess(ctx, params); err != nil {
		return err
	}

	fmt.Printf("Synced Teleport access policy from %s\n", cfgPath)
	fmt.Printf("  Proxy:             %s\n", params.ProxyAddr)
	fmt.Printf("  Organization:      %s\n", params.Organization)
	fmt.Printf("  Admin Teams:       %s\n", strings.Join(params.AdminTeams, ", "))
	fmt.Printf("  Kubernetes Users:  %s\n", strings.Join(params.KubernetesUsers, ", "))
	fmt.Printf("  Kubernetes Groups: %s\n", strings.Join(params.KubernetesGroups, ", "))

	return nil
}
