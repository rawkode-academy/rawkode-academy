package scaleway

import (
	"context"
	"fmt"
	"strings"

	vpc "github.com/scaleway/scaleway-sdk-go/api/vpc/v2"
	"github.com/scaleway/scaleway-sdk-go/scw"
)

// NetworkFoundationParams describes the desired VPC/private-network baseline.
type NetworkFoundationParams struct {
	Region             scw.Region
	ProjectID          string
	VPCID              string
	VPCName            string
	VPCTags            []string
	PrivateNetworkID   string
	PrivateNetworkName string
	PrivateNetworkTags []string
}

// NetworkFoundation contains the resolved VPC/private-network details.
type NetworkFoundation struct {
	Region             scw.Region
	ProjectID          string
	VPCID              string
	VPCName            string
	PrivateNetworkID   string
	PrivateNetworkName string
}

// EnsureNetworkFoundation creates or reuses a VPC + private network in an idempotent way.
func EnsureNetworkFoundation(ctx context.Context, client *Client, params NetworkFoundationParams) (*NetworkFoundation, error) {
	projectID, err := resolveProjectID(client, params.ProjectID)
	if err != nil {
		return nil, err
	}

	if params.Region == "" {
		if region, ok := client.Core.GetDefaultRegion(); ok && region != "" {
			params.Region = region
		} else {
			return nil, fmt.Errorf("region is required (set SCW_DEFAULT_REGION or client default region)")
		}
	}

	vpcResource, err := ensureVPC(ctx, client, params.Region, projectID, params.VPCID, params.VPCName, params.VPCTags)
	if err != nil {
		return nil, err
	}

	privateNetwork, err := ensurePrivateNetwork(ctx, client, params.Region, projectID, vpcResource.ID, params.PrivateNetworkID, params.PrivateNetworkName, params.PrivateNetworkTags)
	if err != nil {
		return nil, err
	}

	return &NetworkFoundation{
		Region:             params.Region,
		ProjectID:          projectID,
		VPCID:              vpcResource.ID,
		VPCName:            vpcResource.Name,
		PrivateNetworkID:   privateNetwork.ID,
		PrivateNetworkName: privateNetwork.Name,
	}, nil
}

func resolveProjectID(client *Client, explicitProjectID string) (string, error) {
	projectID := strings.TrimSpace(explicitProjectID)
	if projectID != "" {
		return projectID, nil
	}

	defaultProjectID, ok := client.Core.GetDefaultProjectID()
	if !ok || strings.TrimSpace(defaultProjectID) == "" {
		return "", fmt.Errorf("project ID is required (set SCW_DEFAULT_PROJECT_ID)")
	}
	return defaultProjectID, nil
}

func ensureVPC(ctx context.Context, client *Client, region scw.Region, projectID, vpcID, vpcName string, tags []string) (*vpc.VPC, error) {
	if vpcID != "" {
		resource, err := client.VPC.GetVPC(&vpc.GetVPCRequest{
			Region: region,
			VpcID:  vpcID,
		}, scw.WithContext(ctx))
		if err != nil {
			return nil, fmt.Errorf("get vpc %s: %w", vpcID, err)
		}
		if !resource.RoutingEnabled {
			updated, err := client.VPC.EnableRouting(&vpc.EnableRoutingRequest{
				Region: region,
				VpcID:  resource.ID,
			}, scw.WithContext(ctx))
			if err != nil {
				return nil, fmt.Errorf("enable routing on vpc %s: %w", resource.ID, err)
			}
			resource = updated
		}
		return resource, nil
	}

	name := strings.TrimSpace(vpcName)
	if name == "" {
		return nil, fmt.Errorf("vpc name is required when vpc ID is not provided")
	}

	listResp, err := client.VPC.ListVPCs(&vpc.ListVPCsRequest{
		Region:    region,
		ProjectID: &projectID,
		Name:      &name,
	}, scw.WithAllPages(), scw.WithContext(ctx))
	if err != nil {
		return nil, fmt.Errorf("list vpcs: %w", err)
	}

	for _, existing := range listResp.Vpcs {
		if existing == nil || existing.Name != name {
			continue
		}
		if !existing.RoutingEnabled {
			updated, err := client.VPC.EnableRouting(&vpc.EnableRoutingRequest{
				Region: region,
				VpcID:  existing.ID,
			}, scw.WithContext(ctx))
			if err != nil {
				return nil, fmt.Errorf("enable routing on existing vpc %s: %w", existing.ID, err)
			}
			return updated, nil
		}
		return existing, nil
	}

	created, err := client.VPC.CreateVPC(&vpc.CreateVPCRequest{
		Region:        region,
		Name:          name,
		ProjectID:     projectID,
		Tags:          tags,
		EnableRouting: true,
	}, scw.WithContext(ctx))
	if err != nil {
		return nil, fmt.Errorf("create vpc %q: %w", name, err)
	}

	return created, nil
}

