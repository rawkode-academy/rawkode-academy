package cmd

import (
	"context"
	"errors"
	"net"
	"strings"
	"testing"
	"time"

	"github.com/rawkode-academy/rawkode-cloud3/internal/cilium"
	"github.com/rawkode-academy/rawkode-cloud3/internal/config"
	"github.com/rawkode-academy/rawkode-cloud3/internal/flux"
	"github.com/rawkode-academy/rawkode-cloud3/internal/operation"
	"github.com/rawkode-academy/rawkode-cloud3/internal/scaleway"
	"github.com/rawkode-academy/rawkode-cloud3/internal/teleport"
	"github.com/scaleway/scaleway-sdk-go/api/baremetal/v1"
	scw "github.com/scaleway/scaleway-sdk-go/scw"
)

func restorePostBootstrapFns() {
	ciliumInstallFn = cilium.Install
	fluxBootstrapFn = flux.Bootstrap
	teleportGenerateJoinTokenFn = teleport.GenerateJoinToken
	teleportDeployKubeAgentFn = teleport.DeployKubeAgent
	teleportDeploySelfHostedFn = teleport.DeploySelfHosted
	teleportEnsureAdminAccessFn = teleport.EnsureAdminAccess
	postBootstrapKubeconfigPathFn = func(context.Context, *operation.Operation, *config.Config) (string, func(), error) {
		return "", func() {}, nil
	}
	postBootstrapKubeconfigRetryInterval = 15 * time.Second
	postBootstrapKubeconfigRetryTimeout = 30 * time.Minute
	postBootstrapKubernetesAPIProbeFn = postBootstrapKubernetesAPIReachable
	postBootstrapKubernetesAPIWaitFn = func(context.Context, string) error {
		return nil
	}
	postBootstrapKubernetesAPIRetryInterval = 5 * time.Second
	postBootstrapKubernetesAPIRetryTimeout = 10 * time.Minute
	scalewayNewClientFn = scaleway.NewClient
	scalewayGetServerFn = func(ctx context.Context, client *scaleway.Client, zone scw.Zone, serverID string) (*baremetal.Server, error) {
		return client.Baremetal.GetServer(&baremetal.GetServerRequest{
			Zone:     zone,
			ServerID: serverID,
		}, scw.WithContext(ctx))
	}
	scalewayEnsureNetworkFoundationFn = scaleway.EnsureNetworkFoundation
	scalewayResolvePrivateNetworkIPv4CIDRFn = scaleway.ResolvePrivateNetworkIPv4CIDR
}

func newPostBootstrapOperation() *operation.Operation {
	op := operation.New("op-test", operation.TypeCreateCluster, "production", []string{"post-bootstrap"})
	op.SetContext("zone", string(scw.ZoneFrPar1))
	op.SetContext("privateNetworkID", "pn-123")
	op.SetContext("privateIP", "172.16.16.16")
	return op
}

func TestPhasePostBootstrapAggregatesComponentErrors(t *testing.T) {
	restorePostBootstrapFns()
	t.Cleanup(restorePostBootstrapFns)

	errCilium := errors.New("cilium failed")
	errFlux := errors.New("flux failed")

	ciliumInstallFn = func(context.Context, cilium.InstallParams) error {
		return errCilium
	}
	fluxBootstrapFn = func(context.Context, flux.BootstrapParams) error {
		return errFlux
	}
	scalewayNewClientFn = func(string, string, string, string) (*scaleway.Client, error) {
		return &scaleway.Client{}, nil
	}
	scalewayResolvePrivateNetworkIPv4CIDRFn = func(context.Context, *scaleway.Client, scw.Region, string, string) (string, error) {
		return "172.16.16.0/22", nil
	}

	cfg := &config.Config{
		Teleport: config.TeleportConfig{
			Mode: config.TeleportModeDisabled,
		},
	}

	err := phasePostBootstrap(context.Background(), newPostBootstrapOperation(), cfg)
	if err == nil {
		t.Fatalf("expected post-bootstrap failure, got nil")
	}
	if !errors.Is(err, errCilium) {
		t.Fatalf("expected cilium error to be included: %v", err)
	}
	if !errors.Is(err, errFlux) {
		t.Fatalf("expected flux error to be included: %v", err)
	}
}

