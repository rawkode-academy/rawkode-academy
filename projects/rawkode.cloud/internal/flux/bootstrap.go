package flux

import (
	"context"
	"fmt"
	"log/slog"
	"os/exec"
	"strings"
)

// BootstrapParams holds parameters for FluxCD bootstrap.
type BootstrapParams struct {
	Kubeconfig string
	OCIRepo    string // OCI repository URL (e.g. oci://ghcr.io/rawkode-academy/flux)
	Branch     string
}

// Bootstrap installs FluxCD into the cluster and configures it to sync from an OCI repository.
// Requires the flux CLI binary to be available in PATH.
func Bootstrap(ctx context.Context, params BootstrapParams) error {
	if params.OCIRepo == "" {
		return fmt.Errorf("flux OCI repo URL is required")
	}

	if !IsInstalled() {
		return fmt.Errorf("flux CLI not found in PATH; install it first: https://fluxcd.io/flux/installation/")
	}

	// First, install Flux components
	installArgs := []string{"install"}
	if params.Kubeconfig != "" {
		installArgs = append(installArgs, "--kubeconfig", params.Kubeconfig)
	}

	slog.Info("installing flux components")
	cmd := exec.CommandContext(ctx, "flux", installArgs...)
	output, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("flux install failed: %w\noutput: %s", err, string(output))
	}

	// Create the OCI source
	ociArgs := []string{
		"create", "source", "oci", "cluster-config",
		"--url", params.OCIRepo,
		"--interval", "5m",
	}
	if params.Kubeconfig != "" {
		ociArgs = append(ociArgs, "--kubeconfig", params.Kubeconfig)
	}

	slog.Info("creating flux OCI source", "repo", params.OCIRepo)
	cmd = exec.CommandContext(ctx, "flux", ociArgs...)
	output, err = cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("flux create source oci failed: %w\noutput: %s", err, string(output))
	}

	// Create the Kustomization to apply from the OCI source
	ksArgs := []string{
		"create", "kustomization", "cluster-config",
		"--source", "OCIRepository/cluster-config",
		"--path", "./",
		"--prune", "true",
		"--interval", "5m",
		"--wait",
	}
	if params.Kubeconfig != "" {
		ksArgs = append(ksArgs, "--kubeconfig", params.Kubeconfig)
	}

	slog.Info("creating flux kustomization")
	cmd = exec.CommandContext(ctx, "flux", ksArgs...)
	output, err = cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("flux create kustomization failed: %w\noutput: %s", err, string(output))
	}

	slog.Info("fluxcd bootstrap complete", "oci_repo", params.OCIRepo)
	return nil
}

// Status checks FluxCD reconciliation status.
func Status(ctx context.Context, kubeconfig string) error {
	args := []string{"get", "all"}
	if kubeconfig != "" {
		args = append(args, "--kubeconfig", kubeconfig)
	}

	cmd := exec.CommandContext(ctx, "flux", args...)
	output, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("flux status check failed: %w\noutput: %s", err, string(output))
	}

	// Check for "False" in Ready conditions
	if strings.Contains(string(output), "False") {
		return fmt.Errorf("flux has unhealthy resources:\n%s", string(output))
	}

	slog.Info("fluxcd status healthy")
	return nil
}

// IsInstalled checks if the flux CLI binary is available.
func IsInstalled() bool {
	_, err := exec.LookPath("flux")
	return err == nil
}
