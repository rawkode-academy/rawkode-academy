package scaleway

import (
	"context"
	"fmt"
	"log/slog"
	"math/rand"
	"time"

	baremetal "github.com/scaleway/scaleway-sdk-go/api/baremetal/v1"
	"github.com/scaleway/scaleway-sdk-go/scw"
)

// ProvisionParams holds all parameters for creating a server with OS install.
type ProvisionParams struct {
	OfferID      string
	Zone         scw.Zone
	OSID         string
	TalosVersion string
}

// OrderServer creates a new bare metal server with Scaleway and triggers OS
// installation with a Talos pivot cloud-init script in a single API call.
// This eliminates the need to wait for hardware allocation before triggering
// install — Scaleway starts the OS install automatically once hardware is ready.
func OrderServer(ctx context.Context, api *baremetal.API, params ProvisionParams) (*baremetal.Server, error) {
	cloudInit := BuildCloudInit(params.TalosVersion)
	cloudInitBytes := []byte(cloudInit)

	suffix := rand.Intn(99999) //nolint:gosec // non-cryptographic, used only for unique naming
	server, err := api.CreateServer(&baremetal.CreateServerRequest{
		Zone:        params.Zone,
		OfferID:     params.OfferID,
		Name:        fmt.Sprintf("rawkode-%s-%05d", time.Now().Format("20060102-150405"), suffix),
		Description: "Provisioned by rawkode-cloud CLI",
		Install: &baremetal.CreateServerRequestInstall{
			OsID:     params.OSID,
			Hostname: "talos-pivot",
		},
		UserData: &cloudInitBytes,
	})
	if err != nil {
		return nil, fmt.Errorf("create server: %w", err)
	}

	slog.Info("server ordered with OS install",
		"phase", "1",
		"server_id", server.ID,
		"offer", params.OfferID,
		"os", params.OSID,
		"talos_version", params.TalosVersion,
		"zone", params.Zone,
	)

	return server, nil
}

// WaitForReady polls Scaleway until the server reaches a terminal state.
// With combined create+install, this waits for both hardware allocation AND
// OS installation to complete. Bare metal provisioning can take 15-30 minutes.
func WaitForReady(ctx context.Context, api *baremetal.API, serverID string, zone scw.Zone) (*baremetal.Server, error) {
	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()

	timeout := time.After(45 * time.Minute)

	for {
		select {
		case <-ctx.Done():
			return nil, ctx.Err()
		case <-timeout:
			return nil, fmt.Errorf("server %s did not become ready within 45 minutes", serverID)
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
if ! ( cd /tmp && grep "metal-amd64.raw.xz" sha256sum.txt | sha256sum -c - ); then
    echo "FATAL: Checksum verification failed. Aborting."
    exit 1
fi

# Step 3: Decompress
echo "Decompressing..."
xz -d /tmp/talos.raw.xz

# Step 4: Detect the boot disk to avoid writing to the wrong device
echo "Detecting boot disk..."
ROOT_SOURCE=$(findmnt -n -o SOURCE / 2>/dev/null || echo "")
if [ -b "$ROOT_SOURCE" ]; then
    DISK_NAME=$(lsblk -no PKNAME "$ROOT_SOURCE" 2>/dev/null || basename "$ROOT_SOURCE")
    TARGET_DISK="/dev/${DISK_NAME}"
else
    TARGET_DISK="/dev/sda"
fi
echo "Writing Talos to ${TARGET_DISK}..."
dd if=/tmp/talos.raw of="${TARGET_DISK}" bs=4M status=progress
sync

echo "Pivot complete. Rebooting into Talos at $(date)"
reboot
`, talosVersion, imageURL, checksumURL)
}
