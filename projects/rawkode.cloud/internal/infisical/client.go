package infisical

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"net/url"
	"time"
)

// authRequest represents an Infisical Universal Auth login request.
type authRequest struct {
	ClientID     string `json:"clientId"`
	ClientSecret string `json:"clientSecret"`
}

// authResponse represents an Infisical Universal Auth login response.
type authResponse struct {
	AccessToken string `json:"accessToken"`
	ExpiresIn   int    `json:"expiresIn"`
	TokenType   string `json:"tokenType"`
}

// Client is an authenticated Infisical API client for fetching secrets.
type Client struct {
	siteURL     string
	accessToken string
	httpClient  *http.Client
}

// secretResponse represents a single secret from the Infisical API.
type secretResponse struct {
	SecretKey   string `json:"secretKey"`
	SecretValue string `json:"secretValue"`
}

// secretsListResponse represents the Infisical list-secrets API response.
type secretsListResponse struct {
	Secrets []secretResponse `json:"secrets"`
}

// NewClient authenticates with Infisical using Universal Auth and returns
// a client that can fetch secrets. The client credentials belong to the
// developer; the access token is scoped per the machine identity's permissions.
func NewClient(ctx context.Context, siteURL, clientID, clientSecret string) (*Client, error) {
	loginURL := fmt.Sprintf("%s/api/v1/auth/universal-auth/login", siteURL)

	reqBody, err := json.Marshal(authRequest{
		ClientID:     clientID,
		ClientSecret: clientSecret,
	})
	if err != nil {
		return nil, fmt.Errorf("marshal auth request: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, loginURL, bytes.NewReader(reqBody))
	if err != nil {
		return nil, fmt.Errorf("build auth request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")

	httpClient := &http.Client{Timeout: 30 * time.Second}
	resp, err := httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("infisical auth request: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("read auth response: %w", err)
	}

	if resp.StatusCode >= 400 {
		return nil, fmt.Errorf("infisical auth failed (status %d): %s", resp.StatusCode, string(body))
	}

	var authResp authResponse
	if err := json.Unmarshal(body, &authResp); err != nil {
		return nil, fmt.Errorf("parse auth response: %w", err)
	}

	slog.Info("infisical client authenticated", "expires_in_seconds", authResp.ExpiresIn)

	return &Client{
		siteURL:     siteURL,
		accessToken: authResp.AccessToken,
		httpClient:  httpClient,
	}, nil
}

// GetSecret fetches a single secret by key from a given project/environment/path.
func (c *Client) GetSecret(ctx context.Context, projectID, environment, secretPath, key string) (string, error) {
	endpoint := fmt.Sprintf("%s/api/v3/secrets/raw/%s", c.siteURL, url.PathEscape(key))

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return "", fmt.Errorf("build request: %w", err)
	}

	q := req.URL.Query()
	q.Set("workspaceId", projectID)
	q.Set("environment", environment)
	q.Set("secretPath", secretPath)
	req.URL.RawQuery = q.Encode()

	req.Header.Set("Authorization", "Bearer "+c.accessToken)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("fetch secret %s: %w", key, err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", fmt.Errorf("read secret response: %w", err)
	}

	if resp.StatusCode >= 400 {
		return "", fmt.Errorf("fetch secret %s failed (status %d): %s", key, resp.StatusCode, string(body))
	}

	var result struct {
		Secret secretResponse `json:"secret"`
	}
	if err := json.Unmarshal(body, &result); err != nil {
		return "", fmt.Errorf("parse secret response: %w", err)
	}

	return result.Secret.SecretValue, nil
}

// GetSecrets fetches all secrets from a given project/environment/path.
func (c *Client) GetSecrets(ctx context.Context, projectID, environment, secretPath string) (map[string]string, error) {
	endpoint := fmt.Sprintf("%s/api/v3/secrets/raw", c.siteURL)

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return nil, fmt.Errorf("build request: %w", err)
	}

	q := req.URL.Query()
	q.Set("workspaceId", projectID)
	q.Set("environment", environment)
	q.Set("secretPath", secretPath)
	req.URL.RawQuery = q.Encode()

	req.Header.Set("Authorization", "Bearer "+c.accessToken)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("fetch secrets: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("read secrets response: %w", err)
	}

	if resp.StatusCode >= 400 {
		return nil, fmt.Errorf("fetch secrets failed (status %d): %s", resp.StatusCode, string(body))
	}

	var result secretsListResponse
	if err := json.Unmarshal(body, &result); err != nil {
		return nil, fmt.Errorf("parse secrets response: %w", err)
	}

	secrets := make(map[string]string, len(result.Secrets))
	for _, s := range result.Secrets {
		secrets[s.SecretKey] = s.SecretValue
	}

	slog.Info("fetched secrets from infisical",
		"project", projectID,
		"environment", environment,
		"path", secretPath,
		"count", len(secrets),
	)

	return secrets, nil
}

// AccessToken returns the raw access token for injection into the cluster.
// This is the machine identity token that gets embedded as a Kubernetes secret.
func (c *Client) AccessToken() string {
	return c.accessToken
}
