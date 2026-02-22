package config

import (
	"fmt"
	"log/slog"
	"strings"

	"github.com/spf13/cobra"
	"github.com/spf13/pflag"
	"github.com/spf13/viper"
)

// Config holds all resolved configuration for the CLI.
// Resolution order: config file < environment variables < CLI flags.
type Config struct {
	// Cluster settings
	ClusterName       string `mapstructure:"cluster_name"`
	KubernetesVersion string `mapstructure:"kubernetes_version"`
	FlatcarChannel    string `mapstructure:"flatcar_channel"`
	Role              string `mapstructure:"role"`
	CiliumVersion     string `mapstructure:"cilium_version"`

	// Scaleway settings
	ScalewayAccessKey string `mapstructure:"scaleway_access_key"`
	ScalewaySecretKey string `mapstructure:"scaleway_secret_key"`
	ScalewayZone      string `mapstructure:"scaleway_zone"`
	ScalewayOfferID   string `mapstructure:"scaleway_offer_id"`
	ScalewayOSID      string `mapstructure:"scaleway_os_id"`

	// Teleport settings
	TeleportProxy string `mapstructure:"teleport_proxy"`

	// Cloudflare DNS settings — for pointing rawkode.cloud at the server
	CloudflareAPIToken  string `mapstructure:"cloudflare_api_token"`
	CloudflareAccountID string `mapstructure:"cloudflare_account_id"`
	CloudflareZoneID    string `mapstructure:"cloudflare_zone_id"`
	CloudflareDNSName   string `mapstructure:"cloudflare_dns_name"`

	// Infisical settings — these bootstrap everything else.
	// The URL, client ID, and client secret are the minimum needed to
	// authenticate. Once authenticated, all other secrets (Scaleway creds,
	// Teleport proxy address, etc.) can be fetched from Infisical.
	InfisicalURL          string `mapstructure:"infisical_url"`
	InfisicalClientID     string `mapstructure:"infisical_client_id"`
	InfisicalClientSecret string `mapstructure:"infisical_client_secret"`
	InfisicalProjectID    string `mapstructure:"infisical_project_id"`
	InfisicalEnvironment  string `mapstructure:"infisical_environment"`
	InfisicalSecretPath   string `mapstructure:"infisical_secret_path"`

	// Infisical cluster identity — injected into the cluster as a K8s secret
	InfisicalClusterClientID     string `mapstructure:"infisical_cluster_client_id"`
	InfisicalClusterClientSecret string `mapstructure:"infisical_cluster_client_secret"`

	// SSH
	SSHAgentSocket string `mapstructure:"ssh_agent"`

	// Runtime
	Verbose bool `mapstructure:"verbose"`
}

// InitViper sets up viper with the config file, environment variable, and
// CLI flag precedence chain.
//
// Precedence (lowest to highest):
//  1. Config file (~/.rawkode-cloud.yaml or --config path)
//  2. Environment variables (RAWKODE_CLOUD_*)
//  3. CLI flags
func InitViper(configFile string) {
	if configFile != "" {
		viper.SetConfigFile(configFile)
	} else {
		viper.SetConfigName(".rawkode-cloud")
		viper.SetConfigType("yaml")
		viper.AddConfigPath(".")
		viper.AddConfigPath("$HOME")
	}

	// Environment variables: RAWKODE_CLOUD_CLUSTER_NAME, etc.
	viper.SetEnvPrefix("RAWKODE_CLOUD")
	viper.SetEnvKeyReplacer(strings.NewReplacer("-", "_", ".", "_"))
	viper.AutomaticEnv()

	// Also support SCW_ACCESS_KEY and SCW_SECRET_KEY without prefix
	// for backwards compatibility with the Scaleway SDK convention.
	_ = viper.BindEnv("scaleway_access_key", "RAWKODE_CLOUD_SCALEWAY_ACCESS_KEY", "SCW_ACCESS_KEY")
	_ = viper.BindEnv("scaleway_secret_key", "RAWKODE_CLOUD_SCALEWAY_SECRET_KEY", "SCW_SECRET_KEY")

	// Support legacy/non-prefixed Cloudflare env names.
	_ = viper.BindEnv("cloudflare_api_token", "RAWKODE_CLOUD_CLOUDFLARE_API_TOKEN", "CLOUDFLARE_API_TOKEN", "CF_API_TOKEN")
	_ = viper.BindEnv("cloudflare_account_id", "RAWKODE_CLOUD_CLOUDFLARE_ACCOUNT_ID", "CLOUDFLARE_ACCOUNT_ID", "CF_ACCOUNT_ID")
	_ = viper.BindEnv("cloudflare_zone_id", "RAWKODE_CLOUD_CLOUDFLARE_ZONE_ID", "CLOUDFLARE_ZONE_ID", "CF_ZONE_ID")
	_ = viper.BindEnv("cloudflare_dns_name", "RAWKODE_CLOUD_CLOUDFLARE_DNS_NAME", "CLOUDFLARE_DNS_NAME", "CF_DNS_NAME")

	if err := viper.ReadInConfig(); err != nil {
		if _, ok := err.(viper.ConfigFileNotFoundError); !ok {
			slog.Warn("error reading config file", "error", err)
		}
	} else {
		slog.Info("using config file", "path", viper.ConfigFileUsed())
	}
}

// BindFlags binds cobra flags to viper keys so CLI flags override
// config file and env var values. Flag names use kebab-case; viper
// keys use snake_case.
func BindFlags(cmd *cobra.Command) {
	cmd.Flags().VisitAll(func(f *pflag.Flag) {
		viperKey := strings.ReplaceAll(f.Name, "-", "_")
		_ = viper.BindPFlag(viperKey, f)
	})
}

// Resolve reads the final merged configuration from viper.
// At this point, all sources (config file, env vars, flags) have been loaded.
func Resolve() (*Config, error) {
	var cfg Config
	if err := viper.Unmarshal(&cfg); err != nil {
		return nil, fmt.Errorf("unmarshal config: %w", err)
	}
	return &cfg, nil
}
