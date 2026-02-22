package flatcar

import (
	"context"
	"fmt"
	"log/slog"
	"strings"

	"github.com/rawkode-academy/rawkode-cloud/internal/ssh"
)

// LockdownFirewall removes the operator-IP SSH rule, keeping only Teleport
// tunnel access. The SSH connection is expected to drop after reload.
func LockdownFirewall(ctx context.Context, sshClient *ssh.Client) error {
	lockdownRules := `#!/usr/sbin/nft -f
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

        # Allow Kubernetes API (6443) from anywhere (Teleport tunnels through it)
        tcp dport 6443 accept

        # Allow kubelet API for inter-node communication
        tcp dport 10250 accept

        # Allow etcd peer communication
        tcp dport {2379, 2380} accept

        # Drop everything else (including SSH 22)
    }

    chain forward {
        type filter hook forward priority 0; policy accept;
    }

    chain output {
        type filter hook output priority 0; policy accept;
    }
}
`

	err := sshClient.Upload(ctx, "/tmp/nftables-lockdown.conf", []byte(lockdownRules), "0644")
	if err != nil {
		return fmt.Errorf("upload lockdown nftables config: %w", err)
	}

	_, err = sshClient.Run(ctx, "sudo cp /tmp/nftables-lockdown.conf /etc/nftables.conf && sudo systemctl reload nftables")
	if err != nil {
		// Connection drop after firewall reload is expected and counts as success
		if strings.Contains(err.Error(), "connection reset") ||
			strings.Contains(err.Error(), "broken pipe") ||
			strings.Contains(err.Error(), "EOF") {
			slog.Info("firewall lockdown applied — SSH connection dropped as expected",
				"phase", "6",
				"access_method", "teleport-only",
			)
			return nil
		}
		return fmt.Errorf("apply lockdown firewall: %w", err)
	}

	slog.Info("firewall lockdown applied",
		"phase", "6",
		"blocked_ports", "22 (SSH)",
		"access_method", "teleport-only",
	)
	return nil
}
