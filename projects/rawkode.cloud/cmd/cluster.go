package cmd

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net"
	"os"
	"strings"
	"sync"

	"github.com/rawkode-academy/rawkode-cloud3/internal/cilium"
	"github.com/rawkode-academy/rawkode-cloud3/internal/cloudflare"
	clusterstate "github.com/rawkode-academy/rawkode-cloud3/internal/cluster"
	"github.com/rawkode-academy/rawkode-cloud3/internal/config"
	"github.com/rawkode-academy/rawkode-cloud3/internal/flux"
	"github.com/rawkode-academy/rawkode-cloud3/internal/infisical"
	"github.com/rawkode-academy/rawkode-cloud3/internal/operation"
	"github.com/rawkode-academy/rawkode-cloud3/internal/scaleway"
	"github.com/rawkode-academy/rawkode-cloud3/internal/talos"
	"github.com/rawkode-academy/rawkode-cloud3/internal/teleport"
	scw "github.com/scaleway/scaleway-sdk-go/scw"
	"github.com/spf13/cobra"

	"time"
)

var clusterCmd = &cobra.Command{
	Use:   "cluster",
	Short: "Cluster lifecycle management",
}

const (
	infisicalTalosSecretsKey      = "TALOS_SECRETS_YAML"
	infisicalTalosControlPlaneKey = "TALOS_CONTROLPLANE_CONFIG_YAML"
	infisicalTalosWorkerKey       = "TALOS_WORKER_CONFIG_YAML"
	infisicalTalosConfigKey       = "TALOSCONFIG_YAML"
)

var infisicalClientCache struct {
	mu     sync.Mutex
	key    string
	client *infisical.Client
}

var clusterCreateCmd = &cobra.Command{
	Use:   "create",
	Short: "Create a new Talos Kubernetes cluster",
	RunE:  runClusterCreate,
}

var clusterStatusCmd = &cobra.Command{
	Use:   "status",
	Short: "Show cluster health and drift detection",
	RunE: func(cmd *cobra.Command, args []string) error {
		cfgPath, _ := cmd.Flags().GetString("config")
		cfg, err := config.Load(cfgPath)
		if err != nil {
			return fmt.Errorf("load config: %w", err)
		}

		fmt.Printf("Cluster: %s\n", cfg.Environment)
		fmt.Printf("Talos:   %s\n", cfg.Cluster.TalosVersion)
		fmt.Printf("K8s:     %s\n", cfg.Cluster.KubernetesVersion)
		fmt.Printf("Cilium:  %s\n", cfg.Cluster.EffectiveCiliumVersion())
		fmt.Printf("Flux:    %s\n", cfg.Cluster.EffectiveFluxVersion())
		fmt.Printf("Teleport: %s\n", cfg.Cluster.EffectiveTeleportVersion())
		fmt.Printf("Pools:   %d\n", len(cfg.NodePools))

		for _, pool := range cfg.NodePools {
			fmt.Printf("  - %s (offer=%s, billing=%s)\n", pool.Name, pool.Offer, pool.BillingCycle)
		}

		return nil
	},
}

func init() {
	clusterCmd.AddCommand(clusterCreateCmd)
	clusterCmd.AddCommand(clusterDeleteCmd)
	clusterCmd.AddCommand(clusterStatusCmd)
	clusterCmd.AddCommand(clusterScaffoldCmd)

	clusterCreateCmd.Flags().StringP("environment", "e", "", "Cluster/environment name")
	clusterCreateCmd.Flags().StringP("file", "f", "", "Path to cluster config YAML")
	clusterCreateCmd.Flags().String("node-name", "", "Deprecated: control-plane names are now auto-generated from the pool")
	clusterCreateCmd.Flags().String("pool", "", "Node pool name (defaults to first controlplane pool)")
	clusterCreateCmd.Flags().Bool("cleanup", false, "Force cleanup of incomplete provisioned resources before creating the cluster")

	clusterDeleteCmd.Flags().StringP("environment", "e", "", "Cluster/environment name")
	clusterDeleteCmd.Flags().StringP("file", "f", "", "Path to cluster config YAML")

	clusterStatusCmd.Flags().String("config", "", "Path to cluster config YAML")
}

// createClusterPhases defines the phase order for creating a cluster.
var createClusterPhases = []string{
	"init",
	"generate-config",
	"order-server",
	"wait-server",
	"wait-talos",
	"apply-config",
	"bootstrap",
	"dns",
	"post-bootstrap",
	"verify",
}

var (
	ciliumInstallFn                         = cilium.Install
	fluxBootstrapFn                         = flux.Bootstrap
	teleportGenerateJoinTokenFn             = teleport.GenerateJoinToken
	teleportDeployKubeAgentFn               = teleport.DeployKubeAgent
	teleportDeploySelfHostedFn              = teleport.DeploySelfHosted
	teleportEnsureAdminAccessFn             = teleport.EnsureAdminAccess
	postBootstrapKubeconfigPathFn           = postBootstrapKubeconfigPath
	scalewayNewClientFn                     = scaleway.NewClient
	scalewayEnsureNetworkFoundationFn       = scaleway.EnsureNetworkFoundation
	scalewayResolvePrivateNetworkIPv4CIDRFn = scaleway.ResolvePrivateNetworkIPv4CIDR
)

