package cmd

import (
	"context"
	"errors"
	"strings"
	"testing"
	"time"

	"github.com/rawkode-academy/rawkode-cloud3/internal/cilium"
	"github.com/rawkode-academy/rawkode-cloud3/internal/config"
	"github.com/rawkode-academy/rawkode-cloud3/internal/flux"
	"github.com/rawkode-academy/rawkode-cloud3/internal/operation"
	"github.com/rawkode-academy/rawkode-cloud3/internal/scaleway"
	"github.com/rawkode-academy/rawkode-cloud3/internal/teleport"
	scw "github.com/scaleway/scaleway-sdk-go/scw"
)

func restorePostBootstrapFns() {
	ciliumInstallFn = cilium.Install
	fluxBootstrapFn = flux.Bootstrap
	teleportGenerateJoinTokenFn = teleport.GenerateJoinToken
	teleportDeployKubeAgentFn = teleport.DeployKubeAgent
	teleportDeploySelfHostedFn = teleport.DeploySelfHosted
	scalewayNewClientFn = scaleway.NewClient
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
