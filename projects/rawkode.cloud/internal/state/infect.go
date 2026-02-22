package state

import (
	"context"
	"encoding/base64"
	"fmt"
	"log/slog"
	"time"

	"github.com/rawkode-academy/rawkode-cloud/internal/cloudflare"
	"github.com/rawkode-academy/rawkode-cloud/internal/flatcar"
	"github.com/rawkode-academy/rawkode-cloud/internal/infisical"
	"github.com/rawkode-academy/rawkode-cloud/internal/ssh"
	"github.com/rawkode-academy/rawkode-cloud/internal/teleport"
)

// InfectConfig holds all parameters for infecting an existing Ubuntu host.
type InfectConfig struct {
	// Target host
	Host           string // IP or hostname of existing Ubuntu 24 server
	SSHPort        string // SSH port (default "22")
	SSHUser        string // SSH user for initial connection (default "root")
	SSHKeyPath     string // Path to SSH private key for initial connection
	SSHAgentSocket string // Explicit SSH agent socket (overrides SSH_AUTH_SOCK)

	// Cluster settings
	ClusterName       string
	Role              string // "control-plane" or "worker"
	FlatcarChannel    string
	KubernetesVersion string
	CiliumVersion     string
	TeleportProxy     string

	// Cloudflare DNS
	CloudflareAPIToken  string
	CloudflareAccountID string
	CloudflareZoneID    string
	CloudflareDNSName   string

	// Infisical
	InfisicalURL          string
	InfisicalClientID     string
	InfisicalClientSecret string
	InfisicalProjectID    string
	InfisicalEnvironment  string
	InfisicalSecretPath   string

	// Infisical cluster identity
	InfisicalClusterClientID     string
	InfisicalClusterClientSecret string
}