func runClusterCreate(cmd *cobra.Command, args []string) error {
	ctx := context.Background()
	clusterName, _ := cmd.Flags().GetString("environment")
	cfgPathFlag, _ := cmd.Flags().GetString("file")
	nodeNameFlag, _ := cmd.Flags().GetString("node-name")
	poolName, _ := cmd.Flags().GetString("pool")
	cleanupRequested, _ := cmd.Flags().GetBool("cleanup")

	cfg, cfgPath, err := loadConfigForClusterOrFile(clusterName, cfgPathFlag)
	if err != nil {
		return err
	}

	pool, err := selectCreatePool(cfg, poolName)
	if err != nil {
		return err
	}

	if pool.EffectiveType() != config.NodeTypeControlPlane {
		return fmt.Errorf("cluster create currently supports controlplane pools only (pool %q is %q)", pool.Name, pool.EffectiveType())
	}
	if strings.TrimSpace(nodeNameFlag) != "" {
		return fmt.Errorf(
			"--node-name is no longer supported; first control-plane node will be %q",
			controlPlaneNodeName(cfg.Environment, pool.Name, 1),
		)
	}

	nodeName := controlPlaneNodeName(cfg.Environment, pool.Name, 1)
	privateIP, err := controlPlaneReservedIPForSlot(pool, 1)
	if err != nil {
		return err
	}

	scwAccessKey, scwSecretKey := cfg.ScalewayCredentials()

	// Initialize S3-backed operation store
	store, err := operation.NewStore(operation.StoreConfig{
		Bucket:    cfg.State.Bucket,
		Region:    cfg.State.Region,
		Endpoint:  cfg.State.Endpoint,
		AccessKey: scwAccessKey,
		SecretKey: scwSecretKey,
	})
	if err != nil {
		return fmt.Errorf("init operation store: %w", err)
	}

	// Check for incomplete operations to resume or cleanup.
	incomplete, err := store.FindIncomplete(operation.TypeCreateCluster, cfg.Environment)
	if err != nil {
		return fmt.Errorf("check resume: %w", err)
	}
	var existing *operation.Operation
	if len(incomplete) > 0 {
		existing = incomplete[0]
	}

	nodeStore := clusterstate.NewNodeStore(store, cfg.Environment)

	if existing != nil {
		resumePhase := existing.ResumePhase()
		shouldCleanup, reason := shouldCleanupIncompleteCreateOperation(existing, cleanupRequested)
		if shouldCleanup {
			slog.Warn("incomplete create-cluster operation will be cleaned up before retry",
				"operation", existing.ID,
				"cluster", existing.Cluster,
				"resume_phase", resumePhase,
				"reason", reason,
			)
			fmt.Printf("Found incomplete operation %s (type=%s, phase=%s)\n", existing.ID, existing.Type, resumePhase)
			fmt.Printf("Cleaning up incomplete operation before create: %s\n", reason)
			if err := cleanupIncompleteCreateOperation(ctx, cfg, store, nodeStore, existing, reason); err != nil {
				return err
			}
			existing = nil
		} else {
			slog.Info("found incomplete create-cluster operation eligible for resume",
				"id", existing.ID,
				"type", existing.Type,
				"cluster", existing.Cluster,
				"resume_phase", resumePhase,
				"updated_at", existing.UpdatedAt,
			)
			fmt.Printf("Found incomplete operation %s (type=%s, phase=%s)\n", existing.ID, existing.Type, resumePhase)
			fmt.Printf("Resuming from phase: %s\n", resumePhase)
		}
	}

	var op *operation.Operation
	if existing != nil {
		op = existing
		if err := ensureCreateOperationContext(op, nodeName, pool, privateIP, cfg.Environment); err != nil {
			return err
		}
		if err := store.Save(op); err != nil {
			return fmt.Errorf("save resumed operation context: %w", err)
		}
	} else {
		op = operation.New(operation.GenerateID(), operation.TypeCreateCluster, cfg.Environment, createClusterPhases)
		op.SetContext("nodeName", nodeName)
		op.SetContext("role", pool.EffectiveType())
		op.SetContext("poolName", pool.Name)
		op.SetContext("controlPlaneSlot", "1")
		if privateIP != "" {
			op.SetContext("privateIP", privateIP)
		}
		if err := store.Save(op); err != nil {
			return fmt.Errorf("save new operation: %w", err)
		}
	}

	// Execute phases from resume point
	resumePhase := op.ResumePhase()
	if resumePhase == "" {
		fmt.Println("Operation already complete.")
		return nil
	}

	slog.Info("starting create-cluster operation",
		"operation", op.ID,
		"cluster", cfg.Environment,
		"config", cfgPath,
		"pool", op.GetContextString("poolName"),
		"resume_from", resumePhase,
	)

	return executeCreateCluster(ctx, op, store, nodeStore, cfg)
}

func shouldCleanupIncompleteCreateOperation(op *operation.Operation, forceCleanup bool) (bool, string) {
	if op == nil {
		return false, ""
	}
	if forceCleanup {
		return true, "--cleanup requested"
	}

	if hasTalosActivationEvidence(op) {
		return false, "Talos activation detected"
	}

	resumePhase := op.ResumePhase()
	if isCreatePreTalosPhase(resumePhase) {
		return true, fmt.Sprintf("operation is pre-Talos activation (phase %q)", resumePhase)
	}

	return false, ""
}

func hasTalosActivationEvidence(op *operation.Operation) bool {
	if op == nil {
		return false
	}

	if activatedRaw, ok := op.GetContext("talosActivated"); ok {
		if activated, ok := activatedRaw.(bool); ok && activated {
			return true
		}
	}

	phase, ok := op.Phases["apply-config"]
	if ok && phase != nil && phase.Status == operation.PhaseCompleted {
		return true
	}

	for _, name := range []string{"bootstrap", "dns", "post-bootstrap", "verify"} {
		p, ok := op.Phases[name]
		if !ok || p == nil {
			continue
		}
		if p.Status != operation.PhasePending {
			return true
		}
	}

	return false
}

func isCreatePreTalosPhase(phase string) bool {
	switch strings.TrimSpace(phase) {
	case "init", "generate-config", "order-server", "wait-server", "wait-talos":
		return true
	default:
		return false
	}
}

func cleanupIncompleteCreateOperation(
	ctx context.Context,
	cfg *config.Config,
	store *operation.Store,
	nodeStore *clusterstate.NodeStore,
	op *operation.Operation,
	reason string,
) error {
	if op == nil {
		return nil
	}

	registry := newCreateCleanupRegistry(cfg)
	errs := registry.ExecuteLIFO(ctx, op.Cleanup)
	hasDeleteServerCleanup := false
	for _, action := range op.Cleanup {
		if action.Type == "delete-server" {
			hasDeleteServerCleanup = true
			break
		}
	}

	// Best-effort fallback for operations that have server context but no cleanup stack.
	if !hasDeleteServerCleanup {
		if serverID := strings.TrimSpace(op.GetContextString("serverId")); serverID != "" {
			if zone := strings.TrimSpace(op.GetContextString("zone")); zone != "" {
				err := runDeleteServerCleanupAction(ctx, cfg, cleanupDeleteServer{
					ServerID: serverID,
					Zone:     zone,
				})
				if err != nil {
					errs = append(errs, fmt.Errorf("fallback delete-server cleanup: %w", err))
				}
			}
		}
	}

	if len(errs) > 0 {
		return fmt.Errorf("cleanup incomplete operation %s: %w", op.ID, errors.Join(errs...))
	}

	if strings.TrimSpace(op.GetContextString("serverId")) != "" {
		if err := markNodeDeleted(ctx, nodeStore, op, cfg.Environment); err != nil {
			slog.Warn("failed to persist deleted node state after cleanup", "error", err)
		}
	}

	if err := store.Delete(op.ID); err != nil {
		return fmt.Errorf("remove cleaned operation %s from store: %w", op.ID, err)
	}

	slog.Info("cleaned incomplete create operation", "operation", op.ID, "reason", reason)
	return nil
}

