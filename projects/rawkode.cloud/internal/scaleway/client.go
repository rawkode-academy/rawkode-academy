package scaleway

import (
	"fmt"

	baremetal "github.com/scaleway/scaleway-sdk-go/api/baremetal/v1"
	"github.com/scaleway/scaleway-sdk-go/scw"
)

// NewClient creates a Scaleway bare metal API client.
// If accessKey and secretKey are provided, they are used directly.
// Otherwise, falls back to environment variables (SCW_ACCESS_KEY, SCW_SECRET_KEY).
func NewClient(accessKey, secretKey string) (*baremetal.API, error) {
	opts := []scw.ClientOption{
		scw.WithEnv(),
	}

	// Explicit credentials override environment variables.
	if accessKey != "" && secretKey != "" {
		opts = append(opts,
			scw.WithAuth(accessKey, secretKey),
		)
	}

	client, err := scw.NewClient(opts...)
	if err != nil {
		return nil, fmt.Errorf("scaleway client init: %w", err)
	}
	return baremetal.NewAPI(client), nil
}