func TestPhasePostBootstrapExternalJoinTokenFailureFailsPhase(t *testing.T) {
	restorePostBootstrapFns()
	t.Cleanup(restorePostBootstrapFns)

	errJoin := errors.New("join token failed")

	ciliumInstallFn = func(context.Context, cilium.InstallParams) error {
		return nil
	}
	fluxBootstrapFn = func(context.Context, flux.BootstrapParams) error {
		return nil
	}
	teleportGenerateJoinTokenFn = func(context.Context, string, time.Duration) (string, error) {
		return "", errJoin
	}
	scalewayNewClientFn = func(string, string, string, string) (*scaleway.Client, error) {
		return &scaleway.Client{}, nil
	}
	scalewayResolvePrivateNetworkIPv4CIDRFn = func(context.Context, *scaleway.Client, scw.Region, string, string) (string, error) {
		return "172.16.16.0/22", nil
	}

	err := phasePostBootstrap(context.Background(), newPostBootstrapOperation(), &config.Config{
		Environment: "production",
		Teleport: config.TeleportConfig{
			Mode:   config.TeleportModeExternal,
			Domain: "teleport.example.com",
		},
	})
	if err == nil {
		t.Fatalf("expected post-bootstrap failure, got nil")
	}
	if !errors.Is(err, errJoin) {
		t.Fatalf("expected join token error to be included: %v", err)
	}
}

func TestPhasePostBootstrapExternalEnsuresTeleportAdminAccessFromConfig(t *testing.T) {
	restorePostBootstrapFns()
	t.Cleanup(restorePostBootstrapFns)

	ciliumInstallFn = func(context.Context, cilium.InstallParams) error {
		return nil
	}
	fluxBootstrapFn = func(context.Context, flux.BootstrapParams) error {
		return nil
	}
	teleportGenerateJoinTokenFn = func(context.Context, string, time.Duration) (string, error) {
		return "join-token", nil
	}
	teleportDeployKubeAgentFn = func(context.Context, teleport.DeployKubeAgentParams) error {
		return nil
	}
	scalewayNewClientFn = func(string, string, string, string) (*scaleway.Client, error) {
		return &scaleway.Client{}, nil
	}
	scalewayResolvePrivateNetworkIPv4CIDRFn = func(context.Context, *scaleway.Client, scw.Region, string, string) (string, error) {
		return "172.16.16.0/22", nil
	}

	var gotEnsureParams teleport.EnsureAccessParams
	teleportEnsureAdminAccessFn = func(_ context.Context, params teleport.EnsureAccessParams) error {
		gotEnsureParams = params
		return nil
	}

	cfg := &config.Config{
		Environment: "production",
		Teleport: config.TeleportConfig{
			Mode:   config.TeleportModeExternal,
			Domain: "teleport.example.com",
			GitHub: config.TeleportGitHubConfig{
				Organization: "rawkode-academy",
				Teams:        []string{"legacy-team"},
			},
			Access: config.TeleportAccessConfig{
				AdminTeams:       []string{"platform"},
				KubernetesUsers:  []string{"teleport-admin"},
				KubernetesGroups: []string{"system:masters"},
			},
		},
	}

	if err := phasePostBootstrap(context.Background(), newPostBootstrapOperation(), cfg); err != nil {
		t.Fatalf("phasePostBootstrap returned error: %v", err)
	}

	if gotEnsureParams.ProxyAddr != "teleport.example.com" {
		t.Fatalf("ensure access proxy addr = %q, want %q", gotEnsureParams.ProxyAddr, "teleport.example.com")
	}
	if gotEnsureParams.Organization != "rawkode-academy" {
		t.Fatalf("ensure access organization = %q, want %q", gotEnsureParams.Organization, "rawkode-academy")
	}
	if len(gotEnsureParams.AdminTeams) != 1 || gotEnsureParams.AdminTeams[0] != "platform" {
		t.Fatalf("ensure access admin teams = %v, want [platform]", gotEnsureParams.AdminTeams)
	}
	if len(gotEnsureParams.KubernetesUsers) != 1 || gotEnsureParams.KubernetesUsers[0] != "teleport-admin" {
		t.Fatalf("ensure access kubernetes users = %v, want [teleport-admin]", gotEnsureParams.KubernetesUsers)
	}
	if len(gotEnsureParams.KubernetesGroups) != 1 || gotEnsureParams.KubernetesGroups[0] != "system:masters" {
		t.Fatalf("ensure access kubernetes groups = %v, want [system:masters]", gotEnsureParams.KubernetesGroups)
	}
}