func executeCreateCluster(
	ctx context.Context,
	op *operation.Operation,
	store *operation.Store,
	nodeStore *clusterstate.NodeStore,
	cfg *config.Config,
) error {
	for {
		phase := op.ResumePhase()
		if phase == "" {
			fmt.Println("Cluster creation complete!")
			return store.Save(op)
		}

		slog.Info("executing phase", "phase", phase, "operation", op.ID)

		if err := op.StartPhase(phase); err != nil {
			return fmt.Errorf("start phase %s: %w", phase, err)
		}
		if err := store.Save(op); err != nil {
			return fmt.Errorf("save phase start %s: %w", phase, err)
		}

		var phaseErr error
		switch phase {
		case "init":
			phaseErr = phaseInit(ctx, op, cfg)
		case "generate-config":
			phaseErr = phaseGenerateConfig(ctx, op, cfg)
		case "order-server":
			phaseErr = phaseOrderServer(ctx, op, cfg, nodeStore)
		case "wait-server":
			phaseErr = phaseWaitServer(ctx, op, cfg, nodeStore)
		case "wait-talos":
			phaseErr = phaseWaitTalos(ctx, op, cfg)
		case "apply-config":
			phaseErr = phaseApplyConfig(ctx, op, cfg)
		case "bootstrap":
			phaseErr = phaseBootstrap(ctx, op, cfg)
		case "dns":
			phaseErr = phaseDNS(ctx, op, cfg)
		case "post-bootstrap":
			phaseErr = phasePostBootstrap(ctx, op, cfg)
		case "verify":
			phaseErr = phaseVerify(ctx, op, cfg)
		default:
			phaseErr = fmt.Errorf("unknown phase %q", phase)
		}

		if phaseErr != nil {
			_ = op.FailPhase(phase, phaseErr)
			_ = store.Save(op)
			if err := markNodeFailed(ctx, nodeStore, op, cfg.Environment); err != nil {
				slog.Warn("failed to persist failed node state", "error", err)
			}
			return fmt.Errorf("phase %s failed: %w", phase, phaseErr)
		}

		if err := op.CompletePhase(phase, nil); err != nil {
			return fmt.Errorf("complete phase %s: %w", phase, err)
		}
		if err := store.Save(op); err != nil {
			return fmt.Errorf("save phase complete %s: %w", phase, err)
		}
	}
}

// Phase implementations

func phaseInit(ctx context.Context, op *operation.Operation, cfg *config.Config) error {
	slog.Info("phase init: ensuring Talos secrets are available in Infisical")

	client, err := newInfisicalClient(ctx, cfg)
	if err != nil {
		return err
	}
	if _, err := ensureTalosSecretsYAML(ctx, cfg, client); err != nil {
		return err
	}

	op.SetContext("secretsPath", infisicalSecretPathForCluster(cfg))
	return nil
}

func phaseGenerateConfig(ctx context.Context, op *operation.Operation, cfg *config.Config) error {
	slog.Info("phase generate-config: validating Talos generation prerequisites")

	client, err := newInfisicalClient(ctx, cfg)
	if err != nil {
		return err
	}
	if _, err := ensureTalosSecretsYAML(ctx, cfg, client); err != nil {
		return err
	}

	return nil
}

func phaseOrderServer(
	ctx context.Context,
	op *operation.Operation,
	cfg *config.Config,
	nodeStore *clusterstate.NodeStore,
) error {
	pool, err := poolForOperation(cfg, op)
	if err != nil {
		return fmt.Errorf("resolve node pool: %w", err)
	}

	nodeName := nodeNameForOperation(op, cfg.Environment)
	role := op.GetContextString("role")
	if role == "" {
		role = pool.EffectiveType()
	}
	privateIP := strings.TrimSpace(op.GetContextString("privateIP"))
	if privateIP == "" && role == config.NodeTypeControlPlane {
		if slot, ok := parseControlPlaneSlot(cfg.Environment, pool.Name, nodeName); ok {
			reserved, err := controlPlaneReservedIPForSlot(pool, slot)
			if err != nil {
				return err
			}
			privateIP = strings.TrimSpace(reserved)
			if privateIP != "" {
				op.SetContext("privateIP", privateIP)
			}
		}
	}

	// Check if server already exists from a previous run
	if serverID := op.GetContextString("serverId"); serverID != "" {
		slog.Info("server already ordered", "server_id", serverID)
		if err := nodeStore.Upsert(ctx, clusterstate.NodeState{
			Name:     nodeName,
			Role:     role,
			Pool:     pool.Name,
			ServerID: serverID,
			Status:   clusterstate.NodeStatusProvisioning,
		}); err != nil {
			return fmt.Errorf("persist node state: %w", err)
		}
		return nil
	}

	slog.Info("phase order-server: ordering Scaleway bare metal")

	scwAccessKey, scwSecretKey := cfg.ScalewayCredentials()
	scwClient, err := scalewayNewClientFn(
		scwAccessKey,
		scwSecretKey,
		cfg.Scaleway.ProjectID,
		cfg.Scaleway.OrganizationID,
	)
	if err != nil {
		return fmt.Errorf("create scaleway client: %w", err)
	}

	zoneValue := pool.EffectiveZone()
	if zoneValue == "" {
		return fmt.Errorf("node pool %q must define zone", pool.Name)
	}
	op.SetContext("zone", zoneValue)
	zone := scw.Zone(zoneValue)

	// Resolve offer and OS
	offerID, _, err := scaleway.ResolveOfferForBillingCycle(ctx, scwClient, zone, pool.Offer, pool.BillingCycle)
	if err != nil {
		return fmt.Errorf("resolve offer: %w", err)
	}

	osID, err := scaleway.ResolveUbuntuOSID(ctx, scwClient, zone, offerID)
	if err != nil {
		return fmt.Errorf("resolve ubuntu OS: %w", err)
	}

	// Ensure network foundation
	region, _ := zone.Region()
	vpcName, err := cfg.ScalewayVPCName()
	if err != nil {
		return err
	}
	privateNetworkName, err := cfg.ScalewayPrivateNetworkName()
	if err != nil {
		return err
	}
	network, err := scaleway.EnsureNetworkFoundation(ctx, scwClient, scaleway.NetworkFoundationParams{
		Region:             region,
		VPCName:            vpcName,
		PrivateNetworkName: privateNetworkName,
	})
	if err != nil {
		return fmt.Errorf("ensure network: %w", err)
	}
	op.SetContext("privateNetworkID", network.PrivateNetworkID)

	// Build Talos pivot cloud-init
	cloudInit := talos.BuildCloudInit(talos.PivotParams{
		TalosVersion:   cfg.Cluster.TalosVersion,
		TalosSchematic: cfg.Cluster.TalosSchematic,
		OSDisk:         pool.Disks.OS,
		DataDisk:       pool.Disks.Data,
	})

	// Order the server
	server, err := scaleway.OrderServer(ctx, scwClient, scaleway.ProvisionParams{
		OfferID:                  offerID,
		Zone:                     zone,
		OSID:                     osID,
		Name:                     nodeName,
		PrivateNetworkID:         network.PrivateNetworkID,
		PrivateNetworkReservedIP: privateIP,
		BillingCycle:             pool.BillingCycle,
		CloudInitScript:          cloudInit,
		SSHKeyGitHubUser:         "", // uses Scaleway API keys, falls back to default
		PivotOSDisk:              pool.Disks.OS,
		PivotDataDisk:            pool.Disks.Data,
	})
	if err != nil {
		return fmt.Errorf("order server: %w", err)
	}

	op.SetContext("serverId", server.ID)
	_ = op.AddCleanup("delete-server", map[string]string{
		"serverId": server.ID,
		"zone":     string(zone),
	})

	if err := nodeStore.Upsert(ctx, clusterstate.NodeState{
		Name:      nodeName,
		Role:      role,
		Pool:      pool.Name,
		ServerID:  server.ID,
		PublicIP:  op.GetContextString("publicIP"),
		PrivateIP: op.GetContextString("privateIP"),
		Status:    clusterstate.NodeStatusProvisioning,
	}); err != nil {
		return fmt.Errorf("persist node state: %w", err)
	}

	slog.Info("server ordered", "server_id", server.ID)
	return nil
}

