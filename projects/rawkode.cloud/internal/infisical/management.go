package infisical

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"

	sdkerrors "github.com/infisical/go-sdk/packages/errors"
)

const (
	identityRoleNoAccess = "no-access"
)

// APIError represents an error returned by Infisical's management API.
type APIError struct {
	ReqID      string `json:"reqId"`
	StatusCode int    `json:"statusCode"`
	Message    string `json:"message"`
	Err        string `json:"error"`
}

func (e *APIError) Error() string {
	if e == nil {
		return ""
	}

	switch {
	case strings.TrimSpace(e.Message) != "" && strings.TrimSpace(e.Err) != "":
		return fmt.Sprintf("infisical API %d: %s (%s)", e.StatusCode, e.Message, e.Err)
	case strings.TrimSpace(e.Message) != "":
		return fmt.Sprintf("infisical API %d: %s", e.StatusCode, e.Message)
	case strings.TrimSpace(e.Err) != "":
		return fmt.Sprintf("infisical API %d: %s", e.StatusCode, e.Err)
	default:
		return fmt.Sprintf("infisical API %d", e.StatusCode)
	}
}

// MetadataEntry describes machine identity metadata.
type MetadataEntry struct {
	Key   string `json:"key"`
	Value string `json:"value"`
}

// Project contains the Infisical project fields used by bootstrap.
type Project struct {
	ID    string `json:"id"`
	Slug  string `json:"slug"`
	OrgID string `json:"orgId"`
}

// SecretTag contains the Infisical tag fields used by bootstrap.
type SecretTag struct {
	ID    string `json:"id"`
	Slug  string `json:"slug"`
	Name  string `json:"name"`
	Color string `json:"color"`
}

// ProjectRole contains the Infisical custom role fields used by bootstrap.
type ProjectRole struct {
	ID          string           `json:"id"`
	Slug        string           `json:"slug"`
	Name        string           `json:"name"`
	Description string           `json:"description"`
	Permissions []map[string]any `json:"permissions"`
}

// MachineIdentity contains the Infisical machine identity fields used by bootstrap.
type MachineIdentity struct {
	ID                  string          `json:"id"`
	Name                string          `json:"name"`
	OrganizationID      string          `json:"orgId"`
	HasDeleteProtection bool            `json:"hasDeleteProtection"`
	AuthMethods         []string        `json:"authMethods"`
	Metadata            []MetadataEntry `json:"metadata"`
}

// IdentityMembershipRole contains project membership role details for a machine identity.
type IdentityMembershipRole struct {
	ID             string `json:"id"`
	Role           string `json:"role"`
	CustomRoleID   string `json:"customRoleId"`
	CustomRoleName string `json:"customRoleName"`
	CustomRoleSlug string `json:"customRoleSlug"`
}

// IdentityMembership contains the project membership fields used by bootstrap.
type IdentityMembership struct {
	ID         string                   `json:"id"`
	IdentityID string                   `json:"identityId"`
	Roles      []IdentityMembershipRole `json:"roles"`
}

// UniversalAuthConfig contains the machine identity's Universal Auth config.
type UniversalAuthConfig struct {
	ID         string `json:"id"`
	ClientID   string `json:"clientId"`
	IdentityID string `json:"identityId"`
}

// UniversalAuthClientSecret contains client-secret metadata.
type UniversalAuthClientSecret struct {
	ID          string `json:"id"`
	Description string `json:"description"`
	Prefix      string `json:"clientSecretPrefix"`
	Revoked     bool   `json:"isClientSecretRevoked"`
}

// UniversalAuthClientSecretResult includes the one-time plain client secret value.
type UniversalAuthClientSecretResult struct {
	ClientSecret string
	Data         UniversalAuthClientSecret
}

// AccessToken returns the current Infisical bearer token for management API calls.
func (c *Client) AccessToken() string {
	if c == nil {
		return ""
	}
	if c.getAccessToken != nil {
		return strings.TrimSpace(c.getAccessToken())
	}
	if c.sdk == nil {
		return ""
	}
	return strings.TrimSpace(c.sdk.Auth().GetAccessToken())
}

// IsNotFound reports whether the given error is an Infisical not-found response.
func IsNotFound(err error) bool {
	if err == nil {
		return false
	}

	var apiErr *APIError
	if errors.As(err, &apiErr) && apiErr.StatusCode == http.StatusNotFound {
		return true
	}

	var sdkErr *sdkerrors.APIError
	return errors.As(err, &sdkErr) && sdkErr.StatusCode == http.StatusNotFound
}

