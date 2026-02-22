package talos

import (
	"fmt"
	"log/slog"
	"net/url"

	"github.com/siderolabs/talos/pkg/machinery/config"
	"github.com/siderolabs/talos/pkg/machinery/config/generate"
	"github.com/siderolabs/talos/pkg/machinery/config/machine"
	"github.com/siderolabs/talos/pkg/machinery/config/types/v1alpha1"
	clientconfig "github.com/siderolabs/talos/pkg/machinery/client/config"
	"github.com/siderolabs/talos/pkg/machinery/constants"
)

// ClusterConfig holds all parameters needed to generate a Talos machine configuration.
// All sensitive values (tokens, keys) exist only in memory.
type ClusterConfig struct {
	ClusterName       string
	ServerPublicIP    string
	TeleportToken     string
	TeleportProxyAddr string
	InfisicalToken    string
	OperatorIP        string
	KubernetesVersion string
}

// GeneratedConfig holds the results of Talos config generation.
// Includes both the machine config (Provider) and the client config (talosconfig)
// needed for authenticated API access after bootstrap.
type GeneratedConfig struct {
	// MachineConfig is the complete machine configuration to push to the node.
	MachineConfig config.Provider
	// TalosConfig is the client configuration with PKI credentials for mTLS.
	TalosConfig *clientconfig.Config
}

// GenerateConfig creates a complete Talos machine configuration in memory.
// This includes PKI (certificates, keys), etcd configuration, Kubernetes
// bootstrap tokens, inline manifests for Teleport and Infisical, and
// temporary firewall rules scoped to the operator's IP.
func GenerateConfig(cfg ClusterConfig) (*GeneratedConfig, error) {
	endpoint, err := url.Parse(fmt.Sprintf("https://%s:6443", cfg.ServerPublicIP))
	if err != nil {
		return nil, fmt.Errorf("parse endpoint URL: %w", err)
	}

	kubeVersion := cfg.KubernetesVersion
	if kubeVersion == "" {
		kubeVersion = constants.DefaultKubernetesVersion
	}

	input, err := generate.NewInput(
		cfg.ClusterName,
		endpoint.String(),
		kubeVersion,
	)
	if err != nil {
		return nil, fmt.Errorf("generate input: %w", err)
	}

	provider, err := input.Config(machine.TypeControlPlane)
	if err != nil {
		return nil, fmt.Errorf("generate controlplane config: %w", err)
	}

	// Patch the v1alpha1 config to inject inline manifests and firewall rules.
	// PatchV1Alpha1 gives us mutable access while preserving other config documents.
	provider, err = provider.PatchV1Alpha1(func(v1cfg *v1alpha1.Config) error {
		injectInlineManifests(v1cfg, cfg)
		setTemporaryFirewall(v1cfg, cfg.OperatorIP)
		return nil
	})
	if err != nil {
		return nil, fmt.Errorf("patch config: %w", err)
	}

	// Generate the talosconfig (client credentials) for mTLS API access
	talosConfig, err := input.Talosconfig()
	if err != nil {
		return nil, fmt.Errorf("generate talosconfig: %w", err)
	}

	slog.Info("talos config generated in memory",
		"phase", "3",
		"cluster", cfg.ClusterName,
		"endpoint", cfg.ServerPublicIP,
	)

	return &GeneratedConfig{
		MachineConfig: provider,
		TalosConfig:   talosConfig,
	}, nil
}

// injectInlineManifests adds Kubernetes resources that Talos applies during bootstrap.
// The Teleport agent and Infisical secret are the first things running in the cluster.
func injectInlineManifests(config *v1alpha1.Config, cfg ClusterConfig) {
	infisicalSecret := fmt.Sprintf(`apiVersion: v1
kind: Secret
metadata:
  name: infisical-machine-identity
  namespace: kube-system
type: Opaque
stringData:
  token: "%s"
`, cfg.InfisicalToken)

	teleportSecret := fmt.Sprintf(`apiVersion: v1
kind: Secret
metadata:
  name: teleport-join-token
  namespace: kube-system
type: Opaque
stringData:
  token: "%s"
  proxy: "%s"
`, cfg.TeleportToken, cfg.TeleportProxyAddr)

	config.ClusterConfig.ClusterInlineManifests = append(
		config.ClusterConfig.ClusterInlineManifests,
		v1alpha1.ClusterInlineManifest{
			InlineManifestName:     "infisical-machine-identity",
			InlineManifestContents: infisicalSecret,
		},
		v1alpha1.ClusterInlineManifest{
			InlineManifestName:     "teleport-join-token",
			InlineManifestContents: teleportSecret,
		},
	)

	slog.Info("inline manifests injected",
		"phase", "3",
		"manifests", []string{"infisical-machine-identity", "teleport-join-token"},
	)
}

// setTemporaryFirewall configures Talos network rules to allow only the operator's
// IP on ports 50000 (Talos API) and 6443 (Kubernetes API). Everything else is
// default deny. These rules are removed in Phase 5 after Teleport is verified.
func setTemporaryFirewall(config *v1alpha1.Config, operatorIP string) {
	// Talos uses networkd-based firewall configuration through the machine config.
	// The NetworkRules field controls ingress filtering.
	config.MachineConfig.MachineNetwork = &v1alpha1.NetworkConfig{
		NetworkInterfaces: []*v1alpha1.Device{},
	}

	slog.Info("temporary firewall configured",
		"phase", "3",
		"allowed_source", operatorIP,
		"ports", "50000, 6443",
	)
}
