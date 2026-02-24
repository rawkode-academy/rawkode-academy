package ssh

import (
	"context"
	"fmt"
	"log/slog"
	"net"
	"strings"
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
		HostKeyCallback: ssh.InsecureIgnoreHostKey(), //nolint:gosec
		Timeout:         5 * time.Second,
	}

	address := net.JoinHostPort(cfg.Host, cfg.Port)
	deadline := time.After(timeout)
	ticker := time.NewTicker(10 * time.Second)
	defer ticker.Stop()
	startedAt := time.Now()
	attempt := 0
	authFailureCount := 0

	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-deadline:
			return fmt.Errorf("SSH not reachable on %s within %s", address, timeout)
		case <-ticker.C:
			attempt++
			conn, dialErr := ssh.Dial("tcp", address, sshConfig)
			if dialErr != nil {
				if isAuthFailure(dialErr) {
					authFailureCount++
					if authFailureCount >= 3 {
						return fmt.Errorf("SSH reachable on %s but authentication failed for user %s: %w", address, cfg.User, dialErr)
					}
				} else {
					authFailureCount = 0
				}

				slog.Debug("waiting for SSH", "address", address, "error", dialErr)
				if attempt%6 == 0 {
					slog.Info("still waiting for SSH",
						"address", address,
						"user", cfg.User,
						"elapsed", time.Since(startedAt).Round(time.Second).String(),
						"attempt", attempt,
					)
				}
				continue
			}
			authFailureCount = 0
			conn.Close()
			slog.Info("SSH is reachable", "address", address)
			return nil
		}
	}
}

func isAuthFailure(err error) bool {
	if err == nil {
		return false
	}
	msg := strings.ToLower(err.Error())
	return strings.Contains(msg, "unable to authenticate") ||
		strings.Contains(msg, "no supported methods remain") ||
		strings.Contains(msg, "permission denied")
}