// RunInfect executes the infect pipeline: SSH to existing Ubuntu host,
// install Flatcar, reboot, then proceed with the same kubeadm bootstrap
// as the provision command.
//
// Phases:
//
//	0: Resolve secrets from Infisical + load JoinInfo
//	1: SSH to existing host, generate Ignition, run flatcar-install, reboot
//	2: Wait for Flatcar boot + SSH reachable (new SSH key)
//	3: Update Cloudflare DNS (init only)
//	4: Wait for kubeadm to complete
//	5: [init] Generate Teleport token (proxy now reachable), apply manifests, extract+store join info
//	   [join] Verify node joined
//	6: Verify Teleport agent, then lockdown firewall
func RunInfect(ctx context.Context, cfg InfectConfig, existingSSHKey []byte) error {
	// ── Phase 0: Resolve secrets from Infisical ──
	var infClient *infisical.Client
	var joinInfo *flatcar.JoinInfo

	if cfg.InfisicalURL != "" && cfg.InfisicalClientID != "" && cfg.InfisicalClientSecret != "" {
		slog.Info("authenticating with Infisical", "url", cfg.InfisicalURL)

		var err error
		infClient, err = infisical.NewClient(ctx, cfg.InfisicalURL, cfg.InfisicalClientID, cfg.InfisicalClientSecret)
		if err != nil {
			return fmt.Errorf("infisical auth: %w", err)
		}

		if cfg.InfisicalProjectID != "" {
			env := cfg.InfisicalEnvironment
			if env == "" {
				env = "production"
			}
			baseSecretPath := normalizeSecretPath(cfg.InfisicalSecretPath)

			secrets, err := infClient.GetSecrets(ctx, cfg.InfisicalProjectID, env, baseSecretPath)
			if err != nil {
				return fmt.Errorf("fetch secrets from infisical: %w", err)
			}

			backfillInfectFromSecrets(&cfg, secrets)

			joinSecretPath := clusterSecretPath(baseSecretPath, cfg.ClusterName)
			joinInfo, err = flatcar.LoadJoinInfo(ctx, infClient, cfg.InfisicalProjectID, env, joinSecretPath)
			if err != nil {
				return fmt.Errorf("load join info: %w", err)
			}
		}
	}

	isInit := joinInfo == nil
	teleportEnabled := cfg.TeleportProxy != ""

	if err := validateInfectConfig(&cfg); err != nil {
		return fmt.Errorf("config validation: %w", err)
	}

	slog.Info("infect: starting",
		"host", cfg.Host,
		"role", cfg.Role,
		"init", isInit,
	)

	operatorIP, err := GetOperatorIP(ctx)
	if err != nil {
		return fmt.Errorf("operator IP detection failed: %w", err)
	}

	// Validate Infisical cluster identity
	clusterIDSet := cfg.InfisicalClusterClientID != ""
	clusterSecretSet := cfg.InfisicalClusterClientSecret != ""
	if clusterIDSet != clusterSecretSet {
		return fmt.Errorf("INFISICAL_CLUSTER_CLIENT_ID and INFISICAL_CLUSTER_CLIENT_SECRET must both be set or both be absent")
	}

	// For join nodes, check Teleport availability now.
	// For init nodes, token generation is deferred until after DNS + kubeadm.
	var teleportToken string
	if !isInit && teleportEnabled {
		teleportToken, err = teleport.GenerateJoinToken(ctx, cfg.TeleportProxy, 30*time.Minute)
		if err != nil {
			slog.Warn("Teleport unavailable during pre-provision; continuing without Teleport integration",
				"phase", "pre-provision",
				"proxy", cfg.TeleportProxy,
				"error", err,
			)
			teleportEnabled = false
			teleportToken = ""
		}
	}

	teleportProxy := ""
	if teleportEnabled {
		teleportProxy = cfg.TeleportProxy
	}

	// Generate Ignition config with the target host's IP
	nodeCfg := flatcar.NodeConfig{
		Role:                         cfg.Role,
		ClusterName:                  cfg.ClusterName,
		ServerPublicIP:               cfg.Host,
		KubernetesVersion:            cfg.KubernetesVersion,
		CiliumVersion:                cfg.CiliumVersion,
		OperatorIP:                   operatorIP,
		TeleportToken:                teleportToken,
		TeleportProxyAddr:            teleportProxy,
		InfisicalClusterClientID:     cfg.InfisicalClusterClientID,
		InfisicalClusterClientSecret: cfg.InfisicalClusterClientSecret,
	}

	if joinInfo != nil {
		nodeCfg.JoinToken = joinInfo.Token
		nodeCfg.CACertHash = joinInfo.CACertHash
		nodeCfg.CertificateKey = joinInfo.CertificateKey
		nodeCfg.ControlPlaneEndpoint = joinInfo.ControlPlaneEndpoint
	}

	genCfg, err := flatcar.GenerateIgnitionConfig(nodeCfg)
	if err != nil {
		return fmt.Errorf("ignition config generation failed: %w", err)
	}

	// ── Phase 1: SSH to existing host, install Flatcar, reboot ──
	slog.Info("starting phase 1: connecting to existing host", "phase", "1", "host", cfg.Host)

	sshPort := cfg.SSHPort
	if sshPort == "" {
		sshPort = "22"
	}
	sshUser := cfg.SSHUser
	if sshUser == "" {
		sshUser = "root"
	}

	ubuntuSSH, err := ssh.Connect(ctx, ssh.Config{
		Host:        cfg.Host,
		Port:        sshPort,
		User:        sshUser,
		PrivateKey:  existingSSHKey,
		AgentSocket: cfg.SSHAgentSocket,
	}, 2*time.Minute)
	if err != nil {
		return fmt.Errorf("phase 1 (SSH connect) failed: %w", err)
	}

	// Verify this is an Ubuntu host
	osRelease, err := ubuntuSSH.Run(ctx, "cat /etc/os-release 2>/dev/null | head -1 || true")
	if err != nil {
		ubuntuSSH.Close()
		return fmt.Errorf("phase 1 (verify OS) failed: %w", err)
	}
	slog.Info("target host OS", "os_release", osRelease)

	// Write Ignition config and run flatcar-install
	ignitionB64 := base64.StdEncoding.EncodeToString(genCfg.IgnitionJSON)
	pivotScript := buildInfectScript(cfg.FlatcarChannel, ignitionB64)

	slog.Info("installing Flatcar on target host", "phase", "1", "channel", cfg.FlatcarChannel)

	_, err = ubuntuSSH.RunWithStdin(ctx, "bash -s", []byte(pivotScript))
	if err != nil {
		// The reboot at the end of the script will kill the SSH connection.
		// That's expected. Check if the error looks like a connection drop.
		if isConnectionDropError(err) {
			slog.Info("host is rebooting into Flatcar", "phase", "1")
		} else {
			ubuntuSSH.Close()
			return fmt.Errorf("phase 1 (flatcar install) failed: %w", err)
		}
	}
	ubuntuSSH.Close()

	// ── Phase 2: Wait for Flatcar boot + SSH reachable ──
	slog.Info("starting phase 2: waiting for Flatcar boot", "phase", "2")

	flatcarSSHCfg := ssh.Config{
		Host:       cfg.Host,
		Port:       "22",
		User:       "core",
		PrivateKey: genCfg.SSHPrivateKey,
	}

	err = ssh.WaitForSSH(ctx, flatcarSSHCfg, 20*time.Minute)
	if err != nil {
		return fmt.Errorf("phase 2 (SSH wait) failed: %w", err)
	}

	sshClient, err := ssh.Connect(ctx, flatcarSSHCfg, 2*time.Minute)
	if err != nil {
		return fmt.Errorf("phase 2 (SSH connect) failed: %w", err)
	}
	defer sshClient.Close()

	// ── Phase 3: Update Cloudflare DNS (init only) ──
	zoneID, err := resolveCloudflareZoneID(ctx, cfg.CloudflareAPIToken, cfg.CloudflareZoneID, cfg.CloudflareAccountID, cfg.CloudflareDNSName)
	if err != nil {
		return fmt.Errorf("phase 3 (resolve cloudflare zone) failed: %w", err)
	}

	if isInit && cfg.CloudflareAPIToken != "" && zoneID != "" && cfg.CloudflareDNSName != "" {
		slog.Info("starting phase 3: DNS update", "phase", "3")

		err = cloudflare.UpsertARecord(ctx, cfg.CloudflareAPIToken, zoneID, cfg.CloudflareDNSName, cfg.Host)
		if err != nil {
			return fmt.Errorf("phase 3 (dns) failed: %w", err)
		}
	} else {
		slog.Warn("skipping phase 3: DNS not configured or not init node", "phase", "3")
	}

	// ── Phase 4: Wait for kubeadm to complete ──
	slog.Info("starting phase 4: waiting for kubeadm", "phase", "4")

	_, _ = sshClient.Run(ctx, "sudo systemctl start sysext-install.service 2>/dev/null || true")
	_, _ = sshClient.Run(ctx, "sudo systemctl start kubeadm.service 2>/dev/null || true")

	// ── Phase 5: Bootstrap or Join ──
	slog.Info("starting phase 5: cluster operations", "phase", "5")

	if isInit {
		if teleportEnabled {
			// For init nodes: kubeadm + DNS are done. NOW we can reach the Teleport
			// proxy (it's this cluster at rawkode.cloud, which DNS just pointed here).
			// Generate the Teleport token and deploy all manifests.
			slog.Info("generating Teleport join token (post-DNS)", "proxy", cfg.TeleportProxy)
			teleportToken, err = teleport.GenerateJoinToken(ctx, cfg.TeleportProxy, 30*time.Minute)
			if err != nil {
				slog.Warn("Teleport unavailable after init bootstrap; continuing without Teleport integration",
					"phase", "5",
					"proxy", cfg.TeleportProxy,
					"error", err,
				)
				teleportEnabled = false
				teleportToken = ""
			}
		}

		manifestTeleportProxy := ""
		if teleportEnabled {
			manifestTeleportProxy = cfg.TeleportProxy
		}

		manifests := flatcar.GenerateManifests(flatcar.ManifestConfig{
			ClusterName:                  cfg.ClusterName,
			TeleportToken:                teleportToken,
			TeleportProxyAddr:            manifestTeleportProxy,
			InfisicalClusterClientID:     cfg.InfisicalClusterClientID,
			InfisicalClusterClientSecret: cfg.InfisicalClusterClientSecret,
		})

		extractedJoinInfo, err := flatcar.BootstrapInit(ctx, sshClient, manifests, cfg.Host)
		if err != nil {
			return fmt.Errorf("phase 5 (init bootstrap) failed: %w", err)
		}

		if infClient != nil && cfg.InfisicalProjectID != "" {
			env := cfg.InfisicalEnvironment
			if env == "" {
				env = "production"
			}
			baseSecretPath := normalizeSecretPath(cfg.InfisicalSecretPath)
			joinSecretPath := clusterSecretPath(baseSecretPath, cfg.ClusterName)

			err = infClient.EnsureSecretPath(ctx, cfg.InfisicalProjectID, env, joinSecretPath)
			if err != nil {
				return fmt.Errorf("phase 5 (ensure infisical folder) failed: %w", err)
			}

			err = flatcar.StoreJoinInfo(ctx, infClient, cfg.InfisicalProjectID, env, joinSecretPath, extractedJoinInfo)
			if err != nil {
				return fmt.Errorf("phase 5 (store join info) failed: %w", err)
			}
		}
	} else {
		err = flatcar.BootstrapJoin(ctx, sshClient)
		if err != nil {
			return fmt.Errorf("phase 5 (join) failed: %w", err)
		}
	}

	// ── Phase 6: Verify Teleport, then lockdown ──
	slog.Info("starting phase 6: verify and lockdown", "phase", "6")

	if teleportEnabled {
		if isInit {
			err = teleport.WaitForAgent(ctx, cfg.TeleportProxy, cfg.ClusterName, 10*time.Minute)
			if err != nil {
				slog.Error("Teleport agent verification failed — firewall NOT locked",
					"error", err,
					"host", cfg.Host,
				)
				return fmt.Errorf("phase 6 (teleport verify) failed — host left running for manual debug: %w", err)
			}
		}

		err = flatcar.LockdownFirewall(ctx, sshClient)
		if err != nil {
			return fmt.Errorf("phase 6 (lockdown) failed: %w", err)
		}
	} else {
		slog.Warn("skipping phase 6 lockdown: Teleport not configured or unavailable",
			"phase", "6",
			"reason", "bootstrap-safe mode",
		)
	}

	accessMethod := "ssh-operator-ip-only"
	if teleportEnabled {
		accessMethod = "teleport"
	}

	slog.Info("infect complete",
		"cluster", cfg.ClusterName,
		"host", cfg.Host,
		"role", cfg.Role,
		"init", isInit,
		"access", accessMethod,
	)
	return nil
}

