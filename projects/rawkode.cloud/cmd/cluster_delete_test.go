package cmd

import (
	"context"
	"errors"
	"strings"
	"testing"

	clusterstate "github.com/rawkode-academy/rawkode-cloud3/internal/cluster"
	"github.com/rawkode-academy/rawkode-cloud3/internal/config"
	"github.com/rawkode-academy/rawkode-cloud3/internal/infisical"
	"github.com/spf13/cobra"
)

func restoreClusterDeleteFns() {
	clusterDeleteLoadConfigFn = loadConfigForClusterOrFile
	clusterDeleteLoadNodeStateFn = loadNodeState
	clusterDeleteServerCleanupFn = runDeleteServerCleanupAction
	clusterDeleteInfisicalCleanupFn = cleanupClusterDeleteInfisical
}

func newClusterDeleteTestCmd(clusterName, cfgFile string) *cobra.Command {
	cmd := &cobra.Command{}
	cmd.Flags().String("environment", "", "")
	cmd.Flags().StringP("file", "f", "", "")
	_ = cmd.Flags().Set("environment", clusterName)
	_ = cmd.Flags().Set("file", cfgFile)
	return cmd
}

func clusterDeleteTestConfig() *config.Config {
	return &config.Config{
		Environment: "production",
		Infisical: config.InfisicalConfig{
			ProjectID:    "project-123",
			ProjectSlug:  "rawkode-academy",
			Environment:  "production",
			SecretPath:   "/projects/rawkode-cloud",
			SiteURL:      "https://app.infisical.com",
			ClientID:     "bootstrap-client-id",
			ClientSecret: "bootstrap-client-secret",
		},
		NodePools: []config.NodePoolConfig{
			{
				Name: "control-plane",
				Type: config.NodeTypeControlPlane,
				Zone: "fr-par-1",
			},
		},
	}
}

func TestRunClusterDeleteCleansUpInfisicalWhenNoNodesRemain(t *testing.T) {
	restoreClusterDeleteFns()
	t.Cleanup(restoreClusterDeleteFns)

	clusterDeleteLoadConfigFn = func(clusterName, cfgFile string) (*config.Config, string, error) {
		return clusterDeleteTestConfig(), cfgFile, nil
	}
	clusterDeleteLoadNodeStateFn = func(context.Context, *config.Config) (*clusterstate.NodesState, error) {
		return &clusterstate.NodesState{}, nil
	}
	clusterDeleteServerCleanupFn = func(context.Context, *config.Config, cleanupDeleteServer) error {
		t.Fatal("server cleanup should not run when no nodes exist")
		return nil
	}

	cleaned := false
	clusterDeleteInfisicalCleanupFn = func(context.Context, *config.Config) error {
		cleaned = true
		return nil
	}

	if err := runClusterDelete(newClusterDeleteTestCmd("production", "./clusters/production.yaml"), nil); err != nil {
		t.Fatalf("runClusterDelete returned error: %v", err)
	}
	if !cleaned {
		t.Fatal("expected infisical cleanup to run")
	}
}

func TestRunClusterDeleteStillCleansUpInfisicalWhenServerCleanupFails(t *testing.T) {
	restoreClusterDeleteFns()
	t.Cleanup(restoreClusterDeleteFns)

	clusterDeleteLoadConfigFn = func(clusterName, cfgFile string) (*config.Config, string, error) {
		return clusterDeleteTestConfig(), cfgFile, nil
	}
	clusterDeleteLoadNodeStateFn = func(context.Context, *config.Config) (*clusterstate.NodesState, error) {
		return &clusterstate.NodesState{
			Nodes: []clusterstate.NodeState{
				{
					Name:     "production-control-plane-01",
					Role:     config.NodeTypeControlPlane,
					Pool:     "control-plane",
					ServerID: "server-123",
					Status:   clusterstate.NodeStatusReady,
				},
			},
		}, nil
	}

	serverCleanupCalls := 0
	clusterDeleteServerCleanupFn = func(context.Context, *config.Config, cleanupDeleteServer) error {
		serverCleanupCalls++
		return errors.New("boom")
	}

	cleaned := false
	clusterDeleteInfisicalCleanupFn = func(context.Context, *config.Config) error {
		cleaned = true
		return nil
	}

	err := runClusterDelete(newClusterDeleteTestCmd("production", "./clusters/production.yaml"), nil)
	if err == nil {
		t.Fatal("expected error from failed server cleanup")
	}
	if serverCleanupCalls != 1 {
		t.Fatalf("server cleanup calls = %d, want 1", serverCleanupCalls)
	}
	if !cleaned {
		t.Fatal("expected infisical cleanup to run even after server cleanup failure")
	}
}

