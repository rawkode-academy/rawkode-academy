package cmd

import (
	"context"
	"errors"
	"fmt"
	"net"
	"net/netip"
	"net/url"
	"os"
	"path/filepath"
	"strings"

	clusterstate "github.com/rawkode-academy/rawkode-cloud3/internal/cluster"
	"github.com/rawkode-academy/rawkode-cloud3/internal/config"
	"github.com/rawkode-academy/rawkode-cloud3/internal/talos"
	"github.com/spf13/cobra"
	"gopkg.in/yaml.v3"
)

var clusterAccessCmd = &cobra.Command{
	Use:   "access",
	Short: "Write local talosctl and kubectl config files for a cluster",
	RunE:  runClusterAccess,
}

type clusterAccessMaterials struct {
	ConfigPath      string
	TalosEndpoint   string
	TalosconfigYAML []byte
	KubeconfigYAML  []byte
}

func init() {
	clusterCmd.AddCommand(clusterAccessCmd)

	clusterAccessCmd.Flags().String("cluster", "", "Cluster/environment name")
	clusterAccessCmd.Flags().StringP("file", "f", "", "Path to cluster config YAML")
	clusterAccessCmd.Flags().String("talosconfig-out", "~/.talos/config", "Path to write talosconfig")
	clusterAccessCmd.Flags().String("kubeconfig-out", "~/.kube/config", "Path to write kubeconfig")
	clusterAccessCmd.Flags().Bool("overwrite", false, "Overwrite destination files if they already exist")
}

func runClusterAccess(cmd *cobra.Command, args []string) error {
	ctx := context.Background()

	clusterName, _ := cmd.Flags().GetString("cluster")
	cfgFile, _ := cmd.Flags().GetString("file")
	talosOutRaw, _ := cmd.Flags().GetString("talosconfig-out")
	kubeOutRaw, _ := cmd.Flags().GetString("kubeconfig-out")
	overwrite, _ := cmd.Flags().GetBool("overwrite")

	materials, err := buildClusterAccessMaterials(ctx, clusterName, cfgFile)
	if err != nil {
		return err
	}

	talosOut, err := expandLocalPath(talosOutRaw)
	if err != nil {
		return fmt.Errorf("resolve talosconfig path: %w", err)
	}
	kubeOut, err := expandLocalPath(kubeOutRaw)
	if err != nil {
		return fmt.Errorf("resolve kubeconfig path: %w", err)
	}

	if err := writeConfigFile(talosOut, materials.TalosconfigYAML, overwrite); err != nil {
		return fmt.Errorf("write talosconfig: %w", err)
	}
	if err := writeConfigFile(kubeOut, materials.KubeconfigYAML, overwrite); err != nil {
		return fmt.Errorf("write kubeconfig: %w", err)
	}

	fmt.Printf("Cluster access configured from %s\n", materials.ConfigPath)
	fmt.Printf("  Talos API:   %s\n", materials.TalosEndpoint)
	fmt.Printf("  TALOSCONFIG: %s\n", talosOut)
	fmt.Printf("  KUBECONFIG:  %s\n", kubeOut)
	fmt.Printf("\nExport for this shell session:\n")
	fmt.Printf("  export TALOSCONFIG=%q\n", talosOut)
	fmt.Printf("  export KUBECONFIG=%q\n", kubeOut)

	return nil
}

