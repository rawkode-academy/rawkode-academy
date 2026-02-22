package teleport

import (
	"context"
	"fmt"
	"log/slog"
	"time"
)

// WaitForAgent polls the Teleport cluster until a Kubernetes agent with the
// expected cluster name has registered. This confirms the zero-trust access
// path is functional before we lock the firewall.
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
				"teleport agent for cluster %q not detected within %s — "+
					"DO NOT lock the firewall. Debug the Teleport agent first. "+
					"Check: is the join token correct? Is the proxy address reachable "+
					"from the server? Is the Teleport pod running?",
				clusterName, timeout,
			)
		case <-ticker.C:
			servers, err := clt.GetKubernetesServers(ctx)
			if err != nil {
				slog.Warn("teleport query failed, retrying", "phase", "6", "error", err)
				continue
			}

			for _, server := range servers {
				if server.GetName() == clusterName {
					slog.Info("teleport agent confirmed",
						"phase", "6",
						"cluster", clusterName,
					)
					return nil
				}
			}

			slog.Debug("waiting for teleport agent", "phase", "6", "cluster", clusterName)
		}
	}
}