func TestPhasePostBootstrapExternalAccessReconcileIsBestEffort(t *testing.T) {
	restorePostBootstrapFns()
	t.Cleanup(restorePostBootstrapFns)

	ciliumInstallFn = func(context.Context, cilium.InstallParams) error {
		return nil
	}
	fluxBootstrapFn = func(context.Context, flux.BootstrapParams) error {
		return nil
	}
	teleportGenerateJoinTokenFn = func(context.Context, string, time.Duration) (string, error) {
		return "join-token", nil
	}
	teleportDeployKubeAgentFn = func(context.Context, teleport.DeployKubeAgentParams) error {
		return nil
	}
	teleportEnsureAdminAccessFn = func(context.Context, teleport.EnsureAccessParams) error {
		return errors.New("teleport access denied")
	}
	scalewayNewClientFn = func(string, string, string, string) (*scaleway.Client, error) {
		return &scaleway.Client{}, nil
	}
	scalewayResolvePrivateNetworkIPv4CIDRFn = func(context.Context, *scaleway.Client, scw.Region, string, string) (string, error) {
		return "172.16.16.0/22", nil
	}

	err := phasePostBootstrap(context.Background(), newPostBootstrapOperation(), &config.Config{
		Environment: "production",
		Teleport: config.TeleportConfig{
			Mode:   config.TeleportModeExternal,
			Domain: "teleport.example.com",
			GitHub: config.TeleportGitHubConfig{
				Organization: "rawkode-academy",
				Teams:        []string{"platform"},
			},
		},
	})
	if err != nil {
		t.Fatalf("expected best-effort external access reconcile to continue, got error: %v", err)
	}
}

func TestPhasePostBootstrapSkipTeleportDoesNotMaskOtherFailures(t *testing.T) {
	restorePostBootstrapFns()
	t.Cleanup(restorePostBootstrapFns)

	errCilium := errors.New("cilium failed")

	ciliumInstallFn = func(context.Context, cilium.InstallParams) error {
		return errCilium
	}
	fluxBootstrapFn = func(context.Context, flux.BootstrapParams) error {
		return nil
	}
	scalewayNewClientFn = func(string, string, string, string) (*scaleway.Client, error) {
		return &scaleway.Client{}, nil
	}
	scalewayResolvePrivateNetworkIPv4CIDRFn = func(context.Context, *scaleway.Client, scw.Region, string, string) (string, error) {
		return "172.16.16.0/22", nil
	}

	err := phasePostBootstrap(context.Background(), newPostBootstrapOperation(), &config.Config{
		Environment: "production",
		Teleport: config.TeleportConfig{
			Mode: config.TeleportModeExternal,
		},
	})
	if err == nil {
		t.Fatalf("expected post-bootstrap failure, got nil")
	}
	if !errors.Is(err, errCilium) {
		t.Fatalf("expected cilium error to be included: %v", err)
	}
}

func TestPhasePostBootstrapSucceedsWhenAllComponentsSucceed(t *testing.T) {
	restorePostBootstrapFns()
	t.Cleanup(restorePostBootstrapFns)

	ciliumInstallFn = func(context.Context, cilium.InstallParams) error {
		return nil
	}
	fluxBootstrapFn = func(context.Context, flux.BootstrapParams) error {
		return nil
	}
	scalewayNewClientFn = func(string, string, string, string) (*scaleway.Client, error) {
		return &scaleway.Client{}, nil
	}
	scalewayResolvePrivateNetworkIPv4CIDRFn = func(context.Context, *scaleway.Client, scw.Region, string, string) (string, error) {
		return "172.16.16.0/22", nil
	}

	cfg := &config.Config{
		Teleport: config.TeleportConfig{
			Mode: config.TeleportModeDisabled,
		},
	}

	if err := phasePostBootstrap(context.Background(), newPostBootstrapOperation(), cfg); err != nil {
		t.Fatalf("expected post-bootstrap success, got error: %v", err)
	}
}

func TestPhasePostBootstrapPassesDiscoveredCIDRToCilium(t *testing.T) {
	restorePostBootstrapFns()
	t.Cleanup(restorePostBootstrapFns)

	var gotInstallParams cilium.InstallParams
	ciliumInstallFn = func(_ context.Context, params cilium.InstallParams) error {
		gotInstallParams = params
		return nil
	}
	fluxBootstrapFn = func(context.Context, flux.BootstrapParams) error {
		return nil
	}
	scalewayNewClientFn = func(string, string, string, string) (*scaleway.Client, error) {
		return &scaleway.Client{}, nil
	}
	scalewayResolvePrivateNetworkIPv4CIDRFn = func(context.Context, *scaleway.Client, scw.Region, string, string) (string, error) {
		return "172.16.16.0/22", nil
	}

	cfg := &config.Config{
		Teleport: config.TeleportConfig{
			Mode: config.TeleportModeDisabled,
		},
	}

	if err := phasePostBootstrap(context.Background(), newPostBootstrapOperation(), cfg); err != nil {
		t.Fatalf("phasePostBootstrap returned error: %v", err)
	}
	if gotInstallParams.IPv4NativeRoutingCIDR != "172.16.16.0/22" {
		t.Fatalf(
			"cilium install native routing cidr = %q, want %q",
			gotInstallParams.IPv4NativeRoutingCIDR,
			"172.16.16.0/22",
		)
	}
}

