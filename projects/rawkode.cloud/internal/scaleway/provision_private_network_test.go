package scaleway

import (
	"context"
	"errors"
	"reflect"
	"strings"
	"testing"

	baremetal "github.com/scaleway/scaleway-sdk-go/api/baremetal/v1"
	baremetalv3 "github.com/scaleway/scaleway-sdk-go/api/baremetal/v3"
	ipam "github.com/scaleway/scaleway-sdk-go/api/ipam/v1"
	"github.com/scaleway/scaleway-sdk-go/scw"
)

func TestPrivateNetworkOptionIDsForOffer(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name         string
		offer        *baremetal.Offer
		period       baremetal.OfferSubscriptionPeriod
		wantIDs      []string
		wantIncluded bool
		wantErr      string
	}{
		{
			name: "enabled by default",
			offer: &baremetal.Offer{
				ID:   "offer-1",
				Name: "EM-A",
				Options: []*baremetal.OfferOptionOffer{
					{
						ID:                 "opt-private",
						Enabled:            true,
						Manageable:         true,
						SubscriptionPeriod: baremetal.OfferSubscriptionPeriodHourly,
						PrivateNetwork:     &baremetal.PrivateNetworkOption{BandwidthInBps: 1_000_000_000},
					},
				},
			},
			period:       baremetal.OfferSubscriptionPeriodHourly,
			wantIncluded: true,
		},
		{
			name: "option enabled during create",
			offer: &baremetal.Offer{
				ID:   "offer-2",
				Name: "EM-B",
				Options: []*baremetal.OfferOptionOffer{
					{
						ID:                 "opt-private",
						Enabled:            false,
						Manageable:         true,
						SubscriptionPeriod: baremetal.OfferSubscriptionPeriodHourly,
						PrivateNetwork:     &baremetal.PrivateNetworkOption{BandwidthInBps: 1_000_000_000},
					},
				},
			},
			period:  baremetal.OfferSubscriptionPeriodHourly,
			wantIDs: []string{"opt-private"},
		},
		{
			name: "missing private-network option",
			offer: &baremetal.Offer{
				ID:   "offer-3",
				Name: "EM-C",
				Options: []*baremetal.OfferOptionOffer{
					{
						ID:              "opt-public",
						Enabled:         false,
						Manageable:      true,
						PublicBandwidth: &baremetal.PublicBandwidthOption{BandwidthInBps: 1_000_000_000},
					},
				},
			},
			period:  baremetal.OfferSubscriptionPeriodHourly,
			wantErr: "does not expose a private-network option",
		},
		{
			name: "no manageable private-network option",
			offer: &baremetal.Offer{
				ID:   "offer-4",
				Name: "EM-D",
				Options: []*baremetal.OfferOptionOffer{
					{
						ID:                 "opt-private",
						Enabled:            false,
						Manageable:         false,
						SubscriptionPeriod: baremetal.OfferSubscriptionPeriodHourly,
						PrivateNetwork:     &baremetal.PrivateNetworkOption{BandwidthInBps: 1_000_000_000},
					},
				},
			},
			period:  baremetal.OfferSubscriptionPeriodHourly,
			wantErr: "has no manageable private-network option to enable",
		},
		{
			name: "unknown period accepts option",
			offer: &baremetal.Offer{
				ID:   "offer-5",
				Name: "EM-E",
				Options: []*baremetal.OfferOptionOffer{
					{
						ID:                 "opt-private",
						Enabled:            false,
						Manageable:         true,
						SubscriptionPeriod: baremetal.OfferSubscriptionPeriodMonthly,
						PrivateNetwork:     &baremetal.PrivateNetworkOption{BandwidthInBps: 1_000_000_000},
					},
				},
			},
			period:  baremetal.OfferSubscriptionPeriodUnknownSubscriptionPeriod,
			wantIDs: []string{"opt-private"},
		},
	}

	for _, tt := range tests {
		tt := tt
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			gotIDs, gotIncluded, err := privateNetworkOptionIDsForOffer(tt.offer, tt.period)
			if tt.wantErr != "" {
				if err == nil {
					t.Fatalf("expected error containing %q, got nil", tt.wantErr)
				}
				if !strings.Contains(err.Error(), tt.wantErr) {
					t.Fatalf("expected error containing %q, got %q", tt.wantErr, err.Error())
				}
				return
			}
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if gotIncluded != tt.wantIncluded {
				t.Fatalf("expected included=%t, got %t", tt.wantIncluded, gotIncluded)
			}
			if !reflect.DeepEqual(gotIDs, tt.wantIDs) {
				t.Fatalf("expected option IDs %v, got %v", tt.wantIDs, gotIDs)
			}
		})
	}
}

