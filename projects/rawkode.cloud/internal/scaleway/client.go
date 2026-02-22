package scaleway

import (
	"fmt"

	baremetal "github.com/scaleway/scaleway-sdk-go/api/baremetal/v1"
	"github.com/scaleway/scaleway-sdk-go/scw"
)

// NewClient creates a Scaleway bare metal API client from environment variables.
// Reads SCW_ACCESS_KEY, SCW_SECRET_KEY, and SCW_DEFAULT_ZONE from the environment.
// Credentials never appear in code, config files, or CLI flags.
func NewClient() (*baremetal.API, error) {
	client, err := scw.NewClient(
		scw.WithEnv(),
	)
	if err != nil {
		return nil, fmt.Errorf("scaleway client init: %w", err)
	}
	return baremetal.NewAPI(client), nil
}
