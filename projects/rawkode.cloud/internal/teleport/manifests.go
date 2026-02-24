package teleport

import (
	"fmt"
	"strings"
)

const defaultTeleportImageTag = "17"

// KubeAgentManifest generates the Kubernetes YAML for a Teleport kube agent deployment.
func KubeAgentManifest(proxyAddr, clusterName, joinToken, version string) string {
	return fmt.Sprintf(`apiVersion: v1
kind: Namespace
metadata:
  name: teleport-agent
---
apiVersion: v1
kind: ConfigMap
metadata:
  name: teleport-kube-agent
  namespace: teleport-agent
data:
  teleport.yaml: |
    version: v3
    teleport:
      proxy_server: %s
      join_params:
        method: token
        token_name: %s
    kubernetes_service:
      enabled: true
      kube_cluster_name: %s
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: teleport-kube-agent
  namespace: teleport-agent
spec:
  replicas: 1
  selector:
    matchLabels:
      app: teleport-kube-agent
  template:
    metadata:
      labels:
        app: teleport-kube-agent
    spec:
      serviceAccountName: teleport-kube-agent
      containers:
        - name: teleport
          image: %s
          args:
            - --config=/etc/teleport/teleport.yaml
          volumeMounts:
            - name: config
              mountPath: /etc/teleport
              readOnly: true
            - name: data
              mountPath: /var/lib/teleport
      volumes:
        - name: config
          configMap:
            name: teleport-kube-agent
        - name: data
          emptyDir: {}
---
apiVersion: v1
kind: ServiceAccount
metadata:
  name: teleport-kube-agent
  namespace: teleport-agent
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: teleport-kube-agent
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: ClusterRole
  name: cluster-admin
subjects:
  - kind: ServiceAccount
    name: teleport-kube-agent
    namespace: teleport-agent
`, proxyAddr, joinToken, clusterName, teleportImage(version))
}

// SelfHostedManifest generates Kubernetes YAML for a single-node self-hosted Teleport deployment.
func SelfHostedManifest(clusterName, domain, version, githubOrganization string, githubTeams []string, githubClientID, githubClientSecret string) string {
	return fmt.Sprintf(`apiVersion: v1
kind: Namespace
metadata:
  name: teleport
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
      authentication:
        type: github
      connectors:
        - type: github
          id: github
          name: GitHub
          client_id: %q
          client_secret: %q
          redirect_url: %q
          teams_to_logins:
%s
    proxy_service:
      enabled: "yes"
      web_listen_addr: 0.0.0.0:443
      public_addr: %q
    kubernetes_service:
      enabled: "yes"
      kube_cluster_name: %q
    ssh_service:
      enabled: "no"
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
`, clusterName, clusterName, githubClientID, githubClientSecret, fmt.Sprintf("https://%s/v1/webapi/github/callback", domain), githubTeamsToLoginsYAML(githubOrganization, githubTeams), fmt.Sprintf("%s:443", domain), clusterName, teleportImage(version))
}

func githubTeamsToLoginsYAML(organization string, teams []string) string {
	organization = strings.TrimSpace(organization)
	var b strings.Builder

	for _, team := range teams {
		trimmed := strings.TrimSpace(team)
		if trimmed == "" {
			continue
		}
		fmt.Fprintf(&b, "            - organization: %q\n", organization)
		fmt.Fprintf(&b, "              team: %q\n", trimmed)
		fmt.Fprintln(&b, `              logins: ["root"]`)
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
