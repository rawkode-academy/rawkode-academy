package teleport

import "fmt"

// KubeAgentManifest generates the Kubernetes YAML for a Teleport kube agent deployment.
func KubeAgentManifest(proxyAddr, clusterName, joinToken string) string {
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
          image: public.ecr.aws/gravitational/teleport-distroless:17
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
`, proxyAddr, joinToken, clusterName)
}
