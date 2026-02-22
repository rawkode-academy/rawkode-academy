package teleport

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"time"
)

// Client wraps the Teleport API using direct HTTP calls.
// Uses the ~/.tsh profile for authentication (same as `tsh login`).
type Client struct {
	proxyAddr  string
	httpClient *http.Client
	bearerToken string
}

// tshProfile represents the minimal fields from the ~/.tsh profile.
type tshProfile struct {
	WebProxyAddr string `json:"web_proxy_addr"`
	Token        string `json:"token,omitempty"`
}

// NewClient creates a Teleport API client using the ~/.tsh profile credentials.
func NewClient(proxyAddr string) (*Client, error) {
	token, err := loadTshToken()
	if err != nil {
		return nil, fmt.Errorf("load tsh credentials: %w", err)
	}

	return &Client{
		proxyAddr: proxyAddr,
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
		bearerToken: token,
	}, nil
}

// loadTshToken reads the bearer token from the ~/.tsh profile directory.
func loadTshToken() (string, error) {
	home, err := os.UserHomeDir()
	if err != nil {
		return "", fmt.Errorf("get home dir: %w", err)
	}

	// tsh stores the current profile's keys in ~/.tsh/keys/<proxy>/
	// The bearer token for API access is stored in the profile.
	profilePath := filepath.Join(home, ".tsh", "profile")
	data, err := os.ReadFile(profilePath)
	if err != nil {
		return "", fmt.Errorf("read tsh profile (run 'tsh login' first): %w", err)
	}

	var profile tshProfile
	if err := json.Unmarshal(data, &profile); err != nil {
		// Profile might be in YAML format — try reading as plain text
		return string(bytes.TrimSpace(data)), nil
	}

	return profile.Token, nil
}

// doRequest executes an authenticated HTTP request against the Teleport API.
func (c *Client) doRequest(ctx context.Context, method, path string, body any) ([]byte, error) {
	url := fmt.Sprintf("https://%s/v1/%s", c.proxyAddr, path)

	var reqBody io.Reader
	if body != nil {
		data, err := json.Marshal(body)
		if err != nil {
			return nil, fmt.Errorf("marshal request: %w", err)
		}
		reqBody = bytes.NewReader(data)
	}

	req, err := http.NewRequestWithContext(ctx, method, url, reqBody)
	if err != nil {
		return nil, fmt.Errorf("build request: %w", err)
	}

	req.Header.Set("Authorization", "Bearer "+c.bearerToken)
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("execute request: %w", err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("read response: %w", err)
	}

	if resp.StatusCode >= 400 {
		return nil, fmt.Errorf("teleport API error (status %d): %s", resp.StatusCode, string(respBody))
	}

	return respBody, nil
}
