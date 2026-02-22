package flatcar

import (
	"crypto/ed25519"
	"crypto/rand"
	"encoding/json"
	"encoding/pem"
	"fmt"
	"log/slog"
	"math/big"

	"golang.org/x/crypto/ssh"
)

// NodeConfig holds all parameters needed to generate a Flatcar Ignition config.
type NodeConfig struct {
	Role              string // "control-plane" or "worker"
	ClusterName       string
	ServerPublicIP    string
	KubernetesVersion string // e.g. "v1.33.2"
	CiliumVersion     string // e.g. "1.17.3"
	SSHPublicKey      string
	OperatorIP        string

	// For init (first CP):
	TeleportToken                string
	TeleportProxyAddr            string
	InfisicalClusterClientID     string
	InfisicalClusterClientSecret string

	// For join (subsequent nodes):
	JoinToken            string
	CACertHash           string
	CertificateKey       string // only for control-plane joins
	ControlPlaneEndpoint string // existing CP address
}

// GeneratedConfig holds the results of Ignition config generation.
type GeneratedConfig struct {
	IgnitionJSON  []byte
	SSHPrivateKey []byte
	SSHPublicKey  []byte
	IsInit        bool // true = first node, false = join
}

// GenerateIgnitionConfig creates a Flatcar Ignition JSON config for first boot.
func GenerateIgnitionConfig(cfg NodeConfig) (*GeneratedConfig, error) {
	isInit := cfg.JoinToken == ""

	// Generate ephemeral SSH keypair
	pubKey, privKey, err := generateSSHKeypair()
	if err != nil {
		return nil, fmt.Errorf("generate SSH keypair: %w", err)
	}

	hostname := generateHostname(cfg.ClusterName, cfg.Role)

	ignition := buildIgnition(cfg, isInit, string(pubKey), hostname)

	ignitionJSON, err := json.Marshal(ignition)
	if err != nil {
		return nil, fmt.Errorf("marshal ignition config: %w", err)
	}

	slog.Info("ignition config generated",
		"phase", "pre-provision",
		"role", cfg.Role,
		"init", isInit,
		"hostname", hostname,
	)

	return &GeneratedConfig{
		IgnitionJSON:  ignitionJSON,
		SSHPrivateKey: privKey,
		SSHPublicKey:  pubKey,
		IsInit:        isInit,
	}, nil
}

func buildIgnition(cfg NodeConfig, isInit bool, sshPubKey, hostname string) map[string]any {
	// Strip version prefix for sysext download URL (expects "1.33.2" not "v1.33.2")
	k8sVersionBare := cfg.KubernetesVersion
	if len(k8sVersionBare) > 0 && k8sVersionBare[0] == 'v' {
		k8sVersionBare = k8sVersionBare[1:]
	}

	kubeadmCmd := buildKubeadmCommand(cfg, isInit)

	files := []map[string]any{
		// /etc/hostname
		fileEntry("/etc/hostname", hostname, 0644),
		// sysctl for bridge-nf-call-iptables and ip_forward
		fileEntry("/etc/sysctl.d/99-kubernetes.conf",
			"net.bridge.bridge-nf-call-iptables = 1\nnet.ipv4.ip_forward = 1\n", 0644),
		// kernel modules
		fileEntry("/etc/modules-load.d/kubernetes.conf",
			"br_netfilter\noverlay\n", 0644),
		// nftables config — allow SSH + K8s API from operator IP during bootstrap
		fileEntry("/etc/nftables.conf", buildNftablesConfig(cfg.OperatorIP), 0644),
		// kubeadm config file
		fileEntry("/etc/kubeadm-config.yaml", buildKubeadmConfig(cfg, isInit), 0644),
	}

	// Kubernetes sysext download and symlink
	files = append(files,
		fileEntry("/opt/extensions/kubernetes/download.sh", fmt.Sprintf(`#!/bin/bash
set -euo pipefail
ARCH="x86-64"
VERSION="%s"
URL="https://extensions.flatcar.org/extensions/kubernetes-${VERSION}-${ARCH}.raw"
DEST="/opt/extensions/kubernetes/kubernetes-${VERSION}-${ARCH}.raw"
if [ ! -f "$DEST" ]; then
    mkdir -p /opt/extensions/kubernetes
    curl -fsSL -o "$DEST" "$URL"
fi
ln -sf "$DEST" /etc/extensions/kubernetes.raw
`, k8sVersionBare), 0755),
	)

	// Cilium sysext download and symlink
	files = append(files,
		fileEntry("/opt/extensions/cilium/download.sh", fmt.Sprintf(`#!/bin/bash
set -euo pipefail
ARCH="x86-64"
VERSION="%s"
URL="https://extensions.flatcar.org/extensions/cilium-${VERSION}-${ARCH}.raw"
DEST="/opt/extensions/cilium/cilium-${VERSION}-${ARCH}.raw"
if [ ! -f "$DEST" ]; then
    mkdir -p /opt/extensions/cilium
    curl -fsSL -o "$DEST" "$URL"
fi
ln -sf "$DEST" /etc/extensions/cilium.raw
`, cfg.CiliumVersion), 0755),
	)

	units := []map[string]any{
		// Mask locksmithd — we use kured for reboot coordination
		unitEntry("locksmithd.service", true, "", nil),
		// Enable nftables
		unitEntry("nftables.service", false, "", boolPtr(true)),
		// Download and activate sysexts before kubeadm
		unitEntry("sysext-install.service", false, `[Unit]
Description=Download and install sysext images
Before=kubeadm.service
After=network-online.target
Wants=network-online.target
ConditionPathExists=!/etc/extensions/kubernetes.raw

[Service]
Type=oneshot
RemainAfterExit=true
ExecStart=/opt/extensions/kubernetes/download.sh
ExecStart=/opt/extensions/cilium/download.sh
ExecStart=/usr/bin/systemd-sysext refresh
ExecStart=/usr/sbin/sysctl --system

[Install]
WantedBy=multi-user.target
`, boolPtr(true)),
		// Load kernel modules
		unitEntry("load-kernel-modules.service", false, `[Unit]
Description=Load required kernel modules for Kubernetes
Before=kubeadm.service
After=systemd-modules-load.service

[Service]
Type=oneshot
RemainAfterExit=true
ExecStart=/sbin/modprobe br_netfilter
ExecStart=/sbin/modprobe overlay

[Install]
WantedBy=multi-user.target
`, boolPtr(true)),
		// kubeadm service
		unitEntry("kubeadm.service", false, fmt.Sprintf(`[Unit]
Description=kubeadm %s
After=sysext-install.service load-kernel-modules.service containerd.service
Requires=sysext-install.service load-kernel-modules.service containerd.service
ConditionPathExists=!/etc/kubernetes/kubelet.conf

[Service]
Type=oneshot
RemainAfterExit=true
ExecStart=%s

[Install]
WantedBy=multi-user.target
`, modeLabel(isInit), kubeadmCmd), boolPtr(true)),
	}

	ignition := map[string]any{
		"ignition": map[string]any{
			"version": "3.4.0",
		},
		"passwd": map[string]any{
			"users": []map[string]any{
				{
					"name":              "core",
					"sshAuthorizedKeys": []string{sshPubKey},
				},
			},
		},
		"storage": map[string]any{
			"files": files,
		},
		"systemd": map[string]any{
			"units": units,
		},
	}

	return ignition
}

