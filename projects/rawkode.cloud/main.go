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

const defaultFlatcarChannel = "stable"

var configFile string

func main() {
	logging.Setup(slog.LevelInfo)

	rootCmd := &cobra.Command{
		Use:   "rawkode-cloud",
		Short: "Bare metal to Kubernetes provisioning CLI",
		Long: `rawkode-cloud provisions physical bare metal servers from Scaleway,
installs Flatcar Container Linux, bootstraps a Kubernetes cluster with kubeadm,
and secures access through Teleport — all with a single command.

Multi-node support: first invocation does kubeadm init, subsequent invocations
read join info from Infisical and do kubeadm join.

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
	infectCmd := buildInfectCommand()

	rootCmd.AddCommand(provisionCmd)
	rootCmd.AddCommand(destroyCmd)
	rootCmd.AddCommand(infectCmd)

	if err := rootCmd.Execute(); err != nil {
		os.Exit(1)
	}
}

func buildProvisionCommand() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "provision",
		Short: "Provision a bare metal Kubernetes node",
		Long: `Provisions a Scaleway bare metal server, installs Flatcar Container Linux
with an Ignition config, bootstraps Kubernetes via kubeadm, verifies Teleport
connectivity, and locks down the firewall.

First invocation (no join token in Infisical) does kubeadm init.
Subsequent invocations read join info from Infisical and do kubeadm join.

Use --role to specify control-plane or worker.`,
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

			flatcarChannel := cfg.FlatcarChannel
			if flatcarChannel == "" {
				flatcarChannel = defaultFlatcarChannel
			}

			return state.Run(cmd.Context(), state.Config{
				ClusterName:                  cfg.ClusterName,
				OfferID:                      cfg.ScalewayOfferID,
				Zone:                         scw.Zone(zone),
				OSID:                         cfg.ScalewayOSID,
				FlatcarChannel:               flatcarChannel,
				Role:                         cfg.Role,
				TeleportProxy:                cfg.TeleportProxy,
				KubernetesVersion:            cfg.KubernetesVersion,
				CiliumVersion:                cfg.CiliumVersion,
				ScalewayAccessKey:            cfg.ScalewayAccessKey,
				ScalewaySecretKey:            cfg.ScalewaySecretKey,
				CloudflareAPIToken:           cfg.CloudflareAPIToken,
				CloudflareAccountID:          cfg.CloudflareAccountID,
				CloudflareZoneID:             cfg.CloudflareZoneID,
				CloudflareDNSName:            cfg.CloudflareDNSName,
				InfisicalURL:                 cfg.InfisicalURL,
				InfisicalClientID:            cfg.InfisicalClientID,
				InfisicalClientSecret:        cfg.InfisicalClientSecret,
				InfisicalProjectID:           cfg.InfisicalProjectID,
				InfisicalEnvironment:         cfg.InfisicalEnvironment,
				InfisicalSecretPath:          cfg.InfisicalSecretPath,
				InfisicalClusterClientID:     cfg.InfisicalClusterClientID,
				InfisicalClusterClientSecret: cfg.InfisicalClusterClientSecret,
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
	cmd.Flags().String("flatcar-channel", defaultFlatcarChannel, "Flatcar Container Linux channel (stable, beta, alpha)")
	cmd.Flags().String("role", "", "Node role: control-plane or worker (required)")
	cmd.Flags().String("teleport-proxy", "", "Teleport proxy address")
	cmd.Flags().String("kubernetes-version", "", "Kubernetes version (e.g. v1.33.2)")
	cmd.Flags().String("cilium-version", "", "Cilium version (e.g. 1.17.3)")
	cmd.Flags().String("infisical-url", "", "Infisical instance URL")
	cmd.Flags().String("infisical-client-id", "", "Infisical client ID")
	cmd.Flags().String("infisical-client-secret", "", "Infisical client secret")
	cmd.Flags().String("infisical-project-id", "", "Infisical project ID for secret fetching")
	cmd.Flags().String("infisical-environment", "production", "Infisical environment")
	cmd.Flags().String("infisical-secret-path", "/", "Infisical secret path")
	cmd.Flags().String("cloudflare-api-token", "", "Cloudflare API token for DNS management")
	cmd.Flags().String("cloudflare-account-id", "", "Cloudflare account ID (used to resolve zone ID from cloudflare-dns-name when cloudflare-zone-id is unset)")
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

func buildInfectCommand() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "infect",
		Short: "Pivot an existing Ubuntu host to Flatcar + Kubernetes",
		Long: `SSHes to an existing Ubuntu 24 host, installs Flatcar Container Linux,
reboots into Flatcar, and proceeds with the same kubeadm bootstrap as provision.

This is the same flow as provision but without creating a new Scaleway server.
Use this when you already have a bare metal or VM running Ubuntu and want to
convert it to a Flatcar-based Kubernetes node.

Requires --host. Uses the system SSH agent by default; pass --ssh-key to use
a specific private key file instead.`,
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

			host := viper.GetString("host")
			if host == "" {
				return fmt.Errorf("--host is required")
			}

			var sshKey []byte
			if sshKeyPath := viper.GetString("ssh_key"); sshKeyPath != "" {
				sshKey, err = os.ReadFile(sshKeyPath)
				if err != nil {
					return fmt.Errorf("read SSH key %s: %w", sshKeyPath, err)
				}
			}
			// sshKey == nil → ssh package will use SSH_AUTH_SOCK agent

			flatcarChannel := cfg.FlatcarChannel
			if flatcarChannel == "" {
				flatcarChannel = defaultFlatcarChannel
			}

			return state.RunInfect(cmd.Context(), state.InfectConfig{
				Host:                         host,
				SSHPort:                      viper.GetString("ssh_port"),
				SSHUser:                      viper.GetString("ssh_user"),
				SSHAgentSocket:               cfg.SSHAgentSocket,
				ClusterName:                  cfg.ClusterName,
				Role:                         cfg.Role,
				FlatcarChannel:               flatcarChannel,
				KubernetesVersion:            cfg.KubernetesVersion,
				CiliumVersion:                cfg.CiliumVersion,
				TeleportProxy:                cfg.TeleportProxy,
				CloudflareAPIToken:           cfg.CloudflareAPIToken,
				CloudflareAccountID:          cfg.CloudflareAccountID,
				CloudflareZoneID:             cfg.CloudflareZoneID,
				CloudflareDNSName:            cfg.CloudflareDNSName,
				InfisicalURL:                 cfg.InfisicalURL,
				InfisicalClientID:            cfg.InfisicalClientID,
				InfisicalClientSecret:        cfg.InfisicalClientSecret,
				InfisicalProjectID:           cfg.InfisicalProjectID,
				InfisicalEnvironment:         cfg.InfisicalEnvironment,
				InfisicalSecretPath:          cfg.InfisicalSecretPath,
				InfisicalClusterClientID:     cfg.InfisicalClusterClientID,
				InfisicalClusterClientSecret: cfg.InfisicalClusterClientSecret,
			}, sshKey)
		},
	}

	cmd.Flags().String("host", "", "IP or hostname of existing Ubuntu host (required)")
	cmd.Flags().String("ssh-key", "", "Path to SSH private key (default: SSH agent)")
	cmd.Flags().String("ssh-agent", "", "SSH agent socket path (default: SSH_AUTH_SOCK)")
	cmd.Flags().String("ssh-port", "22", "SSH port on target host")
	cmd.Flags().String("ssh-user", "root", "SSH user for initial connection")
	cmd.Flags().String("cluster-name", "", "Name for the Kubernetes cluster")
	cmd.Flags().String("role", "", "Node role: control-plane or worker (required)")
	cmd.Flags().String("flatcar-channel", defaultFlatcarChannel, "Flatcar Container Linux channel (stable, beta, alpha)")
	cmd.Flags().String("kubernetes-version", "", "Kubernetes version (e.g. v1.33.2)")
	cmd.Flags().String("cilium-version", "", "Cilium version (e.g. 1.17.3)")
	cmd.Flags().String("teleport-proxy", "", "Teleport proxy address")
	cmd.Flags().String("infisical-url", "", "Infisical instance URL")
	cmd.Flags().String("infisical-client-id", "", "Infisical client ID")
	cmd.Flags().String("infisical-client-secret", "", "Infisical client secret")
	cmd.Flags().String("infisical-project-id", "", "Infisical project ID")
	cmd.Flags().String("infisical-environment", "production", "Infisical environment")
	cmd.Flags().String("infisical-secret-path", "/", "Infisical secret path")
	cmd.Flags().String("cloudflare-api-token", "", "Cloudflare API token for DNS management")
	cmd.Flags().String("cloudflare-account-id", "", "Cloudflare account ID (used to resolve zone ID from cloudflare-dns-name when cloudflare-zone-id is unset)")
	cmd.Flags().String("cloudflare-zone-id", "", "Cloudflare zone ID for DNS record")
	cmd.Flags().String("cloudflare-dns-name", "", "DNS record name")
	cmd.Flags().BoolP("verbose", "v", false, "Enable debug logging")

	return cmd
}
