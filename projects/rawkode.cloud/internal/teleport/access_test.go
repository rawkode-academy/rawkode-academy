package teleport

import (
	"context"
	"strings"
	"testing"

	"github.com/gravitational/teleport/api/types"
	"github.com/gravitational/trace"
)

type fakeAccessClient struct {
	role      types.Role
	connector types.GithubConnector
}

func (f *fakeAccessClient) GetRole(_ context.Context, name string) (types.Role, error) {
	if f.role == nil {
		return nil, trace.NotFound("role %q not found", name)
	}
	return f.role, nil
}

func (f *fakeAccessClient) UpsertRole(_ context.Context, role types.Role) (types.Role, error) {
	f.role = role
	return role, nil
}

func (f *fakeAccessClient) GetGithubConnector(_ context.Context, _ string, _ bool) (types.GithubConnector, error) {
	if f.connector == nil {
		return nil, trace.NotFound("connector not found")
	}
	return f.connector, nil
}

func (f *fakeAccessClient) UpsertGithubConnector(_ context.Context, connector types.GithubConnector) (types.GithubConnector, error) {
	f.connector = connector
	return connector, nil
}

func (f *fakeAccessClient) Close() {}

func TestEnsureAdminAccessWithClientEnsuresRoleAndTeamMappings(t *testing.T) {
	connector, err := types.NewGithubConnector("github", types.GithubConnectorSpecV3{
		ClientID:     "client-id",
		ClientSecret: "client-secret",
		RedirectURL:  "https://rawkode.cloud/v1/webapi/github/callback",
		TeamsToRoles: []types.TeamRolesMapping{
			{
				Organization: "rawkode-academy",
				Team:         "legacy",
				Roles:        []string{"viewer"},
			},
		},
	})
	if err != nil {
		t.Fatalf("NewGithubConnector returned error: %v", err)
	}

	fake := &fakeAccessClient{
		connector: connector,
	}

	err = ensureAdminAccessWithClient(context.Background(), EnsureAccessParams{
		ProxyAddr:        "rawkode.cloud:443",
		Organization:     "rawkode-academy",
		AdminTeams:       []string{"platform"},
		KubernetesUsers:  []string{"teleport-admin"},
		KubernetesGroups: []string{"system:masters"},
	}, func(context.Context, string) (accessClient, error) {
		return fake, nil
	})
	if err != nil {
		t.Fatalf("ensureAdminAccessWithClient returned error: %v", err)
	}

	if fake.role == nil {
		t.Fatal("expected role to be upserted")
	}
	if got := fake.role.GetKubeUsers(types.Allow); len(got) != 1 || got[0] != "teleport-admin" {
		t.Fatalf("role kube users = %v, want [teleport-admin]", got)
	}
	if got := fake.role.GetKubeGroups(types.Allow); len(got) != 1 || got[0] != "system:masters" {
		t.Fatalf("role kube groups = %v, want [system:masters]", got)
	}
	if !hasWildcardKubernetesLabels(fake.role.GetKubernetesLabels(types.Allow)) {
		t.Fatalf("role kubernetes labels should include wildcard access: %v", fake.role.GetKubernetesLabels(types.Allow))
	}

	mappings := fake.connector.GetTeamsToRoles()
	if len(mappings) != 2 {
		t.Fatalf("connector team role mappings len = %d, want 2 (%v)", len(mappings), mappings)
	}

	foundPlatform := false
	for _, mapping := range mappings {
		if mapping.Organization == "rawkode-academy" && mapping.Team == "platform" {
			foundPlatform = true
			if len(mapping.Roles) != 1 || mapping.Roles[0] != defaultTeleportBootstrapRole {
				t.Fatalf("platform mapping roles = %v, want [%s]", mapping.Roles, defaultTeleportBootstrapRole)
			}
		}
	}
	if !foundPlatform {
		t.Fatalf("expected platform mapping in connector: %v", mappings)
	}
}

func TestNormalizeEnsureAccessParamsRequiresKubernetesSubjects(t *testing.T) {
	_, err := normalizeEnsureAccessParams(EnsureAccessParams{
		ProxyAddr:       "rawkode.cloud:443",
		Organization:    "rawkode-academy",
		AdminTeams:      []string{"platform"},
		KubernetesUsers: []string{},
	})
	if err == nil {
		t.Fatal("expected missing kubernetes users error, got nil")
	}
	if !strings.Contains(err.Error(), "kubernetes user") {
		t.Fatalf("expected kubernetes user validation error, got %v", err)
	}
}

func TestValidateRoleAccessRequiresWildcardLabels(t *testing.T) {
	role, err := types.NewRole(defaultTeleportBootstrapRole, types.RoleSpecV6{})
	if err != nil {
		t.Fatalf("NewRole returned error: %v", err)
	}
	role.SetKubeUsers(types.Allow, []string{"teleport-admin"})
	role.SetKubeGroups(types.Allow, []string{"system:masters"})

	err = validateRoleAccess(role, []string{"teleport-admin"}, []string{"system:masters"})
	if err == nil {
		t.Fatal("expected role label validation error, got nil")
	}
	if !strings.Contains(err.Error(), "kubernetes_labels") {
		t.Fatalf("expected kubernetes_labels validation error, got %v", err)
	}
}

func TestVerifyAdminAccessWithClientSuccess(t *testing.T) {
	role, err := types.NewRole(defaultTeleportBootstrapRole, types.RoleSpecV6{})
	if err != nil {
		t.Fatalf("NewRole returned error: %v", err)
	}
	role.SetKubernetesLabels(types.Allow, types.Labels{
		types.Wildcard: []string{types.Wildcard},
	})
	role.SetKubeUsers(types.Allow, []string{"teleport-admin"})
	role.SetKubeGroups(types.Allow, []string{"system:masters"})

	connector, err := types.NewGithubConnector("github", types.GithubConnectorSpecV3{
		ClientID:     "client-id",
		ClientSecret: "client-secret",
		RedirectURL:  "https://rawkode.cloud/v1/webapi/github/callback",
		TeamsToRoles: []types.TeamRolesMapping{
			{
				Organization: "rawkode-academy",
				Team:         "platform",
				Roles:        []string{defaultTeleportBootstrapRole},
			},
		},
	})
	if err != nil {
		t.Fatalf("NewGithubConnector returned error: %v", err)
	}

	fake := &fakeAccessClient{
		role:      role,
		connector: connector,
	}

	err = verifyAdminAccessWithClient(context.Background(), EnsureAccessParams{
		ProxyAddr:        "rawkode.cloud:443",
		Organization:     "rawkode-academy",
		AdminTeams:       []string{"platform"},
		KubernetesUsers:  []string{"teleport-admin"},
		KubernetesGroups: []string{"system:masters"},
	}, func(context.Context, string) (accessClient, error) {
		return fake, nil
	})
	if err != nil {
		t.Fatalf("verifyAdminAccessWithClient returned error: %v", err)
	}
}
