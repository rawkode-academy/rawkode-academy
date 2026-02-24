package talos

import (
	"context"
	"crypto/tls"
	"crypto/x509"
	"encoding/base64"
	"fmt"
	"log/slog"
	"net"
	"net/url"
	"strings"
	"time"

	machineapi "github.com/siderolabs/talos/pkg/machinery/api/machine"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials"
	"google.golang.org/protobuf/types/known/emptypb"
	"gopkg.in/yaml.v3"
)

const talosAPIDefaultPort = "50000"

// Client wraps Talos operations over the Talos gRPC API.
type Client struct {
	targetNode string
	insecure   bool

	conn    *grpc.ClientConn
	machine machineapi.MachineServiceClient
}

type talosconfigFile struct {
	Context  string                        `yaml:"context"`
	Contexts map[string]talosconfigContext `yaml:"contexts"`
}

type talosconfigContext struct {
	Endpoints []string `yaml:"endpoints"`
	Nodes     []string `yaml:"nodes"`
	CA        string   `yaml:"ca"`
	Crt       string   `yaml:"crt"`
	Key       string   `yaml:"key"`
}

// NewClient creates a Talos client using a talosconfig for mTLS auth.
func NewClient(endpoint string, talosconfig []byte) (*Client, error) {
	dialEndpoint, targetNode, err := normalizeTalosEndpoint(endpoint)
	if err != nil {
		return nil, err
	}
	if len(talosconfig) == 0 {
		return nil, fmt.Errorf("talosconfig is required")
	}

	ctxCfg, err := parseTalosconfigContext(talosconfig)
	if err != nil {
		return nil, err
	}

	tlsConfig, err := tlsConfigFromContext(ctxCfg, false)
	if err != nil {
		return nil, err
	}

	conn, err := grpc.NewClient(
		"dns:///"+dialEndpoint,
		grpc.WithTransportCredentials(credentials.NewTLS(tlsConfig)),
		grpc.WithDefaultCallOptions(grpc.MaxCallRecvMsgSize(32*1024*1024)),
	)
	if err != nil {
		return nil, fmt.Errorf("connect to Talos API %q: %w", dialEndpoint, err)
	}

	return &Client{
		targetNode: targetNode,
		conn:       conn,
		machine:    machineapi.NewMachineServiceClient(conn),
	}, nil
}

// NewInsecureClient creates a Talos client for maintenance mode.
func NewInsecureClient(endpoint string) (*Client, error) {
	dialEndpoint, targetNode, err := normalizeTalosEndpoint(endpoint)
	if err != nil {
		return nil, err
	}

	conn, err := grpc.NewClient(
		"dns:///"+dialEndpoint,
		grpc.WithTransportCredentials(credentials.NewTLS(&tls.Config{InsecureSkipVerify: true})), //nolint:gosec
		grpc.WithDefaultCallOptions(grpc.MaxCallRecvMsgSize(32*1024*1024)),
	)
	if err != nil {
		return nil, fmt.Errorf("connect to Talos API %q: %w", dialEndpoint, err)
	}

	return &Client{
		targetNode: targetNode,
		insecure:   true,
		conn:       conn,
		machine:    machineapi.NewMachineServiceClient(conn),
	}, nil
}

// Close closes the underlying Talos gRPC connection.
func (c *Client) Close() error {
	if c == nil || c.conn == nil {
		return nil
	}

	return c.conn.Close()
}

// ApplyConfig sends a machine configuration to a Talos node.
func (c *Client) ApplyConfig(ctx context.Context, configYAML []byte) error {
	if c.machine == nil {
		return fmt.Errorf("talos client is not initialized")
	}
	if len(strings.TrimSpace(string(configYAML))) == 0 {
		return fmt.Errorf("machine config is required")
	}

	slog.Info("applying Talos machine config", "target", c.targetNode)

	_, err := c.machine.ApplyConfiguration(ctx, &machineapi.ApplyConfigurationRequest{
		Data: configYAML,
		Mode: machineapi.ApplyConfigurationRequest_AUTO,
	})
	if err != nil {
		return fmt.Errorf("apply talos machine config: %w", err)
	}

	return nil
}

