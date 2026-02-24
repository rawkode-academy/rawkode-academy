package cmd

import (
	"context"
	"fmt"
	"strings"

	"github.com/rawkode-academy/rawkode-cloud3/internal/config"
	"github.com/rawkode-academy/rawkode-cloud3/internal/talos"
	"github.com/spf13/cobra"
)

var etcdCmd = &cobra.Command{
	Use:   "etcd",
	Short: "etcd backup and restore operations",
}

var etcdSnapshotCmd = &cobra.Command{
	Use:   "snapshot",
	Short: "Download etcd backup snapshot",
	RunE:  runEtcdSnapshot,
}

var etcdRestoreCmd = &cobra.Command{
	Use:   "restore",
	Short: "Restore etcd from a snapshot",
	RunE:  runEtcdRestore,
}

func runEtcdSnapshot(cmd *cobra.Command, args []string) error {
	ctx := context.Background()

	clusterName, _ := cmd.Flags().GetString("cluster")
	cfgFile, _ := cmd.Flags().GetString("file")
	output, _ := cmd.Flags().GetString("output")

	if strings.TrimSpace(output) == "" {
		return fmt.Errorf("--output is required")
	}

	cfg, cfgPath, err := loadConfigForClusterOrFile(clusterName, cfgFile)
	if err != nil {
		return err
	}

	_, _, state, err := loadNodeState(ctx, cfg)
	if err != nil {
		return err
	}
	controlPlane, err := firstActiveNodeByRole(state, config.NodeTypeControlPlane)
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

	client, err := talos.NewClient(controlPlane.PublicIP, talosconfig)
	if err != nil {
		return err
	}
	defer client.Close()

	if err := client.EtcdSnapshot(ctx, output); err != nil {
		return err
	}

	fmt.Printf("Saved etcd snapshot for cluster %q to %s (config=%s, node=%s)\n", cfg.Environment, output, cfgPath, controlPlane.Name)
	return nil
}

func runEtcdRestore(cmd *cobra.Command, args []string) error {
	ctx := context.Background()

	clusterName, _ := cmd.Flags().GetString("cluster")
	cfgFile, _ := cmd.Flags().GetString("file")
	input, _ := cmd.Flags().GetString("input")

	if strings.TrimSpace(input) == "" {
		return fmt.Errorf("--input is required")
	}

	cfg, cfgPath, err := loadConfigForClusterOrFile(clusterName, cfgFile)
	if err != nil {
		return err
	}

	_, _, state, err := loadNodeState(ctx, cfg)
	if err != nil {
		return err
	}
	controlPlane, err := firstActiveNodeByRole(state, config.NodeTypeControlPlane)
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

	client, err := talos.NewClient(controlPlane.PublicIP, talosconfig)
	if err != nil {
		return err
	}
	defer client.Close()

	if err := client.EtcdRestore(ctx, input); err != nil {
		return err
	}

	fmt.Printf("Restored etcd for cluster %q from %s (config=%s, node=%s)\n", cfg.Environment, input, cfgPath, controlPlane.Name)
	return nil
}

func init() {
	etcdCmd.AddCommand(etcdSnapshotCmd)
	etcdCmd.AddCommand(etcdRestoreCmd)

	etcdSnapshotCmd.Flags().String("cluster", "", "Cluster/environment name")
	etcdSnapshotCmd.Flags().StringP("file", "f", "", "Path to cluster config YAML")
	etcdSnapshotCmd.Flags().String("output", "etcd-snapshot.db", "Output file path")

	etcdRestoreCmd.Flags().String("cluster", "", "Cluster/environment name")
	etcdRestoreCmd.Flags().StringP("file", "f", "", "Path to cluster config YAML")
	etcdRestoreCmd.Flags().String("input", "", "Snapshot file path")
}
