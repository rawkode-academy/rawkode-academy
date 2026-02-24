package ssh

import (
	"bytes"
	"context"
	"fmt"
	"log/slog"
	"net"
	"os"
	"time"

	"golang.org/x/crypto/ssh"
	"golang.org/x/crypto/ssh/agent"
)

// Config holds SSH connection parameters.
type Config struct {
	Host        string
	Port        string
	User        string
	PrivateKey  []byte
	AgentSocket string
}

// Client wraps an SSH connection for executing commands on remote hosts.
type Client struct {
	conn *ssh.Client
}

func buildAuthMethods(privateKey []byte, agentSocket string) ([]ssh.AuthMethod, error) {
	if len(privateKey) > 0 {
		signer, err := ssh.ParsePrivateKey(privateKey)
		if err != nil {
			return nil, fmt.Errorf("parse SSH private key: %w", err)
		}
		return []ssh.AuthMethod{ssh.PublicKeys(signer)}, nil
	}

	sock := agentSocket
	if sock == "" {
		sock = os.Getenv("SSH_AUTH_SOCK")
	}
	if sock == "" {
		return nil, fmt.Errorf("no SSH private key provided and no agent socket available")
	}

	conn, err := net.Dial("unix", sock)
	if err != nil {
		return nil, fmt.Errorf("connect to SSH agent at %s: %w", sock, err)
	}

	agentClient := agent.NewClient(conn)
	return []ssh.AuthMethod{ssh.PublicKeysCallback(agentClient.Signers)}, nil
}

// Connect establishes an SSH connection with retry logic.
func Connect(ctx context.Context, cfg Config, timeout time.Duration) (*Client, error) {
	authMethods, err := buildAuthMethods(cfg.PrivateKey, cfg.AgentSocket)
	if err != nil {
		return nil, err
	}

	sshConfig := &ssh.ClientConfig{
		User:            cfg.User,
		Auth:            authMethods,
		HostKeyCallback: ssh.InsecureIgnoreHostKey(), //nolint:gosec
		Timeout:         10 * time.Second,
	}

	address := net.JoinHostPort(cfg.Host, cfg.Port)
	deadline := time.After(timeout)
	ticker := time.NewTicker(5 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return nil, ctx.Err()
		case <-deadline:
			return nil, fmt.Errorf("SSH connect to %s timed out after %s", address, timeout)
		case <-ticker.C:
			conn, dialErr := ssh.Dial("tcp", address, sshConfig)
			if dialErr != nil {
				slog.Debug("SSH connection attempt failed", "address", address, "error", dialErr)
				continue
			}
			slog.Info("SSH connection established", "address", address, "user", cfg.User)
			return &Client{conn: conn}, nil
		}
	}
}

// Run executes a command and returns its combined output.
func (c *Client) Run(ctx context.Context, cmd string) (string, error) {
	session, err := c.conn.NewSession()
	if err != nil {
		return "", fmt.Errorf("create SSH session: %w", err)
	}
	defer session.Close()

	var stdout, stderr bytes.Buffer
	session.Stdout = &stdout
	session.Stderr = &stderr

	done := make(chan error, 1)
	go func() {
		done <- session.Run(cmd)
	}()

	select {
	case <-ctx.Done():
		_ = session.Signal(ssh.SIGTERM)
		return "", ctx.Err()
	case err := <-done:
		if err != nil {
			return "", fmt.Errorf("SSH command %q failed: %w\nstderr: %s", cmd, err, stderr.String())
		}
		return stdout.String(), nil
	}
}

// RunWithStdin executes a command with data piped to stdin.
func (c *Client) RunWithStdin(ctx context.Context, cmd string, stdin []byte) (string, error) {
	session, err := c.conn.NewSession()
	if err != nil {
		return "", fmt.Errorf("create SSH session: %w", err)
	}
	defer session.Close()

	session.Stdin = bytes.NewReader(stdin)

	var stdout, stderr bytes.Buffer
	session.Stdout = &stdout
	session.Stderr = &stderr

	done := make(chan error, 1)
	go func() {
		done <- session.Run(cmd)
	}()

	select {
	case <-ctx.Done():
		_ = session.Signal(ssh.SIGTERM)
		return "", ctx.Err()
	case err := <-done:
		if err != nil {
			return "", fmt.Errorf("SSH command %q failed: %w\nstderr: %s", cmd, err, stderr.String())
		}
		return stdout.String(), nil
	}
}

// Upload writes content to a remote file by piping through tee.
func (c *Client) Upload(ctx context.Context, remotePath string, content []byte, mode string) error {
	cmd := fmt.Sprintf("sudo tee %s > /dev/null && sudo chmod %s %s", remotePath, mode, remotePath)
	_, err := c.RunWithStdin(ctx, cmd, content)
	return err
}

// Close closes the SSH connection.
func (c *Client) Close() error {
	return c.conn.Close()
}
