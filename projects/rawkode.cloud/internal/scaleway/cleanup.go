package scaleway

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"strings"

	baremetal "github.com/scaleway/scaleway-sdk-go/api/baremetal/v1"
	baremetalv3 "github.com/scaleway/scaleway-sdk-go/api/baremetal/v3"
	flexibleip "github.com/scaleway/scaleway-sdk-go/api/flexibleip/v1alpha1"
	"github.com/scaleway/scaleway-sdk-go/scw"
)

// DeleteServer removes a bare metal server from Scaleway.
// Used for rollback cleanup in failed provisioning runs.
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

// CleanupProvisionedServer detaches network resources and IPs before deleting
// the server. This is intended for rollback of interrupted provisioning runs.
func CleanupProvisionedServer(ctx context.Context, client *Client, serverID string, zone scw.Zone) error {
	if client == nil {
		return fmt.Errorf("scaleway client is required")
	}
	serverID = strings.TrimSpace(serverID)
	if serverID == "" {
		return fmt.Errorf("server ID is required")
	}
	if strings.TrimSpace(string(zone)) == "" {
		return fmt.Errorf("zone is required")
	}

	var errs []error
	if err := detachServerFlexibleIPs(ctx, client, serverID, zone); err != nil {
		errs = append(errs, err)
	}
	if err := detachServerPrivateNetworks(ctx, client, serverID, zone); err != nil {
		errs = append(errs, err)
	}
	if err := deleteServerIfExists(ctx, client.Baremetal, serverID, zone); err != nil {
		errs = append(errs, err)
	}

	if len(errs) > 0 {
		return errors.Join(errs...)
	}

	return nil
}

func detachServerFlexibleIPs(ctx context.Context, client *Client, serverID string, zone scw.Zone) error {
	if client.FlexibleIP == nil {
		return nil
	}

	resp, err := client.FlexibleIP.ListFlexibleIPs(&flexibleip.ListFlexibleIPsRequest{
		Zone:      zone,
		ServerIDs: []string{serverID},
	}, scw.WithAllPages(), scw.WithContext(ctx))
	if err != nil {
		if isScalewayNotFound(err) {
			return nil
		}
		return fmt.Errorf("list flexible IPs attached to server %s: %w", serverID, err)
	}

	var errs []error
	for _, fip := range resp.FlexibleIPs {
		if fip == nil || strings.TrimSpace(fip.ID) == "" {
			continue
		}

		_, err := client.FlexibleIP.DetachFlexibleIP(&flexibleip.DetachFlexibleIPRequest{
			Zone:    zone,
			FipsIDs: []string{fip.ID},
		}, scw.WithContext(ctx))
		if err != nil {
			if isScalewayNotFound(err) {
				continue
			}
			errs = append(errs, fmt.Errorf("detach flexible IP %s: %w", fip.ID, err))
			continue
		}

		slog.Info("detached flexible IP from server",
			"server_id", serverID,
			"fip_id", fip.ID,
			"zone", zone,
		)
	}

	if len(errs) > 0 {
		return errors.Join(errs...)
	}

	return nil
}

func detachServerPrivateNetworks(ctx context.Context, client *Client, serverID string, zone scw.Zone) error {
	if client.BaremetalPrivateNetworkV3 == nil {
		return nil
	}

	serverIDFilter := serverID
	resp, err := client.BaremetalPrivateNetworkV3.ListServerPrivateNetworks(&baremetalv3.PrivateNetworkAPIListServerPrivateNetworksRequest{
		Zone:     zone,
		ServerID: &serverIDFilter,
	}, scw.WithAllPages(), scw.WithContext(ctx))
	if err != nil {
		if isScalewayNotFound(err) {
			return nil
		}
		return fmt.Errorf("list private network attachments for server %s: %w", serverID, err)
	}

	var errs []error
	for _, mapping := range resp.ServerPrivateNetworks {
		if mapping == nil || strings.TrimSpace(mapping.PrivateNetworkID) == "" {
			continue
		}

		err := client.BaremetalPrivateNetworkV3.DeleteServerPrivateNetwork(&baremetalv3.PrivateNetworkAPIDeleteServerPrivateNetworkRequest{
			Zone:             zone,
			ServerID:         serverID,
			PrivateNetworkID: mapping.PrivateNetworkID,
		}, scw.WithContext(ctx))
		if err != nil {
			if isScalewayNotFound(err) {
				continue
			}
			errs = append(errs, fmt.Errorf("detach server private network %s: %w", mapping.PrivateNetworkID, err))
			continue
		}

		slog.Info("detached server from private network",
			"server_id", serverID,
			"private_network_id", mapping.PrivateNetworkID,
			"ipam_ip_ids", mapping.IpamIPIDs,
			"zone", zone,
		)
	}

	if len(errs) > 0 {
		return errors.Join(errs...)
	}

	return nil
}

func deleteServerIfExists(ctx context.Context, api *baremetal.API, serverID string, zone scw.Zone) error {
	err := DeleteServer(ctx, api, serverID, zone)
	if err == nil {
		return nil
	}
	if isScalewayNotFound(err) {
		slog.Info("server already deleted", "server_id", serverID, "zone", zone)
		return nil
	}
	return err
}

func isScalewayNotFound(err error) bool {
	if err == nil {
		return false
	}

	var resourceNotFound *scw.ResourceNotFoundError
	if errors.As(err, &resourceNotFound) {
		return true
	}

	var responseErr *scw.ResponseError
	if errors.As(err, &responseErr) && responseErr.StatusCode == http.StatusNotFound {
		return true
	}

	return false
}