func (c *Client) GetProject(ctx context.Context, projectID string) (*Project, error) {
	var response struct {
		Project Project `json:"project"`
	}

	if err := c.doJSON(ctx, http.MethodGet, "/api/v1/projects/"+url.PathEscape(strings.TrimSpace(projectID)), nil, &response); err != nil {
		return nil, err
	}

	return &response.Project, nil
}

func (c *Client) ListMachineIdentities(ctx context.Context, orgID string) ([]MachineIdentity, error) {
	var response struct {
		Identities []struct {
			OrganizationID string `json:"orgId"`
			IdentityID     string `json:"identityId"`
			Identity       struct {
				ID                  string   `json:"id"`
				Name                string   `json:"name"`
				HasDeleteProtection bool     `json:"hasDeleteProtection"`
				AuthMethods         []string `json:"authMethods"`
			} `json:"identity"`
		} `json:"identities"`
	}

	path := "/api/v1/identities?orgId=" + url.QueryEscape(strings.TrimSpace(orgID))
	if err := c.doJSON(ctx, http.MethodGet, path, nil, &response); err != nil {
		return nil, err
	}

	out := make([]MachineIdentity, 0, len(response.Identities))
	for _, item := range response.Identities {
		id := strings.TrimSpace(item.Identity.ID)
		if id == "" {
			id = strings.TrimSpace(item.IdentityID)
		}
		out = append(out, MachineIdentity{
			ID:                  id,
			Name:                strings.TrimSpace(item.Identity.Name),
			OrganizationID:      strings.TrimSpace(item.OrganizationID),
			HasDeleteProtection: item.Identity.HasDeleteProtection,
			AuthMethods:         append([]string(nil), item.Identity.AuthMethods...),
		})
	}

	return out, nil
}

func (c *Client) GetMachineIdentity(ctx context.Context, identityID string) (*MachineIdentity, error) {
	var response struct {
		Identity struct {
			OrganizationID string          `json:"orgId"`
			IdentityID     string          `json:"identityId"`
			Metadata       []MetadataEntry `json:"metadata"`
			Identity       struct {
				ID                  string   `json:"id"`
				Name                string   `json:"name"`
				OrganizationID      string   `json:"orgId"`
				HasDeleteProtection bool     `json:"hasDeleteProtection"`
				AuthMethods         []string `json:"authMethods"`
			} `json:"identity"`
		} `json:"identity"`
	}

	path := "/api/v1/identities/" + url.PathEscape(strings.TrimSpace(identityID))
	if err := c.doJSON(ctx, http.MethodGet, path, nil, &response); err != nil {
		return nil, err
	}

	out := &MachineIdentity{
		ID:                  strings.TrimSpace(response.Identity.Identity.ID),
		Name:                strings.TrimSpace(response.Identity.Identity.Name),
		OrganizationID:      strings.TrimSpace(response.Identity.Identity.OrganizationID),
		HasDeleteProtection: response.Identity.Identity.HasDeleteProtection,
		AuthMethods:         append([]string(nil), response.Identity.Identity.AuthMethods...),
		Metadata:            append([]MetadataEntry(nil), response.Identity.Metadata...),
	}
	if out.ID == "" {
		out.ID = strings.TrimSpace(response.Identity.IdentityID)
	}
	if out.OrganizationID == "" {
		out.OrganizationID = strings.TrimSpace(response.Identity.OrganizationID)
	}

	return out, nil
}

func (c *Client) CreateMachineIdentity(
	ctx context.Context,
	orgID,
	name string,
	deleteProtection bool,
	metadata []MetadataEntry,
) (*MachineIdentity, error) {
	request := struct {
		Name                string          `json:"name"`
		OrganizationID      string          `json:"organizationId"`
		Role                string          `json:"role"`
		HasDeleteProtection bool            `json:"hasDeleteProtection"`
		Metadata            []MetadataEntry `json:"metadata,omitempty"`
	}{
		Name:                strings.TrimSpace(name),
		OrganizationID:      strings.TrimSpace(orgID),
		Role:                identityRoleNoAccess,
		HasDeleteProtection: deleteProtection,
		Metadata:            metadata,
	}

	var response struct {
		Identity MachineIdentity `json:"identity"`
	}

	if err := c.doJSON(ctx, http.MethodPost, "/api/v1/identities", request, &response); err != nil {
		return nil, err
	}

	return &response.Identity, nil
}

