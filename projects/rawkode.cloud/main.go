package main

import (
	"fmt"
	"log/slog"
	"os"

	"github.com/rawkode-academy/rawkode-cloud/internal/config"
	"github.com/rawkode-academy/rawkode-cloud/internal/scaleway"
	"github.com/rawkode-academy/rawkode-cloud/internal/state"
	"github.com/rawkode-academy/rawkode-cloud/pkg/logging"
	scw "github.com/scaleway/scaleway-sdk-go/scw"
	"github.com/spf13/cobra"
	"github.com/spf13/viper"
)

const defaultTalosVersion = "v1.9.5"

var configFile string

func main() {
	logging.Setup(slog.LevelInfo)

	rootCmd := &cobra.Command{
		Use:   "rawkode-cloud",
		Short: "Bare metal to immutable Kubernetes provisioning CLI",
		Long: `rawkode-cloud provisions physical bare metal servers from Scaleway,
pivots them to Talos Linux, bootstraps a Kubernetes cluster, and secures
access through Teleport — all with a single command.

No SSH. No local state. Verify-then-lockdown.

Configuration sources (in precedence order, lowest to highest):
  1. Config file  (~/.rawkode-cloud.yaml or --config path)
  2. Environment   (RAWKODE_CLOUD_* or SCW_ACCESS_KEY/SCW_SECRET_KEY)
  3. CLI flags
  4. Infisical      (secrets fetched at runtime backfill missing values)`,
		PersistentPreRun: func(cmd *cobra.Command, args []string) {
			config.InitViper(configFile)
		},
	}

	rootCmd.PersistentFlags().StringVar(&configFile, "config", "", "Config file path (default: .rawkode-cloud.yaml)")

	provisionCmd := buildProvisionCommand()
	destroyCmd := buildDestroyCommand()

	rootCmd.AddCommand(provisionCmd)
	rootCmd.AddCommand(destroyCmd)

	if err := rootCmd.Execute(); err != nil {
		os.Exit(1)
	}
}

func buildProvisionCommand() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "provision",
		Short: "Provision a bare metal Kubernetes cluster",
		Long: `Provisions a Scaleway bare metal server, pivots it to Talos Linux,
generates cluster configuration in memory, bootstraps Kubernetes,
verifies Teleport connectivity, and locks down the firewall.

All settings can come from a config file, environment variables, CLI flags,
or Infisical. At minimum, provide Infisical credentials and a project ID
to have everything resolved automatically.`,
		PreRun: func(cmd *cobra.Command, args []string) {
			config.BindFlags(cmd)
		},
		RunE: func(cmd *cobra.Command, args []string) error {
			if viper.GetBool("verbose") {
				logging.Setup(slog.LevelDebug)
			}

			cfg, err := config.Resolve()
			if err != nil {
				return err
			}

			zone := cfg.ScalewayZone
			if zone == "" {
				zone = "fr-par-2"
			}

			talosVersion := cfg.TalosVersion
			if talosVersion == "" {
				talosVersion = defaultTalosVersion
			}

			return state.Run(cmd.Context(), state.Config{
				ClusterName:           cfg.ClusterName,
				OfferID:               cfg.ScalewayOfferID,
				Zone:                  scw.Zone(zone),
				OSID:                  cfg.ScalewayOSID,
				TalosVersion:          talosVersion,
				TeleportProxy:         cfg.TeleportProxy,
				KubernetesVersion:     cfg.KubernetesVersion,
				ScalewayAccessKey:     cfg.ScalewayAccessKey,
				ScalewaySecretKey:     cfg.ScalewaySecretKey,
				CloudflareAPIToken:    cfg.CloudflareAPIToken,
				CloudflareZoneID:      cfg.CloudflareZoneID,
				CloudflareDNSName:     cfg.CloudflareDNSName,
				InfisicalURL:          cfg.InfisicalURL,
				InfisicalClientID:     cfg.InfisicalClientID,
				InfisicalClientSecret: cfg.InfisicalClientSecret,
				InfisicalProjectID:    cfg.InfisicalProjectID,
				InfisicalEnvironment:  cfg.InfisicalEnvironment,
				InfisicalSecretPath:   cfg.InfisicalSecretPath,
			})
		},
	}

	// All flags are optional — values can come from config file, env vars, or Infisical
	cmd.Flags().String("cluster-name", "", "Name for the Kubernetes cluster")
	cmd.Flags().String("scaleway-offer-id", "", "Scaleway bare metal offer UUID")
	cmd.Flags().String("scaleway-zone", "fr-par-2", "Scaleway zone")
	cmd.Flags().String("scaleway-os-id", "", "Scaleway OS UUID for Ubuntu 24.04")
	cmd.Flags().String("scaleway-access-key", "", "Scaleway access key")
	cmd.Flags().String("scaleway-secret-key", "", "Scaleway secret key")
	cmd.Flags().String("talos-version", defaultTalosVersion, "Talos Linux release version")
	cmd.Flags().String("teleport-proxy", "", "Teleport proxy address")
	cmd.Flags().String("infisical-url", "", "Infisical instance URL")
	cmd.Flags().String("infisical-client-id", "", "Infisical client ID")
	cmd.Flags().String("infisical-client-secret", "", "Infisical client secret")
	cmd.Flags().String("infisical-project-id", "", "Infisical project ID for secret fetching")
	cmd.Flags().String("infisical-environment", "production", "Infisical environment")
	cmd.Flags().String("infisical-secret-path", "/", "Infisical secret path")
	cmd.Flags().String("kubernetes-version", "", "Kubernetes version (default: Talos SDK default)")
	cmd.Flags().String("cloudflare-api-token", "", "Cloudflare API token for DNS management")
	cmd.Flags().String("cloudflare-zone-id", "", "Cloudflare zone ID for DNS record")
	cmd.Flags().String("cloudflare-dns-name", "", "DNS record name to point at the server (e.g. rawkode.cloud)")
	cmd.Flags().BoolP("verbose", "v", false, "Enable debug logging")

	return cmd
}

func buildDestroyCommand() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "destroy",
		Short: "Destroy a previously provisioned server",
		Long: `Deletes a Scaleway bare metal server by ID. Useful for cleaning up
failed provisioning runs.`,
		PreRun: func(cmd *cobra.Command, args []string) {
			config.BindFlags(cmd)
		},
		RunE: func(cmd *cobra.Command, args []string) error {
			if viper.GetBool("verbose") {
				logging.Setup(slog.LevelDebug)
			}

			cfg, err := config.Resolve()
			if err != nil {
				return err
			}

			serverID := viper.GetString("server_id")
			if serverID == "" {
				return fmt.Errorf("--server-id is required")
			}

			zone := cfg.ScalewayZone
			if zone == "" {
				zone = "fr-par-2"
			}

			client, err := scaleway.NewClient(cfg.ScalewayAccessKey, cfg.ScalewaySecretKey)
			if err != nil {
				return err
			}

			return scaleway.DeleteServer(cmd.Context(), client.Baremetal, serverID, scw.Zone(zone))
		},
	}

	cmd.Flags().String("server-id", "", "Server ID to destroy (required)")
	cmd.Flags().String("scaleway-zone", "fr-par-2", "Scaleway zone")
	cmd.Flags().String("scaleway-access-key", "", "Scaleway access key")
	cmd.Flags().String("scaleway-secret-key", "", "Scaleway secret key")
	cmd.Flags().BoolP("verbose", "v", false, "Enable debug logging")

	return cmd
}