func buildKubeadmCommand(cfg NodeConfig, isInit bool) string {
	if isInit {
		return fmt.Sprintf("/usr/bin/kubeadm init --config /etc/kubeadm-config.yaml --upload-certs")
	}

	cmd := fmt.Sprintf("/usr/bin/kubeadm join --config /etc/kubeadm-config.yaml")
	return cmd
}

func buildKubeadmConfig(cfg NodeConfig, isInit bool) string {
	if isInit {
		return fmt.Sprintf(`apiVersion: kubeadm.k8s.io/v1beta4
kind: InitConfiguration
nodeRegistration:
  kubeletExtraArgs:
    - name: cloud-provider
      value: external
---
apiVersion: kubeadm.k8s.io/v1beta4
kind: ClusterConfiguration
kubernetesVersion: %s
controlPlaneEndpoint: "%s:6443"
networking:
  podSubnet: "10.244.0.0/16"
  serviceSubnet: "10.96.0.0/12"
---
apiVersion: kubelet.config.k8s.io/v1beta1
kind: KubeletConfiguration
cgroupDriver: systemd
`, cfg.KubernetesVersion, cfg.ServerPublicIP)
	}

	// Join configuration
	config := fmt.Sprintf(`apiVersion: kubeadm.k8s.io/v1beta4
kind: JoinConfiguration
discovery:
  bootstrapToken:
    apiServerEndpoint: "%s:6443"
    token: "%s"
    caCertHashes:
      - "%s"
`, cfg.ControlPlaneEndpoint, cfg.JoinToken, cfg.CACertHash)

	if cfg.Role == "control-plane" && cfg.CertificateKey != "" {
		config += fmt.Sprintf(`controlPlane:
  certificateKey: "%s"
`, cfg.CertificateKey)
	}

	return config
}

func buildNftablesConfig(operatorIP string) string {
	return fmt.Sprintf(`#!/usr/sbin/nft -f
flush ruleset

table inet filter {
    chain input {
        type filter hook input priority 0; policy drop;

        # Allow established/related connections
        ct state established,related accept

        # Allow loopback
        iif lo accept

        # Allow ICMP
        ip protocol icmp accept
        ip6 nexthdr icmpv6 accept

        # Allow SSH from operator IP only (temporary, removed after lockdown)
        ip saddr %s tcp dport 22 accept

        # Allow Kubernetes API
        tcp dport 6443 accept

        # Allow kubelet API for inter-node communication
        tcp dport 10250 accept

        # Allow etcd peer communication
        tcp dport {2379, 2380} accept
    }

    chain forward {
        type filter hook forward priority 0; policy accept;
    }

    chain output {
        type filter hook output priority 0; policy accept;
    }
}
`, operatorIP)
}

