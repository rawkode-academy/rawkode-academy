package teleport

import (
	"context"
	"fmt"
	"log/slog"
	"time"
)

// WaitForAgent polls until a Kubernetes agent with the expected cluster name registers.
func WaitForAgent(ctx context.Context, proxyAddr, clusterName string, timeout time.Duration) error {
	clt, err := newClient(ctx, proxyAddr)
	if err != nil {
		return fmt.Errorf("teleport client: %w", err)
	}
	defer clt.Close()

	ticker := time.NewTicker(15 * time.Second)
	defer ticker.Stop()
	deadline := time.After(timeout)

	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-deadline:
			return fmt.Errorf(
				"teleport agent for cluster %q not detected within %s",
				clusterName, timeout,
			)
		case <-ticker.C:
			servers, err := clt.GetKubernetesServers(ctx)
			if err != nil {
				slog.Warn("teleport query failed, retrying", "error", err)
				continue
			}

			for _, server := range servers {
				if server.GetName() == clusterName {
					slog.Info("teleport agent confirmed", "cluster", clusterName)
					return nil
				}
			}
			slog.Debug("waiting for teleport agent", "cluster", clusterName)
		}
	}
}
