package cmd

import (
	"context"
	"errors"
	"fmt"
	"os"
	"os/exec"
	"os/signal"
	"path/filepath"
	"strings"
	"syscall"

	"github.com/spf13/cobra"
)

var clusterExecCmd = &cobra.Command{
	Use:   "exec",
	Short: "Open an interactive shell with talosctl and kubectl configured for a cluster",
	RunE:  runClusterExec,
}

var (
	clusterExecBuildAccessMaterialsFn = buildClusterAccessMaterials
	clusterExecRunShellFn             = runClusterExecShell
	clusterExecMkdirTempFn            = os.MkdirTemp
	clusterExecEnvironFn              = os.Environ
	clusterExecGetenvFn               = os.Getenv
	clusterExecStatFn                 = os.Stat
)

type clusterExecShellParams struct {
	Shell string
	Args  []string
	Env   []string
}

func init() {
	clusterCmd.AddCommand(clusterExecCmd)

	clusterExecCmd.Flags().String("cluster", "", "Cluster/environment name")
	clusterExecCmd.Flags().StringP("file", "f", "", "Path to cluster config YAML")
}

func runClusterExec(cmd *cobra.Command, args []string) error {
	ctx := context.Background()

	clusterName, _ := cmd.Flags().GetString("cluster")
	cfgFile, _ := cmd.Flags().GetString("file")

	materials, err := clusterExecBuildAccessMaterialsFn(ctx, clusterName, cfgFile)
	if err != nil {
		return err
	}

	tempDir, err := clusterExecMkdirTempFn(clusterExecTempRoot(), "rawkode-cloud3-cluster-exec-*")
	if err != nil {
		return fmt.Errorf("create temporary cluster exec directory: %w", err)
	}

	defer func() {
		if removeErr := os.RemoveAll(tempDir); removeErr != nil && !errors.Is(removeErr, os.ErrNotExist) {
			fmt.Fprintf(os.Stderr, "warning: failed to remove temporary cluster exec directory %s: %v\n", tempDir, removeErr)
		}
	}()

	talosconfigPath := filepath.Join(tempDir, "talosconfig")
	kubeconfigPath := filepath.Join(tempDir, "kubeconfig")

	if err := writeConfigFile(talosconfigPath, materials.TalosconfigYAML, true); err != nil {
		return fmt.Errorf("write temporary talosconfig: %w", err)
	}
	if err := writeConfigFile(kubeconfigPath, materials.KubeconfigYAML, true); err != nil {
		return fmt.Errorf("write temporary kubeconfig: %w", err)
	}

	shellPath := clusterExecShellPath()
	env := clusterExecEnv(clusterExecEnvironFn(), talosconfigPath, kubeconfigPath)

	fmt.Printf("Cluster exec configured from %s\n", materials.ConfigPath)
	fmt.Printf("  Talos API:   %s\n", materials.TalosEndpoint)
	fmt.Printf("  TALOSCONFIG: %s\n", talosconfigPath)
	fmt.Printf("  KUBECONFIG:  %s\n", kubeconfigPath)
	fmt.Printf("  Shell:       %s\n", shellPath)
	fmt.Printf("\nExit the shell to clean up temporary credentials.\n")

	if err := clusterExecRunShellFn(clusterExecShellParams{
		Shell: shellPath,
		Args:  nil,
		Env:   env,
	}); err != nil {
		return fmt.Errorf("run interactive shell: %w", err)
	}

	return nil
}

func clusterExecShellPath() string {
	shell := strings.TrimSpace(clusterExecGetenvFn("SHELL"))
	if shell == "" {
		return "/bin/sh"
	}

	return shell
}

func clusterExecTempRoot() string {
	if ramdiskDir := strings.TrimSpace(clusterExecGetenvFn("RAWKODE_CLOUD3_RAMDISK_DIR")); ramdiskDir != "" {
		return ramdiskDir
	}

	if info, err := clusterExecStatFn("/dev/shm"); err == nil && info.IsDir() {
		return "/dev/shm"
	}

	return os.TempDir()
}

func clusterExecEnv(base []string, talosconfigPath, kubeconfigPath string) []string {
	env := make([]string, 0, len(base)+2)
	for _, entry := range base {
		key, _, ok := strings.Cut(entry, "=")
		if ok && (key == "TALOSCONFIG" || key == "KUBECONFIG") {
			continue
		}
		env = append(env, entry)
	}

	env = append(env,
		"TALOSCONFIG="+talosconfigPath,
		"KUBECONFIG="+kubeconfigPath,
	)

	return env
}

func runClusterExecShell(params clusterExecShellParams) error {
	if strings.TrimSpace(params.Shell) == "" {
		return fmt.Errorf("shell is required")
	}

	shellCmd := exec.Command(params.Shell, params.Args...)
	shellCmd.Env = params.Env

	tty, err := os.OpenFile("/dev/tty", os.O_RDWR, 0)
	if err != nil {
		return fmt.Errorf("open controlling terminal (/dev/tty): %w", err)
	}
	defer tty.Close()

	shellCmd.Stdin = tty
	shellCmd.Stdout = tty
	shellCmd.Stderr = tty

	if err := shellCmd.Start(); err != nil {
		return err
	}

	sigCh := make(chan os.Signal, 8)
	signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM, syscall.SIGHUP, syscall.SIGQUIT, syscall.SIGWINCH)
	defer signal.Stop(sigCh)

	waitCh := make(chan error, 1)
	go func() {
		waitCh <- shellCmd.Wait()
	}()

	for {
		select {
		case sig := <-sigCh:
			if shellCmd.Process != nil {
				_ = shellCmd.Process.Signal(sig)
			}
		case err := <-waitCh:
			return err
		}
	}
}