type fakeClusterDeleteInfisicalClient struct {
	project                          *infisical.Project
	identities                       []infisical.MachineIdentity
	identityDetails                  map[string]*infisical.MachineIdentity
	deleteUniversalAuthIdentityIDs   []string
	deleteMembershipProjectIdentitys []string
	updateDeleteProtectionIdentitys  []string
	deleteIdentityIDs                []string
}

func (f *fakeClusterDeleteInfisicalClient) GetProject(context.Context, string) (*infisical.Project, error) {
	return f.project, nil
}

func (f *fakeClusterDeleteInfisicalClient) ListMachineIdentities(context.Context, string) ([]infisical.MachineIdentity, error) {
	return append([]infisical.MachineIdentity(nil), f.identities...), nil
}

func (f *fakeClusterDeleteInfisicalClient) GetMachineIdentity(_ context.Context, identityID string) (*infisical.MachineIdentity, error) {
	identity, ok := f.identityDetails[identityID]
	if !ok {
		return nil, &infisical.APIError{StatusCode: 404}
	}
	copy := *identity
	return &copy, nil
}

func (f *fakeClusterDeleteInfisicalClient) DeleteUniversalAuth(_ context.Context, identityID string) error {
	f.deleteUniversalAuthIdentityIDs = append(f.deleteUniversalAuthIdentityIDs, identityID)
	return nil
}

func (f *fakeClusterDeleteInfisicalClient) DeleteProjectIdentityMembership(_ context.Context, projectID, identityID string) error {
	f.deleteMembershipProjectIdentitys = append(f.deleteMembershipProjectIdentitys, projectID+":"+identityID)
	return nil
}

func (f *fakeClusterDeleteInfisicalClient) UpdateMachineIdentity(
	_ context.Context,
	identityID,
	_ string,
	deleteProtection bool,
	metadata []infisical.MetadataEntry,
) (*infisical.MachineIdentity, error) {
	if deleteProtection {
		return nil, errors.New("delete cleanup should disable delete protection, not enable it")
	}
	if metadata != nil {
		return nil, errors.New("delete cleanup should not rewrite metadata")
	}
	f.updateDeleteProtectionIdentitys = append(f.updateDeleteProtectionIdentitys, identityID)
	return f.identityDetails[identityID], nil
}

func (f *fakeClusterDeleteInfisicalClient) DeleteMachineIdentity(_ context.Context, identityID string) error {
	f.deleteIdentityIDs = append(f.deleteIdentityIDs, identityID)
	return nil
}

