package cmd

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
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
		if strings.TrimSpace(node.PublicIP) == "" {
			continue
		}
		return node, nil
	}

	return nil, fmt.Errorf("no active %s node with public IP found in state", role)
}

func loadTalosconfigFromInfisical(ctx context.Context, cfg *config.Config, client *infisical.Client) ([]byte, error) {
	value, err := client.GetSecret(ctx, cfg.Infisical.ProjectID, cfg.Infisical.Environment, cfg.Infisical.SecretPath, infisicalTalosConfigKey)
	if err != nil {
		return nil, fmt.Errorf("load %s from infisical: %w", infisicalTalosConfigKey, err)
	}
	if strings.TrimSpace(value) == "" {
		return nil, fmt.Errorf("%s is empty in infisical path %s", infisicalTalosConfigKey, cfg.Infisical.SecretPath)
	}

	return []byte(value), nil
}

func controlPlaneEndpointFromState(cfg *config.Config, state *clusterstate.NodesState) (string, error) {
	if dns := strings.TrimSpace(cfg.Teleport.Domain); dns != "" {
		return dns, nil
	}

	node, err := firstActiveNodeByRole(state, config.NodeTypeControlPlane)
	if err != nil {
		return "", err
	}
	return node.PublicIP, nil
}
