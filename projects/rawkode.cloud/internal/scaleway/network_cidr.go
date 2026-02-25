package scaleway

import (
	"context"
	"fmt"
	"net"
	"net/netip"
	"sort"
	"strings"

	ipam "github.com/scaleway/scaleway-sdk-go/api/ipam/v1"
	vpc "github.com/scaleway/scaleway-sdk-go/api/vpc/v2"
	"github.com/scaleway/scaleway-sdk-go/scw"
)

var getPrivateNetworkForCIDRLookup = func(ctx context.Context, client *Client, region scw.Region, privateNetworkID string) (*vpc.PrivateNetwork, error) {
	return client.VPC.GetPrivateNetwork(&vpc.GetPrivateNetworkRequest{
		Region:           region,
		PrivateNetworkID: privateNetworkID,
	}, scw.WithContext(ctx))
}

var listPrivateNetworkIPAMIPs = func(ctx context.Context, client *Client, region scw.Region, privateNetworkID string) ([]*ipam.IP, error) {
	resp, err := client.IPAM.ListIPs(&ipam.ListIPsRequest{
		Region:           region,
		PrivateNetworkID: &privateNetworkID,
	}, scw.WithAllPages(), scw.WithContext(ctx))
	if err != nil {
		return nil, err
	}
	return resp.IPs, nil
}

// ResolvePrivateNetworkIPv4CIDR discovers the IPv4 CIDR used for Cilium native routing.
func ResolvePrivateNetworkIPv4CIDR(
	ctx context.Context,
	client *Client,
	region scw.Region,
	privateNetworkID string,
	preferredIP string,
) (string, error) {
	if ctx == nil {
		ctx = context.Background()
	}
	if client == nil {
		return "", fmt.Errorf("scaleway client is required")
	}
	if region == "" {
		return "", fmt.Errorf("region is required")
	}

	privateNetworkID = strings.TrimSpace(privateNetworkID)
	if privateNetworkID == "" {
		return "", fmt.Errorf("private network ID is required")
	}

	privateNetwork, err := getPrivateNetworkForCIDRLookup(ctx, client, region, privateNetworkID)
	if err != nil {
		return "", fmt.Errorf("get private network %s: %w", privateNetworkID, err)
	}

	candidates := ipv4CIDRsFromSubnets(privateNetwork)
	if len(candidates) == 0 {
		candidates, err = ipv4CIDRsFromIPAM(ctx, client, region, privateNetworkID)
		if err != nil {
			return "", err
		}
	}

	cidr, err := selectIPv4NativeRoutingCIDR(candidates, preferredIP)
	if err != nil {
		return "", err
	}
	return cidr, nil
}

func ipv4CIDRsFromSubnets(privateNetwork *vpc.PrivateNetwork) []string {
	if privateNetwork == nil {
		return nil
	}

	cidrs := make([]string, 0, len(privateNetwork.Subnets))
	for _, subnet := range privateNetwork.Subnets {
		if subnet == nil {
			continue
		}
		cidr, ok := normalizeIPv4CIDR(subnet.Subnet)
		if !ok {
			continue
		}
		cidrs = append(cidrs, cidr)
	}

	return uniqueSorted(cidrs)
}

func ipv4CIDRsFromIPAM(ctx context.Context, client *Client, region scw.Region, privateNetworkID string) ([]string, error) {
	ips, err := listPrivateNetworkIPAMIPs(ctx, client, region, privateNetworkID)
	if err != nil {
		return nil, fmt.Errorf("list ipam ips for private network %s: %w", privateNetworkID, err)
	}

	cidrs := make([]string, 0, len(ips))
	for _, ip := range ips {
		if ip == nil {
			continue
		}
		cidr, ok := normalizeIPv4CIDR(ip.Address)
		if !ok {
			continue
		}
		cidrs = append(cidrs, cidr)
	}

	return uniqueSorted(cidrs), nil
}

func normalizeIPv4CIDR(ipNet scw.IPNet) (string, bool) {
	prefix, err := netip.ParsePrefix(ipNet.String())
	if err != nil {
		return "", false
	}
	if !prefix.Addr().Is4() {
		return "", false
	}
	return prefix.Masked().String(), true
}

func selectIPv4NativeRoutingCIDR(candidates []string, preferredIP string) (string, error) {
	candidates = uniqueSorted(candidates)
	if len(candidates) == 0 {
		return "", fmt.Errorf("no IPv4 CIDR discovered for native routing")
	}

	preferredIP = strings.TrimSpace(preferredIP)
	if preferredIP == "" {
		if len(candidates) == 1 {
			return candidates[0], nil
		}
		return "", fmt.Errorf("multiple IPv4 CIDRs discovered (%s) and no preferred private IP provided", strings.Join(candidates, ", "))
	}

	parsedIP := net.ParseIP(preferredIP)
	if parsedIP == nil || parsedIP.To4() == nil {
		return "", fmt.Errorf("preferred private IP %q must be a valid IPv4 address", preferredIP)
	}

	matches := make([]string, 0, len(candidates))
	for _, candidate := range candidates {
		_, network, err := net.ParseCIDR(candidate)
		if err != nil {
			continue
		}
		if network.Contains(parsedIP) {
			matches = append(matches, candidate)
		}
	}

	switch len(matches) {
	case 0:
		return "", fmt.Errorf(
			"no discovered IPv4 CIDR contains preferred private IP %s (candidates: %s)",
			preferredIP,
			strings.Join(candidates, ", "),
		)
	case 1:
		return matches[0], nil
	default:
		sort.Strings(matches)
		return "", fmt.Errorf(
			"multiple discovered IPv4 CIDRs contain preferred private IP %s (%s)",
			preferredIP,
			strings.Join(matches, ", "),
		)
	}
}

func uniqueSorted(values []string) []string {
	if len(values) == 0 {
		return nil
	}

	unique := make(map[string]struct{}, len(values))
	for _, value := range values {
		trimmed := strings.TrimSpace(value)
		if trimmed == "" {
			continue
		}
		unique[trimmed] = struct{}{}
	}

	out := make([]string, 0, len(unique))
	for value := range unique {
		out = append(out, value)
	}
	sort.Strings(out)
	return out
}