func TestPhasePostBootstrapPassesPreparedKubeconfigToComponents(t *testing.T) {
	restorePostBootstrapFns()
	t.Cleanup(restorePostBootstrapFns)

	const kubeconfigPath = "/tmp/bootstrap-kubeconfig"

	postBootstrapKubeconfigPathFn = func(context.Context, *operation.Operation, *config.Config) (string, func(), error) {
		return kubeconfigPath, func() {}, nil
	}

	var gotCiliumParams cilium.InstallParams
	ciliumInstallFn = func(_ context.Context, params cilium.InstallParams) error {
		gotCiliumParams = params
		return nil
	}

	var gotFluxParams flux.BootstrapParams
	fluxBootstrapFn = func(_ context.Context, params flux.BootstrapParams) error {
		gotFluxParams = params
		return nil
	}

	scalewayNewClientFn = func(string, string, string, string) (*scaleway.Client, error) {
		return &scaleway.Client{}, nil
	}
	scalewayResolvePrivateNetworkIPv4CIDRFn = func(context.Context, *scaleway.Client, scw.Region, string, string) (string, error) {
		return "172.16.16.0/22", nil
	}

	cfg := &config.Config{
		Teleport: config.TeleportConfig{
			Mode: config.TeleportModeDisabled,
		},
	}

	if err := phasePostBootstrap(context.Background(), newPostBootstrapOperation(), cfg); err != nil {
		t.Fatalf("phasePostBootstrap returned error: %v", err)
	}

	if gotCiliumParams.Kubeconfig != kubeconfigPath {
		t.Fatalf("cilium install kubeconfig = %q, want %q", gotCiliumParams.Kubeconfig, kubeconfigPath)
	}
	if gotFluxParams.Kubeconfig != kubeconfigPath {
		t.Fatalf("flux bootstrap kubeconfig = %q, want %q", gotFluxParams.Kubeconfig, kubeconfigPath)
	}
}

func TestPrepareBootstrapKubeconfigWithRetryRetriesUntilSuccess(t *testing.T) {
	restorePostBootstrapFns()
	t.Cleanup(restorePostBootstrapFns)

	postBootstrapKubeconfigRetryInterval = time.Millisecond
	postBootstrapKubeconfigRetryTimeout = 100 * time.Millisecond

	attempts := 0
	postBootstrapKubeconfigPathFn = func(context.Context, *operation.Operation, *config.Config) (string, func(), error) {
		attempts++
		if attempts < 3 {
			return "", nil, errors.New("talos api not ready")
		}
		return "/tmp/bootstrap-kubeconfig", func() {}, nil
	}

	path, cleanup, err := prepareBootstrapKubeconfigWithRetry(context.Background(), newPostBootstrapOperation(), &config.Config{})
	if err != nil {
		t.Fatalf("prepareBootstrapKubeconfigWithRetry returned error: %v", err)
	}
	if path != "/tmp/bootstrap-kubeconfig" {
		t.Fatalf("kubeconfig path = %q, want %q", path, "/tmp/bootstrap-kubeconfig")
	}
	if cleanup == nil {
		t.Fatal("expected cleanup function")
	}
	if attempts != 3 {
		t.Fatalf("attempts = %d, want %d", attempts, 3)
	}
}

func TestPrepareBootstrapKubeconfigWithRetryTimesOut(t *testing.T) {
	restorePostBootstrapFns()
	t.Cleanup(restorePostBootstrapFns)

	postBootstrapKubeconfigRetryInterval = time.Millisecond
	postBootstrapKubeconfigRetryTimeout = 5 * time.Millisecond

	errFetch := errors.New("dial timeout")
	postBootstrapKubeconfigPathFn = func(context.Context, *operation.Operation, *config.Config) (string, func(), error) {
		return "", nil, errFetch
	}

	_, _, err := prepareBootstrapKubeconfigWithRetry(context.Background(), newPostBootstrapOperation(), &config.Config{})
	if err == nil {
		t.Fatal("expected timeout error, got nil")
	}
	if !strings.Contains(err.Error(), "bootstrap kubeconfig not ready") {
		t.Fatalf("expected timeout wrapper in error, got %q", err)
	}
	if !errors.Is(err, errFetch) {
		t.Fatalf("expected wrapped fetch error, got %v", err)
	}
}