func TestAddServerPrivateNetworkWithReservedIPUsesV3IPAMIDs(t *testing.T) {
	originalLookup := privateNetworkIPIDLookup
	originalAdd := addServerPrivateNetworkWithIPAMIDs
	t.Cleanup(func() {
		privateNetworkIPIDLookup = originalLookup
		addServerPrivateNetworkWithIPAMIDs = originalAdd
	})

	var (
		gotRegion           scw.Region
		gotPrivateNetworkID string
		gotTargetIPv4       string
		gotRequest          *baremetalv3.PrivateNetworkAPIAddServerPrivateNetworkRequest
	)

	privateNetworkIPIDLookup = func(_ context.Context, _ *ipam.API, region scw.Region, privateNetworkID, targetIPv4 string) (string, error) {
		gotRegion = region
		gotPrivateNetworkID = privateNetworkID
		gotTargetIPv4 = targetIPv4
		return "ipam-ip-id-1", nil
	}

	addServerPrivateNetworkWithIPAMIDs = func(_ context.Context, _ *Client, req *baremetalv3.PrivateNetworkAPIAddServerPrivateNetworkRequest) (*baremetalv3.ServerPrivateNetwork, error) {
		gotRequest = req
		return &baremetalv3.ServerPrivateNetwork{}, nil
	}

	err := addServerPrivateNetworkWithReservedIP(
		context.Background(),
		&Client{},
		scw.ZoneFrPar1,
		"server-123",
		"pn-123",
		"172.16.16.16",
	)
	if err != nil {
		t.Fatalf("addServerPrivateNetworkWithReservedIP returned error: %v", err)
	}

	if gotRegion != scw.RegionFrPar {
		t.Fatalf("lookup region = %q, want %q", gotRegion, scw.RegionFrPar)
	}
	if gotPrivateNetworkID != "pn-123" {
		t.Fatalf("lookup private network id = %q, want %q", gotPrivateNetworkID, "pn-123")
	}
	if gotTargetIPv4 != "172.16.16.16" {
		t.Fatalf("lookup target IPv4 = %q, want %q", gotTargetIPv4, "172.16.16.16")
	}
	if gotRequest == nil {
		t.Fatal("expected v3 add private network request to be sent, got nil")
	}
	if gotRequest.Zone != scw.ZoneFrPar1 {
		t.Fatalf("request zone = %q, want %q", gotRequest.Zone, scw.ZoneFrPar1)
	}
	if gotRequest.ServerID != "server-123" {
		t.Fatalf("request server id = %q, want %q", gotRequest.ServerID, "server-123")
	}
	if gotRequest.PrivateNetworkID != "pn-123" {
		t.Fatalf("request private network id = %q, want %q", gotRequest.PrivateNetworkID, "pn-123")
	}
	if !reflect.DeepEqual(gotRequest.IpamIPIDs, []string{"ipam-ip-id-1"}) {
		t.Fatalf("request ipam ids = %v, want %v", gotRequest.IpamIPIDs, []string{"ipam-ip-id-1"})
	}
}

func TestAddServerPrivateNetworkWithReservedIPRejectsCIDRNotation(t *testing.T) {
	err := addServerPrivateNetworkWithReservedIP(
		context.Background(),
		&Client{},
		scw.ZoneFrPar1,
		"server-123",
		"pn-123",
		"172.16.16.6/22",
	)
	if err == nil {
		t.Fatal("expected error for CIDR notation reserved IP, got nil")
	}
	if !strings.Contains(err.Error(), "must be a valid IPv4 address") {
		t.Fatalf("expected IPv4 validation error, got %q", err)
	}
}

func TestAddServerPrivateNetworkWithReservedIPWrapsV3AttachErrors(t *testing.T) {
	originalLookup := privateNetworkIPIDLookup
	originalAdd := addServerPrivateNetworkWithIPAMIDs
	t.Cleanup(func() {
		privateNetworkIPIDLookup = originalLookup
		addServerPrivateNetworkWithIPAMIDs = originalAdd
	})

	privateNetworkIPIDLookup = func(_ context.Context, _ *ipam.API, _ scw.Region, _, _ string) (string, error) {
		return "ipam-ip-id-1", nil
	}
	addServerPrivateNetworkWithIPAMIDs = func(_ context.Context, _ *Client, _ *baremetalv3.PrivateNetworkAPIAddServerPrivateNetworkRequest) (*baremetalv3.ServerPrivateNetwork, error) {
		return nil, errors.New("transport failed")
	}

	err := addServerPrivateNetworkWithReservedIP(
		context.Background(),
		&Client{},
		scw.ZoneFrPar1,
		"server-123",
		"pn-123",
		"172.16.16.16",
	)
	if err == nil {
		t.Fatal("expected wrapped v3 attach error, got nil")
	}
	if !strings.Contains(err.Error(), "attach reserved private IP 172.16.16.16 via baremetal v3") {
		t.Fatalf("expected wrapped attach error, got %q", err)
	}
}
