package talos

import (
	"context"
	"fmt"
	"strings"
	"time"

	talosconfig "github.com/siderolabs/talos/pkg/machinery/config"
	talosgenerate "github.com/siderolabs/talos/pkg/machinery/config/generate"
	talossecrets "github.com/siderolabs/talos/pkg/machinery/config/generate/secrets"
	"github.com/siderolabs/talos/pkg/machinery/config/machine"
	v1alpha1 "github.com/siderolabs/talos/pkg/machinery/config/types/v1alpha1"
	talosconstants "github.com/siderolabs/talos/pkg/machinery/constants"
	"gopkg.in/yaml.v3"
)

// GenConfigResult contains generated Talos assets from Talos Go APIs.
type GenConfigResult struct {
	ControlPlane []byte
	Worker       []byte
	Talosconfig  []byte
}

// GenConfigParams holds generation inputs for Talos configuration generation.
type GenConfigParams struct {
	ClusterName        string
	Endpoint           string
	TalosVersion       string
	TalosSchematic     string
	KubernetesVersion  string
	InstallDisk        string
	ControlPlaneTaints bool
	SecretsYAML        []byte
}

// GenerateSecretsYAML generates a Talos secrets document via Talos Go APIs.
func GenerateSecretsYAML(ctx context.Context) ([]byte, error) {
	if err := ctx.Err(); err != nil {
		return nil, err
	}

	bundle, err := talossecrets.NewBundle(talossecrets.NewFixedClock(time.Now().UTC()), talosconfig.TalosVersionCurrent)
	if err != nil {
		return nil, fmt.Errorf("generate talos secrets bundle: %w", err)
	}

	output, err := yaml.Marshal(bundle)
	if err != nil {
		return nil, fmt.Errorf("marshal talos secrets: %w", err)
	}
	if len(strings.TrimSpace(string(output))) == 0 {
		return nil, fmt.Errorf("generated Talos secrets YAML is empty")
	}

	return output, nil
}

// GenerateConfig renders controlplane/worker config + talosconfig using a persisted secrets document.
func GenerateConfig(ctx context.Context, params GenConfigParams) (*GenConfigResult, error) {
	if err := ctx.Err(); err != nil {
		return nil, err
	}
	if strings.TrimSpace(params.ClusterName) == "" {
		return nil, fmt.Errorf("cluster name is required")
	}
	if strings.TrimSpace(params.Endpoint) == "" {
		return nil, fmt.Errorf("endpoint is required")
	}
	if len(params.SecretsYAML) == 0 {
		return nil, fmt.Errorf("secrets YAML is required")
	}

	secretsBundle := &talossecrets.Bundle{}
	if err := yaml.Unmarshal(params.SecretsYAML, secretsBundle); err != nil {
		return nil, fmt.Errorf("decode secrets YAML: %w", err)
	}
	if secretsBundle.Clock == nil {
		secretsBundle.Clock = talossecrets.NewClock()
	}
	if secretsBundle.Cluster == nil || secretsBundle.Certs == nil || secretsBundle.Secrets == nil || secretsBundle.TrustdInfo == nil {
		return nil, fmt.Errorf("secrets YAML is incomplete")
	}

	versionContract := talosconfig.TalosVersionCurrent
	if version := strings.TrimSpace(params.TalosVersion); version != "" {
		parsed, err := talosconfig.ParseContractFromVersion(version)
		if err != nil {
			return nil, fmt.Errorf("parse Talos version %q: %w", version, err)
		}
		versionContract = parsed
	}

	kubernetesVersion := normalizeKubernetesVersion(params.KubernetesVersion)
	if kubernetesVersion == "" {
		kubernetesVersion = talosconstants.DefaultKubernetesVersion
	}
	installDisk := resolveInstallDisk(params.InstallDisk)

	_, talosEndpoint, err := normalizeTalosEndpoint(params.Endpoint)
	if err != nil {
		return nil, err
	}

	generateOpts := []talosgenerate.Option{
		talosgenerate.WithVersionContract(versionContract),
		talosgenerate.WithSecretsBundle(secretsBundle),
		talosgenerate.WithEndpointList([]string{talosEndpoint}),
		talosgenerate.WithClusterCNIConfig(&v1alpha1.CNIConfig{CNIName: "none"}),
		talosgenerate.WithAllowSchedulingOnControlPlanes(allowSchedulingOnControlPlanes(params.ControlPlaneTaints)),
		talosgenerate.WithInstallDisk(installDisk),
	}

	if installImage := buildInstallerImage(params.TalosVersion, params.TalosSchematic); installImage != "" {
		generateOpts = append(generateOpts, talosgenerate.WithInstallImage(installImage))
	}

	input, err := talosgenerate.NewInput(
		strings.TrimSpace(params.ClusterName),
		normalizeClusterEndpoint(params.Endpoint),
		kubernetesVersion,
		generateOpts...,
	)
	if err != nil {
		return nil, fmt.Errorf("generate talos input: %w", err)
	}

	controlPlaneConfig, err := input.Config(machine.TypeControlPlane)
	if err != nil {
		return nil, fmt.Errorf("generate controlplane config: %w", err)
	}
	controlPlane, err := controlPlaneConfig.Bytes()
	if err != nil {
		return nil, fmt.Errorf("encode controlplane config: %w", err)
	}

	workerConfig, err := input.Config(machine.TypeWorker)
	if err != nil {
		return nil, fmt.Errorf("generate worker config: %w", err)
	}
	worker, err := workerConfig.Bytes()
	if err != nil {
		return nil, fmt.Errorf("encode worker config: %w", err)
	}

	clientConfig, err := input.Talosconfig()
	if err != nil {
		return nil, fmt.Errorf("generate talosconfig: %w", err)
	}
	talosconfigBytes, err := clientConfig.Bytes()
	if err != nil {
		return nil, fmt.Errorf("encode talosconfig: %w", err)
	}

	return &GenConfigResult{
		ControlPlane: controlPlane,
		Worker:       worker,
		Talosconfig:  talosconfigBytes,
	}, nil
}

func buildInstallerImage(talosVersion, talosSchematic string) string {
	talosVersion = strings.TrimSpace(talosVersion)
	talosSchematic = strings.TrimSpace(talosSchematic)
	if talosVersion == "" {
		return ""
	}

	if talosSchematic != "" {
		return fmt.Sprintf("factory.talos.dev/installer/%s/%s", talosSchematic, talosVersion)
	}

	return fmt.Sprintf("ghcr.io/siderolabs/installer:%s", talosVersion)
}

func normalizeKubernetesVersion(version string) string {
	return strings.TrimPrefix(strings.TrimSpace(version), "v")
}

func normalizeClusterEndpoint(endpoint string) string {
	trimmed := strings.TrimSpace(endpoint)
	if strings.HasPrefix(trimmed, "http://") || strings.HasPrefix(trimmed, "https://") {
		return trimmed
	}
	if strings.Contains(trimmed, ":") {
		return "https://" + trimmed
	}
	return "https://" + trimmed + ":6443"
}

func resolveInstallDisk(configuredDisk string) string {
	if disk := strings.TrimSpace(configuredDisk); disk != "" {
		return disk
	}

	return defaultOSDisk
}

func allowSchedulingOnControlPlanes(controlPlaneTaints bool) bool {
	return !controlPlaneTaints
}
