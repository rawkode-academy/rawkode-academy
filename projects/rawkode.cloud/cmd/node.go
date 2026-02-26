package cmd

import (
	"context"
	"fmt"
	"net"
	"strings"
	"time"

	clusterstate "github.com/rawkode-academy/rawkode-cloud3/internal/cluster"
	"github.com/rawkode-academy/rawkode-cloud3/internal/config"
	"github.com/rawkode-academy/rawkode-cloud3/internal/scaleway"
	"github.com/rawkode-academy/rawkode-cloud3/internal/talos"
	scw "github.com/scaleway/scaleway-sdk-go/scw"
	"github.com/spf13/cobra"
)

var nodeCmd = &cobra.Command{
	Use:   "node",
	Short: "Node lifecycle management",
}

var nodeAddCmd = &cobra.Command{
	Use:   "add",
	Short: "Add a control plane or worker node",
	RunE:  runNodeAdd,
}

var nodeRemoveCmd = &cobra.Command{
	Use:   "remove",
	Short: "Drain and remove a node",
	RunE:  runNodeRemove,
}

func runNodeAdd(cmd *cobra.Command, args []string) error {
	ctx := context.Background()

	nameFlag, _ := cmd.Flags().GetString("name")
	roleRaw, _ := cmd.Flags().GetString("role")
	clusterName, _ := cmd.Flags().GetString("cluster")
	cfgFile, _ := cmd.Flags().GetString("file")
	poolName, _ := cmd.Flags().GetString("pool")

	role := config.NormalizeNodePoolType(roleRaw)
	if role == "" {
		return fmt.Errorf("--role must be one of: control-plane, worker")
	}

	cfg, cfgPath, err := loadConfigForClusterOrFile(clusterName, cfgFile)
	if err != nil {
		return err
	}

	_, nodeStore, state, err := loadNodeState(ctx, cfg)
	if err != nil {
		return err
	}

	pool, err := resolveAddPool(cfg, poolName, role)
	if err != nil {
		return err
	}

	var (
		name      string
		privateIP string
	)

	if strings.TrimSpace(nameFlag) != "" {
		return fmt.Errorf("--name is no longer supported; names are auto-generated from pool %q", pool.Name)
	}

	slot := nextNodePoolSlot(state, cfg.Environment, pool.Name, role)
	if slot > 99 {
		return fmt.Errorf("no available naming slot for pool %q", pool.Name)
	}
	name = pooledNodeName(cfg.Environment, pool.Name, slot)

	if role == config.NodeTypeControlPlane {
		privateIP, err = controlPlaneReservedIPForSlot(pool, slot)
		if err != nil {
			return err
		}
	}

	if existing, ok := findNodeByName(state, name); ok && existing.Status != clusterstate.NodeStatusDeleted {
		return fmt.Errorf("node %q already exists in state with status=%s", name, existing.Status)
	}

	accessKey, secretKey := cfg.ScalewayCredentials()
	scwClient, err := scaleway.NewClient(accessKey, secretKey, cfg.Scaleway.ProjectID, cfg.Scaleway.OrganizationID)
	if err != nil {
		return fmt.Errorf("create scaleway client: %w", err)
	}

	zoneValue := pool.EffectiveZone()
	if zoneValue == "" {
		return fmt.Errorf("node pool %q must define zone", pool.Name)
	}
	zone := scw.Zone(zoneValue)
	offerID, _, err := scaleway.ResolveOfferForBillingCycle(ctx, scwClient, zone, pool.Offer, pool.BillingCycle)
	if err != nil {
		return fmt.Errorf("resolve offer: %w", err)
	}

	osID, err := scaleway.ResolveUbuntuOSID(ctx, scwClient, zone, offerID)
	if err != nil {
		return fmt.Errorf("resolve ubuntu OS: %w", err)
	}

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

	cloudInit := talos.BuildCloudInit(talos.PivotParams{
		TalosVersion:   cfg.Cluster.TalosVersion,
		TalosSchematic: cfg.Cluster.TalosSchematic,
		OSDisk:         pool.Disks.OS,
		DataDisk:       pool.Disks.Data,
	})

	server, err := scaleway.OrderServer(ctx, scwClient, scaleway.ProvisionParams{
		OfferID:                  offerID,
		Zone:                     zone,
		OSID:                     osID,
		Name:                     name,
		PrivateNetworkID:         network.PrivateNetworkID,
		PrivateNetworkReservedIP: privateIP,
		BillingCycle:             pool.BillingCycle,
		CloudInitScript:          cloudInit,
		PivotOSDisk:              pool.Disks.OS,
		PivotDataDisk:            pool.Disks.Data,
	})
	if err != nil {
		return fmt.Errorf("order server: %w", err)
	}

	if err := nodeStore.Upsert(ctx, clusterstate.NodeState{
		Name:      name,
		Role:      role,
		Pool:      pool.Name,
		ServerID:  server.ID,
		PrivateIP: privateIP,
		Status:    clusterstate.NodeStatusProvisioning,
	}); err != nil {
		return fmt.Errorf("persist provisioning node state: %w", err)
	}

	serverReady, err := scaleway.WaitForReady(ctx, scwClient, server.ID, zone)
	if err != nil {
		return fmt.Errorf("wait for server ready: %w", err)
	}

	var publicIP string
	for _, ip := range serverReady.IPs {
		address := ip.Address.String()
		parsed := net.ParseIP(address)
		if parsed != nil && parsed.IsPrivate() && strings.TrimSpace(privateIP) == "" {
			privateIP = address
			continue
		}
		if ip.Version == "IPv4" {
			publicIP = address
		}
	}
	if strings.TrimSpace(publicIP) == "" {
		return fmt.Errorf("server %s has no public IPv4", server.ID)
	}

	if err := nodeStore.Upsert(ctx, clusterstate.NodeState{
		Name:      name,
		Role:      role,
		Pool:      pool.Name,
		ServerID:  server.ID,
		PublicIP:  publicIP,
		PrivateIP: privateIP,
		Status:    clusterstate.NodeStatusProvisioning,
	}); err != nil {
		return fmt.Errorf("persist node IP state: %w", err)
	}

	if err := talos.WaitForMaintenance(ctx, publicIP, 30*time.Minute); err != nil {
		return fmt.Errorf("wait for talos maintenance: %w", err)
	}

	infClient, err := newInfisicalClient(ctx, cfg)
	if err != nil {
		return err
	}

	endpoint, err := controlPlaneEndpointFromState(state)
	if err != nil {
		return fmt.Errorf("resolve control-plane endpoint for join: %w", err)
	}
	assets, err := ensureTalosAssets(ctx, cfg, endpoint, infClient)
	if err != nil {
		return err
	}

	nodeConfig := assets.Worker
	if role == config.NodeTypeControlPlane {
		nodeConfig = assets.ControlPlane
	}
	nodeConfig, err = talos.WithNodeName(nodeConfig, name)
	if err != nil {
		return fmt.Errorf("render node-specific Talos config for %q: %w", name, err)
	}

	talosClient, err := talos.NewInsecureClient(publicIP)
	if err != nil {
		return fmt.Errorf("create talos client: %w", err)
	}
	defer talosClient.Close()

	if err := talosClient.ApplyConfig(ctx, nodeConfig); err != nil {
		return fmt.Errorf("apply node config: %w", err)
	}

	if err := nodeStore.Upsert(ctx, clusterstate.NodeState{
		Name:      name,
		Role:      role,
		Pool:      pool.Name,
		ServerID:  server.ID,
		PublicIP:  publicIP,
		PrivateIP: privateIP,
		Status:    clusterstate.NodeStatusReady,
	}); err != nil {
		return fmt.Errorf("persist ready node state: %w", err)
	}

	fmt.Printf("Added %s node %q to cluster %q (config=%s, server=%s, public_ip=%s, private_ip=%s)\n", role, name, cfg.Environment, cfgPath, server.ID, publicIP, privateIP)
	return nil
}

