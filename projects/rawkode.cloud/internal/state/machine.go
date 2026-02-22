package state

import (
	"context"
	"fmt"
	"io"
	"log/slog"
	"net"
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
// Values may come from config file, env vars, CLI flags, or Infisical.
type Config struct {
	ClusterName       string
	OfferID           string
	Zone              scw.Zone
	OSID              string
	TalosVersion      string
	TeleportProxy     string
	KubernetesVersion string

	// Scaleway credentials — fetched from Infisical or env vars
	ScalewayAccessKey string
	ScalewaySecretKey string

	// Infisical connection — used to fetch all other secrets
	InfisicalURL          string
	InfisicalClientID     string
	InfisicalClientSecret string
	InfisicalProjectID    string
	InfisicalEnvironment  string
	InfisicalSecretPath   string

	// InfisicalClusterClientID and InfisicalClusterClientSecret are the machine
	// identity credentials for the cluster's dedicated Infisical identity. At
	// provisioning time, the CLI uses these to mint a fresh, short-lived bootstrap
	// token that gets injected into the cluster. This keeps provisioning-level
	// Infisical access separate from runtime cluster access.
	// Fetched from INFISICAL_CLUSTER_CLIENT_ID and INFISICAL_CLUSTER_CLIENT_SECRET.
	InfisicalClusterClientID     string
	InfisicalClusterClientSecret string
}

// Run executes the 5-phase provisioning pipeline.
// Each phase has clear entry/exit conditions. If any phase fails,
// cleanup runs in reverse order (LIFO).
func Run(ctx context.Context, cfg Config) error {
	var cleanup []func()
	skipCleanup := false

	defer func() {
		if skipCleanup {
			return
		}
		for i := len(cleanup) - 1; i >= 0; i-- {
			cleanup[i]()
		}
	}()

	// ── Phase 0: Resolve secrets from Infisical ──
	// Infisical is the single source of truth for all secret material.
	// If we have Infisical credentials, authenticate and fetch any missing values.
	var infClient *infisical.Client

	if cfg.InfisicalURL != "" && cfg.InfisicalClientID != "" && cfg.InfisicalClientSecret != "" {
		slog.Info("authenticating with Infisical", "url", cfg.InfisicalURL)

		var err error
		infClient, err = infisical.NewClient(ctx, cfg.InfisicalURL, cfg.InfisicalClientID, cfg.InfisicalClientSecret)
		if err != nil {
			return fmt.Errorf("infisical auth: %w", err)
		}

		// Fetch all secrets from the configured path and backfill any missing config values
		if cfg.InfisicalProjectID != "" {
			env := cfg.InfisicalEnvironment
			if env == "" {
				env = "production"
			}
			path := cfg.InfisicalSecretPath
			if path == "" {
				path = "/"
			}

			secrets, err := infClient.GetSecrets(ctx, cfg.InfisicalProjectID, env, path)
			if err != nil {
				return fmt.Errorf("fetch secrets from infisical: %w", err)
			}

			backfillFromSecrets(&cfg, secrets)
		}
	}

	// Validate required fields after secret resolution
	if err := validateConfig(&cfg); err != nil {
		return fmt.Errorf("config validation: %w", err)
	}

	// Initialize Scaleway client with resolved credentials
	scwAPI, err := scaleway.NewClient(cfg.ScalewayAccessKey, cfg.ScalewaySecretKey)
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
		cleanupCtx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
		defer cancel()
		if err := scaleway.DeleteServer(cleanupCtx, scwAPI, serverID, cfg.Zone); err != nil {
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

	// Mint a fresh, short-lived Infisical bootstrap token for the cluster's own
	// machine identity. The CLI authenticates as the cluster identity using its
	// dedicated clientID/clientSecret (stored as secrets in Infisical) to obtain
	// this token. This keeps the CLI's provisioning-level access fully separate
	// from the cluster's runtime access.
	var infisicalBootstrapToken string
	clusterIDSet := cfg.InfisicalClusterClientID != ""
	clusterSecretSet := cfg.InfisicalClusterClientSecret != ""
	if clusterIDSet != clusterSecretSet {
		return fmt.Errorf("phase 3: INFISICAL_CLUSTER_CLIENT_ID and INFISICAL_CLUSTER_CLIENT_SECRET must both be set or both be absent")
	}
	if infClient != nil && clusterIDSet {
		infisicalBootstrapToken, err = infClient.CreateClusterBootstrapToken(
			ctx,
			cfg.InfisicalClusterClientID,
			cfg.InfisicalClusterClientSecret,
		)
		if err != nil {
			return fmt.Errorf("phase 3 (infisical bootstrap token) failed: %w", err)
		}
	}

	talosConfig, err := talos.GenerateConfig(talos.ClusterConfig{
		ClusterName:       cfg.ClusterName,
		ServerPublicIP:    publicIP,
		TeleportToken:     teleportToken,
		TeleportProxyAddr: cfg.TeleportProxy,
		InfisicalToken:    infisicalBootstrapToken,
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
		skipCleanup = true
		return fmt.Errorf("phase 5 (teleport verify) failed — server left running for manual debug: %w", err)
	}

	err = talos.LockdownFirewall(ctx, publicIP, talosConfig)
	if err != nil {
		return fmt.Errorf("phase 5 (lockdown) failed: %w", err)
	}

	// Success — skip cleanup so we don't delete the working server
	skipCleanup = true

	slog.Info("provisioning complete",
		"cluster", cfg.ClusterName,
		"server_id", serverID,
		"server_ip", publicIP,
		"access", "teleport",
	)
	return nil
}

// backfillFromSecrets fills in any missing Config fields from Infisical secrets.
// Secret keys map to config fields by convention:
//
//	SCW_ACCESS_KEY                  -> ScalewayAccessKey
//	SCW_SECRET_KEY                  -> ScalewaySecretKey
//	TELEPORT_PROXY                  -> TeleportProxy
//	SCALEWAY_OFFER_ID               -> OfferID
//	SCALEWAY_OS_ID                  -> OSID
//	CLUSTER_NAME                    -> ClusterName
//	TALOS_VERSION                   -> TalosVersion
//	KUBERNETES_VERSION              -> KubernetesVersion
//	INFISICAL_CLUSTER_CLIENT_ID     -> InfisicalClusterClientID
//	INFISICAL_CLUSTER_CLIENT_SECRET -> InfisicalClusterClientSecret
func backfillFromSecrets(cfg *Config, secrets map[string]string) {
	backfill := func(target *string, keys ...string) {
		if *target != "" {
			return
		}
		for _, key := range keys {
			if v, ok := secrets[key]; ok && v != "" {
				*target = v
				slog.Debug("backfilled config from infisical", "key", key)
				return
			}
		}
	}

	backfill(&cfg.ScalewayAccessKey, "SCW_ACCESS_KEY", "SCALEWAY_ACCESS_KEY")
	backfill(&cfg.ScalewaySecretKey, "SCW_SECRET_KEY", "SCALEWAY_SECRET_KEY")
	backfill(&cfg.TeleportProxy, "TELEPORT_PROXY", "TELEPORT_PROXY_ADDR")
	backfill(&cfg.OfferID, "SCALEWAY_OFFER_ID", "SCW_OFFER_ID")
	backfill(&cfg.OSID, "SCALEWAY_OS_ID", "SCW_OS_ID")
	backfill(&cfg.ClusterName, "CLUSTER_NAME")
	backfill(&cfg.TalosVersion, "TALOS_VERSION")
	backfill(&cfg.KubernetesVersion, "KUBERNETES_VERSION")
	backfill(&cfg.InfisicalClusterClientID, "INFISICAL_CLUSTER_CLIENT_ID")
	backfill(&cfg.InfisicalClusterClientSecret, "INFISICAL_CLUSTER_CLIENT_SECRET")
}

// validateConfig checks that all required fields are present after resolution.
func validateConfig(cfg *Config) error {
	var missing []string
	check := func(val, name string) {
		if val == "" {
			missing = append(missing, name)
		}
	}

	check(cfg.ClusterName, "cluster-name")
	check(cfg.OfferID, "offer-id")
	check(cfg.OSID, "os-id")
	check(cfg.TeleportProxy, "teleport-proxy")

	if len(missing) > 0 {
		return fmt.Errorf("missing required config: %s (set via config file, env vars, CLI flags, or Infisical)", strings.Join(missing, ", "))
	}
	return nil
}

// GetOperatorIP determines the public IP of the machine running the CLI.
// This is used to scope temporary firewall rules to the operator's IP only.
// It tries multiple services with retries so a single unavailable endpoint
// does not abort the provisioning run.
func GetOperatorIP(ctx context.Context) (string, error) {
	endpoints := []string{
		"https://checkip.amazonaws.com",
		"https://ifconfig.me/ip",
		"https://icanhazip.com",
	}

	const (
		maxAttempts = 3
		baseBackoff = 500 * time.Millisecond
	)

	var lastErr error

	for _, endpoint := range endpoints {
		for attempt := 0; attempt < maxAttempts; attempt++ {
			select {
			case <-ctx.Done():
				if lastErr != nil {
					return "", fmt.Errorf("context cancelled while determining operator IP (last error: %w)", lastErr)
				}
				return "", ctx.Err()
			default:
			}

			ip, err := fetchIP(ctx, endpoint)
			if err == nil {
				slog.Info("detected operator public IP", "ip", ip, "endpoint", endpoint)
				return ip, nil
			}

			lastErr = err
			slog.Debug("failed to determine operator IP", "endpoint", endpoint, "attempt", attempt+1, "error", err)

			if attempt < maxAttempts-1 {
				backoff := baseBackoff * time.Duration(1<<attempt)
				timer := time.NewTimer(backoff)
				select {
				case <-ctx.Done():
					timer.Stop()
					return "", fmt.Errorf("context cancelled while determining operator IP (last error: %w)", lastErr)
				case <-timer.C:
				}
			}
		}
	}

	return "", fmt.Errorf("could not determine operator IP after trying all endpoints: %w", lastErr)
}

// fetchIP fetches the public IP from a single endpoint and validates the result.
func fetchIP(ctx context.Context, endpoint string) (string, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return "", fmt.Errorf("build request for %s: %w", endpoint, err)
	}

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("request to %s failed: %w", endpoint, err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("non-200 status from %s: %s", endpoint, resp.Status)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", fmt.Errorf("read response from %s: %w", endpoint, err)
	}

	ip := strings.TrimSpace(string(body))
	if net.ParseIP(ip) == nil {
		return "", fmt.Errorf("invalid IP address returned from %s: %q", endpoint, ip)
	}

	return ip, nil
}