func (c *Client) UpdateMachineIdentity(
	ctx context.Context,
	identityID,
	name string,
	deleteProtection bool,
	metadata []MetadataEntry,
) (*MachineIdentity, error) {
	request := struct {
		Name                string          `json:"name,omitempty"`
		HasDeleteProtection bool            `json:"hasDeleteProtection"`
		Metadata            []MetadataEntry `json:"metadata,omitempty"`
	}{
		Name:                strings.TrimSpace(name),
		HasDeleteProtection: deleteProtection,
		Metadata:            metadata,
	}

	var response struct {
		Identity MachineIdentity `json:"identity"`
	}

	path := "/api/v1/identities/" + url.PathEscape(strings.TrimSpace(identityID))
	if err := c.doJSON(ctx, http.MethodPatch, path, request, &response); err != nil {
		return nil, err
	}

	return &response.Identity, nil
}

func (c *Client) GetSecretTagBySlug(ctx context.Context, projectID, tagSlug string) (*SecretTag, error) {
	var response struct {
		Tag SecretTag `json:"tag"`
	}

	path := "/api/v1/projects/" + url.PathEscape(strings.TrimSpace(projectID)) + "/tags/slug/" + url.PathEscape(strings.TrimSpace(tagSlug))
	if err := c.doJSON(ctx, http.MethodGet, path, nil, &response); err != nil {
		return nil, err
	}

	return &response.Tag, nil
}

func (c *Client) CreateSecretTag(ctx context.Context, projectID, tagSlug, color string) (*SecretTag, error) {
	request := struct {
		Slug  string `json:"slug"`
		Color string `json:"color"`
	}{
		Slug:  strings.TrimSpace(tagSlug),
		Color: strings.TrimSpace(color),
	}

	var response struct {
		Tag SecretTag `json:"tag"`
	}

	path := "/api/v1/projects/" + url.PathEscape(strings.TrimSpace(projectID)) + "/tags"
	if err := c.doJSON(ctx, http.MethodPost, path, request, &response); err != nil {
		return nil, err
	}

	return &response.Tag, nil
}

func (c *Client) GetProjectRoleBySlug(ctx context.Context, projectID, roleSlug string) (*ProjectRole, error) {
	var response struct {
		Role ProjectRole `json:"role"`
	}

	path := "/api/v2/workspace/" + url.PathEscape(strings.TrimSpace(projectID)) + "/roles/slug/" + url.PathEscape(strings.TrimSpace(roleSlug))
	if err := c.doJSON(ctx, http.MethodGet, path, nil, &response); err != nil {
		return nil, err
	}

	return &response.Role, nil
}

func (c *Client) CreateProjectRole(
	ctx context.Context,
	projectID,
	slug,
	name,
	description string,
	permissions []map[string]any,
) (*ProjectRole, error) {
	request := struct {
		Slug        string           `json:"slug"`
		Name        string           `json:"name"`
		Description string           `json:"description,omitempty"`
		Permissions []map[string]any `json:"permissions"`
	}{
		Slug:        strings.TrimSpace(slug),
		Name:        strings.TrimSpace(name),
		Description: strings.TrimSpace(description),
		Permissions: permissions,
	}

	var response struct {
		Role ProjectRole `json:"role"`
	}

	path := "/api/v2/workspace/" + url.PathEscape(strings.TrimSpace(projectID)) + "/roles"
	if err := c.doJSON(ctx, http.MethodPost, path, request, &response); err != nil {
		return nil, err
	}

	return &response.Role, nil
}

func (c *Client) UpdateProjectRole(
	ctx context.Context,
	projectID,
	roleID,
	slug,
	name,
	description string,
	permissions []map[string]any,
) (*ProjectRole, error) {
	request := struct {
		Slug        string           `json:"slug"`
		Name        string           `json:"name"`
		Description string           `json:"description,omitempty"`
		Permissions []map[string]any `json:"permissions"`
	}{
		Slug:        strings.TrimSpace(slug),
		Name:        strings.TrimSpace(name),
		Description: strings.TrimSpace(description),
		Permissions: permissions,
	}

	var response struct {
		Role ProjectRole `json:"role"`
	}

	path := "/api/v2/workspace/" + url.PathEscape(strings.TrimSpace(projectID)) + "/roles/" + url.PathEscape(strings.TrimSpace(roleID))
	if err := c.doJSON(ctx, http.MethodPatch, path, request, &response); err != nil {
		return nil, err
	}

	return &response.Role, nil
}