func runNodeRemove(cmd *cobra.Command, args []string) error {
	ctx := context.Background()

	name, _ := cmd.Flags().GetString("name")
	clusterName, _ := cmd.Flags().GetString("cluster")
	cfgFile, _ := cmd.Flags().GetString("file")

	if strings.TrimSpace(name) == "" {
		return fmt.Errorf("--name is required")
	}

	cfg, cfgPath, err := loadConfigForClusterOrFile(clusterName, cfgFile)
	if err != nil {
		return err
	}

	_, nodeStore, state, err := loadNodeState(ctx, cfg)
	if err != nil {
		return err
	}

	node, ok := findNodeByName(state, name)
	if !ok {
		return fmt.Errorf("node %q not found in cluster state", name)
	}
	if node.Status == clusterstate.NodeStatusDeleted {
		fmt.Printf("Node %q is already marked deleted.\n", name)
		return nil
	}

	if strings.TrimSpace(node.ServerID) != "" {
		accessKey, secretKey := cfg.ScalewayCredentials()
		scwClient, err := scaleway.NewClient(accessKey, secretKey, cfg.Scaleway.ProjectID, cfg.Scaleway.OrganizationID)
		if err != nil {
			return fmt.Errorf("create scaleway client: %w", err)
		}

		pool, err := cfg.FindNodePool(node.Pool)
		if err != nil {
			return fmt.Errorf("resolve node pool %q for node %q: %w", node.Pool, node.Name, err)
		}
		zoneValue := pool.EffectiveZone()
		if zoneValue == "" {
			return fmt.Errorf("node pool %q must define zone", pool.Name)
		}

		if err := scaleway.CleanupProvisionedServer(ctx, scwClient, node.ServerID, scw.Zone(zoneValue)); err != nil {
			return fmt.Errorf("cleanup server %s: %w", node.ServerID, err)
		}
	}

	if err := nodeStore.Upsert(ctx, clusterstate.NodeState{
		Name:     node.Name,
		Role:     node.Role,
		Pool:     node.Pool,
		ServerID: node.ServerID,
		PublicIP: node.PublicIP,
		Status:   clusterstate.NodeStatusDeleted,
	}); err != nil {
		return fmt.Errorf("persist deleted node state: %w", err)
	}

	fmt.Printf("Removed node %q from cluster %q (config=%s)\n", name, cfg.Environment, cfgPath)
	return nil
}

