package ssh

import (
	"context"
	"fmt"
	"log/slog"
	"net"
	"time"

	"golang.org/x/crypto/ssh"
)

// WaitForSSH polls until an SSH connection can be established.
func WaitForSSH(ctx context.Context, cfg Config, timeout time.Duration) error {
	authMethods, err := buildAuthMethods(cfg.PrivateKey, cfg.AgentSocket)
	if err != nil {
		return err
	}

	sshConfig := &ssh.ClientConfig{
		User:            cfg.User,
		Auth:            authMethods,
		HostKeyCallback: ssh.InsecureIgnoreHostKey(), //nolint:gosec // ephemeral server
		Timeout:         5 * time.Second,
	}

	address := net.JoinHostPort(cfg.Host, cfg.Port)
	deadline := time.After(timeout)
	ticker := time.NewTicker(10 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-deadline:
			return fmt.Errorf("SSH not reachable on %s within %s", address, timeout)
		case <-ticker.C:
			conn, dialErr := ssh.Dial("tcp", address, sshConfig)
			if dialErr != nil {
				slog.Debug("waiting for SSH", "address", address, "error", dialErr)
				continue
			}
			conn.Close()
			slog.Info("SSH is reachable", "address", address)
			return nil
		}
	}
}
