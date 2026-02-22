package cloudflare

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"net/url"
	"strings"
)

// dnsRecord represents a Cloudflare DNS record from the API response.
type dnsRecord struct {
	ID      string `json:"id"`
	Type    string `json:"type"`
	Name    string `json:"name"`
	Content string `json:"content"`
}

type listResponse struct {
	Result  []dnsRecord `json:"result"`
	Success bool        `json:"success"`
}

type zone struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}

type listZonesResponse struct {
	Result  []zone `json:"result"`
	Success bool   `json:"success"`
}

type mutateResponse struct {
	Result  dnsRecord `json:"result"`
	Success bool      `json:"success"`
}

// ResolveZoneID resolves a zone ID from a Cloudflare account ID and DNS name.
// It tries progressively shorter DNS suffixes until a zone match is found.
func ResolveZoneID(ctx context.Context, apiToken, accountID, dnsName string) (string, string, error) {
	if apiToken == "" {
		return "", "", fmt.Errorf("cloudflare API token is required")
	}
	if accountID == "" {
		return "", "", fmt.Errorf("cloudflare account ID is required")
	}

	candidates := zoneNameCandidates(dnsName)
	if len(candidates) == 0 {
		return "", "", fmt.Errorf("cloudflare dns name is required to resolve zone ID")
	}

	for _, zoneName := range candidates {
		zoneID, err := findZoneIDByName(ctx, apiToken, accountID, zoneName)
		if err != nil {
			return "", "", err
		}
		if zoneID != "" {
			return zoneID, zoneName, nil
		}
	}

	return "", "", fmt.Errorf("no Cloudflare zone found for DNS name %q in account %q", dnsName, accountID)
}

// UpsertARecord creates or updates an A record in Cloudflare DNS.
// If a record with the given name already exists, it is updated.
// Otherwise, a new record is created.
func UpsertARecord(ctx context.Context, apiToken, zoneID, recordName, ip string) error {
	existing, err := findARecord(ctx, apiToken, zoneID, recordName)
	if err != nil {
		return fmt.Errorf("lookup existing DNS record: %w", err)
	}

	if existing != nil {
		if existing.Content == ip {
			slog.Info("DNS record already points to correct IP",
				"phase", "3",
				"name", recordName,
				"ip", ip,
			)
			return nil
		}

		if err := updateRecord(ctx, apiToken, zoneID, existing.ID, recordName, ip); err != nil {
			return fmt.Errorf("update DNS record: %w", err)
		}

		slog.Info("DNS A record updated",
			"phase", "3",
			"name", recordName,
			"old_ip", existing.Content,
			"new_ip", ip,
		)
		return nil
	}

	if err := createRecord(ctx, apiToken, zoneID, recordName, ip); err != nil {
		return fmt.Errorf("create DNS record: %w", err)
	}

	slog.Info("DNS A record created",
		"phase", "3",
		"name", recordName,
		"ip", ip,
	)
	return nil
}

func findARecord(ctx context.Context, apiToken, zoneID, name string) (*dnsRecord, error) {
	url := fmt.Sprintf(
		"https://api.cloudflare.com/client/v4/zones/%s/dns_records?type=A&name=%s",
		zoneID, name,
	)

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+apiToken)

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("cloudflare API returned %s: %s", resp.Status, body)
	}

	var result listResponse
	if err := json.Unmarshal(body, &result); err != nil {
		return nil, fmt.Errorf("decode response: %w", err)
	}

	if !result.Success {
		return nil, fmt.Errorf("cloudflare API error: %s", body)
	}

	if len(result.Result) == 0 {
		return nil, nil
	}

	return &result.Result[0], nil
}

func createRecord(ctx context.Context, apiToken, zoneID, name, ip string) error {
	url := fmt.Sprintf("https://api.cloudflare.com/client/v4/zones/%s/dns_records", zoneID)

	payload, _ := json.Marshal(map[string]any{
		"type":    "A",
		"name":    name,
		"content": ip,
		"ttl":     60,
		"proxied": false,
	})

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(payload))
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bearer "+apiToken)
	req.Header.Set("Content-Type", "application/json")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return err
	}

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("cloudflare API returned %s: %s", resp.Status, body)
	}

	var result mutateResponse
	if err := json.Unmarshal(body, &result); err != nil {
		return fmt.Errorf("decode response: %w", err)
	}

	if !result.Success {
		return fmt.Errorf("cloudflare API error: %s", body)
	}

	return nil
}

func updateRecord(ctx context.Context, apiToken, zoneID, recordID, name, ip string) error {
	url := fmt.Sprintf(
		"https://api.cloudflare.com/client/v4/zones/%s/dns_records/%s",
		zoneID, recordID,
	)

	payload, _ := json.Marshal(map[string]any{
		"type":    "A",
		"name":    name,
		"content": ip,
		"ttl":     60,
		"proxied": false,
	})

	req, err := http.NewRequestWithContext(ctx, http.MethodPut, url, bytes.NewReader(payload))
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bearer "+apiToken)
	req.Header.Set("Content-Type", "application/json")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return err
	}

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("cloudflare API returned %s: %s", resp.Status, body)
	}

	var result mutateResponse
	if err := json.Unmarshal(body, &result); err != nil {
		return fmt.Errorf("decode response: %w", err)
	}

	if !result.Success {
		return fmt.Errorf("cloudflare API error: %s", body)
	}

	return nil
}

func findZoneIDByName(ctx context.Context, apiToken, accountID, zoneName string) (string, error) {
	baseURL, err := url.Parse("https://api.cloudflare.com/client/v4/zones")
	if err != nil {
		return "", err
	}

	q := baseURL.Query()
	q.Set("name", zoneName)
	q.Set("account.id", accountID)
	q.Set("status", "active")
	baseURL.RawQuery = q.Encode()

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, baseURL.String(), nil)
	if err != nil {
		return "", err
	}
	req.Header.Set("Authorization", "Bearer "+apiToken)

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", err
	}

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("cloudflare API returned %s while resolving zone %q: %s", resp.Status, zoneName, body)
	}

	var result listZonesResponse
	if err := json.Unmarshal(body, &result); err != nil {
		return "", fmt.Errorf("decode response: %w", err)
	}

	if !result.Success {
		return "", fmt.Errorf("cloudflare API error while resolving zone %q: %s", zoneName, body)
	}

	if len(result.Result) == 0 {
		return "", nil
	}

	return result.Result[0].ID, nil
}

func zoneNameCandidates(dnsName string) []string {
	clean := strings.Trim(strings.ToLower(strings.TrimSpace(dnsName)), ".")
	if clean == "" {
		return nil
	}

	parts := strings.Split(clean, ".")
	if len(parts) < 2 {
		return []string{clean}
	}

	candidates := make([]string, 0, len(parts)-1)
	for i := 0; i <= len(parts)-2; i++ {
		candidates = append(candidates, strings.Join(parts[i:], "."))
	}

	return candidates
}
