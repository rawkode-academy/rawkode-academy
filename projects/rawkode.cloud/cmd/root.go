package cmd

import (
	"github.com/spf13/cobra"
)

var rootCmd = &cobra.Command{
	Use:   "rawkode-cloud3",
	Short: "Talos bare metal Kubernetes platform",
	Long:  "Provision and manage Talos Linux Kubernetes clusters on Scaleway bare metal.",
}

func Execute() error {
	return rootCmd.Execute()
}

func init() {
	rootCmd.AddCommand(clusterCmd)
	rootCmd.AddCommand(nodeCmd)
	rootCmd.AddCommand(upgradeCmd)
	rootCmd.AddCommand(etcdCmd)
	rootCmd.AddCommand(opsCmd)
}