func phaseWaitServer(
	ctx context.Context,
	op *operation.Operation,
	cfg *config.Config,
	nodeStore *clusterstate.NodeStore,
) error {
	serverID := op.GetContextString("serverId")
	if serverID == "" {
		return fmt.Errorf("no server ID in operation context")
	}

	slog.Info("phase wait-server: waiting for bare metal provisioning", "server_id", serverID)

	pool, err := poolForOperation(cfg, op)
	if err != nil {
		return fmt.Errorf("resolve node pool: %w", err)
	}

	scwAccessKey, scwSecretKey := cfg.ScalewayCredentials()
	scwClient, err := scaleway.NewClient(
		scwAccessKey,
		scwSecretKey,
		cfg.Scaleway.ProjectID,
		cfg.Scaleway.OrganizationID,
	)
	if err != nil {
		return fmt.Errorf("create scaleway client: %w", err)
	}

	zoneValue := strings.TrimSpace(op.GetContextString("zone"))
	if zoneValue == "" {
		zoneValue = pool.EffectiveZone()
	}
	if zoneValue == "" {
		return fmt.Errorf("node pool %q must define zone", pool.Name)
	}
	zone := scw.Zone(zoneValue)
	server, err := scaleway.WaitForReady(ctx, scwClient, serverID, zone)
	if err != nil {
		return fmt.Errorf("wait for server ready: %w", err)
	}

	// Extract IPs
	for _, ip := range server.IPs {
		addr := ip.Address.String()
		parsed := net.ParseIP(addr)
		if parsed != nil && parsed.IsPrivate() {
			if strings.TrimSpace(op.GetContextString("privateIP")) == "" {
				op.SetContext("privateIP", addr)
				slog.Info("server ready", "private_ip", addr)
			}
			continue
		}

		if ip.Version == "IPv4" {
			op.SetContext("publicIP", addr)
			slog.Info("server ready", "public_ip", addr)
		}
	}

	role := op.GetContextString("role")
	if role == "" {
		role = pool.EffectiveType()
	}

	if err := nodeStore.Upsert(ctx, clusterstate.NodeState{
		Name:      nodeNameForOperation(op, cfg.Environment),
		Role:      role,
		Pool:      pool.Name,
		ServerID:  serverID,
		PublicIP:  op.GetContextString("publicIP"),
		PrivateIP: op.GetContextString("privateIP"),
		Status:    clusterstate.NodeStatusReady,
	}); err != nil {
		return fmt.Errorf("persist node state: %w", err)
	}

	return nil
}

func phaseWaitTalos(ctx context.Context, op *operation.Operation, cfg *config.Config) error {
	publicIP := op.GetContextString("publicIP")
	if publicIP == "" {
		return fmt.Errorf("no public IP in operation context")
	}

	slog.Info("phase wait-talos: waiting for Talos maintenance mode", "ip", publicIP)
	return talos.WaitForMaintenance(ctx, publicIP, 30*time.Minute)
}

func phaseApplyConfig(ctx context.Context, op *operation.Operation, cfg *config.Config) error {
	publicIP := op.GetContextString("publicIP")
	if publicIP == "" {
		return fmt.Errorf("no public IP in operation context")
	}

	endpoint := controlPlaneEndpoint(op.GetContextString("privateIP"), publicIP)
	op.SetContext("controlPlaneEndpoint", endpoint)

	client, err := newInfisicalClient(ctx, cfg)
	if err != nil {
		return err
	}
	assets, err := ensureTalosAssets(ctx, cfg, endpoint, client)
	if err != nil {
		return err
	}

	talosClient, err := talos.NewInsecureClient(publicIP)
	if err != nil {
		return fmt.Errorf("create talos client: %w", err)
	}
	defer talosClient.Close()

	slog.Info("phase apply-config: applying Talos controlplane config", "ip", publicIP, "endpoint", endpoint)
	if err := talosClient.ApplyConfig(ctx, assets.ControlPlane); err != nil {
		return err
	}
	op.SetContext("talosActivated", true)

	return nil
}

func phaseBootstrap(ctx context.Context, op *operation.Operation, cfg *config.Config) error {
	publicIP := op.GetContextString("publicIP")
	if publicIP == "" {
		return fmt.Errorf("no public IP in operation context")
	}

	endpoint := op.GetContextString("controlPlaneEndpoint")
	if endpoint == "" {
		endpoint = controlPlaneEndpoint(op.GetContextString("privateIP"), publicIP)
	}

	client, err := newInfisicalClient(ctx, cfg)
	if err != nil {
		return err
	}
	assets, err := ensureTalosAssets(ctx, cfg, endpoint, client)
	if err != nil {
		return err
	}

	talosClient, err := talos.NewClient(publicIP, assets.Talosconfig)
	if err != nil {
		return fmt.Errorf("create talos mTLS client: %w", err)
	}
	defer talosClient.Close()

	// apply-config reboots into configured mode; bootstrap can race the API coming up.
	var lastErr error
	for attempt := 1; attempt <= 40; attempt++ {
		lastErr = talosClient.Bootstrap(ctx)
		if lastErr == nil {
			return nil
		}
		slog.Info("waiting to retry bootstrap", "attempt", attempt, "error", lastErr)
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-time.After(15 * time.Second):
		}
	}

	return fmt.Errorf("bootstrap did not succeed after retries: %w", lastErr)
}

