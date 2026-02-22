package talos

import (
	"fmt"
	"log/slog"
	"net/netip"
	"net/url"

	coreconfig "github.com/siderolabs/talos/pkg/machinery/config"
	"github.com/siderolabs/talos/pkg/machinery/config/config"
	"github.com/siderolabs/talos/pkg/machinery/config/container"
	"github.com/siderolabs/talos/pkg/machinery/config/generate"
	"github.com/siderolabs/talos/pkg/machinery/config/machine"
	"github.com/siderolabs/talos/pkg/machinery/config/types/network"
	"github.com/siderolabs/talos/pkg/machinery/config/types/v1alpha1"
	clientconfig "github.com/siderolabs/talos/pkg/machinery/client/config"
	"github.com/siderolabs/talos/pkg/machinery/constants"
	"github.com/siderolabs/talos/pkg/machinery/nethelpers"
)

// ClusterConfig holds all parameters needed to generate a Talos machine configuration.
// All sensitive values (tokens, keys) exist only in memory.
type ClusterConfig struct {
	ClusterName       string
	ServerPublicIP    string
	TeleportToken     string
	TeleportProxyAddr string
	OperatorIP        string
	KubernetesVersion string

	// Infisical cluster identity — injected directly as long-lived credentials.
	// The cluster uses these to authenticate with Infisical at runtime.
	InfisicalClusterClientID     string
	InfisicalClusterClientSecret string
}

// GeneratedConfig holds the results of Talos config generation.
// Includes both the machine config (Provider) and the client config (talosconfig)
// needed for authenticated API access after bootstrap.
type GeneratedConfig struct {
	// MachineConfig is the complete machine configuration to push to the node.
	// It includes temporary ingress firewall rules scoped to the operator's IP.
	MachineConfig coreconfig.Provider
	// LockdownConfigBytes is the serialised machine config without the temporary
	// firewall rules. Applied in Phase 6 after Teleport connectivity is confirmed.
	LockdownConfigBytes []byte
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

	// Inject inline manifests into the v1alpha1 config.
	provider, err = provider.PatchV1Alpha1(func(v1cfg *v1alpha1.Config) error {
		injectInlineManifests(v1cfg, cfg)
		return nil
	})
	if err != nil {
		return nil, fmt.Errorf("patch config: %w", err)
	}

	// Serialize the config without firewall rules for use during lockdown (Phase 6).
	lockdownBytes, err := provider.Bytes()
	if err != nil {
		return nil, fmt.Errorf("serialize lockdown config: %w", err)
	}

	// Build the full config with temporary ingress firewall rules added as
	// separate NetworkRuleConfig documents. These are removed in Phase 6
	// by re-applying the lockdown bytes (which contain only the v1alpha1 config).
	fullProvider, err := buildProviderWithFirewall(provider, cfg.OperatorIP)
	if err != nil {
		return nil, fmt.Errorf("add firewall rules: %w", err)
	}

	// Generate the talosconfig (client credentials) for mTLS API access
	talosConfig, err := input.Talosconfig()
	if err != nil {
		return nil, fmt.Errorf("generate talosconfig: %w", err)
	}

	slog.Info("talos config generated in memory",
		"phase", "4",
		"cluster", cfg.ClusterName,
		"endpoint", cfg.ServerPublicIP,
	)

	return &GeneratedConfig{
		MachineConfig:       fullProvider,
		LockdownConfigBytes: lockdownBytes,
		TalosConfig:         talosConfig,
	}, nil
}

// injectInlineManifests adds Kubernetes resources that Talos applies during bootstrap.
// The Teleport agent and Infisical secret are the first things running in the cluster.
func injectInlineManifests(config *v1alpha1.Config, cfg ClusterConfig) {
	var manifests []v1alpha1.ClusterInlineManifest

	// Inject Infisical machine identity with long-lived credentials.
	// The cluster authenticates directly with these — no short-lived bootstrap
	// token needed since the CLI controls the entire provisioning flow.
	if cfg.InfisicalClusterClientID != "" && cfg.InfisicalClusterClientSecret != "" {
		infisicalSecret := fmt.Sprintf(`apiVersion: v1
kind: Secret
metadata:
  name: infisical-machine-identity
  namespace: kube-system
type: Opaque
stringData:
  clientId: "%s"
  clientSecret: "%s"
`, cfg.InfisicalClusterClientID, cfg.InfisicalClusterClientSecret)

		manifests = append(manifests, v1alpha1.ClusterInlineManifest{
			InlineManifestName:     "infisical-machine-identity",
			InlineManifestContents: infisicalSecret,
		})
	}

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

	manifests = append(manifests, v1alpha1.ClusterInlineManifest{
		InlineManifestName:     "teleport-join-token",
		InlineManifestContents: teleportSecret,
	})

	config.ClusterConfig.ClusterInlineManifests = append(
		config.ClusterConfig.ClusterInlineManifests,
		manifests...,
	)

	manifestNames := make([]string, len(manifests))
	for i, m := range manifests {
		manifestNames[i] = m.InlineManifestName
	}

	slog.Info("inline manifests injected",
		"phase", "4",
		"manifests", manifestNames,
	)
}

// buildProviderWithFirewall creates a new config container that includes the
// base provider documents plus two NetworkRuleConfig documents that restrict
// ingress on the Talos API port (50000) and Kubernetes API port (6443) to the
// operator's IP only. All other sources are implicitly denied by Talos's
// default-deny firewall behaviour when rules are present.
func buildProviderWithFirewall(base coreconfig.Provider, operatorIP string) (coreconfig.Provider, error) {
	operatorPrefix, err := netip.ParsePrefix(operatorIP + "/32")
	if err != nil {
		return nil, fmt.Errorf("parse operator IP as CIDR: %w", err)
	}

	talosRule := network.NewRuleConfigV1Alpha1()
	talosRule.MetaName = "operator-talos-api"
	talosRule.PortSelector.Protocol = nethelpers.ProtocolTCP
	talosRule.PortSelector.Ports = network.PortRanges{{Lo: 50000, Hi: 50000}}
	talosRule.Ingress = network.IngressConfig{{Subnet: operatorPrefix}}

	kubeRule := network.NewRuleConfigV1Alpha1()
	kubeRule.MetaName = "operator-kube-api"
	kubeRule.PortSelector.Protocol = nethelpers.ProtocolTCP
	kubeRule.PortSelector.Ports = network.PortRanges{{Lo: 6443, Hi: 6443}}
	kubeRule.Ingress = network.IngressConfig{{Subnet: operatorPrefix}}

	docs := base.Documents()
	allDocs := make([]config.Document, 0, len(docs)+2)
	allDocs = append(allDocs, docs...)
	allDocs = append(allDocs, talosRule, kubeRule)

	provider, err := container.New(allDocs...)
	if err != nil {
		return nil, fmt.Errorf("build config container with firewall rules: %w", err)
	}

	slog.Info("temporary firewall rules added",
		"phase", "4",
		"allowed_source", operatorIP,
		"ports", "50000/TCP, 6443/TCP",
	)

	return provider, nil
}