// Bootstrap bootstraps etcd on the first control plane node.
func (c *Client) Bootstrap(ctx context.Context) error {
	if c.machine == nil {
		return fmt.Errorf("talos client is not initialized")
	}
	if c.insecure {
		return fmt.Errorf("bootstrap requires talosconfig")
	}

	slog.Info("bootstrapping etcd", "target", c.targetNode)

	if _, err := c.machine.Bootstrap(ctx, &machineapi.BootstrapRequest{}); err != nil {
		return fmt.Errorf("bootstrap etcd: %w", err)
	}

	return nil
}

// HealthCheck verifies the node is healthy.
func (c *Client) HealthCheck(ctx context.Context) error {
	if c.machine == nil {
		return fmt.Errorf("talos client is not initialized")
	}

	timeout := time.NewTimer(5 * time.Minute)
	defer timeout.Stop()

	ticker := time.NewTicker(5 * time.Second)
	defer ticker.Stop()

	var lastErr error

	for {
		if _, err := c.machine.ServiceList(ctx, &emptypb.Empty{}); err == nil {
			return nil
		} else {
			lastErr = err
		}

		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-timeout.C:
			if lastErr == nil {
				lastErr = fmt.Errorf("node health check timed out")
			}
			return fmt.Errorf("health check failed: %w", lastErr)
		case <-ticker.C:
		}
	}
}

// Upgrade triggers a Talos OS upgrade on the node.
func (c *Client) Upgrade(ctx context.Context, imageURL string) error {
	if c.machine == nil {
		return fmt.Errorf("talos client is not initialized")
	}
	if c.insecure {
		return fmt.Errorf("upgrade requires talosconfig")
	}
	if strings.TrimSpace(imageURL) == "" {
		return fmt.Errorf("image URL is required")
	}

	_, err := c.machine.Upgrade(ctx, &machineapi.UpgradeRequest{
		Image: imageURL,
	})
	if err != nil {
		return fmt.Errorf("upgrade failed: %w", err)
	}

	return nil
}

// UpgradeKubernetes triggers a cluster Kubernetes control-plane version upgrade.
func (c *Client) UpgradeKubernetes(ctx context.Context, version string) error {
	_ = ctx
	_ = version
	return fmt.Errorf("kubernetes upgrades are orchestrated by regenerating and applying machine configs")
}

// Reset resets a Talos node.
func (c *Client) Reset(ctx context.Context) error {
	if c.machine == nil {
		return fmt.Errorf("talos client is not initialized")
	}

	req := &machineapi.ResetRequest{
		Graceful: true,
		Reboot:   true,
	}

	if c.insecure {
		req.Graceful = false
		req.Reboot = false
		req.Mode = machineapi.ResetRequest_SYSTEM_DISK
		req.SystemPartitionsToWipe = []*machineapi.ResetPartitionSpec{
			{
				Label: "STATE",
				Wipe:  true,
			},
		}
	}

	if _, err := c.machine.Reset(ctx, req); err != nil {
		return fmt.Errorf("reset failed: %w", err)
	}

	return nil
}

// WaitForMaintenance polls until the Talos API is reachable in maintenance mode.
func WaitForMaintenance(ctx context.Context, ip string, timeout time.Duration) error {
	target := net.JoinHostPort(ip, talosAPIDefaultPort)
	deadline := time.After(timeout)
	ticker := time.NewTicker(15 * time.Second)
	defer ticker.Stop()

	slog.Info("waiting for talos maintenance mode", "target", target)

	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-deadline:
			return fmt.Errorf("talos maintenance mode not reachable at %s within %s", target, timeout)
		case <-ticker.C:
			conn, err := net.DialTimeout("tcp", target, 5*time.Second)
			if err != nil {
				slog.Debug("talos not yet reachable", "target", target, "error", err)
				continue
			}
			conn.Close()
			slog.Info("talos maintenance mode reachable", "target", target)
			return nil
		}
	}
}

