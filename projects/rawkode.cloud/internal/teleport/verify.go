package teleport

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"time"
)

// kubeServersResponse represents the Teleport API response for listing
// Kubernetes servers.
type kubeServersResponse struct {
	Items []kubeServer `json:"items"`
}

type kubeServer struct {
	Name   string `json:"name"`
	HostID string `json:"host_id"`
}

// WaitForAgent polls the Teleport cluster until a Kubernetes agent with the
// expected cluster name has registered. This confirms the zero-trust access
// path is functional before we lock the firewall.
//
// Uses the kube_servers endpoint specifically — a healthy proxy tells you nothing
// about whether your specific agent has registered.
func WaitForAgent(ctx context.Context, proxyAddr, clusterName string, timeout time.Duration) error {
	client, err := NewClient(proxyAddr)
	if err != nil {
		return fmt.Errorf("teleport client: %w", err)
	}

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
			respBody, err := client.doRequest(ctx, "GET", "kube_servers", nil)
			if err != nil {
				slog.Warn("teleport query failed, retrying", "phase", "5", "error", err)
				continue
			}

			var resp kubeServersResponse
			if err := json.Unmarshal(respBody, &resp); err != nil {
				slog.Warn("failed to parse teleport response, retrying", "phase", "5", "error", err)
				continue
			}

			for _, server := range resp.Items {
				if server.Name == clusterName {
					slog.Info("teleport agent confirmed",
						"phase", "5",
						"cluster", clusterName,
						"host_id", server.HostID,
					)
					return nil
				}
			}

			slog.Debug("waiting for teleport agent", "phase", "5", "cluster", clusterName)
		}
	}
}
