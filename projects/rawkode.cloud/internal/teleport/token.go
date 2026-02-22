package teleport

import (
	"context"
	"fmt"
	"log/slog"
	"time"
)

// tokenRequest represents a Teleport provision token creation request.
type tokenRequest struct {
	Kind    string        `json:"kind"`
	Version string        `json:"version"`
	Metadata tokenMetadata `json:"metadata"`
	Spec    tokenSpec     `json:"spec"`
}

type tokenMetadata struct {
	Name    string `json:"name"`
	Expires string `json:"expires"`
}

type tokenSpec struct {
	Roles    []string `json:"roles"`
	JoinMethod string `json:"join_method"`
}

// GenerateJoinToken creates a short-lived Teleport join token for a Kubernetes agent.
// The token is scoped to the "Kube" role and has a limited TTL (typically 30 minutes).
// Generated AFTER the machine is ordered to maximize the usable lifetime window.
func GenerateJoinToken(ctx context.Context, proxyAddr string, ttl time.Duration) (string, error) {
	client, err := NewClient(proxyAddr)
	if err != nil {
		return "", fmt.Errorf("teleport client: %w", err)
	}

	tokenName := fmt.Sprintf("rawkode-cloud-%d", time.Now().Unix())
	expiry := time.Now().Add(ttl)

	req := tokenRequest{
		Kind:    "token",
		Version: "v2",
		Metadata: tokenMetadata{
			Name:    tokenName,
			Expires: expiry.Format(time.RFC3339),
		},
		Spec: tokenSpec{
			Roles:      []string{"Kube"},
			JoinMethod: "token",
		},
	}

	_, err = client.doRequest(ctx, "POST", "tokens", req)
	if err != nil {
		return "", fmt.Errorf("create join token: %w", err)
	}

	slog.Info("teleport join token generated", "phase", "3", "ttl", ttl, "token_name", tokenName)
	return tokenName, nil
}
