package infisical

import (
	"context"
	"fmt"
	"log/slog"

	infisicalsdk "github.com/infisical/go-sdk"
)

// Client is an authenticated Infisical client for fetching secrets.
type Client struct {
	sdk infisicalsdk.InfisicalClientInterface
}

// NewClient authenticates with Infisical using Universal Auth and returns
// a client that can fetch secrets.
func NewClient(ctx context.Context, siteURL, clientID, clientSecret string) (*Client, error) {
	sdk := infisicalsdk.NewInfisicalClient(ctx, infisicalsdk.Config{
		SiteUrl:          siteURL,
		AutoTokenRefresh: true,
	})

	_, err := sdk.Auth().UniversalAuthLogin(clientID, clientSecret)
	if err != nil {
		return nil, fmt.Errorf("infisical auth: %w", err)
	}

	slog.Info("infisical client authenticated")

	return &Client{sdk: sdk}, nil
}

// GetSecret fetches a single secret by key from a given project/environment/path.
func (c *Client) GetSecret(_ context.Context, projectID, environment, secretPath, key string) (string, error) {
	secret, err := c.sdk.Secrets().Retrieve(infisicalsdk.RetrieveSecretOptions{
		ProjectID:   projectID,
		Environment: environment,
		SecretPath:  secretPath,
		SecretKey:   key,
	})
	if err != nil {
		return "", fmt.Errorf("fetch secret %s: %w", key, err)
	}

	return secret.SecretValue, nil
}

// GetSecrets fetches all secrets from a given project/environment/path.
func (c *Client) GetSecrets(_ context.Context, projectID, environment, secretPath string) (map[string]string, error) {
	list, err := c.sdk.Secrets().List(infisicalsdk.ListSecretsOptions{
		ProjectID:   projectID,
		Environment: environment,
		SecretPath:  secretPath,
	})
	if err != nil {
		return nil, fmt.Errorf("fetch secrets: %w", err)
	}

	secrets := make(map[string]string, len(list))
	for _, s := range list {
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
