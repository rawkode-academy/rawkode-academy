package teleport

import (
	"context"
	"fmt"
	"log/slog"
	"time"

	"github.com/gravitational/teleport/api/types"
)

// GenerateJoinToken creates a short-lived Teleport join token for a Kubernetes agent.
func GenerateJoinToken(ctx context.Context, proxyAddr string, ttl time.Duration) (string, error) {
	clt, err := newClient(ctx, proxyAddr)
	if err != nil {
		return "", fmt.Errorf("teleport client: %w", err)
	}
	defer clt.Close()

	tokenName := fmt.Sprintf("rawkode-cloud-%d", time.Now().Unix())
	expiry := time.Now().Add(ttl)

	token, err := types.NewProvisionToken(tokenName, types.SystemRoles{types.RoleKube}, expiry)
	if err != nil {
		return "", fmt.Errorf("build provision token: %w", err)
	}

	if err := clt.CreateToken(ctx, token); err != nil {
		return "", fmt.Errorf("create join token: %w", err)
	}

	slog.Info("teleport join token generated", "ttl", ttl, "token_name", tokenName)
	return tokenName, nil
}