func phaseDNS(ctx context.Context, op *operation.Operation, cfg *config.Config) error {
	publicIP := op.GetContextString("publicIP")
	if publicIP == "" {
		return fmt.Errorf("no public IP in operation context")
	}

	cfToken := cfg.CloudflareAPIToken()
	dnsName := cfg.Teleport.Domain
	if dnsName == "" || cfToken == "" {
		slog.Info("phase dns: skipping (cloudflare or teleport domain not configured)")
		return nil
	}

	slog.Info("phase dns: upserting DNS A record", "name", dnsName, "ip", publicIP)

	accountID := strings.TrimSpace(cfg.CloudflareAccountID())
	if accountID == "" {
		slog.Info("phase dns: skipping (cloudflare account ID not configured)")
		return nil
	}

	zoneID, _, err := cloudflare.ResolveZoneID(ctx, cfToken, accountID, dnsName)
	if err != nil {
		return fmt.Errorf("resolve cloudflare zone: %w", err)
	}

	return cloudflare.UpsertARecord(ctx, cfToken, zoneID, dnsName, publicIP)
}

func phasePostBootstrap(ctx context.Context, op *operation.Operation, cfg *config.Config) error {
	if op == nil {
		return fmt.Errorf("operation context is required for post-bootstrap")
	}

	zoneValue := strings.TrimSpace(op.GetContextString("zone"))
	if zoneValue == "" {
		return fmt.Errorf("missing zone in operation context")
	}

	zone := scw.Zone(zoneValue)
	region, err := zone.Region()
	if err != nil {
		return fmt.Errorf("derive region from zone %q: %w", zoneValue, err)
	}

	preferredPrivateIP := strings.TrimSpace(op.GetContextString("privateIP"))

	scwAccessKey, scwSecretKey := cfg.ScalewayCredentials()
	scwClient, err := scalewayNewClientFn(
		scwAccessKey,
		scwSecretKey,
		cfg.Scaleway.ProjectID,
		cfg.Scaleway.OrganizationID,
	)
	if err != nil {
		return fmt.Errorf("create scaleway client: %w", err)
	}

	privateNetworkID := strings.TrimSpace(op.GetContextString("privateNetworkID"))
	if privateNetworkID == "" {
		vpcName, err := cfg.ScalewayVPCName()
		if err != nil {
			return fmt.Errorf("resolve missing privateNetworkID context: %w", err)
		}
		privateNetworkName, err := cfg.ScalewayPrivateNetworkName()
		if err != nil {
			return fmt.Errorf("resolve missing privateNetworkID context: %w", err)
		}

		network, err := scalewayEnsureNetworkFoundationFn(ctx, scwClient, scaleway.NetworkFoundationParams{
			Region:             region,
			VPCName:            vpcName,
			PrivateNetworkName: privateNetworkName,
		})
		if err != nil {
			return fmt.Errorf("resolve missing privateNetworkID context: %w", err)
		}

		privateNetworkID = strings.TrimSpace(network.PrivateNetworkID)
		if privateNetworkID == "" {
			return fmt.Errorf("resolve missing privateNetworkID context: resolved empty private network ID")
		}
		op.SetContext("privateNetworkID", privateNetworkID)
		slog.Info("resolved missing private network id from scaleway network foundation",
			"private_network_id", privateNetworkID,
			"vpc", vpcName,
			"private_network", privateNetworkName,
		)
	}

	ipv4NativeRoutingCIDR, err := scalewayResolvePrivateNetworkIPv4CIDRFn(
		ctx,
		scwClient,
		region,
		privateNetworkID,
		preferredPrivateIP,
	)
	if err != nil {
		return fmt.Errorf("resolve cilium ipv4 native routing cidr: %w", err)
	}
	op.SetContext("ipv4NativeRoutingCIDR", ipv4NativeRoutingCIDR)

	slog.Info("phase post-bootstrap: installing Cilium, FluxCD, and Teleport")
	slog.Info("resolved cilium native routing cidr",
		"private_network_id", privateNetworkID,
		"preferred_private_ip", preferredPrivateIP,
		"cidr", ipv4NativeRoutingCIDR,
	)

	kubeconfigPath, cleanupKubeconfig, err := postBootstrapKubeconfigPathFn(ctx, op, cfg)
	if err != nil {
		return fmt.Errorf("prepare bootstrap kubeconfig: %w", err)
	}
	if cleanupKubeconfig != nil {
		defer cleanupKubeconfig()
	}

	var bootstrapErrors []error

	// Install Cilium CNI
	if err := ciliumInstallFn(ctx, cilium.InstallParams{
		Kubeconfig:            kubeconfigPath,
		Version:               cfg.Cluster.EffectiveCiliumVersion(),
		Hubble:                true,
		IPv4NativeRoutingCIDR: ipv4NativeRoutingCIDR,
	}); err != nil {
		slog.Warn("cilium install failed", "error", err)
		bootstrapErrors = append(bootstrapErrors, fmt.Errorf("install cilium: %w", err))
	}

	// Install FluxCD (and optionally configure OCI source).
	if err := fluxBootstrapFn(ctx, flux.BootstrapParams{
		Kubeconfig: kubeconfigPath,
		OCIRepo:    cfg.Flux.OCIRepo,
		Version:    cfg.Cluster.EffectiveFluxVersion(),
	}); err != nil {
		slog.Warn("flux bootstrap failed", "error", err)
		bootstrapErrors = append(bootstrapErrors, fmt.Errorf("bootstrap flux: %w", err))
	}

	ensureTeleportAdminAccess := func(strict bool) error {
		organization := strings.TrimSpace(cfg.Teleport.GitHub.Organization)
		adminTeams := cfg.Teleport.EffectiveAdminTeams()
		kubernetesUsers := cfg.Teleport.EffectiveKubernetesUsers()
		kubernetesGroups := cfg.Teleport.EffectiveKubernetesGroups()

		if organization == "" || len(adminTeams) == 0 {
			slog.Warn(
				"skipping teleport access reconciliation (teleport.github.organization and admin teams are required)",
				"organization", organization,
				"admin_teams", adminTeams,
			)
			return nil
		}

		slog.Info(
			"ensuring teleport kubernetes admin access",
			"organization", organization,
			"admin_teams", adminTeams,
			"kubernetes_users", kubernetesUsers,
			"kubernetes_groups", kubernetesGroups,
		)

		err := teleportEnsureAdminAccessFn(ctx, teleport.EnsureAccessParams{
			ProxyAddr:        strings.TrimSpace(cfg.Teleport.Domain),
			Organization:     organization,
			AdminTeams:       adminTeams,
			KubernetesUsers:  kubernetesUsers,
			KubernetesGroups: kubernetesGroups,
		})
		if err == nil {
			slog.Info("teleport kubernetes admin access ensured")
			return nil
		}
		if strict {
			return fmt.Errorf("ensure teleport admin access: %w", err)
		}

		slog.Warn("teleport admin access reconciliation failed (continuing in best-effort mode)", "error", err)
		return nil
	}

	switch cfg.Teleport.EffectiveMode() {
	case config.TeleportModeDisabled:
		slog.Info("skipping teleport (mode disabled)")
	case config.TeleportModeExternal:
		if strings.TrimSpace(cfg.Teleport.Domain) == "" {
			slog.Info("skipping external teleport agent (domain not configured)")
			break
		}

		joinToken, err := teleportGenerateJoinTokenFn(ctx, cfg.Teleport.Domain, 30*time.Minute)
		if err != nil {
			slog.Warn("teleport join token generation failed", "error", err)
			bootstrapErrors = append(bootstrapErrors, fmt.Errorf("generate teleport join token: %w", err))
			break
		}

		slog.Info("deploying teleport kube agent",
			"proxy_addr", cfg.Teleport.Domain,
			"cluster", cfg.Environment,
			"version", cfg.Cluster.EffectiveTeleportVersion(),
		)

		if err := teleportDeployKubeAgentFn(ctx, teleport.DeployKubeAgentParams{
			Kubeconfig:  kubeconfigPath,
			ProxyAddr:   cfg.Teleport.Domain,
			ClusterName: cfg.Environment,
			JoinToken:   joinToken,
			Version:     cfg.Cluster.EffectiveTeleportVersion(),
		}); err != nil {
			slog.Warn("teleport agent deployment failed", "error", err)
			bootstrapErrors = append(bootstrapErrors, fmt.Errorf("deploy teleport kube agent: %w", err))
		} else {
			slog.Info("teleport kube agent deployed successfully")
			if err := ensureTeleportAdminAccess(false); err != nil {
				bootstrapErrors = append(bootstrapErrors, err)
			}
		}
	case config.TeleportModeSelfHosted:
		if strings.TrimSpace(cfg.Teleport.Domain) == "" {
			slog.Warn("skipping self-hosted teleport deployment (teleport.domain not configured)")
			break
		}

		organization := strings.TrimSpace(cfg.Teleport.GitHub.Organization)
		adminTeams := cfg.Teleport.EffectiveAdminTeams()
		kubernetesUsers := cfg.Teleport.EffectiveKubernetesUsers()
		kubernetesGroups := cfg.Teleport.EffectiveKubernetesGroups()
		if organization == "" || len(adminTeams) == 0 {
			slog.Warn("skipping self-hosted teleport deployment (teleport.github.organization and admin teams are required)")
			break
		}

		clientID, clientSecret := cfg.TeleportGitHubCredentials()
		clientID = strings.TrimSpace(clientID)
		clientSecret = strings.TrimSpace(clientSecret)
		if clientID == "" || clientSecret == "" {
			slog.Warn("skipping self-hosted teleport deployment (missing GitHub OAuth secrets from Infisical)",
				"secret_path", cfg.Infisical.SecretPath,
				"required_keys", "GITHUB_CLIENT_ID,GITHUB_CLIENT_SECRET",
			)
			break
		}

		acmeEnabled := cfg.Teleport.ACME.EffectiveEnabled()
		acmeEmail := strings.TrimSpace(cfg.Teleport.ACME.Email)
		acmeURI := strings.TrimSpace(cfg.Teleport.ACME.URI)
		if acmeEnabled && acmeEmail == "" {
			slog.Warn("teleport ACME enabled without email; registration may fail depending on CA policy")
		}

		slog.Info("deploying self-hosted teleport",
			"domain", cfg.Teleport.Domain,
			"cluster", cfg.Environment,
			"version", cfg.Cluster.EffectiveTeleportVersion(),
			"organization", organization,
			"admin_teams", adminTeams,
			"kubernetes_users", kubernetesUsers,
			"kubernetes_groups", kubernetesGroups,
		)

		if err := teleportDeploySelfHostedFn(ctx, teleport.DeploySelfHostedParams{
			Kubeconfig:         kubeconfigPath,
			ClusterName:        cfg.Environment,
			Domain:             cfg.Teleport.Domain,
			GitHubOrganization: organization,
			GitHubTeams:        adminTeams,
			AdminTeams:         adminTeams,
			KubernetesUsers:    kubernetesUsers,
			KubernetesGroups:   kubernetesGroups,
			GitHubClientID:     clientID,
			GitHubClientSecret: clientSecret,
			ACMEEnabled:        acmeEnabled,
			ACMEEmail:          acmeEmail,
			ACMEURI:            acmeURI,
			Version:            cfg.Cluster.EffectiveTeleportVersion(),
		}); err != nil {
			slog.Warn("self-hosted teleport deployment failed", "error", err)
			bootstrapErrors = append(bootstrapErrors, fmt.Errorf("deploy self-hosted teleport: %w", err))
		} else {
			slog.Info("self-hosted teleport deployed successfully")
			if err := ensureTeleportAdminAccess(true); err != nil {
				slog.Warn("self-hosted teleport access reconciliation failed", "error", err)
				bootstrapErrors = append(bootstrapErrors, err)
			}
		}
	default:
		slog.Warn("skipping teleport deployment (unsupported teleport.mode)", "mode", cfg.Teleport.Mode)
	}

	if len(bootstrapErrors) > 0 {
		return fmt.Errorf("post-bootstrap component installation failed: %w", errors.Join(bootstrapErrors...))
	}

	return nil
}

