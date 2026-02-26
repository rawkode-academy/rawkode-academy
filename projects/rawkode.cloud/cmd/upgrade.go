package cmd

import (
	"context"
	"fmt"
	"strings"

	"github.com/rawkode-academy/rawkode-cloud3/internal/cluster"
	"github.com/rawkode-academy/rawkode-cloud3/internal/config"
	"github.com/rawkode-academy/rawkode-cloud3/internal/talos"
	"github.com/spf13/cobra"
)

var upgradeCmd = &cobra.Command{
	Use:   "upgrade",
	Short: "Upgrade Talos or Kubernetes versions",
}

var upgradeTalosCmd = &cobra.Command{
	Use:   "talos",
	Short: "Rolling Talos OS upgrade",
	RunE:  runUpgradeTalos,
}

var upgradeK8sCmd = &cobra.Command{
	Use:   "k8s",
	Short: "Kubernetes version upgrade",
	RunE:  runUpgradeK8s,
}

func runUpgradeTalos(cmd *cobra.Command, args []string) error {
	ctx := context.Background()
	clusterName, _ := cmd.Flags().GetString("cluster")
	cfgFile, _ := cmd.Flags().GetString("file")
	version, _ := cmd.Flags().GetString("version")

	if strings.TrimSpace(version) == "" {
		return fmt.Errorf("--version is required")
	}

	cfg, cfgPath, err := loadConfigForClusterOrFile(clusterName, cfgFile)
	if err != nil {
		return err
	}

	state, err := loadNodeState(ctx, cfg)
	if err != nil {
		return err
	}

	infClient, err := newInfisicalClient(ctx, cfg)
	if err != nil {
		return err
	}
	talosconfig, err := loadTalosconfigFromInfisical(ctx, cfg, infClient)
	if err != nil {
		return err
	}

	imageURL := fmt.Sprintf("factory.talos.dev/installer/%s/%s", cfg.Cluster.TalosSchematic, version)

	orderedNodes := make([]cluster.NodeState, 0, len(state.Nodes))
	for _, node := range state.Nodes {
		if node.Status == cluster.NodeStatusDeleted || node.Status == cluster.NodeStatusFailed {
			continue
		}
		if strings.TrimSpace(node.PublicIP) == "" {
			continue
		}
		orderedNodes = append(orderedNodes, node)
	}
	// Control planes first.
	for i := range orderedNodes {
		for j := i + 1; j < len(orderedNodes); j++ {
			if orderedNodes[i].Role == config.NodeTypeWorker && orderedNodes[j].Role == config.NodeTypeControlPlane {
				orderedNodes[i], orderedNodes[j] = orderedNodes[j], orderedNodes[i]
			}
		}
	}

	if len(orderedNodes) == 0 {
		return fmt.Errorf("no active nodes found to upgrade")
	}

	for _, node := range orderedNodes {
		client, err := talos.NewClient(node.PublicIP, talosconfig)
		if err != nil {
			return fmt.Errorf("create talos client for node %s: %w", node.Name, err)
		}
		if err := client.Upgrade(ctx, imageURL); err != nil {
			client.Close()
			return fmt.Errorf("upgrade node %s: %w", node.Name, err)
		}
		if err := client.Close(); err != nil {
			return fmt.Errorf("close talos client for node %s: %w", node.Name, err)
		}
	}

	fmt.Printf("Upgraded Talos to %s on cluster %q (config=%s)\n", version, cfg.Environment, cfgPath)
	return nil
}

