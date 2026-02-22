package state

import (
	"context"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"github.com/rawkode-academy/rawkode-cloud/internal/infisical"
	"github.com/rawkode-academy/rawkode-cloud/internal/scaleway"
	"github.com/rawkode-academy/rawkode-cloud/internal/talos"
	"github.com/rawkode-academy/rawkode-cloud/internal/teleport"
	scw "github.com/scaleway/scaleway-sdk-go/scw"
)

// Config holds all parameters needed for a full provisioning run.
type Config struct {
	ClusterName       string
	OfferID           string
	Zone              scw.Zone
	OSID              string
	TalosVersion      string
	TeleportProxy     string
	InfisicalURL      string
	InfisicalClientID string
	InfisicalSecret   string
	KubernetesVersion string
}

// Run executes the 5-phase provisioning pipeline.
// Each phase has clear entry/exit conditions. If any phase fails,
// cleanup runs in reverse order (LIFO).
func Run(ctx context.Context, cfg Config) error {
	var cleanup []func()

	defer func() {
		for i := len(cleanup) - 1; i >= 0; i-- {
			cleanup[i]()
		}
	}()

	// Initialize Scaleway client
	scwAPI, err := scaleway.NewClient()
	if err != nil {
		return fmt.Errorf("init scaleway: %w", err)
	}

	// ── Phase 1: Order bare metal server ──
	slog.Info("starting phase 1: bare metal provisioning", "phase", "1")

	server, err := scaleway.OrderServer(ctx, scwAPI, cfg.OfferID, cfg.Zone)
	if err != nil {
		return fmt.Errorf("phase 1 failed: %w", err)
	}

	serverID := server.ID
	cleanup = append(cleanup, func() {
		slog.Warn("CLEANUP: deleting server", "server_id", serverID)
		if err := scaleway.DeleteServer(ctx, scwAPI, serverID, cfg.Zone); err != nil {
			slog.Error("CLEANUP FAILED: server not deleted, manual cleanup required",
				"server_id", serverID,
				"error", err,
			)
		}
	})

	server, err = scaleway.WaitForReady(ctx, scwAPI, serverID, cfg.Zone)
	if err != nil {
		return fmt.Errorf("phase 1 (wait) failed: %w", err)
	}

	// Extract the server's public IP
	var publicIP string
	for _, ip := range server.IPs {
		publicIP = ip.Address.String()
		break
	}
	if publicIP == "" {
		return fmt.Errorf("phase 1 failed: server has no public IP")
	}

	// ── Phase 2: Install OS with Talos pivot ──
	slog.Info("starting phase 2: OS pivot", "phase", "2")

	err = scaleway.InstallOS(ctx, scwAPI, serverID, cfg.Zone, cfg.OSID, cfg.TalosVersion)
	if err != nil {
		return fmt.Errorf("phase 2 failed: %w", err)
	}

	err = scaleway.WaitForInstall(ctx, scwAPI, serverID, cfg.Zone)
	if err != nil {
		return fmt.Errorf("phase 2 (install wait) failed: %w", err)
	}

	err = talos.WaitForMaintenanceMode(ctx, publicIP, 20*time.Minute)
	if err != nil {
		return fmt.Errorf("phase 2 (talos boot) failed: %w", err)
	}

	// ── Phase 3: Generate config (tokens, certs, manifests) ──
	// Happens AFTER ordering because tokens have limited lifetimes.
	slog.Info("starting phase 3: configuration generation", "phase", "3")

	operatorIP, err := GetOperatorIP(ctx)
	if err != nil {
		return fmt.Errorf("phase 3 (operator IP) failed: %w", err)
	}

	teleportToken, err := teleport.GenerateJoinToken(ctx, cfg.TeleportProxy, 30*time.Minute)
	if err != nil {
		return fmt.Errorf("phase 3 (teleport token) failed: %w", err)
	}

	infisicalToken, err := infisical.GenerateMachineToken(ctx, cfg.InfisicalURL, cfg.InfisicalClientID, cfg.InfisicalSecret)
	if err != nil {
		return fmt.Errorf("phase 3 (infisical token) failed: %w", err)
	}

	talosConfig, err := talos.GenerateConfig(talos.ClusterConfig{
		ClusterName:       cfg.ClusterName,
		ServerPublicIP:    publicIP,
		TeleportToken:     teleportToken,
		TeleportProxyAddr: cfg.TeleportProxy,
		InfisicalToken:    infisicalToken,
		OperatorIP:        operatorIP,
		KubernetesVersion: cfg.KubernetesVersion,
	})
	if err != nil {
		return fmt.Errorf("phase 3 (talos config) failed: %w", err)
	}

	// ── Phase 4: Bootstrap cluster ──
	slog.Info("starting phase 4: cluster bootstrap", "phase", "4")

	err = talos.ApplyConfig(ctx, publicIP, talosConfig)
	if err != nil {
		return fmt.Errorf("phase 4 (apply config) failed: %w", err)
	}

	err = talos.BootstrapCluster(ctx, publicIP, talosConfig)
	if err != nil {
		return fmt.Errorf("phase 4 (bootstrap) failed: %w", err)
	}

	// ── Phase 5: Verify Teleport, then lockdown ──
	slog.Info("starting phase 5: verify and lockdown", "phase", "5")

	err = teleport.WaitForAgent(ctx, cfg.TeleportProxy, cfg.ClusterName, 10*time.Minute)
	if err != nil {
		// Do NOT lock the firewall. Do NOT delete the server.
		// The developer needs to debug this manually.
		slog.Error("Teleport agent verification failed — firewall NOT locked",
			"error", err,
			"server_ip", publicIP,
		)
		cleanup = cleanup[:0]
		return fmt.Errorf("phase 5 (teleport verify) failed — server left running for manual debug: %w", err)
	}

	err = talos.LockdownFirewall(ctx, publicIP, talosConfig)
	if err != nil {
		return fmt.Errorf("phase 5 (lockdown) failed: %w", err)
	}

	// Success — remove cleanup so we don't delete the working server
	cleanup = cleanup[:0]

	slog.Info("provisioning complete",
		"cluster", cfg.ClusterName,
		"server_id", serverID,
		"server_ip", publicIP,
		"access", "teleport",
	)
	return nil
}

// GetOperatorIP determines the public IP of the machine running the CLI.
// This is used to scope temporary firewall rules to the operator's IP only.
func GetOperatorIP(ctx context.Context) (string, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, "https://checkip.amazonaws.com", nil)
	if err != nil {
		return "", fmt.Errorf("build request: %w", err)
	}

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("could not determine operator IP: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", fmt.Errorf("read operator IP response: %w", err)
	}

	ip := strings.TrimSpace(string(body))
	slog.Info("detected operator public IP", "ip", ip)
	return ip, nil
}
