package scaleway

import (
	"fmt"

	baremetal "github.com/scaleway/scaleway-sdk-go/api/baremetal/v1"
	iam "github.com/scaleway/scaleway-sdk-go/api/iam/v1alpha1"
	"github.com/scaleway/scaleway-sdk-go/scw"
)

// Client wraps a Scaleway client, providing access to both the bare metal
// and IAM APIs from a single set of credentials.
type Client struct {
	Baremetal *baremetal.API
	IAM       *iam.API
}

// NewClient creates a Scaleway client with access to bare metal and IAM APIs.
// If accessKey and secretKey are provided, they are used directly.
// Otherwise, falls back to environment variables (SCW_ACCESS_KEY, SCW_SECRET_KEY).
func NewClient(accessKey, secretKey string) (*Client, error) {
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

	return &Client{
		Baremetal: baremetal.NewAPI(client),
		IAM:       iam.NewAPI(client),
	}, nil
}
