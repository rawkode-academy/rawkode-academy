package teleport

import (
	"strings"
	"testing"
)

func TestSelfHostedManifestSetsPrivilegedPodSecurityLabels(t *testing.T) {
	manifest := SelfHostedManifest(
		"production",
		"rawkode.cloud",
		"18",
		"rawkode-academy",
		[]string{"platform"},
		[]string{"teleport-admin"},
		[]string{"system:masters"},
		"github-client-id",
		"github-client-secret",
		false,
		"",
		"",
	)

	for _, required := range []string{
		"kind: Namespace",
		"name: teleport",
		"pod-security.kubernetes.io/enforce: privileged",
		"pod-security.kubernetes.io/enforce-version: latest",
		"pod-security.kubernetes.io/warn: privileged",
		"pod-security.kubernetes.io/warn-version: latest",
		"pod-security.kubernetes.io/audit: privileged",
		"pod-security.kubernetes.io/audit-version: latest",
	} {
		if !strings.Contains(manifest, required) {
			t.Fatalf("self-hosted manifest missing required fragment %q", required)
		}
	}
}

func TestSelfHostedManifestUsesTeleport18CompatibleAuthConfig(t *testing.T) {
	manifest := SelfHostedManifest(
		"production",
		"rawkode.cloud",
		"18",
		"rawkode-academy",
		[]string{"platform"},
		[]string{"teleport-admin"},
		[]string{"system:masters"},
		"github-client-id",
		"github-client-secret",
		false,
		"",
		"",
	)

	for _, required := range []string{
		"authentication:",
		"type: github",
		"connector_name: github",
		"proxy_listener_mode: multiplex",
		"listen_addr: 0.0.0.0:3026",
	} {
		if !strings.Contains(manifest, required) {
			t.Fatalf("self-hosted manifest missing required fragment %q", required)
		}
	}

	if strings.Contains(manifest, "connectors:") {
		t.Fatalf("self-hosted manifest should not include auth_service.connectors for Teleport v18 compatibility")
	}
}

func TestSelfHostedManifestBootstrapsGitHubConnectorFromConfig(t *testing.T) {
	manifest := SelfHostedManifest(
		"production",
		"rawkode.cloud",
		"18",
		"rawkode-academy",
		[]string{"platform"},
		[]string{"teleport-admin"},
		[]string{"system:masters"},
		"github-client-id",
		"github-client-secret",
		false,
		"",
		"",
	)

	for _, required := range []string{
		"bootstrap-resources.yaml: |",
		"kind: github",
		"name: github",
		"client_id: \"github-client-id\"",
		"client_secret: \"github-client-secret\"",
		"redirect_url: \"https://rawkode.cloud/v1/webapi/github/callback\"",
		"teams_to_roles:",
		"organization: \"rawkode-academy\"",
		"team: \"platform\"",
		"roles: [\"kube-admin\"]",
		"---",
		"kind: role",
		"version: v8",
		"name: \"kube-admin\"",
		"kubernetes_labels:",
		"'*': '*'",
		"kubernetes_groups:",
		"- system:masters",
		"kubernetes_users:",
		"- teleport-admin",
		"--bootstrap=/etc/teleport/bootstrap-resources.yaml",
	} {
		if !strings.Contains(manifest, required) {
			t.Fatalf("self-hosted manifest missing required fragment %q", required)
		}
	}
}

func TestSelfHostedManifestConfiguresNativeACMEWhenEnabled(t *testing.T) {
	manifest := SelfHostedManifest(
		"production",
		"rawkode.cloud",
		"18",
		"rawkode-academy",
		[]string{"platform"},
		[]string{"teleport-admin"},
		[]string{"system:masters"},
		"github-client-id",
		"github-client-secret",
		true,
		"platform@rawkode.cloud",
		"https://acme-v02.api.letsencrypt.org/directory",
	)

	for _, required := range []string{
		"acme:",
		"enabled: yes",
		"email: \"platform@rawkode.cloud\"",
		"uri: \"https://acme-v02.api.letsencrypt.org/directory\"",
	} {
		if !strings.Contains(manifest, required) {
			t.Fatalf("self-hosted manifest missing required ACME fragment %q", required)
		}
	}
}

func TestSelfHostedManifestOmitsACMEWhenDisabled(t *testing.T) {
	manifest := SelfHostedManifest(
		"production",
		"rawkode.cloud",
		"18",
		"rawkode-academy",
		[]string{"platform"},
		[]string{"teleport-admin"},
		[]string{"system:masters"},
		"github-client-id",
		"github-client-secret",
		false,
		"",
		"",
	)

	if strings.Contains(manifest, "\n      acme:\n") {
		t.Fatalf("self-hosted manifest should not include proxy_service.acme when ACME is disabled")
	}
}

func TestSelfHostedManifestUsesConfiguredKubernetesSubjects(t *testing.T) {
	manifest := SelfHostedManifest(
		"production",
		"rawkode.cloud",
		"18",
		"rawkode-academy",
		[]string{"platform"},
		[]string{"platform-admin"},
		[]string{"platform:sre"},
		"github-client-id",
		"github-client-secret",
		false,
		"",
		"",
	)

	for _, required := range []string{
		"kubernetes_groups:",
		"- platform:sre",
		"kubernetes_users:",
		"- platform-admin",
	} {
		if !strings.Contains(manifest, required) {
			t.Fatalf("self-hosted manifest missing configured kubernetes subject fragment %q", required)
		}
	}
}
