package cmd

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/spf13/cobra"
)

const scaffoldTemplate = `environment: %s

state:
  bucket: ""
  region: fr-par

cluster:
  talos_version: v1.12.4
  kubernetes_version: v1.35.0
  talos_schematic: ""

scaleway:
  projectId: ""
  organizationId: ""

nodePools:
  - name: main
    type: control-plane
    zone: fr-par-1
    size: 1
    offer: ""
    billing_cycle: hourly
    reserved_private_ips:
      - 172.16.16.16
      - 172.16.16.17
      - 172.16.16.18
    disks:
      os: /dev/nvme0n1
      data: /dev/nvme1n1

teleport:
  domain: ""
  mode: self_hosted
  github:
    organization: ""
    teams: []

infisical:
  site_url: https://app.infisical.com
  project_id: ""
  environment: production
  secret_path: /%s # shared secrets live here; cluster secrets use <secret_path>/<environment>

flux:
  oci_repo: ""
`

var clusterScaffoldCmd = &cobra.Command{
	Use:   "scaffold",
	Short: "Scaffold a cluster environment YAML in the current working directory",
	RunE: func(cmd *cobra.Command, args []string) error {
		environment, _ := cmd.Flags().GetString("environment")
		outputFile, _ := cmd.Flags().GetString("output-file")
		return runClusterScaffold(environment, outputFile)
	},
}

var scaffoldCmd = &cobra.Command{
	Use:        "scaffold",
	Short:      "Deprecated alias for cluster scaffold",
	Deprecated: "use \"cluster scaffold -e <environment> [--output-file <path>]\" instead",
	RunE: func(cmd *cobra.Command, args []string) error {
		environment, _ := cmd.Flags().GetString("name")
		outputFile, _ := cmd.Flags().GetString("output")
		return runClusterScaffold(environment, outputFile)
	},
}

func runClusterScaffold(environment, outputFile string) error {
	environment = strings.TrimSpace(environment)
	if environment == "" {
		return fmt.Errorf("--environment is required")
	}

	if strings.TrimSpace(outputFile) == "" {
		outputFile = environment + ".yaml"
	}

	content := fmt.Sprintf(scaffoldTemplate, environment, environment)

	dir := filepath.Dir(outputFile)
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return fmt.Errorf("create directory %s: %w", dir, err)
	}

	if _, err := os.Stat(outputFile); err == nil {
		return fmt.Errorf("file %s already exists; remove it first or use a different --output-file", outputFile)
	}

	if err := os.WriteFile(outputFile, []byte(content), 0o644); err != nil {
		return fmt.Errorf("write %s: %w", outputFile, err)
	}

	fmt.Printf("Scaffolded environment config: %s\n", outputFile)
	fmt.Println("Edit the file to fill in your Scaleway, Teleport, and Infisical settings.")
	return nil
}

func init() {
	rootCmd.AddCommand(scaffoldCmd)
	clusterScaffoldCmd.Flags().StringP("environment", "e", "", "Environment name")
	clusterScaffoldCmd.Flags().String("output-file", "", "Output file path (default: ./<environment>.yaml)")
	_ = clusterScaffoldCmd.MarkFlagRequired("environment")

	// Deprecated alias flags
	scaffoldCmd.Flags().String("name", "", "Environment/cluster name")
	scaffoldCmd.Flags().String("output", "", "Output file path (default: clusters/<name>.yaml)")
}
