package teleport

import (
	"context"
	"fmt"
	"log/slog"
	"sort"
	"strings"

	"github.com/gravitational/teleport/api/types"
	"github.com/gravitational/trace"
)

const defaultTeleportGitHubConnectorName = "github"

// EnsureAccessParams defines Teleport RBAC settings that should be enforced.
type EnsureAccessParams struct {
	ProxyAddr        string
	Organization     string
	AdminTeams       []string
	KubernetesUsers  []string
	KubernetesGroups []string
	RoleName         string
	ConnectorName    string
}

type accessClient interface {
	GetRole(context.Context, string) (types.Role, error)
	UpsertRole(context.Context, types.Role) (types.Role, error)
	GetGithubConnector(context.Context, string, bool) (types.GithubConnector, error)
	UpsertGithubConnector(context.Context, types.GithubConnector) (types.GithubConnector, error)
	Close()
}

type accessClientFactory func(context.Context, string) (accessClient, error)

// EnsureAdminAccess ensures the Teleport admin role and GitHub team mappings are present.
func EnsureAdminAccess(ctx context.Context, params EnsureAccessParams) error {
	return ensureAdminAccessWithClient(ctx, params, func(ctx context.Context, proxyAddr string) (accessClient, error) {
		return newClient(ctx, proxyAddr)
	})
}

// VerifyAdminAccess verifies Teleport admin access without mutating Teleport state.
func VerifyAdminAccess(ctx context.Context, params EnsureAccessParams) error {
	return verifyAdminAccessWithClient(ctx, params, func(ctx context.Context, proxyAddr string) (accessClient, error) {
		return newClient(ctx, proxyAddr)
	})
}

func ensureAdminAccessWithClient(ctx context.Context, params EnsureAccessParams, clientFactory accessClientFactory) error {
	normalized, err := normalizeEnsureAccessParams(params)
	if err != nil {
		return err
	}

	clt, err := clientFactory(ctx, normalized.proxyAddr)
	if err != nil {
		return fmt.Errorf("teleport client: %w", err)
	}
	defer clt.Close()

	role, err := clt.GetRole(ctx, normalized.roleName)
	if err != nil {
		if !trace.IsNotFound(err) {
			return fmt.Errorf("get teleport role %q: %w", normalized.roleName, err)
		}
		role, err = types.NewRole(normalized.roleName, types.RoleSpecV6{})
		if err != nil {
			return fmt.Errorf("build teleport role %q: %w", normalized.roleName, err)
		}
	}

	role.SetKubernetesLabels(types.Allow, types.Labels{
		types.Wildcard: []string{types.Wildcard},
	})
	role.SetKubeUsers(types.Allow, normalized.kubernetesUsers)
	role.SetKubeGroups(types.Allow, normalized.kubernetesGroups)

	upsertedRole, err := clt.UpsertRole(ctx, role)
	if err != nil {
		return fmt.Errorf("upsert teleport role %q: %w", normalized.roleName, err)
	}
	if err := validateRoleAccess(upsertedRole, normalized.kubernetesUsers, normalized.kubernetesGroups); err != nil {
		return err
	}

	connector, err := clt.GetGithubConnector(ctx, normalized.connectorName, true)
	if err != nil {
		return fmt.Errorf("get teleport github connector %q: %w", normalized.connectorName, err)
	}

	updatedMappings := ensureTeamRoleMappings(
		connector.GetTeamsToRoles(),
		normalized.organization,
		normalized.adminTeams,
		normalized.roleName,
	)
	connector.SetTeamsToRoles(updatedMappings)
	if _, err := clt.UpsertGithubConnector(ctx, connector); err != nil {
		return fmt.Errorf("upsert teleport github connector %q: %w", normalized.connectorName, err)
	}

	if err := validateConnectorMappings(updatedMappings, normalized.organization, normalized.adminTeams, normalized.roleName); err != nil {
		return err
	}

	slog.Info(
		"teleport admin access ensured",
		"role", normalized.roleName,
		"organization", normalized.organization,
		"teams", normalized.adminTeams,
		"kubernetes_users", normalized.kubernetesUsers,
		"kubernetes_groups", normalized.kubernetesGroups,
	)
	return nil
}

