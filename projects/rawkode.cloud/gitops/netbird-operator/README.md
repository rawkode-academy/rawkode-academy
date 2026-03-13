# NetBird Kubernetes Operator

This package installs the NetBird Kubernetes operator via Flux to expose Kubernetes services to the NetBird network.

What it enables:

1. Installs `kubernetes-operator` and `netbird-operator-config` charts from `https://netbirdio.github.io/helms`.
2. Enables operator ingress support (`ingress.enabled: true`).
3. Enables routing peer creation (`router.enabled: true`) so annotated services can be exposed.

Requirements:

1. A NetBird API token secret named `netbird-mgmt-api-key` in the `netbird` namespace with key `NB_API_KEY`.
2. Annotate Services you want exposed, for example:

```yaml
apiVersion: v1
kind: Service
metadata:
  name: my-service
  annotations:
    netbird.io/expose: "true"
    netbird.io/groups: "k8s-service-access"
spec:
  ports:
    - port: 80
      targetPort: 8080
```

Verification:

1. `kubectl -n flux-system get helmrelease netbird-operator netbird-operator-config`
2. `kubectl -n netbird get pods`
3. `kubectl -n <workload-namespace> get svc <service-name> -o yaml | rg netbird.io/`