func postBootstrapKubeconfigPath(ctx context.Context, op *operation.Operation, cfg *config.Config) (string, func(), error) {
	publicIP := strings.TrimSpace(op.GetContextString("publicIP"))
	if publicIP == "" {
		return "", nil, fmt.Errorf("no public IP in operation context")
	}

	endpoint := strings.TrimSpace(op.GetContextString("controlPlaneEndpoint"))
	if endpoint == "" {
		endpoint = controlPlaneEndpoint(op.GetContextString("privateIP"), publicIP)
	}

	infClient, err := newInfisicalClient(ctx, cfg)
	if err != nil {
		return "", nil, err
	}
	assets, err := ensureTalosAssets(ctx, cfg, endpoint, infClient)
	if err != nil {
		return "", nil, err
	}

	candidates := []string{publicIP, strings.TrimSpace(op.GetContextString("privateIP"))}
	seen := map[string]struct{}{}
	var (
		kubeconfig       []byte
		selectedEndpoint string
		lastErr          error
	)

	for _, candidate := range candidates {
		candidate = strings.TrimSpace(candidate)
		if candidate == "" {
			continue
		}
		if _, ok := seen[candidate]; ok {
			continue
		}
		seen[candidate] = struct{}{}

		talosClient, err := talos.NewClient(candidate, assets.Talosconfig)
		if err != nil {
			lastErr = fmt.Errorf("create talos client via %s: %w", candidate, err)
			continue
		}

		kubeconfig, err = talosClient.Kubeconfig(ctx)
		closeErr := talosClient.Close()
		if err == nil && closeErr == nil {
			selectedEndpoint = candidate
			break
		}
		if err != nil {
			lastErr = fmt.Errorf("fetch kubeconfig via %s: %w", candidate, err)
		} else {
			lastErr = fmt.Errorf("close talos client via %s: %w", candidate, closeErr)
		}
	}

	if selectedEndpoint == "" {
		if lastErr == nil {
			lastErr = fmt.Errorf("unknown talos connectivity error")
		}
		return "", nil, lastErr
	}

	rewrittenKubeconfig, err := rewriteKubeconfigServerIfNeeded(kubeconfig, selectedEndpoint)
	if err != nil {
		return "", nil, fmt.Errorf("rewrite kubeconfig server: %w", err)
	}

	tempFile, err := os.CreateTemp("", "rawkode-cloud3-kubeconfig-*.yaml")
	if err != nil {
		return "", nil, fmt.Errorf("create temporary kubeconfig: %w", err)
	}

	cleanup := func() {
		if removeErr := os.Remove(tempFile.Name()); removeErr != nil && !errors.Is(removeErr, os.ErrNotExist) {
			slog.Warn("failed to remove temporary bootstrap kubeconfig", "path", tempFile.Name(), "error", removeErr)
		}
	}

	if _, err := tempFile.Write(rewrittenKubeconfig); err != nil {
		_ = tempFile.Close()
		cleanup()
		return "", nil, fmt.Errorf("write temporary kubeconfig: %w", err)
	}
	if err := tempFile.Close(); err != nil {
		cleanup()
		return "", nil, fmt.Errorf("close temporary kubeconfig: %w", err)
	}
	if err := os.Chmod(tempFile.Name(), 0o600); err != nil {
		cleanup()
		return "", nil, fmt.Errorf("chmod temporary kubeconfig: %w", err)
	}

	return tempFile.Name(), cleanup, nil
}

