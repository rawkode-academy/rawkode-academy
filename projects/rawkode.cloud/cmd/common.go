package cmd

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"strconv"
	"strings"

	clusterstate "github.com/rawkode-academy/rawkode-cloud3/internal/cluster"
	"github.com/rawkode-academy/rawkode-cloud3/internal/config"
	"github.com/rawkode-academy/rawkode-cloud3/internal/infisical"
	"github.com/rawkode-academy/rawkode-cloud3/internal/operation"
)

func loadConfigForClusterOrFile(clusterName, filePath string) (*config.Config, string, error) {
	resolved, err := resolveConfigPath(clusterName, filePath)
	if err != nil {
		return nil, "", err
	}

	cfg, err := config.Load(resolved)
	if err != nil {
		return nil, "", fmt.Errorf("load config %s: %w", resolved, err)
	}

	infClient, err := getOrCreateInfisicalClient(context.Background(), cfg)
	if err != nil {
		return nil, "", fmt.Errorf("create infisical client: %w", err)
	}
	if err := cfg.LoadRuntimeSecretsWithClient(context.Background(), infClient); err != nil {
		return nil, "", fmt.Errorf("load runtime secrets: %w", err)
	}

	return cfg, resolved, nil
}

func resolveConfigPath(clusterName, filePath string) (string, error) {
	if p := strings.TrimSpace(filePath); p != "" {
		if _, err := os.Stat(p); err != nil {
			return "", fmt.Errorf("config file %s: %w", p, err)
		}
		return p, nil
	}

	clusterName = strings.TrimSpace(clusterName)
	if clusterName == "" {
		return "", fmt.Errorf("either --file or --cluster is required")
	}

	candidates := []string{
		clusterName + ".yaml",
		filepath.Join("clusters", clusterName+".yaml"),
	}

	for _, candidate := range candidates {
		if _, err := os.Stat(candidate); err == nil {
			return candidate, nil
		}
	}

	return "", fmt.Errorf("could not find config for cluster %q (checked %s)", clusterName, strings.Join(candidates, ", "))
}

func newNodeStore(cfg *config.Config) (*operation.Store, *clusterstate.NodeStore, error) {
	store, err := newOperationStore(cfg)
	if err != nil {
		return nil, nil, err
	}

	return store, clusterstate.NewNodeStore(store, cfg.Environment), nil
}

func loadNodeState(ctx context.Context, cfg *config.Config) (*operation.Store, *clusterstate.NodeStore, *clusterstate.NodesState, error) {
	store, nodeStore, err := newNodeStore(cfg)
	if err != nil {
		return nil, nil, nil, err
	}

	state, err := nodeStore.Load(ctx)
	if err != nil {
		return nil, nil, nil, fmt.Errorf("load node state: %w", err)
	}

	return store, nodeStore, state, nil
}

func findNodeByName(state *clusterstate.NodesState, name string) (*clusterstate.NodeState, bool) {
	for i := range state.Nodes {
		if state.Nodes[i].Name == name {
			return &state.Nodes[i], true
		}
	}
	return nil, false
}

func firstActiveNodeByRole(state *clusterstate.NodesState, role string) (*clusterstate.NodeState, error) {
	for i := range state.Nodes {
		node := &state.Nodes[i]
		if node.Role != role {
			continue
		}
		if node.Status == clusterstate.NodeStatusDeleted || node.Status == clusterstate.NodeStatusFailed {
			continue
		}
		if strings.TrimSpace(node.PublicIP) == "" && strings.TrimSpace(node.PrivateIP) == "" {
			continue
		}
		return node, nil
	}

	return nil, fmt.Errorf("no active %s node with reachable IP found in state", role)
}

