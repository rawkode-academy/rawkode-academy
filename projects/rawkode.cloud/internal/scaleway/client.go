package scaleway

import (
	"fmt"

	baremetal "github.com/scaleway/scaleway-sdk-go/api/baremetal/v1"
	iam "github.com/scaleway/scaleway-sdk-go/api/iam/v1alpha1"
	ipam "github.com/scaleway/scaleway-sdk-go/api/ipam/v1"
	vpc "github.com/scaleway/scaleway-sdk-go/api/vpc/v2"
	"github.com/scaleway/scaleway-sdk-go/scw"
)

// Client wraps a Scaleway client, providing access to bare metal,
// IAM, IPAM, and VPC APIs from a single set of credentials.
type Client struct {
	Core                    *scw.Client
	Baremetal               *baremetal.API
	BaremetalPrivateNetwork *baremetal.PrivateNetworkAPI
	IAM                     *iam.API
	IPAM                    *ipam.API
	VPC                     *vpc.API
}

// NewClient creates a Scaleway client with access to bare metal and IAM APIs.
// If accessKey and secretKey are provided, they are used directly.
// Otherwise, falls back to environment variables (SCW_ACCESS_KEY, SCW_SECRET_KEY).
func NewClient(accessKey, secretKey string) (*Client, error) {
	opts := []scw.ClientOption{
		scw.WithEnv(),
	}

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
		Core:                    client,
		Baremetal:               baremetal.NewAPI(client),
		BaremetalPrivateNetwork: baremetal.NewPrivateNetworkAPI(client),
		IAM:                     iam.NewAPI(client),
		IPAM:                    ipam.NewAPI(client),
		VPC:                     vpc.NewAPI(client),
	}, nil
}
