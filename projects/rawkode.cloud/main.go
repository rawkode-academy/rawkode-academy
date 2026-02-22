package main

import (
	"log/slog"
	"os"

	"github.com/rawkode-academy/rawkode-cloud/internal/scaleway"
	"github.com/rawkode-academy/rawkode-cloud/internal/state"
	"github.com/rawkode-academy/rawkode-cloud/pkg/logging"
	scw "github.com/scaleway/scaleway-sdk-go/scw"
	"github.com/spf13/cobra"
)

const defaultTalosVersion = "v1.9.5"

func main() {
	logging.Setup(slog.LevelInfo)

	rootCmd := &cobra.Command{
		Use:   "rawkode-cloud",
		Short: "Bare metal to immutable Kubernetes provisioning CLI",
		Long: `rawkode-cloud provisions physical bare metal servers from Scaleway,
pivots them to Talos Linux, bootstraps a Kubernetes cluster, and secures
access through Teleport — all with a single command.

No SSH. No local state. No YAML files. Verify-then-lockdown.`,
	}

	provisionCmd := buildProvisionCommand()
	destroyCmd := buildDestroyCommand()

	rootCmd.AddCommand(provisionCmd)
	rootCmd.AddCommand(destroyCmd)

	if err := rootCmd.Execute(); err != nil {
		os.Exit(1)
	}
}

func buildProvisionCommand() *cobra.Command {
	var (
		clusterName       string
		offerID           string
		zone              string
		osID              string
		talosVersion      string
		teleportProxy     string
		infisicalURL      string
		infisicalClientID string
		infisicalSecret   string
		kubeVersion       string
		verbose           bool
	)

	cmd := &cobra.Command{
		Use:   "provision",
		Short: "Provision a bare metal Kubernetes cluster",
		Long: `Provisions a Scaleway bare metal server, pivots it to Talos Linux,
generates cluster configuration in memory, bootstraps Kubernetes,
verifies Teleport connectivity, and locks down the firewall.

Required environment variables:
  SCW_ACCESS_KEY    - Scaleway access key
  SCW_SECRET_KEY    - Scaleway secret key`,
		RunE: func(cmd *cobra.Command, args []string) error {
			if verbose {
				logging.Setup(slog.LevelDebug)
			}

			cfg := state.Config{
				ClusterName:       clusterName,
				OfferID:           offerID,
				Zone:              scw.Zone(zone),
				OSID:              osID,
				TalosVersion:      talosVersion,
				TeleportProxy:     teleportProxy,
				InfisicalURL:      infisicalURL,
				InfisicalClientID: infisicalClientID,
				InfisicalSecret:   infisicalSecret,
				KubernetesVersion: kubeVersion,
			}

			return state.Run(cmd.Context(), cfg)
		},
	}

	cmd.Flags().StringVar(&clusterName, "cluster-name", "", "Name for the Kubernetes cluster (required)")
	cmd.Flags().StringVar(&offerID, "offer-id", "", "Scaleway bare metal offer UUID (required)")
	cmd.Flags().StringVar(&zone, "zone", "fr-par-2", "Scaleway zone")
	cmd.Flags().StringVar(&osID, "os-id", "", "Scaleway OS UUID for Ubuntu 24.04 (required)")
	cmd.Flags().StringVar(&talosVersion, "talos-version", defaultTalosVersion, "Talos Linux release version")
	cmd.Flags().StringVar(&teleportProxy, "teleport-proxy", "", "Teleport proxy address (required)")
	cmd.Flags().StringVar(&infisicalURL, "infisical-url", "", "Infisical instance URL (required)")
	cmd.Flags().StringVar(&infisicalClientID, "infisical-client-id", "", "Infisical client ID for machine token generation (required)")
	cmd.Flags().StringVar(&infisicalSecret, "infisical-client-secret", "", "Infisical client secret for machine token generation (required)")
	cmd.Flags().StringVar(&kubeVersion, "kubernetes-version", "", "Kubernetes version (default: Talos SDK default)")
	cmd.Flags().BoolVarP(&verbose, "verbose", "v", false, "Enable debug logging")

	_ = cmd.MarkFlagRequired("cluster-name")
	_ = cmd.MarkFlagRequired("offer-id")
	_ = cmd.MarkFlagRequired("os-id")
	_ = cmd.MarkFlagRequired("teleport-proxy")
	_ = cmd.MarkFlagRequired("infisical-url")
	_ = cmd.MarkFlagRequired("infisical-client-id")
	_ = cmd.MarkFlagRequired("infisical-client-secret")

	return cmd
}

func buildDestroyCommand() *cobra.Command {
	var (
		serverID string
		zone     string
		verbose  bool
	)

	cmd := &cobra.Command{
		Use:   "destroy",
		Short: "Destroy a previously provisioned server",
		Long: `Deletes a Scaleway bare metal server by ID. Useful for cleaning up
failed provisioning runs.

Required environment variables:
  SCW_ACCESS_KEY    - Scaleway access key
  SCW_SECRET_KEY    - Scaleway secret key`,
		RunE: func(cmd *cobra.Command, args []string) error {
			if verbose {
				logging.Setup(slog.LevelDebug)
			}

			api, err := scaleway.NewClient()
			if err != nil {
				return err
			}

			return scaleway.DeleteServer(cmd.Context(), api, serverID, scw.Zone(zone))
		},
	}

	cmd.Flags().StringVar(&serverID, "server-id", "", "Server ID to destroy (required)")
	cmd.Flags().StringVar(&zone, "zone", "fr-par-2", "Scaleway zone")
	cmd.Flags().BoolVarP(&verbose, "verbose", "v", false, "Enable debug logging")

	_ = cmd.MarkFlagRequired("server-id")

	return cmd
}
