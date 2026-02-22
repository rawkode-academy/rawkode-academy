package state

import (
	"context"
	"fmt"
	"log/slog"

	"github.com/rawkode-academy/rawkode-cloud/internal/cloudflare"
)

func resolveCloudflareZoneID(ctx context.Context, apiToken, zoneID, accountID, dnsName string) (string, error) {
	if zoneID != "" {
		return zoneID, nil
	}

	if apiToken == "" || accountID == "" || dnsName == "" {
		return "", nil
	}

	resolvedZoneID, resolvedZoneName, err := cloudflare.ResolveZoneID(ctx, apiToken, accountID, dnsName)
	if err != nil {
		return "", fmt.Errorf("resolve zone ID from account ID: %w", err)
	}

	slog.Info("resolved Cloudflare zone from account ID",
		"phase", "3",
		"dns_name", dnsName,
		"zone_name", resolvedZoneName,
	)
	return resolvedZoneID, nil
}