func buildClusterAccessMaterials(ctx context.Context, clusterName, cfgFile string) (*clusterAccessMaterials, error) {
	cfg, cfgPath, err := loadConfigForClusterOrFile(clusterName, cfgFile)
	if err != nil {
		return nil, err
	}

	infClient, err := getOrCreateInfisicalClient(ctx, cfg)
	if err != nil {
		return nil, fmt.Errorf("create infisical client: %w", err)
	}

	talosconfig, err := loadTalosconfigFromInfisical(ctx, cfg, infClient)
	if err != nil {
		return nil, err
	}

	state, err := loadNodeState(ctx, cfg)
	if err != nil {
		return nil, err
	}

	controlPlane, err := firstActiveNodeByRole(state, config.NodeTypeControlPlane)
	if err != nil {
		return nil, err
	}

	candidates := talosAccessEndpoints(controlPlane)
	if len(candidates) == 0 {
		return nil, fmt.Errorf("no control-plane endpoint available in state")
	}

	var (
		kubeconfig       []byte
		selectedEndpoint string
		lastErr          error
	)
	for _, endpoint := range candidates {
		talosClient, err := talos.NewClient(endpoint, talosconfig)
		if err != nil {
			lastErr = fmt.Errorf("create talos client via %s: %w", endpoint, err)
			continue
		}

		kubeconfig, err = talosClient.Kubeconfig(ctx)
		closeErr := talosClient.Close()
		if err == nil && closeErr == nil {
			selectedEndpoint = endpoint
			break
		}
		if err != nil {
			lastErr = fmt.Errorf("fetch kubeconfig via %s: %w", endpoint, err)
		} else {
			lastErr = fmt.Errorf("close talos client via %s: %w", endpoint, closeErr)
		}
	}
	if selectedEndpoint == "" {
		if lastErr == nil {
			lastErr = fmt.Errorf("unknown talos connectivity error")
		}
		return nil, lastErr
	}

	rewrittenTalosconfig, err := rewriteTalosconfigEndpoint(talosconfig, selectedEndpoint)
	if err != nil {
		return nil, fmt.Errorf("rewrite talosconfig endpoint: %w", err)
	}
	rewrittenKubeconfig, err := rewriteKubeconfigServerIfNeeded(kubeconfig, selectedEndpoint)
	if err != nil {
		return nil, fmt.Errorf("rewrite kubeconfig server: %w", err)
	}

	return &clusterAccessMaterials{
		ConfigPath:      cfgPath,
		TalosEndpoint:   selectedEndpoint,
		TalosconfigYAML: rewrittenTalosconfig,
		KubeconfigYAML:  rewrittenKubeconfig,
	}, nil
}

func talosAccessEndpoints(node *clusterstate.NodeState) []string {
	if node == nil {
		return nil
	}

	seen := map[string]struct{}{}
	out := make([]string, 0, 4)

	add := func(value string) {
		value = strings.TrimSpace(value)
		if value == "" {
			return
		}
		if _, ok := seen[value]; ok {
			return
		}
		seen[value] = struct{}{}
		out = append(out, value)
	}

	// Prefer Netbird/DNS-based control-plane names first; those are the primary
	// path for local operator access in this environment.
	if nodeName := strings.TrimSpace(node.Name); nodeName != "" {
		if strings.Contains(nodeName, ".") {
			add(nodeName)
		} else {
			suffix := strings.Trim(strings.TrimSpace(os.Getenv("TALOS_NODE_FQDN_SUFFIX")), ".")
			if suffix == "" {
				suffix = defaultTalosNodeFQDNSuffix
			}
			if suffix != "" {
				add(nodeName + "." + suffix)
			}
			add(nodeName)
		}
	}

	// Fallback to direct node IP access.
	add(node.PublicIP)
	add(node.PrivateIP)

	return out
}

func rewriteTalosconfigEndpoint(talosconfig []byte, endpoint string) ([]byte, error) {
	var cfg map[string]any
	if err := yaml.Unmarshal(talosconfig, &cfg); err != nil {
		return nil, fmt.Errorf("parse talosconfig YAML: %w", err)
	}

	contextName := strings.TrimSpace(stringValue(cfg["context"]))
	contexts, ok := cfg["contexts"].(map[string]any)
	if !ok || len(contexts) == 0 {
		return nil, fmt.Errorf("talosconfig has no contexts")
	}

	if contextName == "" {
		for name := range contexts {
			contextName = name
			break
		}
	}

	rawContext, ok := contexts[contextName]
	if !ok {
		return nil, fmt.Errorf("talosconfig context %q not found", contextName)
	}

	contextMap, ok := rawContext.(map[string]any)
	if !ok {
		return nil, fmt.Errorf("talosconfig context %q is not a map", contextName)
	}

	contextMap["endpoints"] = []string{endpoint}
	if !looksPrivateAddress(endpoint) {
		contextMap["nodes"] = []string{endpoint}
	}
	contexts[contextName] = contextMap
	cfg["contexts"] = contexts

	out, err := yaml.Marshal(cfg)
	if err != nil {
		return nil, fmt.Errorf("encode talosconfig YAML: %w", err)
	}

	return out, nil
}

