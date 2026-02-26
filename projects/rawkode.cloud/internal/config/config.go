package config

import (
	"context"
	"fmt"
	"os"
	"strings"

	"github.com/rawkode-academy/rawkode-cloud3/internal/infisical"
	"gopkg.in/yaml.v3"
)

// Config is the top-level cluster configuration loaded from YAML.
type Config struct {
	Environment string           `yaml:"environment"`
	Cluster     ClusterConfig    `yaml:"cluster"`
	Scaleway    ScalewayConfig   `yaml:"scaleway"`
	NodePools   []NodePoolConfig `yaml:"nodePools"`
	Infisical   InfisicalConfig  `yaml:"infisical"`
	Flux        FluxConfig       `yaml:"flux"`

	// Runtime credentials loaded from secret providers, never serialized.
	scwAccessKey       string
	scwSecretKey       string
	cloudflareAPIToken string
	cloudflareAccount  string
}

// ClusterConfig holds Kubernetes/Talos version info.
type ClusterConfig struct {
	TalosVersion      string `yaml:"talosVersion"`
	KubernetesVersion string `yaml:"kubernetesVersion"`
	TalosSchematic    string `yaml:"talosSchematic"`
	CiliumVersion     string `yaml:"ciliumVersion"`
	FluxVersion       string `yaml:"fluxVersion"`
	// ControlPlaneTaints controls whether control-plane NoSchedule taints are kept.
	// true keeps taints (isolated control-plane), false removes them (schedulable).
	ControlPlaneTaints *bool `yaml:"controlPlaneTaints"`
}

// ScalewayConfig holds Scaleway infrastructure settings (no credentials).
type ScalewayConfig struct {
	ProjectID      string `yaml:"projectId"`
	OrganizationID string `yaml:"organizationId"`
}

// NodePoolConfig describes a group of nodes sharing the same hardware/disk layout.
type NodePoolConfig struct {
	Name               string     `yaml:"name"`
	Type               string     `yaml:"type"`
	Zone               string     `yaml:"zone"`
	Size               int        `yaml:"size"`
	Offer              string     `yaml:"offer"`
	BillingCycle       string     `yaml:"billingCycle"`
	Disks              DiskConfig `yaml:"disks"`
	ReservedPrivateIPs []string   `yaml:"reservedPrivateIPs"`
}

const (
	NodeTypeControlPlane = "control-plane"
	NodeTypeWorker       = "worker"
)

const (
	defaultCiliumVersion = "v1.19.0"
	defaultFluxVersion   = "latest"
)

// DiskConfig holds disk device paths.
type DiskConfig struct {
	OS   string `yaml:"os"`
	Data string `yaml:"data"`
}

// InfisicalConfig holds secrets management settings.
type InfisicalConfig struct {
	SiteURL           string `yaml:"siteUrl"`
	ProjectID         string `yaml:"projectId"`
	Environment       string `yaml:"environment"`
	SecretPath        string `yaml:"secretPath"`
	NetbirdSecretPath string `yaml:"netbirdSecretPath"`
	NetbirdSecretKey  string `yaml:"netbirdSecretKey"`
	ClientID          string `yaml:"clientId"`
	ClientSecret      string `yaml:"clientSecret"`
}

// FluxConfig holds FluxCD configuration.
type FluxConfig struct {
	OCIRepo string `yaml:"ociRepo"`
}

const (
	infisicalSCWAccessKeyKey = "SCW_ACCESS_KEY"
	infisicalSCWSecretKeyKey = "SCW_SECRET_KEY"
)

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

// LoadRuntimeSecrets fetches operational credentials from Infisical.
func (c *Config) LoadRuntimeSecrets(ctx context.Context) error {
	if c == nil {
		return fmt.Errorf("config is required")
	}

	if strings.TrimSpace(c.Infisical.SiteURL) == "" {
		return fmt.Errorf("infisical.siteUrl is required")
	}
	if strings.TrimSpace(c.Infisical.ProjectID) == "" {
		return fmt.Errorf("infisical.projectId is required")
	}
	if strings.TrimSpace(c.Infisical.Environment) == "" {
		return fmt.Errorf("infisical.environment is required")
	}
	if strings.TrimSpace(c.Infisical.SecretPath) == "" {
		return fmt.Errorf("infisical.secretPath is required")
	}
	if strings.TrimSpace(c.Infisical.ClientID) == "" || strings.TrimSpace(c.Infisical.ClientSecret) == "" {
		return fmt.Errorf("INFISICAL_CLIENT_ID and INFISICAL_CLIENT_SECRET are required")
	}

	client, err := infisical.NewClient(ctx, c.Infisical.SiteURL, c.Infisical.ClientID, c.Infisical.ClientSecret)
	if err != nil {
		return fmt.Errorf("create infisical client: %w", err)
	}

	return c.LoadRuntimeSecretsWithClient(ctx, client)
}

