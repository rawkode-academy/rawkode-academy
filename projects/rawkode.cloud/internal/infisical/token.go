package infisical

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
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

// GenerateMachineToken creates a scoped machine identity token for the Kubernetes cluster.
// The machine token is different from the developer's Infisical credentials — it is
// scoped to only the secrets the cluster needs. If the cluster is compromised, the
// blast radius is limited to those specific secrets.
//
// Uses Infisical's Universal Auth API directly.
func GenerateMachineToken(ctx context.Context, siteURL, clientID, clientSecret string) (string, error) {
	loginURL := fmt.Sprintf("%s/api/v1/auth/universal-auth/login", siteURL)

	reqBody, err := json.Marshal(authRequest{
		ClientID:     clientID,
		ClientSecret: clientSecret,
	})
	if err != nil {
		return "", fmt.Errorf("marshal auth request: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, loginURL, bytes.NewReader(reqBody))
	if err != nil {
		return "", fmt.Errorf("build auth request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return "", fmt.Errorf("infisical auth request: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", fmt.Errorf("read auth response: %w", err)
	}

	if resp.StatusCode >= 400 {
		return "", fmt.Errorf("infisical auth failed (status %d): %s", resp.StatusCode, string(body))
	}

	var authResp authResponse
	if err := json.Unmarshal(body, &authResp); err != nil {
		return "", fmt.Errorf("parse auth response: %w", err)
	}

	slog.Info("infisical machine token generated",
		"phase", "3",
		"expires_in_seconds", authResp.ExpiresIn,
	)

	return authResp.AccessToken, nil
}