func verifyAdminAccessWithClient(ctx context.Context, params EnsureAccessParams, clientFactory accessClientFactory) error {
	normalized, err := normalizeEnsureAccessParams(params)
	if err != nil {
		return err
	}

	clt, err := clientFactory(ctx, normalized.proxyAddr)
	if err != nil {
		return fmt.Errorf("teleport client: %w", err)
	}
	defer clt.Close()

	role, err := clt.GetRole(ctx, normalized.roleName)
	if err != nil {
		return fmt.Errorf("get teleport role %q: %w", normalized.roleName, err)
	}
	if err := validateRoleAccess(role, normalized.kubernetesUsers, normalized.kubernetesGroups); err != nil {
		return err
	}

	connector, err := clt.GetGithubConnector(ctx, normalized.connectorName, false)
	if err != nil {
		return fmt.Errorf("get teleport github connector %q: %w", normalized.connectorName, err)
	}
	if err := validateConnectorMappings(
		connector.GetTeamsToRoles(),
		normalized.organization,
		normalized.adminTeams,
		normalized.roleName,
	); err != nil {
		return err
	}

	slog.Info(
		"teleport admin access verified",
		"role", normalized.roleName,
		"organization", normalized.organization,
		"teams", normalized.adminTeams,
		"kubernetes_users", normalized.kubernetesUsers,
		"kubernetes_groups", normalized.kubernetesGroups,
	)
	return nil
}

type normalizedEnsureAccessParams struct {
	proxyAddr        string
	organization     string
	adminTeams       []string
	kubernetesUsers  []string
	kubernetesGroups []string
	roleName         string
	connectorName    string
}

func normalizeEnsureAccessParams(params EnsureAccessParams) (normalizedEnsureAccessParams, error) {
	normalized := normalizedEnsureAccessParams{
		proxyAddr:        strings.TrimSpace(params.ProxyAddr),
		organization:     strings.TrimSpace(params.Organization),
		adminTeams:       uniqueNonEmptyStrings(params.AdminTeams),
		kubernetesUsers:  uniqueNonEmptyStrings(params.KubernetesUsers),
		kubernetesGroups: uniqueNonEmptyStrings(params.KubernetesGroups),
		roleName:         strings.TrimSpace(params.RoleName),
		connectorName:    strings.TrimSpace(params.ConnectorName),
	}

	if normalized.proxyAddr == "" {
		return normalized, fmt.Errorf("teleport proxy address is required")
	}
	if normalized.organization == "" {
		return normalized, fmt.Errorf("github organization is required")
	}
	if len(normalized.adminTeams) == 0 {
		return normalized, fmt.Errorf("at least one admin team is required")
	}
	if len(normalized.kubernetesUsers) == 0 {
		return normalized, fmt.Errorf("at least one kubernetes user is required")
	}
	if len(normalized.kubernetesGroups) == 0 {
		return normalized, fmt.Errorf("at least one kubernetes group is required")
	}

	if normalized.roleName == "" {
		normalized.roleName = defaultTeleportBootstrapRole
	}
	if normalized.connectorName == "" {
		normalized.connectorName = defaultTeleportGitHubConnectorName
	}

	return normalized, nil
}

func validateRoleAccess(role types.Role, requiredUsers, requiredGroups []string) error {
	if role == nil {
		return fmt.Errorf("teleport role validation failed: role is nil")
	}

	actualUsers := uniqueNonEmptyStrings(role.GetKubeUsers(types.Allow))
	actualGroups := uniqueNonEmptyStrings(role.GetKubeGroups(types.Allow))

	if len(actualUsers) == 0 || len(actualGroups) == 0 {
		return fmt.Errorf(
			"teleport role %q must set non-empty kubernetes_users and kubernetes_groups",
			role.GetName(),
		)
	}

	missingUsers := missingCaseInsensitive(requiredUsers, actualUsers)
	missingGroups := missingCaseInsensitive(requiredGroups, actualGroups)
	if len(missingUsers) > 0 || len(missingGroups) > 0 {
		return fmt.Errorf(
			"teleport role %q missing required kubernetes access (users=%v, groups=%v)",
			role.GetName(),
			missingUsers,
			missingGroups,
		)
	}

	if !hasWildcardKubernetesLabels(role.GetKubernetesLabels(types.Allow)) {
		return fmt.Errorf(
			"teleport role %q must include kubernetes_labels wildcard access",
			role.GetName(),
		)
	}

	return nil
}

func hasWildcardKubernetesLabels(labels types.Labels) bool {
	values, ok := labels[types.Wildcard]
	if !ok {
		return false
	}

	for _, value := range values {
		if strings.TrimSpace(value) == types.Wildcard {
			return true
		}
	}

	return false
}

