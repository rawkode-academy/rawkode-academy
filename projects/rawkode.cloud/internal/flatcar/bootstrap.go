package flatcar

import (
	"context"
	"fmt"
	"log/slog"
	"strings"
	"time"

	"github.com/rawkode-academy/rawkode-cloud/internal/ssh"
)

// BootstrapInit orchestrates post-boot tasks for the first control-plane node.
// It waits for kubeadm init to complete, applies K8s manifests, and extracts
// join info for subsequent nodes.
func BootstrapInit(ctx context.Context, sshClient *ssh.Client, manifests []string, serverPublicIP string) (*JoinInfo, error) {
	if err := waitForKubeadmComplete(ctx, sshClient); err != nil {
		return nil, fmt.Errorf("kubeadm init: %w", err)
	}

	// Apply manifests (Teleport + Infisical)
	for i, manifest := range manifests {
		slog.Info("applying manifest", "phase", "5", "index", i)
		_, err := sshClient.RunWithStdin(ctx, "sudo KUBECONFIG=/etc/kubernetes/admin.conf kubectl apply -f -", []byte(manifest))
		if err != nil {
			return nil, fmt.Errorf("apply manifest %d: %w", i, err)
		}
	}

	if err := waitForKubernetesReady(ctx, sshClient); err != nil {
		return nil, fmt.Errorf("kubernetes readiness: %w", err)
	}

	joinInfo, err := extractJoinInfo(ctx, sshClient, serverPublicIP)
	if err != nil {
		return nil, fmt.Errorf("extract join info: %w", err)
	}

	return joinInfo, nil
}

// BootstrapJoin orchestrates post-boot tasks for joining nodes.
func BootstrapJoin(ctx context.Context, sshClient *ssh.Client) error {
	if err := waitForKubeadmComplete(ctx, sshClient); err != nil {
		return fmt.Errorf("kubeadm join: %w", err)
	}

	if err := waitForNodeJoined(ctx, sshClient); err != nil {
		return fmt.Errorf("node join verification: %w", err)
	}

	return nil
}

// waitForKubeadmComplete polls until the kubeadm.service unit has succeeded.
func waitForKubeadmComplete(ctx context.Context, sshClient *ssh.Client) error {
	ticker := time.NewTicker(15 * time.Second)
	defer ticker.Stop()

	deadline := time.After(15 * time.Minute)

	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-deadline:
			// Grab journal for debugging
			journal, _ := sshClient.Run(ctx, "sudo journalctl -u kubeadm.service --no-pager -n 50")
			return fmt.Errorf("kubeadm did not complete within 15 minutes\nrecent logs:\n%s", journal)
		case <-ticker.C:
			output, err := sshClient.Run(ctx, "systemctl is-active kubeadm.service 2>/dev/null || true")
			if err != nil {
				slog.Debug("waiting for kubeadm", "error", err)
				continue
			}

			status := strings.TrimSpace(output)
			switch status {
			case "active":
				slog.Info("kubeadm completed successfully", "phase", "4")
				return nil
			case "failed":
				journal, _ := sshClient.Run(ctx, "sudo journalctl -u kubeadm.service --no-pager -n 50")
				return fmt.Errorf("kubeadm.service failed\njournal:\n%s", journal)
			default:
				slog.Debug("kubeadm still running", "status", status)
			}
		}
	}
}

// waitForKubernetesReady polls until at least one node reports Ready.
func waitForKubernetesReady(ctx context.Context, sshClient *ssh.Client) error {
	ticker := time.NewTicker(15 * time.Second)
	defer ticker.Stop()

	deadline := time.After(10 * time.Minute)

	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-deadline:
			return fmt.Errorf("kubernetes did not become ready within 10 minutes")
		case <-ticker.C:
			output, err := sshClient.Run(ctx, "sudo KUBECONFIG=/etc/kubernetes/admin.conf kubectl get nodes -o jsonpath='{.items[*].status.conditions[?(@.type==\"Ready\")].status}' 2>/dev/null || true")
			if err != nil {
				slog.Debug("waiting for kubernetes readiness", "error", err)
				continue
			}

			if strings.Contains(output, "True") {
				slog.Info("kubernetes node is Ready", "phase", "5")
				return nil
			}

			slog.Debug("kubernetes not ready yet", "output", output)
		}
	}
}

// waitForNodeJoined verifies the node's kubelet is running after a kubeadm join.
func waitForNodeJoined(ctx context.Context, sshClient *ssh.Client) error {
	ticker := time.NewTicker(10 * time.Second)
	defer ticker.Stop()

	deadline := time.After(5 * time.Minute)

	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-deadline:
			return fmt.Errorf("kubelet did not become active within 5 minutes")
		case <-ticker.C:
			output, err := sshClient.Run(ctx, "systemctl is-active kubelet 2>/dev/null || true")
			if err != nil {
				continue
			}

			if strings.TrimSpace(output) == "active" {
				slog.Info("kubelet is active — node has joined the cluster", "phase", "5")
				return nil
			}
		}
	}
}

// extractJoinInfo creates a new join token and uploads certs for subsequent nodes.
func extractJoinInfo(ctx context.Context, sshClient *ssh.Client, serverPublicIP string) (*JoinInfo, error) {
	// Create a new join token
	tokenOutput, err := sshClient.Run(ctx, "sudo KUBECONFIG=/etc/kubernetes/admin.conf kubeadm token create")
	if err != nil {
		return nil, fmt.Errorf("create join token: %w", err)
	}
	token := strings.TrimSpace(tokenOutput)

	// Get CA cert hash
	hashOutput, err := sshClient.Run(ctx, "openssl x509 -pubkey -in /etc/kubernetes/pki/ca.crt | openssl rsa -pubin -outform der 2>/dev/null | openssl dgst -sha256 -hex | sed 's/^.* //'")
	if err != nil {
		return nil, fmt.Errorf("compute CA cert hash: %w", err)
	}
	caCertHash := "sha256:" + strings.TrimSpace(hashOutput)

	// Upload certs and get certificate key
	certKeyOutput, err := sshClient.Run(ctx, "sudo KUBECONFIG=/etc/kubernetes/admin.conf kubeadm init phase upload-certs --upload-certs 2>/dev/null | tail -1")
	if err != nil {
		return nil, fmt.Errorf("upload certs: %w", err)
	}
	certKey := strings.TrimSpace(certKeyOutput)

	slog.Info("extracted join info",
		"phase", "5",
		"token_prefix", token[:6]+"...",
		"endpoint", serverPublicIP,
	)

	return &JoinInfo{
		Token:                token,
		CACertHash:           caCertHash,
		CertificateKey:       certKey,
		ControlPlaneEndpoint: serverPublicIP,
	}, nil
}
