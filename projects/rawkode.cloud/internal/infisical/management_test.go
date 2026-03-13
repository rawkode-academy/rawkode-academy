package infisical

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestClientGetProject(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			t.Fatalf("method = %s, want GET", r.Method)
		}
		if r.URL.Path != "/api/v1/projects/project-123" {
			t.Fatalf("path = %s, want %s", r.URL.Path, "/api/v1/projects/project-123")
		}
		if r.Header.Get("Authorization") != "Bearer token-123" {
			t.Fatalf("authorization header = %q, want %q", r.Header.Get("Authorization"), "Bearer token-123")
		}

		_ = json.NewEncoder(w).Encode(map[string]any{
			"project": map[string]any{
				"id":    "project-123",
				"slug":  "rawkode-academy",
				"orgId": "org-123",
			},
		})
	}))
	defer server.Close()

	client := &Client{
		siteURL:    server.URL,
		httpClient: server.Client(),
		getAccessToken: func() string {
			return "token-123"
		},
	}

	project, err := client.GetProject(context.Background(), "project-123")
	if err != nil {
		t.Fatalf("GetProject returned error: %v", err)
	}
	if project.ID != "project-123" {
		t.Fatalf("project ID = %q, want %q", project.ID, "project-123")
	}
	if project.Slug != "rawkode-academy" {
		t.Fatalf("project slug = %q, want %q", project.Slug, "rawkode-academy")
	}
	if project.OrgID != "org-123" {
		t.Fatalf("project org ID = %q, want %q", project.OrgID, "org-123")
	}
}

func TestClientGetMachineIdentity(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			t.Fatalf("method = %s, want GET", r.Method)
		}
		if r.URL.Path != "/api/v1/identities/identity-123" {
			t.Fatalf("path = %s, want %s", r.URL.Path, "/api/v1/identities/identity-123")
		}

		_ = json.NewEncoder(w).Encode(map[string]any{
			"identity": map[string]any{
				"orgId":      "org-123",
				"identityId": "identity-123",
				"metadata": []map[string]any{
					{"key": "managed-by", "value": "rawkode-cloud"},
					{"key": "cluster", "value": "production"},
				},
				"identity": map[string]any{
					"id":                  "identity-123",
					"name":                "rawkode-academy-production-external-secrets",
					"orgId":               "org-123",
					"hasDeleteProtection": true,
					"authMethods":         []string{"universal-auth"},
				},
			},
		})
	}))
	defer server.Close()

	client := &Client{
		siteURL:    server.URL,
		httpClient: server.Client(),
		getAccessToken: func() string {
			return "token-123"
		},
	}

	identity, err := client.GetMachineIdentity(context.Background(), "identity-123")
	if err != nil {
		t.Fatalf("GetMachineIdentity returned error: %v", err)
	}
	if identity.ID != "identity-123" {
		t.Fatalf("identity ID = %q, want %q", identity.ID, "identity-123")
	}
	if identity.Name != "rawkode-academy-production-external-secrets" {
		t.Fatalf("identity name = %q", identity.Name)
	}
	if !identity.HasDeleteProtection {
		t.Fatal("expected delete protection to be true")
	}
	if len(identity.Metadata) != 2 {
		t.Fatalf("metadata length = %d, want 2", len(identity.Metadata))
	}
}

func TestClientCreateUniversalAuthClientSecret(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			t.Fatalf("method = %s, want POST", r.Method)
		}
		if r.URL.Path != "/api/v1/auth/universal-auth/identities/identity-123/client-secrets" {
			t.Fatalf("path = %s, want %s", r.URL.Path, "/api/v1/auth/universal-auth/identities/identity-123/client-secrets")
		}

		var payload map[string]any
		if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
			t.Fatalf("decode request body: %v", err)
		}
		if payload["description"] != "bootstrap secret" {
			t.Fatalf("description = %v, want %q", payload["description"], "bootstrap secret")
		}
		if payload["numUsesLimit"] != float64(0) {
			t.Fatalf("numUsesLimit = %v, want 0", payload["numUsesLimit"])
		}
		if payload["ttl"] != float64(0) {
			t.Fatalf("ttl = %v, want 0", payload["ttl"])
		}

		_ = json.NewEncoder(w).Encode(map[string]any{
			"clientSecret": "plain-secret",
			"clientSecretData": map[string]any{
				"id":                    "secret-123",
				"clientSecretPrefix":    "prefix",
				"isClientSecretRevoked": false,
			},
		})
	}))
	defer server.Close()

	client := &Client{
		siteURL:    server.URL,
		httpClient: server.Client(),
		getAccessToken: func() string {
			return "token-123"
		},
	}

	result, err := client.CreateUniversalAuthClientSecret(context.Background(), "identity-123", "bootstrap secret")
	if err != nil {
		t.Fatalf("CreateUniversalAuthClientSecret returned error: %v", err)
	}
	if result.ClientSecret != "plain-secret" {
		t.Fatalf("client secret = %q, want %q", result.ClientSecret, "plain-secret")
	}
	if result.Data.ID != "secret-123" {
		t.Fatalf("client secret data ID = %q, want %q", result.Data.ID, "secret-123")
	}
}

func TestIsNotFound(t *testing.T) {
	if !IsNotFound(&APIError{StatusCode: http.StatusNotFound}) {
		t.Fatal("expected APIError 404 to be treated as not found")
	}
	if IsNotFound(&APIError{StatusCode: http.StatusForbidden}) {
		t.Fatal("expected APIError 403 not to be treated as not found")
	}
}
