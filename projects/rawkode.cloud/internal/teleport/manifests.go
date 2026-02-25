package teleport

import (
	"fmt"
	"strings"
)

const defaultTeleportImageTag = "18"
const defaultTeleportBootstrapRole = "kube-admin"

// SelfHostedManifest generates Kubernetes YAML for a single-node self-hosted Teleport deployment.
func SelfHostedManifest(
	clusterName,
	domain,
	version,
	githubOrganization string,
	adminTeams []string,
	kubernetesUsers []string,
	kubernetesGroups []string,
	githubClientID,
	githubClientSecret string,
	acmeEnabled bool,
	acmeEmail,
	acmeURI string,
) string {
	return fmt.Sprintf(`apiVersion: v1
kind: Namespace
metadata:
  name: teleport
  labels:
    pod-security.kubernetes.io/enforce: privileged
    pod-security.kubernetes.io/enforce-version: latest
    pod-security.kubernetes.io/warn: privileged
    pod-security.kubernetes.io/warn-version: latest
    pod-security.kubernetes.io/audit: privileged
    pod-security.kubernetes.io/audit-version: latest
---
apiVersion: v1
kind: Secret
metadata:
  name: teleport-config
  namespace: teleport
type: Opaque
stringData:
  teleport.yaml: |
    version: v3
    teleport:
      nodename: %q
      data_dir: /var/lib/teleport
      log:
        output: stderr
        severity: INFO
    auth_service:
      enabled: "yes"
      cluster_name: %q
      proxy_listener_mode: multiplex
      authentication:
        type: github
        connector_name: github
    proxy_service:
      enabled: "yes"
      web_listen_addr: 0.0.0.0:443
      public_addr: %q%s
    kubernetes_service:
      enabled: "yes"
      listen_addr: 0.0.0.0:3026
      kube_cluster_name: %q
    ssh_service:
      enabled: "no"
  bootstrap-resources.yaml: |
    kind: github
    version: v3
    metadata:
      name: github
    spec:
      client_id: %q
      client_secret: %q
      display: GitHub
      redirect_url: %q
      teams_to_roles:
%s
    ---
    kind: role
    version: v8
    metadata:
      name: %q
    spec:
      allow:
        kubernetes_labels:
          '*': '*'
        kubernetes_groups:
%s
        kubernetes_users:
%s
      deny: {}
---
apiVersion: v1
kind: ServiceAccount
metadata:
  name: teleport
  namespace: teleport
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: teleport
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: ClusterRole
  name: cluster-admin
subjects:
  - kind: ServiceAccount
    name: teleport
    namespace: teleport
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: teleport
  namespace: teleport
spec:
  replicas: 1
  selector:
    matchLabels:
      app: teleport
  template:
    metadata:
      labels:
        app: teleport
    spec:
      hostNetwork: true
      dnsPolicy: ClusterFirstWithHostNet
      serviceAccountName: teleport
      containers:
        - name: teleport
          image: %s
          args:
            - --config=/etc/teleport/teleport.yaml
            - --bootstrap=/etc/teleport/bootstrap-resources.yaml
          ports:
            - name: web
              containerPort: 443
              hostPort: 443
              protocol: TCP
          volumeMounts:
            - name: config
              mountPath: /etc/teleport
              readOnly: true
            - name: data
              mountPath: /var/lib/teleport
      volumes:
        - name: config
          secret:
            secretName: teleport-config
        - name: data
          emptyDir: {}
`, clusterName, clusterName, fmt.Sprintf("%s:443", domain), proxyACMEYAML(acmeEnabled, acmeEmail, acmeURI), clusterName, githubClientID, githubClientSecret, fmt.Sprintf("https://%s/v1/webapi/github/callback", domain), githubTeamsToRolesYAML(githubOrganization, adminTeams), defaultTeleportBootstrapRole, yamlStringList(kubernetesGroups, "          "), yamlStringList(kubernetesUsers, "          "), teleportImage(version))
}

func githubTeamsToRolesYAML(organization string, teams []string) string {
	return teamRolesYAML(strings.TrimSpace(organization), teams, defaultTeleportBootstrapRole)
}

func proxyACMEYAML(enabled bool, email, uri string) string {
	if !enabled {
		return ""
	}

	var b strings.Builder
	b.WriteString("\n      acme:\n")
	b.WriteString("        enabled: yes")

	if trimmed := strings.TrimSpace(email); trimmed != "" {
		fmt.Fprintf(&b, "\n        email: %q", trimmed)
	}
	if trimmed := strings.TrimSpace(uri); trimmed != "" {
		fmt.Fprintf(&b, "\n        uri: %q", trimmed)
	}

	return b.String()
}

func teleportImage(version string) string {
	tag := strings.TrimSpace(version)
	if tag == "" {
		tag = defaultTeleportImageTag
	}

	return fmt.Sprintf("public.ecr.aws/gravitational/teleport-distroless:%s", tag)
}

func yamlStringList(values []string, indent string) string {
	var b strings.Builder
	for _, value := range values {
		trimmed := strings.TrimSpace(value)
		if trimmed == "" {
			continue
		}
		fmt.Fprintf(&b, "%s- %s\n", indent, trimmed)
	}
	return b.String()
}

func teamRolesYAML(organization string, teams []string, roleName string) string {
	var b strings.Builder
	for _, team := range teams {
		trimmed := strings.TrimSpace(team)
		if trimmed == "" {
			continue
		}
		fmt.Fprintf(&b, "        - organization: %q\n", organization)
		fmt.Fprintf(&b, "          team: %q\n", trimmed)
		fmt.Fprintf(&b, "          roles: [%q]\n", roleName)
	}
	return b.String()
}
