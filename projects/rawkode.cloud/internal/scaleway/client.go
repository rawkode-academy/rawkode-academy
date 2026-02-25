package scaleway

import (
	"fmt"
	"strings"

	baremetal "github.com/scaleway/scaleway-sdk-go/api/baremetal/v1"
	baremetalv3 "github.com/scaleway/scaleway-sdk-go/api/baremetal/v3"
	flexibleip "github.com/scaleway/scaleway-sdk-go/api/flexibleip/v1alpha1"
	iam "github.com/scaleway/scaleway-sdk-go/api/iam/v1alpha1"
	ipam "github.com/scaleway/scaleway-sdk-go/api/ipam/v1"
	vpc "github.com/scaleway/scaleway-sdk-go/api/vpc/v2"
	"github.com/scaleway/scaleway-sdk-go/scw"
)

// Client wraps a Scaleway client, providing access to bare metal,
// IAM, IPAM, and VPC APIs from a single set of credentials.
type Client struct {
	Core                      *scw.Client
	Baremetal                 *baremetal.API
	BaremetalPrivateNetwork   *baremetal.PrivateNetworkAPI
	BaremetalPrivateNetworkV3 *baremetalv3.PrivateNetworkAPI
	FlexibleIP                *flexibleip.API
	IAM                       *iam.API
	IPAM                      *ipam.API
	VPC                       *vpc.API
}

// NewClient creates a Scaleway client with access to bare metal and IAM APIs.
func NewClient(accessKey, secretKey, projectID, organizationID string) (*Client, error) {
	accessKey = strings.TrimSpace(accessKey)
	secretKey = strings.TrimSpace(secretKey)
	if accessKey == "" || secretKey == "" {
		return nil, fmt.Errorf("scaleway credentials are required")
	}

	opts := []scw.ClientOption{
		scw.WithAuth(accessKey, secretKey),
	}
	if trimmed := strings.TrimSpace(projectID); trimmed != "" {
		opts = append(opts, scw.WithDefaultProjectID(trimmed))
	}
	if trimmed := strings.TrimSpace(organizationID); trimmed != "" {
		opts = append(opts, scw.WithDefaultOrganizationID(trimmed))
	}

	client, err := scw.NewClient(opts...)
	if err != nil {
		return nil, fmt.Errorf("scaleway client init: %w", err)
	}

	return &Client{
		Core:                      client,
		Baremetal:                 baremetal.NewAPI(client),
		BaremetalPrivateNetwork:   baremetal.NewPrivateNetworkAPI(client),
		BaremetalPrivateNetworkV3: baremetalv3.NewPrivateNetworkAPI(client),
		FlexibleIP:                flexibleip.NewAPI(client),
		IAM:                       iam.NewAPI(client),
		IPAM:                      ipam.NewAPI(client),
		VPC:                       vpc.NewAPI(client),
	}, nil
}