func phaseVerify(ctx context.Context, op *operation.Operation, cfg *config.Config) error {
	_ = ctx
	slog.Info("phase verify: running health checks")

	nodeName := op.GetContextString("nodeName")
	if nodeName == "" {
		poolName := strings.TrimSpace(op.GetContextString("poolName"))
		if poolName == "" {
			poolName = "controlplane"
		}
		nodeName = controlPlaneNodeName(cfg.Environment, poolName, 1)
	}

	fmt.Printf("\nCluster %q created successfully!\n", cfg.Environment)
	fmt.Printf("  Node:       %s\n", nodeName)
	fmt.Printf("  Public IP:  %s\n", op.GetContextString("publicIP"))
	fmt.Printf("  Server ID:  %s\n", op.GetContextString("serverId"))

	if cfg.Teleport.Domain != "" {
		fmt.Printf("  DNS:        %s\n", cfg.Teleport.Domain)
	}

	return nil
}

func selectCreatePool(cfg *config.Config, poolName string) (*config.NodePoolConfig, error) {
	if strings.TrimSpace(poolName) != "" {
		pool, err := cfg.FindNodePool(poolName)
		if err != nil {
			return nil, fmt.Errorf("resolve --pool %q: %w", poolName, err)
		}
		if pool.EffectiveType() == "" {
			return nil, fmt.Errorf("pool %q has invalid type %q", pool.Name, pool.Type)
		}
		return pool, nil
	}

	pool, err := cfg.FirstNodePoolByType(config.NodeTypeControlPlane)
	if err != nil {
		return nil, fmt.Errorf("select default controlplane pool: %w", err)
	}
	return pool, nil
}

func ensureCreateOperationContext(op *operation.Operation, requestedNodeName string, pool *config.NodePoolConfig, requestedPrivateIP, environment string) error {
	existingNodeName := op.GetContextString("nodeName")
	if existingNodeName == "" {
		op.SetContext("nodeName", requestedNodeName)
	}

	existingPoolName := op.GetContextString("poolName")
	if existingPoolName != "" && existingPoolName != pool.Name {
		return fmt.Errorf("operation already tracks pool %q, cannot switch to %q", existingPoolName, pool.Name)
	}
	if existingPoolName == "" {
		op.SetContext("poolName", pool.Name)
	}

	existingRole := op.GetContextString("role")
	role := pool.EffectiveType()
	if existingRole != "" && existingRole != role {
		return fmt.Errorf("operation already tracks role %q, cannot switch to %q", existingRole, role)
	}
	if existingRole == "" {
		op.SetContext("role", role)
	}

	existingPrivateIP := strings.TrimSpace(op.GetContextString("privateIP"))
	if existingPrivateIP == "" && strings.TrimSpace(requestedPrivateIP) != "" {
		op.SetContext("privateIP", strings.TrimSpace(requestedPrivateIP))
	}

	if op.GetContextString("controlPlaneSlot") == "" {
		if slot, ok := parseControlPlaneSlot(environment, pool.Name, op.GetContextString("nodeName")); ok {
			op.SetContext("controlPlaneSlot", fmt.Sprintf("%d", slot))
		}
	}

	return nil
}

func poolForOperation(cfg *config.Config, op *operation.Operation) (*config.NodePoolConfig, error) {
	poolName := op.GetContextString("poolName")
	if strings.TrimSpace(poolName) != "" {
		return cfg.FindNodePool(poolName)
	}

	pool, err := cfg.FirstNodePoolByType(config.NodeTypeControlPlane)
	if err != nil {
		return nil, err
	}
	op.SetContext("poolName", pool.Name)
	return pool, nil
}

func nodeNameForOperation(op *operation.Operation, environment string) string {
	if nodeName := op.GetContextString("nodeName"); strings.TrimSpace(nodeName) != "" {
		return nodeName
	}
	poolName := strings.TrimSpace(op.GetContextString("poolName"))
	if poolName == "" {
		poolName = "controlplane"
	}
	return controlPlaneNodeName(environment, poolName, 1)
}

func markNodeFailed(ctx context.Context, nodeStore *clusterstate.NodeStore, op *operation.Operation, environment string) error {
	if nodeStore == nil {
		return nil
	}

	nodeName := nodeNameForOperation(op, environment)
	if nodeName == "" {
		return nil
	}

	return nodeStore.Upsert(ctx, clusterstate.NodeState{
		Name:      nodeName,
		Role:      op.GetContextString("role"),
		Pool:      op.GetContextString("poolName"),
		ServerID:  op.GetContextString("serverId"),
		PublicIP:  op.GetContextString("publicIP"),
		PrivateIP: op.GetContextString("privateIP"),
		Status:    clusterstate.NodeStatusFailed,
	})
}

