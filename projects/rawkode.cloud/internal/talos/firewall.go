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
// This is applied as a live config re-apply using the lockdown config bytes —
// the complete machine config without the temporary NetworkRuleConfig documents.
// Re-applying without those documents causes Talos to remove them.
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

	_, err = c.ApplyConfiguration(ctx, &machine.ApplyConfigurationRequest{
		Data: genCfg.LockdownConfigBytes,
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
