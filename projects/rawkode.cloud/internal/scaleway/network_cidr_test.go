package scaleway

import (
	"context"
	"errors"
	"net"
	"reflect"
	"strings"
	"testing"

	ipam "github.com/scaleway/scaleway-sdk-go/api/ipam/v1"
	vpc "github.com/scaleway/scaleway-sdk-go/api/vpc/v2"
	"github.com/scaleway/scaleway-sdk-go/scw"
)

func TestResolvePrivateNetworkIPv4CIDRPrefersCIDRContainingPreferredIP(t *testing.T) {
	originalGet := getPrivateNetworkForCIDRLookup
	originalList := listPrivateNetworkIPAMIPs
	t.Cleanup(func() {
		getPrivateNetworkForCIDRLookup = originalGet
		listPrivateNetworkIPAMIPs = originalList
	})

	getPrivateNetworkForCIDRLookup = func(_ context.Context, _ *Client, _ scw.Region, _ string) (*vpc.PrivateNetwork, error) {
		return &vpc.PrivateNetwork{
			Subnets: []*vpc.Subnet{
				{Subnet: mustIPNet(t, "10.0.0.0/24")},
				{Subnet: mustIPNet(t, "172.16.16.0/22")},
			},
		}, nil
	}
	listPrivateNetworkIPAMIPs = func(_ context.Context, _ *Client, _ scw.Region, _ string) ([]*ipam.IP, error) {
		t.Fatal("ipam lookup should not be used when private network subnets are present")
		return nil, nil
	}

	got, err := ResolvePrivateNetworkIPv4CIDR(context.Background(), &Client{}, scw.RegionFrPar, "pn-123", "172.16.16.16")
	if err != nil {
		t.Fatalf("ResolvePrivateNetworkIPv4CIDR returned error: %v", err)
	}
	if got != "172.16.16.0/22" {
		t.Fatalf("resolved cidr = %q, want %q", got, "172.16.16.0/22")
	}
}

func TestResolvePrivateNetworkIPv4CIDRFailsWhenMultipleCIDRsAndNoPreferredIP(t *testing.T) {
	originalGet := getPrivateNetworkForCIDRLookup
	originalList := listPrivateNetworkIPAMIPs
	t.Cleanup(func() {
		getPrivateNetworkForCIDRLookup = originalGet
		listPrivateNetworkIPAMIPs = originalList
	})

	getPrivateNetworkForCIDRLookup = func(_ context.Context, _ *Client, _ scw.Region, _ string) (*vpc.PrivateNetwork, error) {
		return &vpc.PrivateNetwork{
			Subnets: []*vpc.Subnet{
				{Subnet: mustIPNet(t, "10.0.0.0/24")},
				{Subnet: mustIPNet(t, "172.16.16.0/22")},
			},
		}, nil
	}
	listPrivateNetworkIPAMIPs = func(_ context.Context, _ *Client, _ scw.Region, _ string) ([]*ipam.IP, error) {
		t.Fatal("ipam lookup should not be used when private network subnets are present")
		return nil, nil
	}

	_, err := ResolvePrivateNetworkIPv4CIDR(context.Background(), &Client{}, scw.RegionFrPar, "pn-123", "")
	if err == nil {
		t.Fatal("expected error for ambiguous CIDR discovery without preferred private IP, got nil")
	}
	if !strings.Contains(err.Error(), "multiple IPv4 CIDRs discovered") {
		t.Fatalf("expected multiple-cidr error, got %q", err)
	}
}

