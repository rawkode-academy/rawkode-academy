package talos

import (
	"fmt"
	"strings"

	"gopkg.in/yaml.v3"
)

const (
	mayastorNamespace      = "openebs"
	mayastorHugePages      = "1024"
	mayastorMountPath      = "/var/local"
	mayastorNodeLabelKey   = "openebs.io/engine"
	mayastorNodeLabelValue = "mayastor"
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

// WithCertSANs ensures machine.certSANs includes the provided DNS/IP SAN entries.
func WithCertSANs(machineConfig []byte, certSANs ...string) ([]byte, error) {
	if len(machineConfig) == 0 {
		return nil, fmt.Errorf("machine config is required")
	}

	var cfg map[string]any
	if err := yaml.Unmarshal(machineConfig, &cfg); err != nil {
		return nil, fmt.Errorf("parse machine config YAML: %w", err)
	}
	if cfg == nil {
		cfg = map[string]any{}
	}

	machine := ensureMapField(cfg, "machine")
	existing := stringSlice(machine["certSANs"])
	combined := normalizeStringSet(append(existing, certSANs...)...)
	if len(combined) > 0 {
		machine["certSANs"] = combined
	}

	out, err := yaml.Marshal(cfg)
	if err != nil {
		return nil, fmt.Errorf("encode machine config YAML: %w", err)
	}

	return out, nil
}

// WithMayastorControlPlane exempts the OpenEBS namespace from Talos PodSecurity admission.
func WithMayastorControlPlane(machineConfig []byte) ([]byte, error) {
	if len(machineConfig) == 0 {
		return nil, fmt.Errorf("machine config is required")
	}

	var cfg map[string]any
	if err := yaml.Unmarshal(machineConfig, &cfg); err != nil {
		return nil, fmt.Errorf("parse machine config YAML: %w", err)
	}
	if cfg == nil {
		cfg = map[string]any{}
	}

	cluster := ensureMapField(cfg, "cluster")
	apiServer := ensureMapField(cluster, "apiServer")
	admissionControl := anySlice(apiServer["admissionControl"])

	podSecurity := findAdmissionController(admissionControl, "PodSecurity")
	if podSecurity == nil {
		podSecurity = map[string]any{
			"name": "PodSecurity",
		}
		admissionControl = append(admissionControl, podSecurity)
	}

	configuration := ensureMapField(podSecurity, "configuration")
	if strings.TrimSpace(stringValue(configuration["apiVersion"])) == "" {
		configuration["apiVersion"] = "pod-security.admission.config.k8s.io/v1beta1"
	}
	if strings.TrimSpace(stringValue(configuration["kind"])) == "" {
		configuration["kind"] = "PodSecurityConfiguration"
	}

	exemptions := ensureMapField(configuration, "exemptions")
	exemptions["namespaces"] = normalizeStringSet(append(stringSlice(exemptions["namespaces"]), mayastorNamespace)...)

	apiServer["admissionControl"] = admissionControl

	out, err := yaml.Marshal(cfg)
	if err != nil {
		return nil, fmt.Errorf("encode machine config YAML: %w", err)
	}

	return out, nil
}

// WithMayastorNode applies the machine-level prerequisites Mayastor needs on any storage node.
func WithMayastorNode(machineConfig []byte) ([]byte, error) {
	if len(machineConfig) == 0 {
		return nil, fmt.Errorf("machine config is required")
	}

	var cfg map[string]any
	if err := yaml.Unmarshal(machineConfig, &cfg); err != nil {
		return nil, fmt.Errorf("parse machine config YAML: %w", err)
	}
	if cfg == nil {
		cfg = map[string]any{}
	}

	machine := ensureMapField(cfg, "machine")

	sysctls := ensureMapField(machine, "sysctls")
	sysctls["vm.nr_hugepages"] = mayastorHugePages

	nodeLabels := ensureMapField(machine, "nodeLabels")
	nodeLabels[mayastorNodeLabelKey] = mayastorNodeLabelValue

	kubelet := ensureMapField(machine, "kubelet")
	extraMounts := anySlice(kubelet["extraMounts"])

	mayastorMount := findMount(extraMounts, mayastorMountPath, mayastorMountPath)
	if mayastorMount == nil {
		mayastorMount = map[string]any{}
		extraMounts = append(extraMounts, mayastorMount)
	}
	mayastorMount["destination"] = mayastorMountPath
	mayastorMount["source"] = mayastorMountPath
	mayastorMount["type"] = "bind"
	mayastorMount["options"] = []string{"bind", "rshared", "rw"}

	kubelet["extraMounts"] = extraMounts

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

func stringSlice(value any) []string {
	switch typed := value.(type) {
	case []string:
		out := make([]string, 0, len(typed))
		for _, item := range typed {
			out = append(out, strings.TrimSpace(item))
		}
		return out
	case []any:
		out := make([]string, 0, len(typed))
		for _, item := range typed {
			str, ok := item.(string)
			if !ok {
				continue
			}
			out = append(out, strings.TrimSpace(str))
		}
		return out
	default:
		return nil
	}
}

func anySlice(value any) []any {
	switch typed := value.(type) {
	case []any:
		return append([]any(nil), typed...)
	default:
		return nil
	}
}

func findAdmissionController(admissionControl []any, name string) map[string]any {
	for _, item := range admissionControl {
		controller, ok := item.(map[string]any)
		if !ok {
			continue
		}
		if stringValue(controller["name"]) == name {
			return controller
		}
	}

	return nil
}

func findMount(extraMounts []any, source, destination string) map[string]any {
	for _, item := range extraMounts {
		mount, ok := item.(map[string]any)
		if !ok {
			continue
		}
		if stringValue(mount["source"]) == source && stringValue(mount["destination"]) == destination {
			return mount
		}
	}

	return nil
}

func stringValue(value any) string {
	str, _ := value.(string)
	return strings.TrimSpace(str)
}

func normalizeStringSet(values ...string) []string {
	seen := make(map[string]struct{}, len(values))
	out := make([]string, 0, len(values))
	for _, value := range values {
		trimmed := strings.TrimSpace(value)
		if trimmed == "" {
			continue
		}
		if _, exists := seen[trimmed]; exists {
			continue
		}
		seen[trimmed] = struct{}{}
		out = append(out, trimmed)
	}

	return out
}