// buildInfectScript generates the bash script run on the existing Ubuntu host
// to install Flatcar. Same logic as the cloud-init pivot but without the
// Scaleway-specific logging path.
func buildInfectScript(flatcarChannel, ignitionB64 string) string {
	return fmt.Sprintf(`#!/bin/bash
set -euo pipefail

echo "Starting Flatcar infect at $(date)"

# Step 0: Install dependencies
echo "Installing dependencies..."
sudo apt-get update -qq && sudo apt-get install -y -qq bzip2 > /dev/null

# Step 1: Write Ignition config
echo "Writing Ignition config..."
echo "%s" | base64 -d > /tmp/ignition.json

# Step 2: Detect the boot disk
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
echo "Target disk: $TARGET_DISK"

# Step 3: Download and decompress Flatcar image to RAM
# We decompress to a file so we can inject the Ignition config into the
# OEM partition BEFORE writing to disk. This avoids the blockdev --rereadpt
# failure that happens when flatcar-install writes to a mounted boot disk.
CHANNEL="%s"
echo "Downloading Flatcar ${CHANNEL} image..."
BASEURL="https://${CHANNEL}.release.flatcar-linux.net/amd64-usr/current"
mkdir -p /dev/shm/flatcar-infect
wget --retry-connrefused --waitretry=5 --tries=5 --no-verbose \
    -O /dev/shm/flatcar-infect/flatcar.bin.bz2 "${BASEURL}/flatcar_production_image.bin.bz2"

echo "Decompressing image..."
bzcat /dev/shm/flatcar-infect/flatcar.bin.bz2 > /dev/shm/flatcar-infect/flatcar.bin
rm -f /dev/shm/flatcar-infect/flatcar.bin.bz2

# Step 4: Inject Ignition config into the OEM partition (partition 6) of the image
echo "Injecting Ignition config into image..."
LOOP=$(sudo losetup --find --show --partscan /dev/shm/flatcar-infect/flatcar.bin)
echo "Loop device: $LOOP"

# Wait for partition devices to appear
sleep 1
sudo udevadm settle 2>/dev/null || true

OEM_PART="${LOOP}p6"
if [ -b "$OEM_PART" ]; then
    sudo mkdir -p /tmp/oem
    sudo mount "$OEM_PART" /tmp/oem
    sudo cp /tmp/ignition.json /tmp/oem/config.ign
    sudo umount /tmp/oem
    echo "Ignition config injected into OEM partition"
else
    echo "ERROR: OEM partition $OEM_PART not found" >&2
    sudo losetup -d "$LOOP"
    exit 1
fi
sudo losetup -d "$LOOP"

# Step 5: Write the modified image to disk
echo "Writing Flatcar image to ${TARGET_DISK}..."
sudo dd if=/dev/shm/flatcar-infect/flatcar.bin of="${TARGET_DISK}" bs=4M status=progress
sudo sync
rm -rf /dev/shm/flatcar-infect

echo "Infect complete. Rebooting into Flatcar at $(date)"
sudo reboot
`, ignitionB64, flatcarChannel)
}

