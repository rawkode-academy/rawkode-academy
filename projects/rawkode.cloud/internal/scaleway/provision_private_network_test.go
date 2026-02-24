package scaleway

import (
	"reflect"
	"strings"
	"testing"

	baremetal "github.com/scaleway/scaleway-sdk-go/api/baremetal/v1"
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