func markNodeDeleted(ctx context.Context, nodeStore *clusterstate.NodeStore, op *operation.Operation, environment string) error {
	if nodeStore == nil {
		return nil
	}

	nodeName := nodeNameForOperation(op, environment)
	if nodeName == "" {
		return nil
	}

	return nodeStore.Upsert(ctx, clusterstate.NodeState{
		Name:      nodeName,
		Role:      op.GetContextString("role"),
		Pool:      op.GetContextString("poolName"),
		ServerID:  op.GetContextString("serverId"),
		PublicIP:  op.GetContextString("publicIP"),
		PrivateIP: op.GetContextString("privateIP"),
		Status:    clusterstate.NodeStatusDeleted,
	})
}

func controlPlaneEndpoint(privateIP, publicIP string) string {
	if ip := strings.TrimSpace(privateIP); ip != "" {
		return ip
	}
	return strings.TrimSpace(publicIP)
}

func newInfisicalClient(ctx context.Context, cfg *config.Config) (*infisical.Client, error) {
	client, err := getOrCreateInfisicalClient(ctx, cfg)
	if err != nil {
		return nil, err
	}

	secretPath := infisicalSecretPathForCluster(cfg)
	if err := client.EnsureSecretPath(ctx, cfg.Infisical.ProjectID, cfg.Infisical.Environment, secretPath); err != nil {
		return nil, fmt.Errorf("ensure infisical secret path: %w", err)
	}

	return client, nil
}

func getOrCreateInfisicalClient(ctx context.Context, cfg *config.Config) (*infisical.Client, error) {
	if strings.TrimSpace(cfg.Infisical.SiteURL) == "" {
		return nil, fmt.Errorf("infisical.site_url is required")
	}
	if strings.TrimSpace(cfg.Infisical.ProjectID) == "" {
		return nil, fmt.Errorf("infisical.project_id is required")
	}
	if strings.TrimSpace(cfg.Infisical.Environment) == "" {
		return nil, fmt.Errorf("infisical.environment is required")
	}
	if strings.TrimSpace(cfg.Infisical.SecretPath) == "" {
		return nil, fmt.Errorf("infisical.secret_path is required")
	}
	if strings.TrimSpace(cfg.Infisical.ClientID) == "" || strings.TrimSpace(cfg.Infisical.ClientSecret) == "" {
		return nil, fmt.Errorf("INFISICAL_CLIENT_ID and INFISICAL_CLIENT_SECRET are required")
	}

	cacheKey := strings.TrimSpace(cfg.Infisical.SiteURL) + "|" +
		strings.TrimSpace(cfg.Infisical.ClientID) + "|" +
		strings.TrimSpace(cfg.Infisical.ClientSecret)

	infisicalClientCache.mu.Lock()
	defer infisicalClientCache.mu.Unlock()

	if infisicalClientCache.client != nil && infisicalClientCache.key == cacheKey {
		return infisicalClientCache.client, nil
	}

	client, err := infisical.NewClient(ctx, cfg.Infisical.SiteURL, cfg.Infisical.ClientID, cfg.Infisical.ClientSecret)
	if err != nil {
		return nil, err
	}

	infisicalClientCache.client = client
	infisicalClientCache.key = cacheKey

	return client, nil
}

func ensureTalosSecretsYAML(ctx context.Context, cfg *config.Config, client *infisical.Client) ([]byte, error) {
	secretPath := infisicalSecretPathForCluster(cfg)
	all, err := client.GetSecrets(ctx, cfg.Infisical.ProjectID, cfg.Infisical.Environment, secretPath)
	if err != nil {
		return nil, fmt.Errorf("load infisical secrets: %w", err)
	}

	if existing := strings.TrimSpace(all[infisicalTalosSecretsKey]); existing != "" {
		return []byte(existing), nil
	}

	slog.Info("no Talos secrets found in Infisical; generating new secrets")
	secretsYAML, err := talos.GenerateSecretsYAML(ctx)
	if err != nil {
		return nil, fmt.Errorf("generate talos secrets: %w", err)
	}

	if err := client.SetSecret(ctx, cfg.Infisical.ProjectID, cfg.Infisical.Environment, secretPath, infisicalTalosSecretsKey, string(secretsYAML)); err != nil {
		return nil, fmt.Errorf("store talos secrets in infisical: %w", err)
	}

	return secretsYAML, nil
}

func ensureTalosAssets(ctx context.Context, cfg *config.Config, endpoint string, client *infisical.Client) (*talos.GenConfigResult, error) {
	secretsYAML, err := ensureTalosSecretsYAML(ctx, cfg, client)
	if err != nil {
		return nil, err
	}

	installDisk := ""
	if controlPlanePool, err := cfg.FirstNodePoolByType(config.NodeTypeControlPlane); err == nil {
		installDisk = strings.TrimSpace(controlPlanePool.Disks.OS)
	}

	assets, err := talos.GenerateConfig(ctx, talos.GenConfigParams{
		ClusterName:        cfg.Environment,
		Endpoint:           endpoint,
		TalosVersion:       cfg.Cluster.TalosVersion,
		TalosSchematic:     cfg.Cluster.TalosSchematic,
		KubernetesVersion:  cfg.Cluster.KubernetesVersion,
		InstallDisk:        installDisk,
		ControlPlaneTaints: cfg.Cluster.EffectiveControlPlaneTaints(),
		SecretsYAML:        secretsYAML,
	})
	if err != nil {
		return nil, fmt.Errorf("generate talos assets: %w", err)
	}

	secretPath := infisicalSecretPathForCluster(cfg)
	if err := client.SetSecret(ctx, cfg.Infisical.ProjectID, cfg.Infisical.Environment, secretPath, infisicalTalosControlPlaneKey, string(assets.ControlPlane)); err != nil {
		return nil, fmt.Errorf("store controlplane config in infisical: %w", err)
	}
	if err := client.SetSecret(ctx, cfg.Infisical.ProjectID, cfg.Infisical.Environment, secretPath, infisicalTalosWorkerKey, string(assets.Worker)); err != nil {
		return nil, fmt.Errorf("store worker config in infisical: %w", err)
	}
	if err := client.SetSecret(ctx, cfg.Infisical.ProjectID, cfg.Infisical.Environment, secretPath, infisicalTalosConfigKey, string(assets.Talosconfig)); err != nil {
		return nil, fmt.Errorf("store talosconfig in infisical: %w", err)
	}

	return assets, nil
}
