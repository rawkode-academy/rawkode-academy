package scaleway

import (
	"context"
	"fmt"
	"io"
	"log/slog"
	"math/rand"
	"net"
	"net/http"
	"strings"
	"time"

	baremetal "github.com/scaleway/scaleway-sdk-go/api/baremetal/v1"
	iam "github.com/scaleway/scaleway-sdk-go/api/iam/v1alpha1"
	ipam "github.com/scaleway/scaleway-sdk-go/api/ipam/v1"
	"github.com/scaleway/scaleway-sdk-go/scw"
)

const defaultGitHubSSHKeyUser = "rawkode"

var githubKeysFetcher = fetchGitHubUserPublicKeys

// ProvisionParams holds all parameters for creating a server with OS install.
type ProvisionParams struct {
	OfferID                  string
	Zone                     scw.Zone
	OSID                     string
	PrivateNetworkID         string
	BillingCycle             string
	CloudInitScript          string // Talos pivot cloud-init script
	SSHKeyGitHubUser         string
	PivotOSDisk              string
	PivotDataDisk            string
	PrivateNetworkReservedIP string
}

// OrderServer creates a new bare metal server with Scaleway and triggers OS
// installation with a Talos pivot cloud-init script.
func OrderServer(ctx context.Context, client *Client, params ProvisionParams) (*baremetal.Server, error) {
	sshKeyIDs, err := listSSHKeyIDs(client.IAM)
	if err != nil {
		return nil, fmt.Errorf("list SSH keys: %w", err)
	}

	cloudInitBytes := []byte(params.CloudInitScript)

	effectiveOfferID, effectiveSubscriptionPeriod, err := resolveOfferForBillingCycle(ctx, client, params.Zone, params.OfferID, params.BillingCycle)
	if err != nil {
		return nil, fmt.Errorf("resolve offer for billing cycle: %w", err)
	}

	osInfo, err := client.Baremetal.GetOS(&baremetal.GetOSRequest{
		Zone: params.Zone,
		OsID: params.OSID,
	}, scw.WithContext(ctx))
	if err != nil {
		return nil, fmt.Errorf("get OS %s: %w", params.OSID, err)
	}
	if !osInfo.CustomPartitioningSupported {
		return nil, fmt.Errorf("OS %s (%s) does not support custom partitioning", osInfo.Name, osInfo.ID)
	}

	partitioningSchema, err := buildInstallPartitioningSchema(params)
	if err != nil {
		return nil, fmt.Errorf("build install partitioning schema: %w", err)
	}

	suffix := rand.Intn(99999) //nolint:gosec
	serverName := fmt.Sprintf("rawkode-%s-%05d", time.Now().Format("20060102-150405"), suffix)

	server, err := client.Baremetal.CreateServer(&baremetal.CreateServerRequest{
		Zone:    params.Zone,
		OfferID: effectiveOfferID,
		Name:    serverName,
		Description: "Provisioned by rawkode-cloud3 CLI (Talos)",
		Install: &baremetal.CreateServerRequestInstall{
			OsID:               params.OSID,
			Hostname:           "talos-pivot",
			SSHKeyIDs:          sshKeyIDs,
			PartitioningSchema: partitioningSchema,
		},
		UserData: &cloudInitBytes,
	})
	if err != nil {
		return nil, fmt.Errorf("create server: %w", err)
	}

	slog.Info("server ordered with OS install",
		"server_id", server.ID,
		"offer", effectiveOfferID,
		"billing_cycle", effectiveSubscriptionPeriod,
		"os", params.OSID,
		"zone", params.Zone,
	)

	if params.PrivateNetworkID != "" {
		if strings.TrimSpace(params.PrivateNetworkReservedIP) != "" {
			_, err = addServerPrivateNetworkWithReservedIP(ctx, client, params.Zone, server.ID, params.PrivateNetworkID, params.PrivateNetworkReservedIP)
		} else {
			_, err = client.BaremetalPrivateNetwork.AddServerPrivateNetwork(&baremetal.PrivateNetworkAPIAddServerPrivateNetworkRequest{
				Zone:             params.Zone,
				ServerID:         server.ID,
				PrivateNetworkID: params.PrivateNetworkID,
			}, scw.WithContext(ctx))
		}
		if err != nil {
			return nil, fmt.Errorf("attach server to private network: %w", err)
		}
		slog.Info("server attached to private network", "server_id", server.ID, "private_network_id", params.PrivateNetworkID)
	}

	return server, nil
}