// LoadRuntimeSecretsWithClient fetches operational credentials from Infisical using a caller-managed client.
func (c *Config) LoadRuntimeSecretsWithClient(ctx context.Context, client *infisical.Client) error {
	if c == nil {
		return fmt.Errorf("config is required")
	}
	if client == nil {
		return fmt.Errorf("infisical client is required")
	}

	if strings.TrimSpace(c.Infisical.ProjectID) == "" {
		return fmt.Errorf("infisical.projectId is required")
	}
	if strings.TrimSpace(c.Infisical.Environment) == "" {
		return fmt.Errorf("infisical.environment is required")
	}
	if strings.TrimSpace(c.Infisical.SecretPath) == "" {
		return fmt.Errorf("infisical.secretPath is required")
	}
	var err error
	c.scwAccessKey, err = requiredInfisicalSecret(
		ctx, client, c.Infisical.ProjectID, c.Infisical.Environment, c.Infisical.SecretPath, infisicalSCWAccessKeyKey,
	)
	if err != nil {
		return err
	}

	c.scwSecretKey, err = requiredInfisicalSecret(
		ctx, client, c.Infisical.ProjectID, c.Infisical.Environment, c.Infisical.SecretPath, infisicalSCWSecretKeyKey,
	)
	if err != nil {
		return err
	}

	return nil
}

func requiredInfisicalSecret(
	ctx context.Context,
	client *infisical.Client,
	projectID,
	environment,
	secretPath,
	key string,
) (string, error) {
	value, err := client.GetSecret(ctx, projectID, environment, secretPath, key)
	if err != nil {
		return "", fmt.Errorf("load %s from infisical path %s: %w", key, secretPath, err)
	}
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return "", fmt.Errorf("%s is empty in infisical path %s", key, secretPath)
	}

	return trimmed, nil
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

// ScalewayCredentials returns the Scaleway credentials loaded from Infisical.
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

// EffectiveType returns the normalized pool type, defaulting to control-plane.
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

// EffectiveZone returns the node pool zone value with surrounding whitespace removed.
func (p NodePoolConfig) EffectiveZone() string {
	return strings.TrimSpace(p.Zone)
}

// EffectiveCiliumVersion returns the Cilium version with a default fallback.
func (c ClusterConfig) EffectiveCiliumVersion() string {
	if version := strings.TrimSpace(c.CiliumVersion); version != "" {
		return version
	}

	return defaultCiliumVersion
}

// EffectiveFluxVersion returns the Flux version with a default fallback.
func (c ClusterConfig) EffectiveFluxVersion() string {
	if version := strings.TrimSpace(c.FluxVersion); version != "" {
		return version
	}

	return defaultFluxVersion
}

// EffectiveControlPlaneTaints returns whether control-plane NoSchedule taints should be kept.
// Defaults to true to preserve control-plane isolation when unset.
func (c ClusterConfig) EffectiveControlPlaneTaints() bool {
	if c.ControlPlaneTaints == nil {
		return true
	}

	return *c.ControlPlaneTaints
}

// ScalewayVPCName derives the shared VPC name from the cluster/environment name.
func (c *Config) ScalewayVPCName() (string, error) {
	if c == nil {
		return "", fmt.Errorf("config is required")
	}

	name := strings.TrimSpace(c.Environment)
	if name == "" {
		return "", fmt.Errorf("environment is required to derive scaleway vpc name")
	}

	return name, nil
}

// ScalewayPrivateNetworkName derives the shared private network name from the cluster name.
func (c *Config) ScalewayPrivateNetworkName() (string, error) {
	vpcName, err := c.ScalewayVPCName()
	if err != nil {
		return "", err
	}

	return vpcName + "-private", nil
}

// NormalizeNodePoolType normalizes user-facing type variants.
func NormalizeNodePoolType(value string) string {
	normalized := compactLower(value)
	switch normalized {
	case "", strings.ReplaceAll(NodeTypeControlPlane, "-", ""), "cp":
		return NodeTypeControlPlane
	case NodeTypeWorker:
		return NodeTypeWorker
	default:
		return ""
	}
}

func compactLower(value string) string {
	trimmed := strings.ToLower(strings.TrimSpace(value))
	return strings.NewReplacer("-", "", "_", "").Replace(trimmed)
}