func TestCleanupClusterDeleteInfisicalDeletesManagedIdentity(t *testing.T) {
	cfg := clusterDeleteTestConfig()
	identityName := bootstrapMachineIdentityName(bootstrapScopeName(cfg.Infisical.SecretPath, cfg.Infisical.ProjectSlug), cfg.Environment)
	client := &fakeClusterDeleteInfisicalClient{
		project: &infisical.Project{
			ID:    cfg.Infisical.ProjectID,
			Slug:  cfg.Infisical.ProjectSlug,
			OrgID: "org-123",
		},
		identities: []infisical.MachineIdentity{
			{ID: "identity-123", Name: identityName},
		},
		identityDetails: map[string]*infisical.MachineIdentity{
			"identity-123": {
				ID:                  "identity-123",
				Name:                identityName,
				HasDeleteProtection: true,
				Metadata:            bootstrapMachineIdentityMetadata(cfg.Infisical.ProjectSlug, cfg.Environment, cfg.Infisical.Environment),
			},
		},
	}

	if err := cleanupClusterDeleteInfisicalWithClient(context.Background(), cfg, client); err != nil {
		t.Fatalf("cleanupClusterDeleteInfisicalWithClient returned error: %v", err)
	}

	if len(client.deleteUniversalAuthIdentityIDs) != 1 || client.deleteUniversalAuthIdentityIDs[0] != "identity-123" {
		t.Fatalf("DeleteUniversalAuth calls = %v, want [identity-123]", client.deleteUniversalAuthIdentityIDs)
	}
	if len(client.deleteMembershipProjectIdentitys) != 1 || client.deleteMembershipProjectIdentitys[0] != cfg.Infisical.ProjectID+":identity-123" {
		t.Fatalf("DeleteProjectIdentityMembership calls = %v", client.deleteMembershipProjectIdentitys)
	}
	if len(client.updateDeleteProtectionIdentitys) != 1 || client.updateDeleteProtectionIdentitys[0] != "identity-123" {
		t.Fatalf("UpdateMachineIdentity calls = %v, want [identity-123]", client.updateDeleteProtectionIdentitys)
	}
	if len(client.deleteIdentityIDs) != 1 || client.deleteIdentityIDs[0] != "identity-123" {
		t.Fatalf("DeleteMachineIdentity calls = %v, want [identity-123]", client.deleteIdentityIDs)
	}
}

func TestCleanupClusterDeleteInfisicalRejectsUnmanagedIdentityCollision(t *testing.T) {
	cfg := clusterDeleteTestConfig()
	identityName := bootstrapMachineIdentityName(bootstrapScopeName(cfg.Infisical.SecretPath, cfg.Infisical.ProjectSlug), cfg.Environment)
	client := &fakeClusterDeleteInfisicalClient{
		project: &infisical.Project{
			ID:    cfg.Infisical.ProjectID,
			Slug:  cfg.Infisical.ProjectSlug,
			OrgID: "org-123",
		},
		identities: []infisical.MachineIdentity{
			{ID: "identity-123", Name: identityName},
		},
		identityDetails: map[string]*infisical.MachineIdentity{
			"identity-123": {
				ID:       "identity-123",
				Name:     identityName,
				Metadata: []infisical.MetadataEntry{{Key: bootstrapIdentityMetadataManagedByKey, Value: "manual"}},
			},
		},
	}

	err := cleanupClusterDeleteInfisicalWithClient(context.Background(), cfg, client)
	if err == nil {
		t.Fatal("expected cleanup error for unmanaged identity collision")
	}
	if !strings.Contains(err.Error(), "refusing to delete infisical machine identity") {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(client.deleteUniversalAuthIdentityIDs) != 0 || len(client.deleteMembershipProjectIdentitys) != 0 || len(client.updateDeleteProtectionIdentitys) != 0 || len(client.deleteIdentityIDs) != 0 {
		t.Fatal("expected no destructive Infisical calls when metadata does not match")
	}
}

func TestCleanupClusterDeleteInfisicalNoopsWhenIdentityMissing(t *testing.T) {
	cfg := clusterDeleteTestConfig()
	client := &fakeClusterDeleteInfisicalClient{
		project: &infisical.Project{
			ID:    cfg.Infisical.ProjectID,
			Slug:  cfg.Infisical.ProjectSlug,
			OrgID: "org-123",
		},
	}

	if err := cleanupClusterDeleteInfisicalWithClient(context.Background(), cfg, client); err != nil {
		t.Fatalf("cleanupClusterDeleteInfisicalWithClient returned error: %v", err)
	}
	if len(client.deleteUniversalAuthIdentityIDs) != 0 || len(client.deleteMembershipProjectIdentitys) != 0 || len(client.updateDeleteProtectionIdentitys) != 0 || len(client.deleteIdentityIDs) != 0 {
		t.Fatal("expected no destructive Infisical calls when no identity exists")
	}
}
