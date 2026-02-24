package cilium

import (
	"context"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"strings"

	ciliumdefaults "github.com/cilium/cilium/cilium-cli/defaults"
	ciliuminstall "github.com/cilium/cilium/cilium-cli/install"
	ciliumk8s "github.com/cilium/cilium/cilium-cli/k8s"
	ciliumstatus "github.com/cilium/cilium/cilium-cli/status"
	"helm.sh/helm/v3/pkg/cli/values"
)

// InstallParams holds parameters for Cilium CNI installation.
type InstallParams struct {
	Kubeconfig string
	Version    string // e.g. "1.17.0"
	Hubble     bool
}

const (
	ciliumNamespace   = "kube-system"
	ciliumReleaseName = "cilium"
)

// Install installs Cilium using the Cilium CLI Go implementation.
func Install(ctx context.Context, params InstallParams) error {
	if ctx == nil {
		ctx = context.Background()
	}

	slog.Info("installing cilium CNI", "version", params.Version, "hubble", params.Hubble)

	client, err := ciliumk8s.NewClient("", strings.TrimSpace(params.Kubeconfig), ciliumNamespace, "", nil)
	if err != nil {
		return fmt.Errorf("create cilium kubernetes client: %w", err)
	}

	installerParams := ciliuminstall.Parameters{
		Namespace:                ciliumNamespace,
		Writer:                   io.Discard,
		Version:                  strings.TrimSpace(params.Version),
		Wait:                     true,
		WaitDuration:             ciliumdefaults.StatusWaitDuration,
		DatapathMode:             ciliuminstall.DatapathNative,
		HelmRepository:           ciliumdefaults.HelmRepository,
		HelmMaxHistory:           ciliumdefaults.HelmMaxHistory,
		HelmReleaseName:          ciliumReleaseName,
		HelmResetThenReuseValues: true,
		HelmOpts: values.Options{
			Values: installValues(params.Hubble),
		},
	}

	installer, err := ciliuminstall.NewK8sInstaller(client, installerParams)
	if err != nil {
		return fmt.Errorf("create cilium installer: %w", err)
	}

	if err := installer.InstallWithHelm(ctx, client); err != nil {
		if !isReleaseExistsError(err) {
			return fmt.Errorf("cilium install failed: %w", err)
		}

		if err := installer.UpgradeWithHelm(ctx, client); err != nil {
			return fmt.Errorf("cilium upgrade failed: %w", err)
		}
	}

	slog.Info("cilium CNI installed successfully")
	return nil
}

// Status checks the Cilium CNI status.
func Status(ctx context.Context, kubeconfig string) error {
	if ctx == nil {
		ctx = context.Background()
	}

	client, err := ciliumk8s.NewClient("", strings.TrimSpace(kubeconfig), ciliumNamespace, "", nil)
	if err != nil {
		return fmt.Errorf("create cilium kubernetes client: %w", err)
	}

	collector, err := ciliumstatus.NewK8sStatusCollector(client, ciliumstatus.K8sStatusParameters{
		Namespace:       ciliumNamespace,
		Wait:            true,
		WaitDuration:    ciliumdefaults.StatusWaitDuration,
		IgnoreWarnings:  false,
		WorkerCount:     ciliumstatus.DefaultWorkerCount,
		Output:          ciliumstatus.OutputSummary,
		HelmReleaseName: ciliumReleaseName,
		Interactive:     false,
	})
	if err != nil {
		return fmt.Errorf("create cilium status collector: %w", err)
	}

	currentStatus, err := collector.Status(ctx)
	if err != nil {
		return fmt.Errorf("cilium status check failed: %w", err)
	}

	if currentStatus != nil && len(currentStatus.CollectionErrors) > 0 {
		return fmt.Errorf("cilium status check failed: %w", errors.Join(currentStatus.CollectionErrors...))
	}

	slog.Info("cilium status healthy")
	return nil
}

func installValues(hubble bool) []string {
	values := []string{
		"kubeProxyReplacement=true",
		"ipam.mode=kubernetes",
		"routingMode=native",
		"autoDirectNodeRoutes=true",
		"bpf.masquerade=true",
	}

	if hubble {
		values = append(values,
			"hubble.enabled=true",
			"hubble.relay.enabled=true",
			"hubble.ui.enabled=true",
		)
	}

	return values
}

func isReleaseExistsError(err error) bool {
	return strings.Contains(strings.ToLower(err.Error()), "cannot re-use a name that is still in use")
}
