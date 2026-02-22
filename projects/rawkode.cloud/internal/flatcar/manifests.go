package flatcar

import "fmt"

// ManifestConfig holds the parameters needed to generate Kubernetes manifests.
type ManifestConfig struct {
	ClusterName       string
	TeleportToken     string
	TeleportProxyAddr string

	// Infisical cluster identity — injected directly as long-lived credentials.
	InfisicalClusterClientID     string
	InfisicalClusterClientSecret string
}

// GenerateManifests returns Kubernetes YAML manifests for Teleport and Infisical.
// Teleport manifests are only included when both token and proxy are present.
func GenerateManifests(cfg ManifestConfig) []string {
	var manifests []string

	// Inject Infisical machine identity with long-lived credentials.
	if cfg.InfisicalClusterClientID != "" && cfg.InfisicalClusterClientSecret != "" {
		manifests = append(manifests, fmt.Sprintf(`apiVersion: v1
kind: Secret
metadata:
  name: infisical-machine-identity
  namespace: kube-system
type: Opaque
stringData:
  clientId: "%s"
  clientSecret: "%s"
`, cfg.InfisicalClusterClientID, cfg.InfisicalClusterClientSecret))
	}

	if cfg.TeleportToken == "" || cfg.TeleportProxyAddr == "" {
		return manifests
	}

	manifests = append(manifests, fmt.Sprintf(`apiVersion: v1
kind: Secret
metadata:
  name: teleport-join-token
  namespace: kube-system
type: Opaque
stringData:
  token: "%s"
  proxy: "%s"
`, cfg.TeleportToken, cfg.TeleportProxyAddr))

	manifests = append(manifests, `apiVersion: v1
kind: ServiceAccount
metadata:
  name: teleport-kube-agent
  namespace: kube-system
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
  namespace: kube-system
`)

	manifests = append(manifests, fmt.Sprintf(`apiVersion: v1
kind: ConfigMap
metadata:
  name: teleport-kube-agent
  namespace: kube-system
data:
  teleport.yaml: |
    version: v3
    teleport:
      join_params:
        method: token
        token_name: /etc/teleport-secrets/token
      proxy_server: %s
    kubernetes_service:
      enabled: true
      kube_cluster_name: %s
`, cfg.TeleportProxyAddr, cfg.ClusterName))

	manifests = append(manifests, `apiVersion: apps/v1
kind: Deployment
metadata:
  name: teleport-kube-agent
  namespace: kube-system
  labels:
    app: teleport-kube-agent
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
        image: public.ecr.aws/gravitational/teleport-distroless:17
        args: ["start", "--config=/etc/teleport/teleport.yaml"]
        volumeMounts:
        - name: config
          mountPath: /etc/teleport
          readOnly: true
        - name: join-token
          mountPath: /etc/teleport-secrets
          readOnly: true
        - name: data
          mountPath: /var/lib/teleport
      volumes:
      - name: config
        configMap:
          name: teleport-kube-agent
      - name: join-token
        secret:
          secretName: teleport-join-token
      - name: data
        emptyDir: {}
`)

	return manifests
}