func ensurePrivateNetwork(ctx context.Context, client *Client, region scw.Region, projectID, vpcID, privateNetworkID, privateNetworkName string, tags []string) (*vpc.PrivateNetwork, error) {
	if privateNetworkID != "" {
		resource, err := client.VPC.GetPrivateNetwork(&vpc.GetPrivateNetworkRequest{
			Region:           region,
			PrivateNetworkID: privateNetworkID,
		}, scw.WithContext(ctx))
		if err != nil {
			return nil, fmt.Errorf("get private network %s: %w", privateNetworkID, err)
		}
		if resource.VpcID != "" && resource.VpcID != vpcID {
			return nil, fmt.Errorf("private network %s belongs to vpc %s, expected %s", resource.ID, resource.VpcID, vpcID)
		}
		return ensurePrivateNetworkDefaults(ctx, client, region, resource)
	}

	name := strings.TrimSpace(privateNetworkName)
	if name == "" {
		return nil, fmt.Errorf("private network name is required when private network ID is not provided")
	}

	listResp, err := client.VPC.ListPrivateNetworks(&vpc.ListPrivateNetworksRequest{
		Region:    region,
		ProjectID: &projectID,
		VpcID:     &vpcID,
		Name:      &name,
	}, scw.WithAllPages(), scw.WithContext(ctx))
	if err != nil {
		return nil, fmt.Errorf("list private networks: %w", err)
	}

	for _, existing := range listResp.PrivateNetworks {
		if existing == nil || existing.Name != name {
			continue
		}
		return ensurePrivateNetworkDefaults(ctx, client, region, existing)
	}

	created, err := client.VPC.CreatePrivateNetwork(&vpc.CreatePrivateNetworkRequest{
		Region:                         region,
		Name:                           name,
		ProjectID:                      projectID,
		Tags:                           tags,
		VpcID:                          &vpcID,
		DefaultRoutePropagationEnabled: true,
	}, scw.WithContext(ctx))
	if err != nil {
		return nil, fmt.Errorf("create private network %q: %w", name, err)
	}

	return ensurePrivateNetworkDefaults(ctx, client, region, created)
}

func ensurePrivateNetworkDefaults(ctx context.Context, client *Client, region scw.Region, resource *vpc.PrivateNetwork) (*vpc.PrivateNetwork, error) {
	if resource == nil {
		return nil, fmt.Errorf("private network is nil")
	}

	current := resource
	if !current.DefaultRoutePropagationEnabled {
		enablePropagation := true
		updated, err := client.VPC.UpdatePrivateNetwork(&vpc.UpdatePrivateNetworkRequest{
			Region:                         region,
			PrivateNetworkID:               current.ID,
			DefaultRoutePropagationEnabled: &enablePropagation,
		}, scw.WithContext(ctx))
		if err != nil {
			return nil, fmt.Errorf("enable default route propagation on private network %s: %w", current.ID, err)
		}
		current = updated
	}

	if !current.DHCPEnabled {
		updated, err := client.VPC.EnableDHCP(&vpc.EnableDHCPRequest{
			Region:           region,
			PrivateNetworkID: current.ID,
		}, scw.WithContext(ctx))
		if err != nil {
			return nil, fmt.Errorf("enable dhcp on private network %s: %w", current.ID, err)
		}
		current = updated
	}

	return current, nil
}