func modeLabel(isInit bool) string {
	if isInit {
		return "init"
	}
	return "join"
}

func fileEntry(path, contents string, mode int) map[string]any {
	return map[string]any{
		"path": path,
		"contents": map[string]any{
			"source": "data:," + dataURIEncode(contents),
		},
		"mode": mode,
	}
}

func unitEntry(name string, mask bool, contents string, enabled *bool) map[string]any {
	entry := map[string]any{
		"name": name,
		"mask": mask,
	}
	if contents != "" {
		entry["contents"] = contents
	}
	if enabled != nil {
		entry["enabled"] = *enabled
	}
	return entry
}

func boolPtr(b bool) *bool {
	return &b
}

// dataURIEncode does minimal percent-encoding for Ignition data: URIs.
func dataURIEncode(s string) string {
	var result []byte
	for i := 0; i < len(s); i++ {
		c := s[i]
		switch {
		case c >= 'a' && c <= 'z',
			c >= 'A' && c <= 'Z',
			c >= '0' && c <= '9',
			c == '-', c == '_', c == '.', c == '~',
			c == '/', c == ':', c == '=', c == '+', c == ' ':
			if c == ' ' {
				result = append(result, '%', '2', '0')
			} else {
				result = append(result, c)
			}
		default:
			result = append(result, '%')
			result = append(result, "0123456789ABCDEF"[c>>4])
			result = append(result, "0123456789ABCDEF"[c&0x0f])
		}
	}
	return string(result)
}

func generateSSHKeypair() (pubKeyBytes, privKeyBytes []byte, err error) {
	pub, priv, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		return nil, nil, fmt.Errorf("generate ed25519 key: %w", err)
	}

	sshPub, err := ssh.NewPublicKey(pub)
	if err != nil {
		return nil, nil, fmt.Errorf("convert to SSH public key: %w", err)
	}

	pubKeyBytes = ssh.MarshalAuthorizedKey(sshPub)

	privKeyBytes, err = marshalED25519PrivateKey(priv)
	if err != nil {
		return nil, nil, fmt.Errorf("marshal private key: %w", err)
	}

	return pubKeyBytes, privKeyBytes, nil
}

// marshalED25519PrivateKey serialises an Ed25519 private key in OpenSSH format.
func marshalED25519PrivateKey(key ed25519.PrivateKey) ([]byte, error) {
	// Use x/crypto/ssh to marshal in OpenSSH format
	checkInt, err := rand.Int(rand.Reader, new(big.Int).SetInt64(1<<31))
	if err != nil {
		return nil, err
	}
	check := uint32(checkInt.Uint64())

	block := marshalOpenSSHPrivateKey(key, check)
	return pem.EncodeToMemory(&pem.Block{
		Type:  "OPENSSH PRIVATE KEY",
		Bytes: block,
	}), nil
}

func generateHostname(clusterName, role string) string {
	suffix, _ := rand.Int(rand.Reader, new(big.Int).SetInt64(99999))
	return fmt.Sprintf("%s-%s-%05d", clusterName, role, suffix.Int64())
}

// marshalOpenSSHPrivateKey creates the OpenSSH private key binary format.
func marshalOpenSSHPrivateKey(key ed25519.PrivateKey, check uint32) []byte {
	pubKey := key.Public().(ed25519.PublicKey)
	sshPub, _ := ssh.NewPublicKey(pubKey)
	pubBytes := sshPub.Marshal()

	var buf []byte

	// AUTH_MAGIC
	buf = append(buf, []byte("openssh-key-v1\x00")...)
	// ciphername
	buf = appendLenPrefixed(buf, []byte("none"))
	// kdfname
	buf = appendLenPrefixed(buf, []byte("none"))
	// kdf (empty)
	buf = appendLenPrefixed(buf, []byte{})
	// number of keys
	buf = appendUint32(buf, 1)
	// public key
	buf = appendLenPrefixed(buf, pubBytes)

	// private section
	var priv []byte
	priv = appendUint32(priv, check)
	priv = appendUint32(priv, check)
	// key type
	priv = appendLenPrefixed(priv, []byte("ssh-ed25519"))
	// public key (again)
	priv = appendLenPrefixed(priv, []byte(pubKey))
	// private key (64 bytes: seed + public)
	priv = appendLenPrefixed(priv, []byte(key))
	// comment
	priv = appendLenPrefixed(priv, []byte(""))

	// padding
	for i := 0; len(priv)%8 != 0; i++ {
		priv = append(priv, byte(i+1))
	}

	buf = appendLenPrefixed(buf, priv)
	return buf
}

func appendUint32(buf []byte, v uint32) []byte {
	return append(buf, byte(v>>24), byte(v>>16), byte(v>>8), byte(v))
}

func appendLenPrefixed(buf, data []byte) []byte {
	buf = appendUint32(buf, uint32(len(data)))
	return append(buf, data...)
}
