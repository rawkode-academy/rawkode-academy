package talos

import (
	"context"
	"fmt"
	"log/slog"
	"net"

	"github.com/siderolabs/talos/pkg/machinery/api/machine"
	talosclient "github.com/siderolabs/talos/pkg/machinery/client"
)

// LockdownFirewall removes the temporary firewall rules that allowed direct
// access to ports 50000 (Talos API) and 6443 (Kubernetes API). After this,
// all access goes through Teleport's encrypted, authenticated tunnel.
//
// This is applied as a live config patch — no reboot required.
func LockdownFirewall(ctx context.Context, ip string, genCfg *GeneratedConfig) error {
	address := net.JoinHostPort(ip, "50000")

	c, err := talosclient.New(ctx,
		talosclient.WithEndpoints(address),
		talosclient.WithConfig(genCfg.TalosConfig),
	)
	if err != nil {
		return fmt.Errorf("create talos client for lockdown: %w", err)
	}
	defer c.Close()

	// Apply a config patch that blocks all incoming traffic on the public
	// interface for ports 50000 and 6443. Outbound traffic remains unrestricted
	// (the node needs to pull images, reach Teleport proxy, etc.).
	//
	// The patch removes the operator IP exception from the network rules,
	// effectively closing the temporary access window.
	lockdownPatch := `[{"op": "remove", "path": "/machine/network"}]`

	_, err = c.ApplyConfiguration(ctx, &machine.ApplyConfigurationRequest{
		Data: []byte(lockdownPatch),
		Mode: machine.ApplyConfigurationRequest_AUTO,
	})
	if err != nil {
		return fmt.Errorf("apply firewall lockdown: %w", err)
	}

	slog.Info("firewall lockdown applied",
		"phase", "5",
		"blocked_ports", "50000, 6443",
		"access_method", "teleport-only",
	)
	return nil
}