func loadTalosconfigFromInfisical(ctx context.Context, cfg *config.Config, client *infisical.Client) ([]byte, error) {
	secretPath := infisicalSecretPathForCluster(cfg)
	value, err := client.GetSecret(ctx, cfg.Infisical.ProjectID, cfg.Infisical.Environment, secretPath, infisicalTalosConfigKey)
	if err != nil {
		return nil, fmt.Errorf("load %s from infisical: %w", infisicalTalosConfigKey, err)
	}
	if strings.TrimSpace(value) == "" {
		return nil, fmt.Errorf("%s is empty in infisical path %s", infisicalTalosConfigKey, secretPath)
	}

	return []byte(value), nil
}

func controlPlaneEndpointFromState(state *clusterstate.NodesState) (string, error) {
	node, err := firstActiveNodeByRole(state, config.NodeTypeControlPlane)
	if err != nil {
		return "", err
	}
	if privateIP := strings.TrimSpace(node.PrivateIP); privateIP != "" {
		return privateIP, nil
	}
	return node.PublicIP, nil
}

func infisicalSecretPathForCluster(cfg *config.Config) string {
	base := strings.TrimSpace(cfg.Infisical.SecretPath)
	cluster := strings.TrimSpace(cfg.Environment)

	if cluster == "" {
		return base
	}
	if base == "" || base == "/" {
		return "/" + cluster
	}
	return strings.TrimRight(base, "/") + "/" + cluster
}

func controlPlaneNodeName(environment, poolName string, slot int) string {
	namePrefix := strings.TrimSpace(poolName)
	if env := strings.TrimSpace(environment); env != "" {
		namePrefix = env + "-" + namePrefix
	}

	return fmt.Sprintf("%s-%02d", namePrefix, slot)
}

func parseControlPlaneSlot(environment, poolName, nodeName string) (int, bool) {
	nodeName = strings.TrimSpace(nodeName)
	poolName = strings.TrimSpace(poolName)

	prefixes := make([]string, 0, 2)
	if env := strings.TrimSpace(environment); env != "" {
		prefixes = append(prefixes, env+"-"+poolName+"-")
	}
	// Backward compatibility for existing nodes named as "<pool>-NN".
	prefixes = append(prefixes, poolName+"-")

	for _, prefix := range prefixes {
		if !strings.HasPrefix(nodeName, prefix) {
			continue
		}

		suffix := strings.TrimPrefix(nodeName, prefix)
		if len(suffix) != 2 {
			continue
		}

		slot, err := strconv.Atoi(suffix)
		if err == nil && slot > 0 {
			return slot, true
		}
	}

	return 0, false
}

func controlPlaneReservedIPForSlot(pool *config.NodePoolConfig, slot int) (string, error) {
	if pool == nil {
		return "", fmt.Errorf("node pool is required")
	}

	if len(pool.ReservedPrivateIPs) == 0 {
		return "", nil
	}

	if slot <= 0 || slot > len(pool.ReservedPrivateIPs) {
		return "", fmt.Errorf(
			"control-plane slot %d exceeds reserved_private_ips for pool %q (defined=%d)",
			slot, pool.Name, len(pool.ReservedPrivateIPs),
		)
	}

	return strings.TrimSpace(pool.ReservedPrivateIPs[slot-1]), nil
}

func nextControlPlaneSlot(state *clusterstate.NodesState, environment, poolName string) int {
	occupied := make(map[int]struct{})
	unknownNamedNodes := 0

	for _, node := range state.Nodes {
		if node.Role != config.NodeTypeControlPlane || node.Pool != poolName {
			continue
		}
		if node.Status == clusterstate.NodeStatusDeleted {
			continue
		}
		slot, ok := parseControlPlaneSlot(environment, poolName, node.Name)
		if !ok {
			unknownNamedNodes++
			continue
		}
		occupied[slot] = struct{}{}
	}

	for slot := 1; slot <= 99 && unknownNamedNodes > 0; slot++ {
		if _, used := occupied[slot]; used {
			continue
		}
		occupied[slot] = struct{}{}
		unknownNamedNodes--
	}

	for slot := 1; slot <= 99; slot++ {
		if _, used := occupied[slot]; !used {
			return slot
		}
	}

	return 100
}