func ensureTeamRoleMappings(
	existing []types.TeamRolesMapping,
	organization string,
	teams []string,
	roleName string,
) []types.TeamRolesMapping {
	normalizedOrg := strings.TrimSpace(organization)
	normalizedRole := strings.TrimSpace(roleName)

	out := make([]types.TeamRolesMapping, 0, len(existing)+len(teams))
	index := make(map[string]int, len(existing)+len(teams))

	for _, mapping := range existing {
		normalizedTeam := strings.TrimSpace(mapping.Team)
		normalizedMappingOrg := strings.TrimSpace(mapping.Organization)
		if normalizedMappingOrg == "" || normalizedTeam == "" {
			continue
		}

		key := teamMappingKey(normalizedMappingOrg, normalizedTeam)
		normalizedRoles := uniqueNonEmptyStrings(mapping.Roles)
		if existingIndex, ok := index[key]; ok {
			out[existingIndex].Roles = mergedDistinctStrings(out[existingIndex].Roles, normalizedRoles)
			continue
		}

		index[key] = len(out)
		out = append(out, types.TeamRolesMapping{
			Organization: normalizedMappingOrg,
			Team:         normalizedTeam,
			Roles:        normalizedRoles,
		})
	}

	for _, team := range teams {
		normalizedTeam := strings.TrimSpace(team)
		if normalizedTeam == "" {
			continue
		}

		key := teamMappingKey(normalizedOrg, normalizedTeam)
		if existingIndex, ok := index[key]; ok {
			out[existingIndex].Roles = mergedDistinctStrings(out[existingIndex].Roles, []string{normalizedRole})
			continue
		}

		index[key] = len(out)
		out = append(out, types.TeamRolesMapping{
			Organization: normalizedOrg,
			Team:         normalizedTeam,
			Roles:        []string{normalizedRole},
		})
	}

	for i := range out {
		sort.Strings(out[i].Roles)
	}

	sort.Slice(out, func(i, j int) bool {
		orgI := strings.ToLower(out[i].Organization)
		orgJ := strings.ToLower(out[j].Organization)
		if orgI != orgJ {
			return orgI < orgJ
		}
		return strings.ToLower(out[i].Team) < strings.ToLower(out[j].Team)
	})

	return out
}

func validateConnectorMappings(
	mappings []types.TeamRolesMapping,
	organization string,
	teams []string,
	roleName string,
) error {
	index := make(map[string]map[string]struct{}, len(mappings))
	for _, mapping := range mappings {
		key := teamMappingKey(mapping.Organization, mapping.Team)
		roles, ok := index[key]
		if !ok {
			roles = make(map[string]struct{}, len(mapping.Roles))
			index[key] = roles
		}
		for _, role := range mapping.Roles {
			trimmed := strings.TrimSpace(role)
			if trimmed == "" {
				continue
			}
			roles[strings.ToLower(trimmed)] = struct{}{}
		}
	}

	requiredRole := strings.ToLower(strings.TrimSpace(roleName))
	for _, team := range teams {
		key := teamMappingKey(organization, team)
		roles, ok := index[key]
		if !ok {
			return fmt.Errorf("github connector is missing mapping for team %q in organization %q", team, organization)
		}
		if _, ok := roles[requiredRole]; !ok {
			return fmt.Errorf(
				"github connector team %q in organization %q is missing role %q",
				team,
				organization,
				roleName,
			)
		}
	}

	return nil
}

func teamMappingKey(organization, team string) string {
	return strings.ToLower(strings.TrimSpace(organization)) + "|" + strings.ToLower(strings.TrimSpace(team))
}

func mergedDistinctStrings(base, extra []string) []string {
	merged := make([]string, 0, len(base)+len(extra))
	merged = append(merged, base...)
	merged = append(merged, extra...)
	return uniqueNonEmptyStrings(merged)
}

func missingCaseInsensitive(required, actual []string) []string {
	actualSet := make(map[string]struct{}, len(actual))
	for _, value := range actual {
		trimmed := strings.TrimSpace(value)
		if trimmed == "" {
			continue
		}
		actualSet[strings.ToLower(trimmed)] = struct{}{}
	}

	missing := make([]string, 0)
	for _, value := range required {
		trimmed := strings.TrimSpace(value)
		if trimmed == "" {
			continue
		}
		if _, ok := actualSet[strings.ToLower(trimmed)]; ok {
			continue
		}
		missing = append(missing, trimmed)
	}

	return missing
}
