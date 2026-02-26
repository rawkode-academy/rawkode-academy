package cmd

import (
	"context"
	"errors"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/spf13/cobra"
)

func restoreClusterExecFns() {
	clusterExecBuildAccessMaterialsFn = buildClusterAccessMaterials
	clusterExecRunShellFn = runClusterExecShell
	clusterExecMkdirTempFn = os.MkdirTemp
	clusterExecEnvironFn = os.Environ
	clusterExecGetenvFn = os.Getenv
	clusterExecStatFn = os.Stat
}

func newClusterExecTestCmd(clusterName, cfgFile string) *cobra.Command {
	cmd := &cobra.Command{}
	cmd.Flags().String("cluster", "", "")
	cmd.Flags().StringP("file", "f", "", "")
	_ = cmd.Flags().Set("cluster", clusterName)
	_ = cmd.Flags().Set("file", cfgFile)
	return cmd
}

func envValue(env []string, key string) string {
	prefix := key + "="
	for _, item := range env {
		if strings.HasPrefix(item, prefix) {
			return strings.TrimPrefix(item, prefix)
		}
	}
	return ""
}

func envKeyCount(env []string, key string) int {
	count := 0
	prefix := key + "="
	for _, item := range env {
		if strings.HasPrefix(item, prefix) {
			count++
		}
	}
	return count
}

func TestClusterExecShellPath(t *testing.T) {
	restoreClusterExecFns()
	t.Cleanup(restoreClusterExecFns)

	clusterExecGetenvFn = func(key string) string {
		if key == "SHELL" {
			return "  /bin/zsh  "
		}
		return ""
	}

	if got := clusterExecShellPath(); got != "/bin/zsh" {
		t.Fatalf("clusterExecShellPath() = %q, want %q", got, "/bin/zsh")
	}

	clusterExecGetenvFn = func(string) string { return "" }
	if got := clusterExecShellPath(); got != "/bin/sh" {
		t.Fatalf("clusterExecShellPath() fallback = %q, want %q", got, "/bin/sh")
	}
}

func TestClusterExecEnvOverridesExistingValues(t *testing.T) {
	base := []string{
		"HOME=/tmp/home",
		"TALOSCONFIG=/old/talos",
		"KUBECONFIG=/old/kube",
		"PATH=/usr/bin",
		"BROKEN",
	}

	env := clusterExecEnv(base, "/tmp/new/talos", "/tmp/new/kube")

	if got := envValue(env, "TALOSCONFIG"); got != "/tmp/new/talos" {
		t.Fatalf("TALOSCONFIG = %q, want %q", got, "/tmp/new/talos")
	}
	if got := envValue(env, "KUBECONFIG"); got != "/tmp/new/kube" {
		t.Fatalf("KUBECONFIG = %q, want %q", got, "/tmp/new/kube")
	}
	if envKeyCount(env, "TALOSCONFIG") != 1 {
		t.Fatalf("expected exactly one TALOSCONFIG entry, got %d", envKeyCount(env, "TALOSCONFIG"))
	}
	if envKeyCount(env, "KUBECONFIG") != 1 {
		t.Fatalf("expected exactly one KUBECONFIG entry, got %d", envKeyCount(env, "KUBECONFIG"))
	}
	if !strings.Contains(strings.Join(env, "\n"), "BROKEN") {
		t.Fatalf("expected non key/value env entry to be preserved, env=%v", env)
	}
}

type testDirFileInfo struct{}

func (testDirFileInfo) Name() string       { return "dir" }
func (testDirFileInfo) Size() int64        { return 0 }
func (testDirFileInfo) Mode() os.FileMode  { return os.ModeDir | 0o755 }
func (testDirFileInfo) ModTime() time.Time { return time.Unix(0, 0) }
func (testDirFileInfo) IsDir() bool        { return true }
func (testDirFileInfo) Sys() any           { return nil }

func TestClusterExecTempRootPrefersEnvOverride(t *testing.T) {
	restoreClusterExecFns()
	t.Cleanup(restoreClusterExecFns)

	clusterExecGetenvFn = func(key string) string {
		if key == "RAWKODE_CLOUD3_RAMDISK_DIR" {
			return "/Volumes/RAMDisk"
		}
		return ""
	}

	if got := clusterExecTempRoot(); got != "/Volumes/RAMDisk" {
		t.Fatalf("clusterExecTempRoot() = %q, want %q", got, "/Volumes/RAMDisk")
	}
}

func TestClusterExecTempRootFallsBackToDevShm(t *testing.T) {
	restoreClusterExecFns()
	t.Cleanup(restoreClusterExecFns)

	clusterExecGetenvFn = func(string) string { return "" }
	clusterExecStatFn = func(path string) (os.FileInfo, error) {
		if path == "/dev/shm" {
			return testDirFileInfo{}, nil
		}
		return nil, os.ErrNotExist
	}

	if got := clusterExecTempRoot(); got != "/dev/shm" {
		t.Fatalf("clusterExecTempRoot() = %q, want %q", got, "/dev/shm")
	}
}