// WaitForReady polls Scaleway until the server reaches a terminal state.
func WaitForReady(ctx context.Context, client *Client, serverID string, zone scw.Zone) (*baremetal.Server, error) {
	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()

	timeout := time.After(45 * time.Minute)

	for {
		select {
		case <-ctx.Done():
			return nil, ctx.Err()
		case <-timeout:
			return nil, fmt.Errorf("server %s did not become ready within 45 minutes", serverID)
		case <-ticker.C:
			server, err := client.Baremetal.GetServer(&baremetal.GetServerRequest{
				Zone:     zone,
				ServerID: serverID,
			})
			if err != nil {
				slog.Warn("poll failed, retrying", "error", err)
				continue
			}

			slog.Info("server status", "status", server.Status, "server_id", serverID)

			switch server.Status {
			case baremetal.ServerStatusReady:
				return server, nil
			case baremetal.ServerStatusError:
				return nil, fmt.Errorf("server entered error state: %s", serverID)
			case baremetal.ServerStatusLocked:
				return nil, fmt.Errorf("server is locked (billing issue?): %s", serverID)
			default:
				continue
			}
		}
	}
}

func buildInstallPartitioningSchema(params ProvisionParams) (*baremetal.Schema, error) {
	osDisk := strings.TrimSpace(params.PivotOSDisk)
	if osDisk == "" {
		return nil, fmt.Errorf("pivot_os_disk is required for custom partitioning")
	}

	dataDisk := strings.TrimSpace(params.PivotDataDisk)
	if dataDisk == osDisk {
		return nil, fmt.Errorf("pivot_data_disk must differ from pivot_os_disk")
	}

	const (
		uefiSizeBytes = 512 * 1024 * 1024
		swapSizeBytes = 4 * 1024 * 1024 * 1024
		bootSizeBytes = 512 * 1024 * 1024
		rootSizeBytes = 1018839433216
	)

	disks := []*baremetal.SchemaDisk{
		{
			Device: osDisk,
			Partitions: []*baremetal.SchemaPartition{
				{Label: baremetal.SchemaPartitionLabelUefi, Number: 1, Size: scw.Size(uefiSizeBytes)},
				{Label: baremetal.SchemaPartitionLabelSwap, Number: 2, Size: scw.Size(swapSizeBytes)},
				{Label: baremetal.SchemaPartitionLabelBoot, Number: 3, Size: scw.Size(bootSizeBytes)},
				{Label: baremetal.SchemaPartitionLabelRoot, Number: 4, Size: scw.Size(rootSizeBytes)},
			},
		},
	}

	filesystems := []*baremetal.SchemaFilesystem{
		{Device: partitionDeviceForInstall(osDisk, 1), Format: baremetal.SchemaFilesystemFormatFat32, Mountpoint: "/boot/efi"},
		{Device: partitionDeviceForInstall(osDisk, 3), Format: baremetal.SchemaFilesystemFormatExt4, Mountpoint: "/boot"},
		{Device: partitionDeviceForInstall(osDisk, 4), Format: baremetal.SchemaFilesystemFormatExt4, Mountpoint: "/"},
	}

	if dataDisk != "" {
		disks = append(disks, &baremetal.SchemaDisk{
			Device: dataDisk,
			Partitions: []*baremetal.SchemaPartition{
				{Label: baremetal.SchemaPartitionLabelData, Number: 1, Size: scw.Size(rootSizeBytes)},
			},
		})
	}

	return &baremetal.Schema{
		Disks:       disks,
		Filesystems: filesystems,
		Raids:       []*baremetal.SchemaRAID{},
		Zfs: &baremetal.SchemaZFS{
			Pools: []*baremetal.SchemaPool{},
		},
	}, nil
}

