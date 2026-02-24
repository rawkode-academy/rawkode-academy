package infisical

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"strings"

	infisicalsdk "github.com/infisical/go-sdk"
	sdkerrors "github.com/infisical/go-sdk/packages/errors"
)

// Client is an authenticated Infisical client for fetching secrets.
type Client struct {
	sdk infisicalsdk.InfisicalClientInterface
}

// NewClient authenticates with Infisical using Universal Auth.
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

// GetSecret fetches a single secret by key.
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

// SetSecret creates or updates a single secret.
func (c *Client) SetSecret(_ context.Context, projectID, environment, secretPath, key, value string) error {
	_, err := c.sdk.Secrets().Create(infisicalsdk.CreateSecretOptions{
		SecretKey:   key,
		SecretValue: value,
		ProjectID:   projectID,
		Environment: environment,
		SecretPath:  secretPath,
	})
	if err != nil {
		_, updateErr := c.sdk.Secrets().Update(infisicalsdk.UpdateSecretOptions{
			SecretKey:      key,
			NewSecretValue: value,
			ProjectID:      projectID,
			Environment:    environment,
			SecretPath:     secretPath,
		})
		if updateErr != nil {
			return fmt.Errorf("set secret %s (create: %w, update: %w)", key, err, updateErr)
		}
	}

	slog.Debug("secret set in infisical", "key", key)
	return nil
}

// GetSecrets fetches all secrets from a given path.
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
	return secrets, nil
}

// EnsureSecretPath creates every folder segment in secretPath if missing.
func (c *Client) EnsureSecretPath(_ context.Context, projectID, environment, secretPath string) error {
	cleanPath := strings.TrimSpace(secretPath)
	if cleanPath == "" || cleanPath == "/" {
		return nil
	}

	segments := strings.Split(strings.Trim(cleanPath, "/"), "/")
	currentPath := "/"

	for _, segment := range segments {
		_, err := c.sdk.Folders().Create(infisicalsdk.CreateFolderOptions{
			ProjectID:   projectID,
			Environment: environment,
			Name:        segment,
			Path:        currentPath,
		})
		if err != nil {
			var apiErr *sdkerrors.APIError
			if errors.As(err, &apiErr) && apiErr.StatusCode == 409 {
				// Folder already exists.
			} else {
				return fmt.Errorf("ensure folder %q at %q: %w", segment, currentPath, err)
			}
		}

		if currentPath == "/" {
			currentPath = "/" + segment
		} else {
			currentPath = currentPath + "/" + segment
		}
	}

	return nil
}
