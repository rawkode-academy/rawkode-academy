package scaleway

import (
	"context"
	"fmt"
	"log/slog"

	baremetal "github.com/scaleway/scaleway-sdk-go/api/baremetal/v1"
	"github.com/scaleway/scaleway-sdk-go/scw"
)

// DeleteServer removes a bare metal server from Scaleway.
// Used for cleanup on failure and for the `destroy` CLI command.
// Accepts either a *Client or *baremetal.API for backwards compatibility
// with the destroy command.
func DeleteServer(ctx context.Context, api *baremetal.API, serverID string, zone scw.Zone) error {
	_, err := api.DeleteServer(&baremetal.DeleteServerRequest{
		Zone:     zone,
		ServerID: serverID,
	})
	if err != nil {
		return fmt.Errorf("delete server %s: %w", serverID, err)
	}

	slog.Info("server deleted", "server_id", serverID, "zone", zone)
	return nil
}