func partitionDeviceForInstall(disk string, number uint32) string {
	if strings.HasPrefix(disk, "/dev/nvme") || strings.HasPrefix(disk, "/dev/mmcblk") {
		return fmt.Sprintf("%sp%d", disk, number)
	}
	return fmt.Sprintf("%s%d", disk, number)
}

func resolveOfferForBillingCycle(ctx context.Context, client *Client, zone scw.Zone, offerID, billingCycle string) (string, baremetal.OfferSubscriptionPeriod, error) {
	offerID = strings.TrimSpace(offerID)
	if offerID == "" {
		return "", baremetal.OfferSubscriptionPeriodUnknownSubscriptionPeriod, fmt.Errorf("offer ID/name is required")
	}

	cycle := strings.TrimSpace(strings.ToLower(billingCycle))
	if cycle == "" {
		cycle = "hourly"
	}

	if !isLikelyUUID(offerID) {
		var period baremetal.OfferSubscriptionPeriod
		switch cycle {
		case "hourly":
			period = baremetal.OfferSubscriptionPeriodHourly
		case "monthly":
			period = baremetal.OfferSubscriptionPeriodMonthly
		default:
			return "", baremetal.OfferSubscriptionPeriodUnknownSubscriptionPeriod, fmt.Errorf("invalid billing cycle %q", billingCycle)
		}
		resolvedID, err := resolveOfferIDFromNameByPeriod(ctx, client, zone, offerID, period)
		if err != nil {
			return "", baremetal.OfferSubscriptionPeriodUnknownSubscriptionPeriod, err
		}
		return resolvedID, period, nil
	}

	offer, err := client.Baremetal.GetOffer(&baremetal.GetOfferRequest{
		Zone:    zone,
		OfferID: offerID,
	}, scw.WithContext(ctx))
	if err != nil {
		return "", baremetal.OfferSubscriptionPeriodUnknownSubscriptionPeriod, fmt.Errorf("get offer %s: %w", offerID, err)
	}

	switch cycle {
	case "hourly":
		if offer.SubscriptionPeriod == baremetal.OfferSubscriptionPeriodHourly {
			return offer.ID, offer.SubscriptionPeriod, nil
		}
		hourlyOfferID, err := resolveOfferIDByNameAndPeriod(ctx, client, zone, offer, baremetal.OfferSubscriptionPeriodHourly)
		if err != nil {
			return "", baremetal.OfferSubscriptionPeriodUnknownSubscriptionPeriod, err
		}
		return hourlyOfferID, baremetal.OfferSubscriptionPeriodHourly, nil
	case "monthly":
		if offer.SubscriptionPeriod == baremetal.OfferSubscriptionPeriodMonthly {
			return offer.ID, offer.SubscriptionPeriod, nil
		}
		if offer.MonthlyOfferID != nil && *offer.MonthlyOfferID != "" {
			return *offer.MonthlyOfferID, baremetal.OfferSubscriptionPeriodMonthly, nil
		}
		monthlyOfferID, err := resolveOfferIDByNameAndPeriod(ctx, client, zone, offer, baremetal.OfferSubscriptionPeriodMonthly)
		if err != nil {
			return "", baremetal.OfferSubscriptionPeriodUnknownSubscriptionPeriod, err
		}
		return monthlyOfferID, baremetal.OfferSubscriptionPeriodMonthly, nil
	default:
		return "", baremetal.OfferSubscriptionPeriodUnknownSubscriptionPeriod, fmt.Errorf("invalid billing cycle %q", billingCycle)
	}
}