func TestResolvePrivateNetworkIPv4CIDRFallsBackToIPAM(t *testing.T) {
	originalGet := getPrivateNetworkForCIDRLookup
	originalList := listPrivateNetworkIPAMIPs
	t.Cleanup(func() {
		getPrivateNetworkForCIDRLookup = originalGet
		listPrivateNetworkIPAMIPs = originalList
	})

	getPrivateNetworkForCIDRLookup = func(_ context.Context, _ *Client, _ scw.Region, _ string) (*vpc.PrivateNetwork, error) {
		return &vpc.PrivateNetwork{}, nil
	}
	listPrivateNetworkIPAMIPs = func(_ context.Context, _ *Client, _ scw.Region, _ string) ([]*ipam.IP, error) {
		return []*ipam.IP{
			{Address: mustIPNet(t, "172.16.16.16/22")},
			{Address: mustIPNet(t, "172.16.16.17/22")},
		}, nil
	}

	got, err := ResolvePrivateNetworkIPv4CIDR(context.Background(), &Client{}, scw.RegionFrPar, "pn-123", "")
	if err != nil {
		t.Fatalf("ResolvePrivateNetworkIPv4CIDR returned error: %v", err)
	}
	if got != "172.16.16.0/22" {
		t.Fatalf("resolved cidr = %q, want %q", got, "172.16.16.0/22")
	}
}

func TestResolvePrivateNetworkIPv4CIDRFailsWhenPreferredIPNotInAnyCIDR(t *testing.T) {
	originalGet := getPrivateNetworkForCIDRLookup
	originalList := listPrivateNetworkIPAMIPs
	t.Cleanup(func() {
		getPrivateNetworkForCIDRLookup = originalGet
		listPrivateNetworkIPAMIPs = originalList
	})

	getPrivateNetworkForCIDRLookup = func(_ context.Context, _ *Client, _ scw.Region, _ string) (*vpc.PrivateNetwork, error) {
		return &vpc.PrivateNetwork{
			Subnets: []*vpc.Subnet{
				{Subnet: mustIPNet(t, "10.0.0.0/24")},
			},
		}, nil
	}
	listPrivateNetworkIPAMIPs = func(_ context.Context, _ *Client, _ scw.Region, _ string) ([]*ipam.IP, error) {
		t.Fatal("ipam lookup should not be used when private network subnets are present")
		return nil, nil
	}

	_, err := ResolvePrivateNetworkIPv4CIDR(context.Background(), &Client{}, scw.RegionFrPar, "pn-123", "172.16.16.16")
	if err == nil {
		t.Fatal("expected error when preferred private IP is outside discovered CIDRs, got nil")
	}
	if !strings.Contains(err.Error(), "no discovered IPv4 CIDR contains preferred private IP") {
		t.Fatalf("expected preferred-ip mismatch error, got %q", err)
	}
}

func TestResolvePrivateNetworkIPv4CIDRWrapsIPAMErrors(t *testing.T) {
	originalGet := getPrivateNetworkForCIDRLookup
	originalList := listPrivateNetworkIPAMIPs
	t.Cleanup(func() {
		getPrivateNetworkForCIDRLookup = originalGet
		listPrivateNetworkIPAMIPs = originalList
	})

	getPrivateNetworkForCIDRLookup = func(_ context.Context, _ *Client, _ scw.Region, _ string) (*vpc.PrivateNetwork, error) {
		return &vpc.PrivateNetwork{}, nil
	}
	listPrivateNetworkIPAMIPs = func(_ context.Context, _ *Client, _ scw.Region, _ string) ([]*ipam.IP, error) {
		return nil, errors.New("transport failed")
	}

	_, err := ResolvePrivateNetworkIPv4CIDR(context.Background(), &Client{}, scw.RegionFrPar, "pn-123", "")
	if err == nil {
		t.Fatal("expected wrapped ipam listing error, got nil")
	}
	if !strings.Contains(err.Error(), "list ipam ips for private network pn-123") {
		t.Fatalf("expected wrapped ipam lookup error, got %q", err)
	}
}

func TestUniqueSorted(t *testing.T) {
	got := uniqueSorted([]string{"172.16.16.0/22", "10.0.0.0/24", "172.16.16.0/22"})
	want := []string{"10.0.0.0/24", "172.16.16.0/22"}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("uniqueSorted() = %v, want %v", got, want)
	}
}

func mustIPNet(t *testing.T, cidr string) scw.IPNet {
	t.Helper()

	_, network, err := net.ParseCIDR(cidr)
	if err != nil {
		t.Fatalf("parse cidr %q: %v", cidr, err)
	}

	return scw.IPNet{IPNet: *network}
}