func resolveAddPool(cfg *config.Config, poolName, role string) (*config.NodePoolConfig, error) {
	if strings.TrimSpace(poolName) != "" {
		pool, err := cfg.FindNodePool(poolName)
		if err != nil {
			return nil, err
		}
		if pool.EffectiveType() != role {
			return nil, fmt.Errorf("pool %q has type %q, expected %q", pool.Name, pool.EffectiveType(), role)
		}
		return pool, nil
	}

	return cfg.FirstNodePoolByType(role)
}

func init() {
	nodeCmd.AddCommand(nodeAddCmd)
	nodeCmd.AddCommand(nodeRemoveCmd)

	nodeAddCmd.Flags().String("cluster", "", "Cluster/environment name")
	nodeAddCmd.Flags().StringP("file", "f", "", "Path to cluster config YAML")
	nodeAddCmd.Flags().String("name", "", "Node name (unsupported; names are auto-generated from pool slots)")
	nodeAddCmd.Flags().String("pool", "", "Node pool name (optional)")
	nodeAddCmd.Flags().String("role", "worker", "Node role (control-plane or worker)")

	nodeRemoveCmd.Flags().String("cluster", "", "Cluster/environment name")
	nodeRemoveCmd.Flags().StringP("file", "f", "", "Path to cluster config YAML")
	nodeRemoveCmd.Flags().String("name", "", "Node name")
}
