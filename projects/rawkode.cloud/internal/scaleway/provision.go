package scaleway

import (
	"context"
	"encoding/base64"
	"fmt"
	"log/slog"
	"math/rand"
	"strings"
	"time"

	baremetal "github.com/scaleway/scaleway-sdk-go/api/baremetal/v1"
	iam "github.com/scaleway/scaleway-sdk-go/api/iam/v1alpha1"
	"github.com/scaleway/scaleway-sdk-go/scw"
)

// ProvisionParams holds all parameters for creating a server with OS install.
type ProvisionParams struct {
	OfferID        string
	Zone           scw.Zone
	OSID           string
	FlatcarChannel string
	IgnitionJSON   []byte
}

// OrderServer creates a new bare metal server with Scaleway and triggers OS
// installation with a Flatcar install cloud-init script in a single API call.
// The cloud-init script downloads flatcar-install, writes the Ignition config,
// and installs Flatcar Container Linux to disk.
//
// Scaleway requires SSH key IDs for OS installation even though the Flatcar
// install will overwrite Ubuntu. We list the org's SSH keys and pass them through.
func OrderServer(ctx context.Context, client *Client, params ProvisionParams) (*baremetal.Server, error) {
	sshKeyIDs, err := listSSHKeyIDs(client.IAM)
	if err != nil {
		return nil, fmt.Errorf("list SSH keys: %w", err)
	}

	cloudInit := BuildCloudInit(params.FlatcarChannel, params.IgnitionJSON)
	cloudInitBytes := []byte(cloudInit)

	suffix := rand.Intn(99999) //nolint:gosec // non-cryptographic, used only for unique naming
	server, err := client.Baremetal.CreateServer(&baremetal.CreateServerRequest{
		Zone:        params.Zone,
		OfferID:     params.OfferID,
		Name:        fmt.Sprintf("rawkode-%s-%05d", time.Now().Format("20060102-150405"), suffix),
		Description: "Provisioned by rawkode-cloud CLI",
		Install: &baremetal.CreateServerRequestInstall{
			OsID:      params.OSID,
			Hostname:  "flatcar-pivot",
			SSHKeyIDs: sshKeyIDs,
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
		"flatcar_channel", params.FlatcarChannel,
		"zone", params.Zone,
		"ssh_keys", len(sshKeyIDs),
	)

	return server, nil
}

// listSSHKeyIDs fetches all SSH key IDs from the Scaleway org.
// These are required by the install API even though the Flatcar install overwrites the OS.
func listSSHKeyIDs(iamAPI *iam.API) ([]string, error) {
	resp, err := iamAPI.ListSSHKeys(&iam.ListSSHKeysRequest{})
	if err != nil {
		return nil, fmt.Errorf("list ssh keys: %w", err)
	}

	if len(resp.SSHKeys) == 0 {
		return nil, fmt.Errorf("no SSH keys found in Scaleway org — at least one is required for bare metal OS install")
	}

	ids := make([]string, len(resp.SSHKeys))
	for i, key := range resp.SSHKeys {
		ids[i] = key.ID
	}

	slog.Info("fetched SSH keys from Scaleway",
		"phase", "1",
		"count", len(ids),
	)

	return ids, nil
}

// WaitForReady polls Scaleway until the server reaches a terminal state.
// With combined create+install, this waits for both hardware allocation AND
// OS installation to complete. Bare metal provisioning can take 15-30 minutes.
func WaitForReady(ctx context.Context, client *Client, serverID string, zone scw.Zone) (*baremetal.Server, error) {
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
			server, err := client.Baremetal.GetServer(&baremetal.GetServerRequest{
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

// BuildCloudInit generates a bash script that downloads flatcar-install from
// GitHub, writes the Ignition config to disk, and installs Flatcar Container
// Linux. On reboot, the machine boots into Flatcar with the Ignition config
// applied. This is the OS pivot — a one-way door.
func BuildCloudInit(flatcarChannel string, ignitionJSON []byte) string {
	ignitionB64 := wrapString(base64.StdEncoding.EncodeToString(ignitionJSON), 76)

	pivotScript := fmt.Sprintf(`#!/bin/bash
set -euo pipefail
set -x
echo "Starting Flatcar pivot at $(date)"

# Step 0: Install dependencies required by flatcar-install
echo "Installing dependencies..."
apt-get update -qq
apt-get install -y -qq bzip2 > /dev/null

# Step 1: Write Ignition config
echo "Writing Ignition config..."
cat >/tmp/ignition.b64 <<'__IGNITION_B64__'
%s
__IGNITION_B64__
base64 -d /tmp/ignition.b64 > /tmp/ignition.json
rm -f /tmp/ignition.b64

# Step 2: Download flatcar-install
echo "Downloading flatcar-install..."
wget --retry-connrefused --waitretry=5 --tries=5 \
    -O /tmp/flatcar-install "https://raw.githubusercontent.com/flatcar/init/flatcar-master/bin/flatcar-install"
chmod +x /tmp/flatcar-install

# Step 3: Detect the boot disk to avoid writing to the wrong device
echo "Detecting boot disk..."
TARGET_DISK=""
ROOT_SOURCE=$(findmnt -n -o SOURCE / 2>/dev/null || echo "")
if [ -b "$ROOT_SOURCE" ]; then
    PKNAME=$(lsblk -ndo PKNAME "$ROOT_SOURCE" 2>/dev/null || true)
    if [ -n "$PKNAME" ] && [ -b "/dev/$PKNAME" ]; then
        TARGET_DISK="/dev/$PKNAME"
    fi
fi
if [ -z "$TARGET_DISK" ]; then
    TARGET_DISK=$(lsblk -dnpo NAME -e 7,11 | head -1)
fi
if [ -z "$TARGET_DISK" ]; then
    TARGET_DISK="/dev/sda"
fi

# Step 4: Install Flatcar to disk
echo "Installing Flatcar (%s channel) to ${TARGET_DISK}..."
/tmp/flatcar-install -d "${TARGET_DISK}" -C %s -i /tmp/ignition.json
sync

echo "Pivot complete. Rebooting into Flatcar at $(date)"
reboot
`, ignitionB64, flatcarChannel, flatcarChannel)

	pivotScriptB64 := wrapString(base64.StdEncoding.EncodeToString([]byte(pivotScript)), 76)

	return fmt.Sprintf(`#cloud-config
write_files:
  - path: /usr/local/bin/rawkode-flatcar-pivot.sh
    owner: root:root
    permissions: "0755"
    encoding: b64
    content: |
%s
runcmd:
  - [ bash, -lc, "/usr/local/bin/rawkode-flatcar-pivot.sh" ]
`, indentLines(pivotScriptB64, "      "))
}

func wrapString(s string, width int) string {
	if width <= 0 || len(s) <= width {
		return s
	}

	var b strings.Builder
	for start := 0; start < len(s); start += width {
		end := start + width
		if end > len(s) {
			end = len(s)
		}
		b.WriteString(s[start:end])
		if end < len(s) {
			b.WriteByte('\n')
		}
	}
	return b.String()
}

func indentLines(s, prefix string) string {
	lines := strings.Split(s, "\n")
	for i := range lines {
		lines[i] = prefix + lines[i]
	}
	return strings.Join(lines, "\n")
}
