package scaleway

import (
	"context"
	"fmt"
	"strings"

	baremetal "github.com/scaleway/scaleway-sdk-go/api/baremetal/v1"
	"github.com/scaleway/scaleway-sdk-go/scw"
)

// ResolveOfferForBillingCycle resolves an offer reference (name or UUID)
// to the exact offer UUID for the requested billing cycle.
func ResolveOfferForBillingCycle(ctx context.Context, client *Client, zone scw.Zone, offerRef, billingCycle string) (string, baremetal.OfferSubscriptionPeriod, error) {
	return resolveOfferForBillingCycle(ctx, client, zone, offerRef, billingCycle)
}

// ResolveUbuntuOSID resolves the best Ubuntu OS ID compatible with an offer.
func ResolveUbuntuOSID(ctx context.Context, client *Client, zone scw.Zone, offerID string) (string, error) {
	offerID = strings.TrimSpace(offerID)
	if offerID == "" {
		return "", fmt.Errorf("offer ID is required to resolve Ubuntu OS")
	}

	resp, err := client.Baremetal.ListOS(&baremetal.ListOSRequest{
		Zone:    zone,
		OfferID: &offerID,
	}, scw.WithAllPages(), scw.WithContext(ctx))
	if err != nil {
		return "", fmt.Errorf("list OS for offer %s: %w", offerID, err)
	}

	var bestOS *baremetal.OS
	bestScore := -1
	for _, osImage := range resp.Os {
		if osImage == nil || !osImage.Enabled {
			continue
		}
		if !isUbuntuOS(osImage) {
			continue
		}

		score := scoreUbuntuOS(osImage)
		if score > bestScore {
			bestScore = score
			bestOS = osImage
		}
	}

	if bestOS == nil {
		return "", fmt.Errorf("no enabled Ubuntu OS found for offer %s", offerID)
	}

	return bestOS.ID, nil
}

func isUbuntuOS(osImage *baremetal.OS) bool {
	text := strings.ToLower(osImage.Name + " " + osImage.Version)
	return strings.Contains(text, "ubuntu")
}

func scoreUbuntuOS(osImage *baremetal.OS) int {
	text := strings.ToLower(osImage.Name + " " + osImage.Version)
	score := 100

	if osImage.CloudInitSupported {
		score += 20
	}
	if strings.Contains(text, "24.04") || strings.Contains(text, "noble") {
		score += 40
	} else if strings.Contains(text, "22.04") || strings.Contains(text, "jammy") {
		score += 30
	} else if strings.Contains(text, "20.04") || strings.Contains(text, "focal") {
		score += 20
	}
	if strings.Contains(text, "lts") {
		score += 5
	}

	return score
}