func runUpgradeK8s(cmd *cobra.Command, args []string) error {
	ctx := context.Background()
	clusterName, _ := cmd.Flags().GetString("cluster")
	cfgFile, _ := cmd.Flags().GetString("file")
	version, _ := cmd.Flags().GetString("version")

	if strings.TrimSpace(version) == "" {
		return fmt.Errorf("--version is required")
	}

	cfg, cfgPath, err := loadConfigForClusterOrFile(clusterName, cfgFile)
	if err != nil {
		return err
	}

	state, err := loadNodeState(ctx, cfg)
	if err != nil {
		return err
	}

	infClient, err := newInfisicalClient(ctx, cfg)
	if err != nil {
		return err
	}

	endpoint, err := controlPlaneEndpointFromState(state)
	if err != nil {
		return err
	}

	cfgForUpgrade := *cfg
	cfgForUpgrade.Cluster = cfg.Cluster
	cfgForUpgrade.Cluster.KubernetesVersion = version

	assets, err := ensureTalosAssets(ctx, &cfgForUpgrade, endpoint, infClient)
	if err != nil {
		return err
	}
	if len(assets.Talosconfig) == 0 {
		return fmt.Errorf("generated talosconfig is empty")
	}
	netbirdSetupKey, err := loadOptionalNetbirdSetupKeyFromInfisical(ctx, cfg, infClient)
	if err != nil {
		return fmt.Errorf("load netbird setup key: %w", err)
	}

	orderedNodes := make([]cluster.NodeState, 0, len(state.Nodes))
	for _, node := range state.Nodes {
		if node.Status == cluster.NodeStatusDeleted || node.Status == cluster.NodeStatusFailed {
			continue
		}
		if strings.TrimSpace(node.PublicIP) == "" {
			continue
		}
		orderedNodes = append(orderedNodes, node)
	}
	for i := range orderedNodes {
		for j := i + 1; j < len(orderedNodes); j++ {
			if orderedNodes[i].Role == config.NodeTypeWorker && orderedNodes[j].Role == config.NodeTypeControlPlane {
				orderedNodes[i], orderedNodes[j] = orderedNodes[j], orderedNodes[i]
			}
		}
	}
	if len(orderedNodes) == 0 {
		return fmt.Errorf("no active nodes found to upgrade")
	}

	for _, node := range orderedNodes {
		baseConfig := assets.Worker
		if node.Role == config.NodeTypeControlPlane {
			baseConfig = assets.ControlPlane
		}
		nodeConfig, err := renderNodeTalosConfig(baseConfig, node.Name)
		if err != nil {
			return fmt.Errorf("render node-specific Talos config for node %s: %w", node.Name, err)
		}
		nodeConfig, err = appendNetbirdExtensionServiceConfig(nodeConfig, netbirdSetupKey)
		if err != nil {
			return fmt.Errorf("append netbird extension service config for node %s: %w", node.Name, err)
		}

		client, err := talos.NewClient(node.PublicIP, assets.Talosconfig)
		if err != nil {
			return fmt.Errorf("create talos client for node %s: %w", node.Name, err)
		}
		if err := client.ApplyConfig(ctx, nodeConfig); err != nil {
			client.Close()
			return fmt.Errorf("apply upgraded Kubernetes config to node %s: %w", node.Name, err)
		}
		if err := client.Close(); err != nil {
			return fmt.Errorf("close talos client for node %s: %w", node.Name, err)
		}
	}

	fmt.Printf("Upgraded Kubernetes to %s on cluster %q (config=%s)\n", version, cfg.Environment, cfgPath)
	return nil
}

func init() {
	upgradeCmd.AddCommand(upgradeTalosCmd)
	upgradeCmd.AddCommand(upgradeK8sCmd)

	upgradeTalosCmd.Flags().String("cluster", "", "Cluster/environment name")
	upgradeTalosCmd.Flags().StringP("file", "f", "", "Path to cluster config YAML")
	upgradeTalosCmd.Flags().String("version", "", "Target Talos version (e.g. v1.12.4)")

	upgradeK8sCmd.Flags().String("cluster", "", "Cluster/environment name")
	upgradeK8sCmd.Flags().StringP("file", "f", "", "Path to cluster config YAML")
	upgradeK8sCmd.Flags().String("version", "", "Target Kubernetes version (e.g. v1.35.0)")
}