func isConnectionDropError(err error) bool {
	msg := err.Error()
	return contains(msg, "connection reset") ||
		contains(msg, "broken pipe") ||
		contains(msg, "EOF") ||
		contains(msg, "connection refused") ||
		contains(msg, "remote end closed")
}

func contains(s, substr string) bool {
	return len(s) >= len(substr) && searchString(s, substr)
}

func searchString(s, substr string) bool {
	for i := 0; i <= len(s)-len(substr); i++ {
		if s[i:i+len(substr)] == substr {
			return true
		}
	}
	return false
}

// backfillInfectFromSecrets fills missing InfectConfig fields from Infisical.
func backfillInfectFromSecrets(cfg *InfectConfig, secrets map[string]string) {
	backfill := func(target *string, keys ...string) {
		if *target != "" {
			return
		}
		for _, key := range keys {
			if v, ok := secrets[key]; ok && v != "" {
				*target = v
				slog.Debug("backfilled config from infisical", "key", key)
				return
			}
		}
	}

	backfill(&cfg.TeleportProxy, "TELEPORT_PROXY", "TELEPORT_PROXY_ADDR")
	backfill(&cfg.ClusterName, "CLUSTER_NAME")
	backfill(&cfg.FlatcarChannel, "FLATCAR_CHANNEL")
	backfill(&cfg.KubernetesVersion, "KUBERNETES_VERSION")
	backfill(&cfg.CiliumVersion, "CILIUM_VERSION")
	backfill(&cfg.InfisicalClusterClientID, "INFISICAL_CLUSTER_CLIENT_ID")
	backfill(&cfg.InfisicalClusterClientSecret, "INFISICAL_CLUSTER_CLIENT_SECRET")
	backfill(&cfg.CloudflareAPIToken, "CLOUDFLARE_API_TOKEN", "CF_API_TOKEN")
	backfill(&cfg.CloudflareAccountID, "CLOUDFLARE_ACCOUNT_ID", "CF_ACCOUNT_ID")
	backfill(&cfg.CloudflareZoneID, "CLOUDFLARE_ZONE_ID", "CF_ZONE_ID")
	backfill(&cfg.CloudflareDNSName, "CLOUDFLARE_DNS_NAME", "CF_DNS_NAME")
}

// validateInfectConfig checks required fields for the infect command.
func validateInfectConfig(cfg *InfectConfig) error {
	var missing []string
	check := func(val, name string) {
		if val == "" {
			missing = append(missing, name)
		}
	}

	check(cfg.Host, "host")
	check(cfg.ClusterName, "cluster-name")
	check(cfg.Role, "role")
	check(cfg.KubernetesVersion, "kubernetes-version")
	check(cfg.CiliumVersion, "cilium-version")

	if cfg.Role != "control-plane" && cfg.Role != "worker" {
		return fmt.Errorf("role must be 'control-plane' or 'worker', got %q", cfg.Role)
	}

	if len(missing) > 0 {
		return fmt.Errorf("missing required config: %s", joinStrings(missing, ", "))
	}
	return nil
}

func joinStrings(ss []string, sep string) string {
	if len(ss) == 0 {
		return ""
	}
	result := ss[0]
	for _, s := range ss[1:] {
		result += sep + s
	}
	return result
}
