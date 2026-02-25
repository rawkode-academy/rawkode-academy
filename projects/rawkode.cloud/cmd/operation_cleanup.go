package cmd

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"

	"github.com/rawkode-academy/rawkode-cloud3/internal/config"
	"github.com/rawkode-academy/rawkode-cloud3/internal/operation"
	"github.com/rawkode-academy/rawkode-cloud3/internal/scaleway"
	scw "github.com/scaleway/scaleway-sdk-go/scw"
)

type cleanupDeleteServer struct {
	ServerID string `json:"serverId"`
	Zone     string `json:"zone"`
}

func newCreateCleanupRegistry(cfg *config.Config) *operation.CleanupRegistry {
	registry := operation.NewCleanupRegistry()
	registry.Register("delete-server", func(ctx context.Context, data json.RawMessage) error {
		var payload cleanupDeleteServer
		if err := json.Unmarshal(data, &payload); err != nil {
			return fmt.Errorf("decode cleanup payload: %w", err)
		}
		return runDeleteServerCleanupAction(ctx, cfg, payload)
	})
	return registry
}

func runDeleteServerCleanupAction(ctx context.Context, cfg *config.Config, payload cleanupDeleteServer) error {
	if strings.TrimSpace(payload.ServerID) == "" {
		return fmt.Errorf("cleanup payload missing serverId")
	}
	if strings.TrimSpace(payload.Zone) == "" {
		return fmt.Errorf("cleanup payload missing zone")
	}

	accessKey, secretKey := cfg.ScalewayCredentials()
	scwClient, err := scaleway.NewClient(accessKey, secretKey, cfg.Scaleway.ProjectID, cfg.Scaleway.OrganizationID)
	if err != nil {
		return fmt.Errorf("create scaleway client: %w", err)
	}

	return scaleway.CleanupProvisionedServer(ctx, scwClient, payload.ServerID, scw.Zone(payload.Zone))
}