func TestRunClusterExecCleansUpOnSuccess(t *testing.T) {
	restoreClusterExecFns()
	t.Cleanup(restoreClusterExecFns)

	clusterExecBuildAccessMaterialsFn = func(_ context.Context, clusterName, cfgFile string) (*clusterAccessMaterials, error) {
		if clusterName != "production" {
			t.Fatalf("clusterName = %q, want %q", clusterName, "production")
		}
		if cfgFile != "./clusters/production.yaml" {
			t.Fatalf("cfgFile = %q, want %q", cfgFile, "./clusters/production.yaml")
		}

		return &clusterAccessMaterials{
			ConfigPath:      cfgFile,
			TalosEndpoint:   "203.0.113.10",
			TalosconfigYAML: []byte("context: test\n"),
			KubeconfigYAML:  []byte("apiVersion: v1\n"),
		}, nil
	}

	clusterExecEnvironFn = func() []string {
		return []string{
			"HOME=/tmp/home",
			"PATH=/usr/bin",
			"TALOSCONFIG=/old/talos",
			"KUBECONFIG=/old/kube",
		}
	}
	clusterExecGetenvFn = func(key string) string {
		if key == "SHELL" {
			return " /bin/zsh "
		}
		return ""
	}
	clusterExecStatFn = func(string) (os.FileInfo, error) { return nil, os.ErrNotExist }

	var tempDir string
	clusterExecRunShellFn = func(params clusterExecShellParams) error {
		if params.Shell != "/bin/zsh" {
			t.Fatalf("shell = %q, want %q", params.Shell, "/bin/zsh")
		}
		if len(params.Args) != 0 {
			t.Fatalf("args = %v, want []", params.Args)
		}

		talosPath := envValue(params.Env, "TALOSCONFIG")
		kubePath := envValue(params.Env, "KUBECONFIG")
		if talosPath == "" || kubePath == "" {
			t.Fatalf("missing TALOSCONFIG/KUBECONFIG in env: %v", params.Env)
		}
		if envKeyCount(params.Env, "TALOSCONFIG") != 1 || envKeyCount(params.Env, "KUBECONFIG") != 1 {
			t.Fatalf("expected exactly one TALOSCONFIG/KUBECONFIG entry, env=%v", params.Env)
		}

		talosData, err := os.ReadFile(talosPath)
		if err != nil {
			t.Fatalf("read talosconfig: %v", err)
		}
		if string(talosData) != "context: test\n" {
			t.Fatalf("talosconfig content = %q", string(talosData))
		}

		kubeData, err := os.ReadFile(kubePath)
		if err != nil {
			t.Fatalf("read kubeconfig: %v", err)
		}
		if string(kubeData) != "apiVersion: v1\n" {
			t.Fatalf("kubeconfig content = %q", string(kubeData))
		}

		tempDir = filepath.Dir(talosPath)
		if filepath.Dir(kubePath) != tempDir {
			t.Fatalf("temp directory mismatch: talos=%s kube=%s", tempDir, filepath.Dir(kubePath))
		}

		return nil
	}

	err := runClusterExec(newClusterExecTestCmd("production", "./clusters/production.yaml"), nil)
	if err != nil {
		t.Fatalf("runClusterExec returned error: %v", err)
	}

	if strings.TrimSpace(tempDir) == "" {
		t.Fatalf("expected test to capture temp directory")
	}
	if _, err := os.Stat(tempDir); !errors.Is(err, os.ErrNotExist) {
		t.Fatalf("expected temp directory %s to be removed, stat error=%v", tempDir, err)
	}
}

func TestRunClusterExecCleansUpOnShellError(t *testing.T) {
	restoreClusterExecFns()
	t.Cleanup(restoreClusterExecFns)

	clusterExecBuildAccessMaterialsFn = func(context.Context, string, string) (*clusterAccessMaterials, error) {
		return &clusterAccessMaterials{
			ConfigPath:      "./clusters/production.yaml",
			TalosEndpoint:   "203.0.113.10",
			TalosconfigYAML: []byte("context: test\n"),
			KubeconfigYAML:  []byte("apiVersion: v1\n"),
		}, nil
	}
	clusterExecEnvironFn = func() []string { return nil }
	clusterExecGetenvFn = func(string) string { return "" }
	clusterExecStatFn = func(string) (os.FileInfo, error) { return nil, os.ErrNotExist }

	shellErr := errors.New("shell failed")
	var tempDir string
	clusterExecRunShellFn = func(params clusterExecShellParams) error {
		talosPath := envValue(params.Env, "TALOSCONFIG")
		if talosPath == "" {
			t.Fatalf("missing TALOSCONFIG in env: %v", params.Env)
		}
		tempDir = filepath.Dir(talosPath)
		if _, err := os.Stat(talosPath); err != nil {
			t.Fatalf("expected talosconfig file to exist while shell is running: %v", err)
		}
		return shellErr
	}

	err := runClusterExec(newClusterExecTestCmd("", "./clusters/production.yaml"), nil)
	if err == nil {
		t.Fatal("expected runClusterExec to return error, got nil")
	}
	if !errors.Is(err, shellErr) {
		t.Fatalf("expected shell error to be wrapped, got %v", err)
	}

	if strings.TrimSpace(tempDir) == "" {
		t.Fatalf("expected test to capture temp directory")
	}
	if _, err := os.Stat(tempDir); !errors.Is(err, os.ErrNotExist) {
		t.Fatalf("expected temp directory %s to be removed, stat error=%v", tempDir, err)
	}
}