func (c *Client) GetProjectIdentityMembership(ctx context.Context, projectID, identityID string) (*IdentityMembership, error) {
	var response struct {
		IdentityMembership IdentityMembership `json:"identityMembership"`
	}

	path := "/api/v2/workspace/" + url.PathEscape(strings.TrimSpace(projectID)) + "/identity-memberships/" + url.PathEscape(strings.TrimSpace(identityID))
	if err := c.doJSON(ctx, http.MethodGet, path, nil, &response); err != nil {
		return nil, err
	}

	return &response.IdentityMembership, nil
}

func (c *Client) CreateProjectIdentityMembership(ctx context.Context, projectID, identityID, roleSlug string) (*IdentityMembership, error) {
	request := struct {
		Roles []map[string]any `json:"roles"`
	}{
		Roles: []map[string]any{{"role": strings.TrimSpace(roleSlug)}},
	}

	var response struct {
		IdentityMembership IdentityMembership `json:"identityMembership"`
	}

	path := "/api/v2/workspace/" + url.PathEscape(strings.TrimSpace(projectID)) + "/identity-memberships/" + url.PathEscape(strings.TrimSpace(identityID))
	if err := c.doJSON(ctx, http.MethodPost, path, request, &response); err != nil {
		return nil, err
	}

	return &response.IdentityMembership, nil
}

func (c *Client) UpdateProjectIdentityMembership(ctx context.Context, projectID, identityID, roleSlug string) ([]IdentityMembershipRole, error) {
	request := struct {
		Roles []map[string]any `json:"roles"`
	}{
		Roles: []map[string]any{{"role": strings.TrimSpace(roleSlug)}},
	}

	var response struct {
		Roles []IdentityMembershipRole `json:"roles"`
	}

	path := "/api/v2/workspace/" + url.PathEscape(strings.TrimSpace(projectID)) + "/identity-memberships/" + url.PathEscape(strings.TrimSpace(identityID))
	if err := c.doJSON(ctx, http.MethodPatch, path, request, &response); err != nil {
		return nil, err
	}

	return response.Roles, nil
}

func (c *Client) DeleteProjectIdentityMembership(ctx context.Context, projectID, identityID string) error {
	path := "/api/v2/workspace/" + url.PathEscape(strings.TrimSpace(projectID)) + "/identity-memberships/" + url.PathEscape(strings.TrimSpace(identityID))
	return c.doJSON(ctx, http.MethodDelete, path, nil, nil)
}

func (c *Client) GetUniversalAuth(ctx context.Context, identityID string) (*UniversalAuthConfig, error) {
	var response struct {
		IdentityUniversalAuth UniversalAuthConfig `json:"identityUniversalAuth"`
	}

	path := "/api/v1/auth/universal-auth/identities/" + url.PathEscape(strings.TrimSpace(identityID))
	if err := c.doJSON(ctx, http.MethodGet, path, nil, &response); err != nil {
		return nil, err
	}

	return &response.IdentityUniversalAuth, nil
}

func (c *Client) AttachUniversalAuth(ctx context.Context, identityID string) (*UniversalAuthConfig, error) {
	var response struct {
		IdentityUniversalAuth UniversalAuthConfig `json:"identityUniversalAuth"`
	}

	path := "/api/v1/auth/universal-auth/identities/" + url.PathEscape(strings.TrimSpace(identityID))
	if err := c.doJSON(ctx, http.MethodPost, path, map[string]any{}, &response); err != nil {
		return nil, err
	}

	return &response.IdentityUniversalAuth, nil
}

func (c *Client) DeleteUniversalAuth(ctx context.Context, identityID string) error {
	path := "/api/v1/auth/universal-auth/identities/" + url.PathEscape(strings.TrimSpace(identityID))
	return c.doJSON(ctx, http.MethodDelete, path, nil, nil)
}

