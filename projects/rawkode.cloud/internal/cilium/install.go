package cilium

import (
	"context"
	"fmt"
	"log/slog"
	"os/exec"
)

// InstallParams holds parameters for Cilium CNI installation.
type InstallParams struct {
	Kubeconfig string
	Version    string // e.g. "1.17.0"
	Hubble     bool
}

// Install installs Cilium CNI into the cluster using the cilium CLI.
// Requires the cilium CLI binary to be available in PATH.
// In future, this can be replaced with an embedded Go library.
func Install(ctx context.Context, params InstallParams) error {
	args := []string{
		"install",
		"--wait",
	}

	if params.Version != "" {
		args = append(args, "--version", params.Version)
	}

	// Configure for bare metal with no kube-proxy
	args = append(args,
		"--set", "kubeProxyReplacement=true",
		"--set", "ipam.mode=kubernetes",
		"--set", "routingMode=native",
		"--set", "autoDirectNodeRoutes=true",
		"--set", "bpf.masquerade=true",
	)

	if params.Hubble {
		args = append(args,
			"--set", "hubble.enabled=true",
			"--set", "hubble.relay.enabled=true",
			"--set", "hubble.ui.enabled=true",
		)
	}

	if params.Kubeconfig != "" {
		args = append(args, "--kubeconfig", params.Kubeconfig)
	}

	slog.Info("installing cilium CNI", "version", params.Version, "hubble", params.Hubble)

	cmd := exec.CommandContext(ctx, "cilium", args...)
	output, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("cilium install failed: %w\noutput: %s", err, string(output))
	}

	slog.Info("cilium CNI installed successfully")
	return nil
}

// Status checks the Cilium CNI status.
func Status(ctx context.Context, kubeconfig string) error {
	args := []string{"status", "--wait"}
	if kubeconfig != "" {
		args = append(args, "--kubeconfig", kubeconfig)
	}

	cmd := exec.CommandContext(ctx, "cilium", args...)
	output, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("cilium status check failed: %w\noutput: %s", err, string(output))
	}

	slog.Info("cilium status healthy")
	return nil
}

// IsInstalled checks if the cilium CLI binary is available.
func IsInstalled() bool {
	_, err := exec.LookPath("cilium")
	return err == nil
}
