package infisical

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/rawkode-academy/rawkode-cloud3/internal/talos"
)

const secretsBundleKey = "TALOS_SECRETS_BUNDLE"

// StoreSecretsBundle stores a Talos secrets bundle in Infisical.
func (c *Client) StoreSecretsBundle(ctx context.Context, projectID, environment, secretPath string, bundle *talos.SecretsBundle) error {
	if err := c.EnsureSecretPath(ctx, projectID, environment, secretPath); err != nil {
		return fmt.Errorf("ensure secret path: %w", err)
	}

	data, err := json.Marshal(bundle)
	if err != nil {
		return fmt.Errorf("marshal secrets bundle: %w", err)
	}

	if err := c.SetSecret(ctx, projectID, environment, secretPath, secretsBundleKey, string(data)); err != nil {
		return fmt.Errorf("store secrets bundle: %w", err)
	}

	return nil
}

// LoadSecretsBundle retrieves a Talos secrets bundle from Infisical.
// Returns nil, nil if the secret doesn't exist yet.
func (c *Client) LoadSecretsBundle(ctx context.Context, projectID, environment, secretPath string) (*talos.SecretsBundle, error) {
	value, err := c.GetSecret(ctx, projectID, environment, secretPath, secretsBundleKey)
	if err != nil {
		// If secret not found, return nil (first-time init)
		return nil, nil
	}
	if value == "" {
		return nil, nil
	}

	var bundle talos.SecretsBundle
	if err := json.Unmarshal([]byte(value), &bundle); err != nil {
		return nil, fmt.Errorf("unmarshal secrets bundle: %w", err)
	}

	return &bundle, nil
}