func resolveOfferIDFromNameByPeriod(ctx context.Context, client *Client, zone scw.Zone, offerName string, period baremetal.OfferSubscriptionPeriod) (string, error) {
	trimmedName := strings.TrimSpace(offerName)
	resp, err := client.Baremetal.ListOffers(&baremetal.ListOffersRequest{
		Zone:               zone,
		SubscriptionPeriod: period,
		Name:               &trimmedName,
	}, scw.WithAllPages(), scw.WithContext(ctx))
	if err != nil {
		return "", fmt.Errorf("list offers for %q (%s): %w", offerName, period, err)
	}

	if len(resp.Offers) == 0 {
		return "", fmt.Errorf("no %s offer found matching %q", period, offerName)
	}

	normalizedQuery := normalizeOfferName(offerName)
	for _, offer := range resp.Offers {
		if offer == nil || offer.ID == "" {
			continue
		}
		if strings.EqualFold(offer.Name, trimmedName) {
			return offer.ID, nil
		}
	}
	for _, offer := range resp.Offers {
		if offer == nil || offer.ID == "" {
			continue
		}
		if normalizeOfferName(offer.Name) == normalizedQuery {
			return offer.ID, nil
		}
	}
	for _, offer := range resp.Offers {
		if offer == nil || offer.ID == "" {
			continue
		}
		return offer.ID, nil
	}

	return "", fmt.Errorf("no usable %s offer found for %q", period, offerName)
}

func resolveOfferIDByNameAndPeriod(ctx context.Context, client *Client, zone scw.Zone, baseOffer *baremetal.Offer, period baremetal.OfferSubscriptionPeriod) (string, error) {
	if baseOffer == nil {
		return "", fmt.Errorf("base offer is nil")
	}

	name := baseOffer.Name
	resp, err := client.Baremetal.ListOffers(&baremetal.ListOffersRequest{
		Zone:               zone,
		SubscriptionPeriod: period,
		Name:               &name,
	}, scw.WithAllPages(), scw.WithContext(ctx))
	if err != nil {
		return "", fmt.Errorf("list %s offers for %q: %w", period, baseOffer.Name, err)
	}

	for _, candidate := range resp.Offers {
		if candidate == nil || candidate.ID == "" || candidate.ID == baseOffer.ID {
			continue
		}
		if candidate.Name == baseOffer.Name {
			return candidate.ID, nil
		}
	}
	for _, candidate := range resp.Offers {
		if candidate == nil || candidate.ID == "" || candidate.ID == baseOffer.ID {
			continue
		}
		return candidate.ID, nil
	}

	return "", fmt.Errorf("could not find %s variant for offer %q (%s)", period, baseOffer.Name, baseOffer.ID)
}

func isLikelyUUID(value string) bool {
	if len(value) != 36 {
		return false
	}
	for i, ch := range value {
		switch i {
		case 8, 13, 18, 23:
			if ch != '-' {
				return false
			}
		default:
			if (ch < '0' || ch > '9') && (ch < 'a' || ch > 'f') && (ch < 'A' || ch > 'F') {
				return false
			}
		}
	}
	return true
}

func normalizeOfferName(value string) string {
	trimmed := strings.TrimSpace(strings.ToLower(value))
	var b strings.Builder
	b.Grow(len(trimmed))
	for _, ch := range trimmed {
		if (ch >= 'a' && ch <= 'z') || (ch >= '0' && ch <= '9') {
			b.WriteRune(ch)
		}
	}
	return b.String()
}

func listSSHKeyIDs(iamAPI *iam.API) ([]string, error) {
	resp, err := iamAPI.ListSSHKeys(&iam.ListSSHKeysRequest{})
	if err != nil {
		return nil, fmt.Errorf("list ssh keys: %w", err)
	}
	if len(resp.SSHKeys) == 0 {
		return nil, fmt.Errorf("no SSH keys found in Scaleway org")
	}
	ids := make([]string, len(resp.SSHKeys))
	for i, key := range resp.SSHKeys {
		ids[i] = key.ID
	}
	return ids, nil
}