func stringValue(v any) string {
	s, _ := v.(string)
	return s
}

func looksPrivateAddress(value string) bool {
	addr, err := netip.ParseAddr(strings.TrimSpace(value))
	if err != nil {
		return false
	}

	return addr.IsPrivate()
}

func rewriteKubeconfigServerIfNeeded(kubeconfig []byte, endpoint string) ([]byte, error) {
	endpoint = strings.TrimSpace(endpoint)
	if endpoint == "" || looksPrivateAddress(endpoint) {
		return kubeconfig, nil
	}

	var cfg map[string]any
	if err := yaml.Unmarshal(kubeconfig, &cfg); err != nil {
		return nil, fmt.Errorf("parse kubeconfig YAML: %w", err)
	}

	clusters, ok := cfg["clusters"].([]any)
	if !ok || len(clusters) == 0 {
		return kubeconfig, nil
	}

	changed := false
	for i := range clusters {
		entry, ok := clusters[i].(map[string]any)
		if !ok {
			continue
		}
		clusterSection, ok := entry["cluster"].(map[string]any)
		if !ok {
			continue
		}
		server := stringValue(clusterSection["server"])
		if !isPrivateKubeServer(server) {
			continue
		}

		clusterSection["server"] = "https://" + net.JoinHostPort(endpoint, "6443")
		entry["cluster"] = clusterSection
		clusters[i] = entry
		changed = true
	}

	if !changed {
		return kubeconfig, nil
	}

	cfg["clusters"] = clusters
	out, err := yaml.Marshal(cfg)
	if err != nil {
		return nil, fmt.Errorf("encode kubeconfig YAML: %w", err)
	}

	return out, nil
}

func isPrivateKubeServer(server string) bool {
	server = strings.TrimSpace(server)
	if server == "" {
		return false
	}

	parsed, err := url.Parse(server)
	if err != nil || parsed.Host == "" {
		return false
	}

	host := parsed.Host
	if h, _, err := net.SplitHostPort(parsed.Host); err == nil {
		host = h
	}
	host = strings.Trim(host, "[]")
	addr, err := netip.ParseAddr(host)
	if err != nil {
		return false
	}

	return addr.IsPrivate()
}

func expandLocalPath(path string) (string, error) {
	path = strings.TrimSpace(path)
	if path == "" {
		return "", fmt.Errorf("path is required")
	}

	if path == "~" || strings.HasPrefix(path, "~/") {
		home, err := os.UserHomeDir()
		if err != nil {
			return "", fmt.Errorf("resolve home directory: %w", err)
		}
		if path == "~" {
			path = home
		} else {
			path = filepath.Join(home, strings.TrimPrefix(path, "~/"))
		}
	}

	abs, err := filepath.Abs(path)
	if err != nil {
		return "", err
	}

	return abs, nil
}

func writeConfigFile(path string, data []byte, overwrite bool) error {
	if len(strings.TrimSpace(string(data))) == 0 {
		return fmt.Errorf("config content is empty")
	}

	if !overwrite {
		_, err := os.Stat(path)
		if err == nil {
			return fmt.Errorf("file %s already exists (set --overwrite to replace it)", path)
		}
		if err != nil && !errors.Is(err, os.ErrNotExist) {
			return err
		}
	}

	if err := os.MkdirAll(filepath.Dir(path), 0o700); err != nil {
		return err
	}

	if err := os.WriteFile(path, data, 0o600); err != nil {
		return err
	}

	return nil
}