func parseTalosconfigContext(data []byte) (*talosconfigContext, error) {
	var cfg talosconfigFile
	if err := yaml.Unmarshal(data, &cfg); err != nil {
		return nil, fmt.Errorf("parse talosconfig YAML: %w", err)
	}

	if len(cfg.Contexts) == 0 {
		return nil, fmt.Errorf("talosconfig has no contexts")
	}

	contextName := strings.TrimSpace(cfg.Context)
	if contextName == "" {
		for k := range cfg.Contexts {
			contextName = k
			break
		}
	}

	ctxCfg, ok := cfg.Contexts[contextName]
	if !ok {
		return nil, fmt.Errorf("talosconfig context %q not found", contextName)
	}

	return &ctxCfg, nil
}

func tlsConfigFromContext(ctxCfg *talosconfigContext, insecure bool) (*tls.Config, error) {
	tlsConfig := &tls.Config{
		MinVersion:         tls.VersionTLS12,
		InsecureSkipVerify: insecure, //nolint:gosec
	}

	if !insecure {
		caBytes, err := decodeBase64Field("ca", ctxCfg.CA)
		if err != nil {
			return nil, err
		}

		pool := x509.NewCertPool()
		if ok := pool.AppendCertsFromPEM(caBytes); !ok {
			return nil, fmt.Errorf("invalid talosconfig CA certificate")
		}
		tlsConfig.RootCAs = pool
	}

	if strings.TrimSpace(ctxCfg.Crt) != "" || strings.TrimSpace(ctxCfg.Key) != "" {
		crtBytes, err := decodeBase64Field("crt", ctxCfg.Crt)
		if err != nil {
			return nil, err
		}
		keyBytes, err := decodeBase64Field("key", ctxCfg.Key)
		if err != nil {
			return nil, err
		}

		cert, err := tls.X509KeyPair(crtBytes, keyBytes)
		if err != nil {
			return nil, fmt.Errorf("parse talosconfig client certificate: %w", err)
		}
		tlsConfig.Certificates = []tls.Certificate{cert}
	}

	return tlsConfig, nil
}

func decodeBase64Field(fieldName, value string) ([]byte, error) {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return nil, fmt.Errorf("talosconfig field %q is required", fieldName)
	}

	decoded, err := base64.StdEncoding.DecodeString(trimmed)
	if err != nil {
		return nil, fmt.Errorf("decode talosconfig field %q: %w", fieldName, err)
	}

	return decoded, nil
}

func normalizeTalosEndpoint(endpoint string) (dialEndpoint, targetNode string, err error) {
	trimmed := strings.TrimSpace(endpoint)
	if trimmed == "" {
		return "", "", fmt.Errorf("endpoint is required")
	}

	hostPort := trimmed
	if strings.Contains(trimmed, "://") {
		parsed, parseErr := url.Parse(trimmed)
		if parseErr != nil {
			return "", "", fmt.Errorf("parse endpoint %q: %w", endpoint, parseErr)
		}
		if parsed.Host == "" {
			return "", "", fmt.Errorf("endpoint %q has no host", endpoint)
		}
		hostPort = parsed.Host
	}

	if host, port, splitErr := net.SplitHostPort(hostPort); splitErr == nil {
		if host == "" {
			return "", "", fmt.Errorf("endpoint %q has empty host", endpoint)
		}
		if port == "" {
			port = talosAPIDefaultPort
		}
		return net.JoinHostPort(host, port), host, nil
	}

	if strings.HasPrefix(hostPort, "[") && strings.HasSuffix(hostPort, "]") {
		host := strings.TrimSuffix(strings.TrimPrefix(hostPort, "["), "]")
		return net.JoinHostPort(host, talosAPIDefaultPort), host, nil
	}

	// IPv6 literal without brackets.
	if strings.Count(hostPort, ":") > 1 {
		return net.JoinHostPort(hostPort, talosAPIDefaultPort), hostPort, nil
	}

	return net.JoinHostPort(hostPort, talosAPIDefaultPort), hostPort, nil
}
