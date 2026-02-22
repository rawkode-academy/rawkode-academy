package scaleway

import (
	"context"
	"fmt"
	"log/slog"
	"strings"
	"time"

	baremetal "github.com/scaleway/scaleway-sdk-go/api/baremetal/v1"
	"github.com/scaleway/scaleway-sdk-go/scw"
)

// OrderServer creates a new bare metal server with Scaleway.
// The server name includes a timestamp for easy identification of failed runs.
func OrderServer(ctx context.Context, api *baremetal.API, offerID string, zone scw.Zone) (*baremetal.Server, error) {
	server, err := api.CreateServer(&baremetal.CreateServerRequest{
		Zone:        zone,
		OfferID:     offerID,
		Name:        fmt.Sprintf("rawkode-%s", time.Now().Format("20060102-150405")),
		Description: "Provisioned by rawkode-cloud CLI",
	})
	if err != nil {
		return nil, fmt.Errorf("create server: %w", err)
	}

	slog.Info("server ordered",
		"phase", "1",
		"server_id", server.ID,
		"offer", offerID,
		"zone", zone,
	)

	return server, nil
}

// WaitForReady polls Scaleway until the server reaches a terminal state.
// Bare metal provisioning can take 15-30 minutes — this is physical hardware allocation.
// Poll errors are logged but not fatal; only terminal states (error, locked) cause failure.
func WaitForReady(ctx context.Context, api *baremetal.API, serverID string, zone scw.Zone) (*baremetal.Server, error) {
	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()

	timeout := time.After(30 * time.Minute)

	for {
		select {
		case <-ctx.Done():
			return nil, ctx.Err()
		case <-timeout:
			return nil, fmt.Errorf("server %s did not become ready within 30 minutes", serverID)
		case <-ticker.C:
			server, err := api.GetServer(&baremetal.GetServerRequest{
				Zone:     zone,
				ServerID: serverID,
			})
			if err != nil {
				slog.Warn("poll failed, retrying", "phase", "1", "error", err)
				continue
			}

			slog.Info("server status", "phase", "1", "status", server.Status, "server_id", serverID)

			switch server.Status {
			case baremetal.ServerStatusReady:
				return server, nil
			case baremetal.ServerStatusError:
				return nil, fmt.Errorf("server entered error state: %s", serverID)
			case baremetal.ServerStatusLocked:
				return nil, fmt.Errorf("server is locked (billing issue?): %s", serverID)
			default:
				continue
			}
		}
	}
}

// BuildCloudInit generates a bash script that downloads a Talos Linux image,
// verifies its checksum, and writes it to disk. On reboot, the machine boots
// into Talos instead of Ubuntu. This is the OS pivot — a one-way door.
func BuildCloudInit(talosVersion string) string {
	imageURL := fmt.Sprintf(
		"https://github.com/siderolabs/talos/releases/download/%s/metal-amd64.raw.xz",
		talosVersion,
	)
	checksumURL := fmt.Sprintf(
		"https://github.com/siderolabs/talos/releases/download/%s/sha256sum.txt",
		talosVersion,
	)

	return fmt.Sprintf(`#!/bin/bash
set -euo pipefail

# Log everything for debugging via Scaleway's console output
exec > /var/log/talos-pivot.log 2>&1
echo "Starting Talos pivot at $(date)"

# Step 1: Download the Talos disk image
echo "Downloading Talos %s..."
wget --retry-connrefused --waitretry=5 --tries=5 \
    -O /tmp/talos.raw.xz "%s"

# Step 2: Download and verify checksum
# A corrupted image + dd = a bricked machine with no recovery
echo "Verifying checksum..."
wget --retry-connrefused --waitretry=5 --tries=5 \
    -O /tmp/sha256sum.txt "%s"
cd /tmp && grep "metal-amd64.raw.xz" sha256sum.txt | sha256sum -c -
if [ $? -ne 0 ]; then
    echo "FATAL: Checksum verification failed. Aborting."
    exit 1
fi

# Step 3: Decompress
echo "Decompressing..."
xz -d /tmp/talos.raw.xz

# Step 4: Write to disk — point of no return
echo "Writing Talos to /dev/sda..."
dd if=/tmp/talos.raw of=/dev/sda bs=4M status=progress
sync

echo "Pivot complete. Rebooting into Talos at $(date)"
reboot
`, talosVersion, imageURL, checksumURL)
}

// InstallOS triggers a Scaleway OS installation with a cloud-init script
// that pivots the machine from Ubuntu to Talos Linux.
func InstallOS(ctx context.Context, api *baremetal.API, serverID string, zone scw.Zone, osID string, talosVersion string) error {
	cloudInit := BuildCloudInit(talosVersion)

	hostname := "talos-pivot"

	_, err := api.InstallServer(&baremetal.InstallServerRequest{
		Zone:     zone,
		ServerID: serverID,
		OsID:     osID,
		Hostname: hostname,
		UserData: &scw.File{
			Name:        "cloud-init",
			ContentType: "text/x-shellscript",
			Content:     strings.NewReader(cloudInit),
		},
	})
	if err != nil {
		return fmt.Errorf("install OS: %w", err)
	}

	slog.Info("OS installation started with Talos pivot cloud-init",
		"phase", "2",
		"server_id", serverID,
		"talos_version", talosVersion,
	)

	return nil
}

// WaitForInstall polls until the server installation completes.
func WaitForInstall(ctx context.Context, api *baremetal.API, serverID string, zone scw.Zone) error {
	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()

	timeout := time.After(30 * time.Minute)

	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-timeout:
			return fmt.Errorf("server %s install did not complete within 30 minutes", serverID)
		case <-ticker.C:
			server, err := api.GetServer(&baremetal.GetServerRequest{
				Zone:     zone,
				ServerID: serverID,
			})
			if err != nil {
				slog.Warn("install poll failed, retrying", "phase", "2", "error", err)
				continue
			}

			slog.Info("install status", "phase", "2", "status", server.Status, "server_id", serverID)

			switch server.Status {
			case baremetal.ServerStatusReady:
				return nil
			case baremetal.ServerStatusError:
				return fmt.Errorf("server installation failed: %s", serverID)
			default:
				continue
			}
		}
	}
}
