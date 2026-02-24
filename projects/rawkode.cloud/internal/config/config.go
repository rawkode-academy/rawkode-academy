package config

import (
	"fmt"
	"os"
	"strings"

	"gopkg.in/yaml.v3"
)

// Config is the top-level cluster configuration loaded from YAML.
type Config struct {
	Environment string           `yaml:"environment"`
	State       StateConfig      `yaml:"state"`
	Cluster     ClusterConfig    `yaml:"cluster"`
	Scaleway    ScalewayConfig   `yaml:"scaleway"`
	NodePools   []NodePoolConfig `yaml:"nodePools"`
	Teleport    TeleportConfig   `yaml:"teleport"`
	Infisical   InfisicalConfig  `yaml:"infisical"`
	Flux        FluxConfig       `yaml:"flux"`

	// Credentials populated from environment variables, never serialized.
	scwAccessKey       string
	scwSecretKey       string
	cloudflareAPIToken string
	cloudflareAccount  string
}

// ClusterConfig holds Kubernetes/Talos version info.
type ClusterConfig struct {
	TalosVersion      string `yaml:"talos_version"`
	KubernetesVersion string `yaml:"kubernetes_version"`
	TalosSchematic    string `yaml:"talos_schematic"`
}

// ScalewayConfig holds Scaleway infrastructure settings (no credentials).
type ScalewayConfig struct {
	VPCName            string `yaml:"vpc_name"`
	PrivateNetworkName string `yaml:"private_network_name"`
	Zone               string `yaml:"zone"`
}

// StateConfig holds S3 state storage settings.
type StateConfig struct {
	Bucket   string `yaml:"bucket"`
	Region   string `yaml:"region"`
	Endpoint string `yaml:"endpoint"`
}

// NodePoolConfig describes a group of nodes sharing the same hardware/disk layout.
type NodePoolConfig struct {
	Name         string     `yaml:"name"`
	Type         string     `yaml:"type"`
	Size         int        `yaml:"size"`
	Offer        string     `yaml:"offer"`
	BillingCycle string     `yaml:"billing_cycle"`
	Disks        DiskConfig `yaml:"disks"`
}

const (
	NodeTypeControlPlane = "controlplane"
	NodeTypeWorker       = "worker"
)

// DiskConfig holds disk device paths.
type DiskConfig struct {
	OS   string `yaml:"os"`
	Data string `yaml:"data"`
}

// TeleportConfig holds Teleport proxy settings.
type TeleportConfig struct {
	Domain string `yaml:"domain"`
}

// InfisicalConfig holds secrets management settings.
type InfisicalConfig struct {
	SiteURL      string `yaml:"site_url"`
	ProjectID    string `yaml:"project_id"`
	Environment  string `yaml:"environment"`
	SecretPath   string `yaml:"secret_path"`
	ClientID     string `yaml:"client_id"`
	ClientSecret string `yaml:"client_secret"`
}

// FluxConfig holds FluxCD configuration.
type FluxConfig struct {
	OCIRepo string `yaml:"oci_repo"`
}

// Load reads and parses a cluster configuration YAML file.
// Environment variables override YAML values for sensitive fields.
func Load(path string) (*Config, error) {
	if path == "" {
		return nil, fmt.Errorf("config path is required")
	}

	data, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("read config %s: %w", path, err)
	}

	var cfg Config
	if err := yaml.Unmarshal(data, &cfg); err != nil {
		return nil, fmt.Errorf("parse config %s: %w", path, err)
	}

	// Environment variable overrides for sensitive values
	if v := os.Getenv("SCW_ACCESS_KEY"); v != "" {
		cfg.scwAccessKey = v
	}
	if v := os.Getenv("SCW_SECRET_KEY"); v != "" {
		cfg.scwSecretKey = v
	}
	if v := os.Getenv("CLOUDFLARE_API_TOKEN"); v != "" {
		cfg.cloudflareAPIToken = v
	}
	if v := os.Getenv("CLOUDFLARE_ACCOUNT_ID"); v != "" {
		cfg.cloudflareAccount = v
	}
	if v := os.Getenv("INFISICAL_CLIENT_ID"); v != "" && cfg.Infisical.ClientID == "" {
		cfg.Infisical.ClientID = v
	}
	if v := os.Getenv("INFISICAL_CLIENT_SECRET"); v != "" && cfg.Infisical.ClientSecret == "" {
		cfg.Infisical.ClientSecret = v
	}

	return &cfg, nil
}

// Save writes the configuration back to a YAML file.
func Save(path string, cfg *Config) error {
	data, err := yaml.Marshal(cfg)
	if err != nil {
		return fmt.Errorf("marshal config: %w", err)
	}

	if err := os.WriteFile(path, data, 0o644); err != nil {
		return fmt.Errorf("write config %s: %w", path, err)
	}

	return nil
}

// ScalewayCredentials returns the Scaleway credentials loaded from environment variables.
func (c *Config) ScalewayCredentials() (accessKey, secretKey string) {
	return c.scwAccessKey, c.scwSecretKey
}

// CloudflareAPIToken returns the Cloudflare API token loaded from environment variables.
func (c *Config) CloudflareAPIToken() string {
	return c.cloudflareAPIToken
}

// CloudflareAccountID returns the Cloudflare account ID from environment variables.
func (c *Config) CloudflareAccountID() string {
	return c.cloudflareAccount
}

// FindNodePool returns the NodePoolConfig with the given name, or an error.
func (c *Config) FindNodePool(name string) (*NodePoolConfig, error) {
	for i := range c.NodePools {
		if c.NodePools[i].Name == name {
			return &c.NodePools[i], nil
		}
	}
	return nil, fmt.Errorf("node pool %q not found in config", name)
}

// DefaultNodePool returns the first node pool, or an error if none exist.
func (c *Config) DefaultNodePool() (*NodePoolConfig, error) {
	if len(c.NodePools) == 0 {
		return nil, fmt.Errorf("no node pools defined in config")
	}
	return &c.NodePools[0], nil
}

// FirstNodePoolByType returns the first pool matching a normalized type.
func (c *Config) FirstNodePoolByType(poolType string) (*NodePoolConfig, error) {
	normalized := NormalizeNodePoolType(poolType)
	if normalized == "" {
		return nil, fmt.Errorf("invalid node pool type %q", poolType)
	}

	for i := range c.NodePools {
		if c.NodePools[i].EffectiveType() == normalized {
			return &c.NodePools[i], nil
		}
	}

	return nil, fmt.Errorf("no node pool with type %q found", normalized)
}

// EffectiveType returns the normalized pool type, defaulting to controlplane.
func (p NodePoolConfig) EffectiveType() string {
	if normalized := NormalizeNodePoolType(p.Type); normalized != "" {
		return normalized
	}
	return NodeTypeControlPlane
}

// DesiredSize returns the configured pool size with a sane default.
func (p NodePoolConfig) DesiredSize() int {
	if p.Size <= 0 {
		return 1
	}

	return p.Size
}

// NormalizeNodePoolType normalizes user-facing type variants.
func NormalizeNodePoolType(value string) string {
	switch strings.ToLower(strings.TrimSpace(value)) {
	case "", "controlplane", "control-plane", "control_plane", "cp":
		return NodeTypeControlPlane
	case "worker":
		return NodeTypeWorker
	default:
		return ""
	}
}