func (c *Client) CreateUniversalAuthClientSecret(
	ctx context.Context,
	identityID,
	description string,
) (*UniversalAuthClientSecretResult, error) {
	request := struct {
		Description  string `json:"description,omitempty"`
		NumUsesLimit int    `json:"numUsesLimit"`
		TTL          int    `json:"ttl"`
	}{
		Description:  strings.TrimSpace(description),
		NumUsesLimit: 0,
		TTL:          0,
	}

	var response struct {
		ClientSecret     string                    `json:"clientSecret"`
		ClientSecretData UniversalAuthClientSecret `json:"clientSecretData"`
	}

	path := "/api/v1/auth/universal-auth/identities/" + url.PathEscape(strings.TrimSpace(identityID)) + "/client-secrets"
	if err := c.doJSON(ctx, http.MethodPost, path, request, &response); err != nil {
		return nil, err
	}

	return &UniversalAuthClientSecretResult{
		ClientSecret: strings.TrimSpace(response.ClientSecret),
		Data:         response.ClientSecretData,
	}, nil
}

func (c *Client) ListUniversalAuthClientSecrets(ctx context.Context, identityID string) ([]UniversalAuthClientSecret, error) {
	var response struct {
		ClientSecretData []UniversalAuthClientSecret `json:"clientSecretData"`
	}

	path := "/api/v1/auth/universal-auth/identities/" + url.PathEscape(strings.TrimSpace(identityID)) + "/client-secrets"
	if err := c.doJSON(ctx, http.MethodGet, path, nil, &response); err != nil {
		return nil, err
	}

	return response.ClientSecretData, nil
}

func (c *Client) RevokeUniversalAuthClientSecret(ctx context.Context, identityID, clientSecretID string) error {
	path := "/api/v1/auth/universal-auth/identities/" + url.PathEscape(strings.TrimSpace(identityID)) + "/client-secrets/" + url.PathEscape(strings.TrimSpace(clientSecretID)) + "/revoke"
	return c.doJSON(ctx, http.MethodPost, path, nil, nil)
}

func (c *Client) DeleteMachineIdentity(ctx context.Context, identityID string) error {
	path := "/api/v1/identities/" + url.PathEscape(strings.TrimSpace(identityID))
	return c.doJSON(ctx, http.MethodDelete, path, nil, nil)
}

func (c *Client) doJSON(ctx context.Context, method, path string, requestBody any, out any) error {
	if c == nil {
		return fmt.Errorf("infisical client is required")
	}
	if strings.TrimSpace(c.siteURL) == "" {
		return fmt.Errorf("infisical site URL is required")
	}

	token := c.AccessToken()
	if token == "" {
		return fmt.Errorf("infisical access token is required")
	}

	fullURL := c.siteURL + ensureLeadingSlash(path)

	var body io.Reader
	if requestBody != nil {
		payload, err := json.Marshal(requestBody)
		if err != nil {
			return fmt.Errorf("marshal infisical request: %w", err)
		}
		body = bytes.NewReader(payload)
	}

	req, err := http.NewRequestWithContext(ctx, method, fullURL, body)
	if err != nil {
		return fmt.Errorf("create infisical request: %w", err)
	}

	req.Header.Set("Accept", "application/json")
	req.Header.Set("Authorization", "Bearer "+token)
	if requestBody != nil {
		req.Header.Set("Content-Type", "application/json")
	}

	httpClient := c.httpClient
	if httpClient == nil {
		httpClient = http.DefaultClient
	}

	resp, err := httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("call infisical API %s %s: %w", method, path, err)
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return decodeInfisicalAPIError(resp)
	}

	if out == nil {
		_, _ = io.Copy(io.Discard, resp.Body)
		return nil
	}

	if err := json.NewDecoder(resp.Body).Decode(out); err != nil {
		return fmt.Errorf("decode infisical response %s %s: %w", method, path, err)
	}

	return nil
}

func decodeInfisicalAPIError(resp *http.Response) error {
	if resp == nil {
		return fmt.Errorf("empty infisical response")
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return fmt.Errorf("read infisical error response: %w", err)
	}

	var apiErr APIError
	if len(body) > 0 && json.Unmarshal(body, &apiErr) == nil {
		if apiErr.StatusCode == 0 {
			apiErr.StatusCode = resp.StatusCode
		}
		return &apiErr
	}

	message := strings.TrimSpace(string(body))
	if message == "" {
		message = resp.Status
	}

	return &APIError{
		StatusCode: resp.StatusCode,
		Message:    message,
	}
}

func ensureLeadingSlash(path string) string {
	path = strings.TrimSpace(path)
	if path == "" {
		return ""
	}
	if strings.HasPrefix(path, "/") {
		return path
	}
	return "/" + path
}
