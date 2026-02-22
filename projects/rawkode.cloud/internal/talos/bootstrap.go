package talos

import (
	"context"
	"fmt"
	"log/slog"
	"net"
	"time"

	"github.com/siderolabs/talos/pkg/machinery/api/machine"
	talosclient "github.com/siderolabs/talos/pkg/machinery/client"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/protobuf/types/known/emptypb"
)

// WaitForMaintenanceMode polls until the Talos API is responding on port 50000.
// Uses the actual gRPC Version endpoint, not raw TCP — a raw connect can succeed
// during the reboot cycle before the Talos API is genuinely serving.
func WaitForMaintenanceMode(ctx context.Context, ip string, timeout time.Duration) error {
	deadline := time.After(timeout)
	ticker := time.NewTicker(10 * time.Second)
	defer ticker.Stop()

	address := net.JoinHostPort(ip, "50000")

	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-deadline:
			return fmt.Errorf("talos maintenance mode not detected on %s within %s", address, timeout)
		case <-ticker.C:
			dialCtx, cancel := context.WithTimeout(ctx, 5*time.Second)
			conn, err := grpc.DialContext(dialCtx, address,
				grpc.WithTransportCredentials(insecure.NewCredentials()),
				grpc.WithBlock(),
			)
			cancel()
			if err != nil {
				slog.Debug("waiting for Talos maintenance mode", "address", address, "error", err)
				continue
			}

			machineClient := machine.NewMachineServiceClient(conn)
			_, err = machineClient.Version(ctx, &emptypb.Empty{})
			conn.Close()

			if err != nil {
				slog.Debug("Talos port open but API not ready yet", "error", err)
				continue
			}

			slog.Info("Talos maintenance mode confirmed", "phase", "2", "address", address)
			return nil
		}
	}
}

// ApplyConfig sends the complete machine configuration to a Talos node in maintenance mode.
// This is the only time we communicate without mTLS — the node has no identity yet.
// The firewall is scoped to the operator's IP to mitigate this.
func ApplyConfig(ctx context.Context, ip string, genCfg *GeneratedConfig) error {
	address := net.JoinHostPort(ip, "50000")

	conn, err := grpc.DialContext(ctx, address,
		grpc.WithTransportCredentials(insecure.NewCredentials()),
	)
	if err != nil {
		return fmt.Errorf("connect to talos: %w", err)
	}
	defer conn.Close()

	machineClient := machine.NewMachineServiceClient(conn)

	configBytes, err := genCfg.MachineConfig.Bytes()
	if err != nil {
		return fmt.Errorf("serialize config: %w", err)
	}

	_, err = machineClient.ApplyConfiguration(ctx, &machine.ApplyConfigurationRequest{
		Data: configBytes,
		Mode: machine.ApplyConfigurationRequest_AUTO,
	})
	if err != nil {
		return fmt.Errorf("apply config: %w", err)
	}

	slog.Info("configuration applied, node will reboot into cluster mode",
		"phase", "4",
		"ip", ip,
	)
	return nil
}

// BootstrapCluster initiates etcd on the first control plane node.
// This is a one-time operation. Subsequent nodes join the existing cluster.
func BootstrapCluster(ctx context.Context, ip string, genCfg *GeneratedConfig) error {
	address := net.JoinHostPort(ip, "50000")

	// Create a Talos client using the generated PKI credentials (talosconfig).
	c, err := talosclient.New(ctx,
		talosclient.WithEndpoints(address),
		talosclient.WithConfig(genCfg.TalosConfig),
	)
	if err != nil {
		return fmt.Errorf("create talos client: %w", err)
	}
	defer c.Close()

	// Wait for the node to be reachable after config-apply reboot
	if err := waitForTalosAPI(ctx, c, 10*time.Minute); err != nil {
		return fmt.Errorf("waiting for talos API after config apply: %w", err)
	}

	if err := c.Bootstrap(ctx, &machine.BootstrapRequest{}); err != nil {
		return fmt.Errorf("bootstrap etcd: %w", err)
	}

	slog.Info("etcd bootstrap initiated", "phase", "4", "ip", ip)

	if err := waitForKubernetesReady(ctx, c, 10*time.Minute); err != nil {
		return fmt.Errorf("kubernetes readiness: %w", err)
	}

	return nil
}

// waitForTalosAPI polls until the Talos API responds with mTLS credentials.
func waitForTalosAPI(ctx context.Context, c *talosclient.Client, timeout time.Duration) error {
	ticker := time.NewTicker(10 * time.Second)
	defer ticker.Stop()

	deadline := time.After(timeout)

	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-deadline:
			return fmt.Errorf("talos API did not become available within %s", timeout)
		case <-ticker.C:
			_, err := c.Version(ctx)
			if err != nil {
				slog.Debug("waiting for Talos API with mTLS", "error", err)
				continue
			}
			slog.Info("Talos API available with mTLS", "phase", "4")
			return nil
		}
	}
}

// waitForKubernetesReady polls until Kubernetes components report healthy.
// etcd bootstrap + component startup takes time. Rushing to Phase 5 before
// this completes means Teleport's agent pod won't be scheduled.
func waitForKubernetesReady(ctx context.Context, c *talosclient.Client, timeout time.Duration) error {
	ticker := time.NewTicker(15 * time.Second)
	defer ticker.Stop()

	deadline := time.After(timeout)

	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-deadline:
			return fmt.Errorf("kubernetes did not become ready within %s", timeout)
		case <-ticker.C:
			resp, err := c.ServiceList(ctx)
			if err != nil {
				slog.Debug("waiting for kubernetes components", "error", err)
				continue
			}

			requiredServices := map[string]bool{
				"etcd":    false,
				"kubelet": false,
				"apid":    false,
				"trustd":  false,
			}

			for _, msg := range resp.Messages {
				for _, svc := range msg.Services {
					if _, required := requiredServices[svc.Id]; required {
						if svc.State == "Running" && svc.Health.Healthy {
							requiredServices[svc.Id] = true
						}
					}
				}
			}

			allHealthy := true
			for name, healthy := range requiredServices {
				if !healthy {
					slog.Debug("service not ready", "service", name)
					allHealthy = false
				}
			}

			if allHealthy {
				slog.Info("all Talos services healthy", "phase", "4")
				return nil
			}
		}
	}
}