func TestWaitForKubernetesAPIWithRetryRetriesUntilSuccess(t *testing.T) {
	restorePostBootstrapFns()
	t.Cleanup(restorePostBootstrapFns)

	postBootstrapKubernetesAPIRetryInterval = time.Millisecond
	postBootstrapKubernetesAPIRetryTimeout = 100 * time.Millisecond

	attempts := 0
	postBootstrapKubernetesAPIProbeFn = func(context.Context, string) error {
		attempts++
		if attempts < 3 {
			return errors.New("connection refused")
		}
		return nil
	}

	if err := waitForKubernetesAPIWithRetry(context.Background(), "/tmp/bootstrap-kubeconfig"); err != nil {
		t.Fatalf("waitForKubernetesAPIWithRetry returned error: %v", err)
	}
	if attempts != 3 {
		t.Fatalf("attempts = %d, want %d", attempts, 3)
	}
}

func TestWaitForKubernetesAPIWithRetryTimesOut(t *testing.T) {
	restorePostBootstrapFns()
	t.Cleanup(restorePostBootstrapFns)

	postBootstrapKubernetesAPIRetryInterval = time.Millisecond
	postBootstrapKubernetesAPIRetryTimeout = 5 * time.Millisecond

	errProbe := errors.New("connection refused")
	postBootstrapKubernetesAPIProbeFn = func(context.Context, string) error {
		return errProbe
	}

	err := waitForKubernetesAPIWithRetry(context.Background(), "/tmp/bootstrap-kubeconfig")
	if err == nil {
		t.Fatal("expected timeout error, got nil")
	}
	if !strings.Contains(err.Error(), "kubernetes API not ready") {
		t.Fatalf("expected timeout wrapper in error, got %q", err)
	}
	if !errors.Is(err, errProbe) {
		t.Fatalf("expected wrapped probe error, got %v", err)
	}
}

func TestPhasePostBootstrapFailsWhenKubernetesAPINotReachable(t *testing.T) {
	restorePostBootstrapFns()
	t.Cleanup(restorePostBootstrapFns)

	waitErr := errors.New("api not ready")
	postBootstrapKubernetesAPIWaitFn = func(context.Context, string) error {
		return waitErr
	}
	ciliumInstallFn = func(context.Context, cilium.InstallParams) error {
		t.Fatal("cilium install should not run when kubernetes API is not reachable")
		return nil
	}
	fluxBootstrapFn = func(context.Context, flux.BootstrapParams) error {
		t.Fatal("flux bootstrap should not run when kubernetes API is not reachable")
		return nil
	}
	scalewayNewClientFn = func(string, string, string, string) (*scaleway.Client, error) {
		return &scaleway.Client{}, nil
	}
	scalewayResolvePrivateNetworkIPv4CIDRFn = func(context.Context, *scaleway.Client, scw.Region, string, string) (string, error) {
		return "172.16.16.0/22", nil
	}

	cfg := &config.Config{
		Teleport: config.TeleportConfig{
			Mode: config.TeleportModeDisabled,
		},
	}

	err := phasePostBootstrap(context.Background(), newPostBootstrapOperation(), cfg)
	if err == nil {
		t.Fatal("expected kubernetes API readiness failure, got nil")
	}
	if !strings.Contains(err.Error(), "wait for kubernetes API readiness") {
		t.Fatalf("expected wait wrapper in error, got %q", err)
	}
	if !errors.Is(err, waitErr) {
		t.Fatalf("expected wrapped wait error, got %v", err)
	}
}

