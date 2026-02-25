package talos

import (
	"fmt"
	"strings"

	"gopkg.in/yaml.v3"
)

// WithNodeName sets machine hostname fields so Kubernetes registers the node
// using the expected infrastructure name instead of a Talos-generated fallback.
func WithNodeName(machineConfig []byte, nodeName string) ([]byte, error) {
	if len(machineConfig) == 0 {
		return nil, fmt.Errorf("machine config is required")
	}

	nodeName = strings.TrimSpace(nodeName)
	if nodeName == "" {
		return nil, fmt.Errorf("node name is required")
	}

	var cfg map[string]any
	if err := yaml.Unmarshal(machineConfig, &cfg); err != nil {
		return nil, fmt.Errorf("parse machine config YAML: %w", err)
	}
	if cfg == nil {
		cfg = map[string]any{}
	}

	machine := ensureMapField(cfg, "machine")
	network := ensureMapField(machine, "network")
	network["hostname"] = nodeName

	kubelet := ensureMapField(machine, "kubelet")
	extraArgs := ensureMapField(kubelet, "extraArgs")
	extraArgs["hostname-override"] = nodeName

	out, err := yaml.Marshal(cfg)
	if err != nil {
		return nil, fmt.Errorf("encode machine config YAML: %w", err)
	}

	return out, nil
}

func ensureMapField(parent map[string]any, key string) map[string]any {
	if existing, ok := parent[key].(map[string]any); ok {
		return existing
	}

	out := map[string]any{}
	parent[key] = out
	return out
}