type addServerPrivateNetworkRequest struct {
	PrivateNetworkID string   `json:"private_network_id"`
	IPAMIPIDs        []string `json:"ipam_ip_ids,omitempty"`
}

func addServerPrivateNetworkWithReservedIP(ctx context.Context, client *Client, zone scw.Zone, serverID, privateNetworkID, reservedIP string) (*baremetal.ServerPrivateNetwork, error) {
	reservedIP = strings.TrimSpace(reservedIP)
	if reservedIP == "" {
		return nil, fmt.Errorf("reserved private IP cannot be empty")
	}
	if parsed := net.ParseIP(reservedIP); parsed == nil || parsed.To4() == nil {
		return nil, fmt.Errorf("reserved private IP must be a valid IPv4 address, got %q", reservedIP)
	}

	region, err := zone.Region()
	if err != nil {
		return nil, fmt.Errorf("derive region from zone %q: %w", zone, err)
	}

	reservedIPID, err := findPrivateNetworkIPIDByAddress(ctx, client.IPAM, region, privateNetworkID, reservedIP)
	if err != nil {
		return nil, err
	}

	req := &addServerPrivateNetworkRequest{
		PrivateNetworkID: privateNetworkID,
		IPAMIPIDs:        []string{reservedIPID},
	}

	scwReq := &scw.ScalewayRequest{
		Method: "POST",
		Path:   "/baremetal/v1/zones/" + fmt.Sprint(zone) + "/servers/" + fmt.Sprint(serverID) + "/private-networks",
	}
	if err := scwReq.SetBody(req); err != nil {
		return nil, fmt.Errorf("encode private network attach payload: %w", err)
	}

	var resp baremetal.ServerPrivateNetwork
	if err := client.Core.Do(scwReq, &resp, scw.WithContext(ctx)); err != nil {
		return nil, err
	}

	return &resp, nil
}

func findPrivateNetworkIPIDByAddress(ctx context.Context, ipamAPI *ipam.API, region scw.Region, privateNetworkID, targetIPv4 string) (string, error) {
	resp, err := ipamAPI.ListIPs(&ipam.ListIPsRequest{
		Region:           region,
		PrivateNetworkID: &privateNetworkID,
	}, scw.WithAllPages(), scw.WithContext(ctx))
	if err != nil {
		return "", fmt.Errorf("list ipam ips for private network %s: %w", privateNetworkID, err)
	}

	for _, candidate := range resp.IPs {
		if candidate == nil || candidate.Address.IP == nil || candidate.Address.IP.To4() == nil {
			continue
		}
		if candidate.Address.IP.String() != targetIPv4 {
			continue
		}
		if candidate.Resource != nil && candidate.Resource.ID != "" {
			return "", fmt.Errorf("reserved ip %s (%s) is already attached to resource %s (%s)", targetIPv4, candidate.ID, candidate.Resource.ID, candidate.Resource.Type)
		}
		return candidate.ID, nil
	}

	return "", fmt.Errorf("reserved ip %s was not found in private network %s", targetIPv4, privateNetworkID)
}

func fetchGitHubUserPublicKeys(ctx context.Context, username string) ([]string, error) {
	url := fmt.Sprintf("https://github.com/%s.keys", username)
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, fmt.Errorf("build github keys request: %w", err)
	}

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("fetch github keys: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("fetch github keys: unexpected status %s", resp.Status)
	}

	body, err := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	if err != nil {
		return nil, fmt.Errorf("read github keys response: %w", err)
	}

	lines := strings.Split(string(body), "\n")
	var keys []string
	for _, line := range lines {
		trimmed := strings.TrimSpace(line)
		if trimmed != "" && (strings.HasPrefix(trimmed, "ssh-") || strings.HasPrefix(trimmed, "ecdsa-") || strings.HasPrefix(trimmed, "sk-")) {
			keys = append(keys, trimmed)
		}
	}

	if len(keys) == 0 {
		return nil, fmt.Errorf("no SSH public keys found for %s", username)
	}

	return keys, nil
}