func TestPhasePostBootstrapFailsWhenCIDRDiscoveryFails(t *testing.T) {
	restorePostBootstrapFns()
	t.Cleanup(restorePostBootstrapFns)

	ciliumInstallFn = func(context.Context, cilium.InstallParams) error {
		t.Fatal("cilium install should not run when CIDR discovery fails")
		return nil
	}
	fluxBootstrapFn = func(context.Context, flux.BootstrapParams) error {
		return nil
	}
	scalewayNewClientFn = func(string, string, string, string) (*scaleway.Client, error) {
		return &scaleway.Client{}, nil
	}
	scalewayResolvePrivateNetworkIPv4CIDRFn = func(context.Context, *scaleway.Client, scw.Region, string, string) (string, error) {
		return "", errors.New("no discovered IPv4 CIDR contains preferred private IP")
	}

	cfg := &config.Config{
		Teleport: config.TeleportConfig{
			Mode: config.TeleportModeDisabled,
		},
	}

	err := phasePostBootstrap(context.Background(), newPostBootstrapOperation(), cfg)
	if err == nil {
		t.Fatal("expected cidr discovery failure, got nil")
	}
	if !strings.Contains(err.Error(), "resolve cilium ipv4 native routing cidr") {
		t.Fatalf("expected wrapped cidr discovery failure, got %q", err)
	}
}

func TestPhasePostBootstrapRecoversMissingPrivateNetworkIDFromScaleway(t *testing.T) {
	restorePostBootstrapFns()
	t.Cleanup(restorePostBootstrapFns)

	op := newPostBootstrapOperation()
	delete(op.Context, "privateNetworkID")

	var gotCIDRLookupPrivateNetworkID string
	ciliumInstallFn = func(context.Context, cilium.InstallParams) error {
		return nil
	}
	fluxBootstrapFn = func(context.Context, flux.BootstrapParams) error {
		return nil
	}
	scalewayNewClientFn = func(string, string, string, string) (*scaleway.Client, error) {
		return &scaleway.Client{}, nil
	}
	scalewayEnsureNetworkFoundationFn = func(context.Context, *scaleway.Client, scaleway.NetworkFoundationParams) (*scaleway.NetworkFoundation, error) {
		return &scaleway.NetworkFoundation{
			PrivateNetworkID: "pn-recovered",
		}, nil
	}
	scalewayResolvePrivateNetworkIPv4CIDRFn = func(_ context.Context, _ *scaleway.Client, _ scw.Region, privateNetworkID string, _ string) (string, error) {
		gotCIDRLookupPrivateNetworkID = privateNetworkID
		return "172.16.16.0/22", nil
	}

	cfg := &config.Config{
		Environment: "production",
		Teleport: config.TeleportConfig{
			Mode: config.TeleportModeDisabled,
		},
	}

	if err := phasePostBootstrap(context.Background(), op, cfg); err != nil {
		t.Fatalf("phasePostBootstrap returned error: %v", err)
	}
	if gotCIDRLookupPrivateNetworkID != "pn-recovered" {
		t.Fatalf("cidr lookup private network id = %q, want %q", gotCIDRLookupPrivateNetworkID, "pn-recovered")
	}
	if got := op.GetContextString("privateNetworkID"); got != "pn-recovered" {
		t.Fatalf("operation privateNetworkID context = %q, want %q", got, "pn-recovered")
	}
}

func TestMaybeRefreshOperationServerIPsUpdatesContext(t *testing.T) {
	restorePostBootstrapFns()
	t.Cleanup(restorePostBootstrapFns)

	op := operation.New("op-test", operation.TypeCreateCluster, "production", []string{"post-bootstrap"})
	op.SetContext("serverId", "srv-123")
	op.SetContext("zone", string(scw.ZoneFrPar1))
	op.SetContext("publicIP", "51.15.0.10")
	op.SetContext("privateIP", "172.16.16.10")

	scalewayNewClientFn = func(string, string, string, string) (*scaleway.Client, error) {
		return &scaleway.Client{}, nil
	}
	scalewayGetServerFn = func(context.Context, *scaleway.Client, scw.Zone, string) (*baremetal.Server, error) {
		return &baremetal.Server{
			IPs: []*baremetal.IP{
				{Address: net.ParseIP("172.16.16.16"), Version: "IPv4"},
				{Address: net.ParseIP("51.159.1.2"), Version: "IPv4"},
			},
		}, nil
	}

	maybeRefreshOperationServerIPs(context.Background(), op, &config.Config{
		Scaleway: config.ScalewayConfig{
			ProjectID:      "project-id",
			OrganizationID: "org-id",
		},
	})

	if got := op.GetContextString("publicIP"); got != "51.159.1.2" {
		t.Fatalf("publicIP = %q, want %q", got, "51.159.1.2")
	}
	if got := op.GetContextString("privateIP"); got != "172.16.16.16" {
		t.Fatalf("privateIP = %q, want %q", got, "172.16.16.16")
	}
}
