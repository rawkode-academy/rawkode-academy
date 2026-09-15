set -euo pipefail
kubectl patch deployment klustered --type json -p '[
  {"op":"remove","path":"/spec/template/spec/initContainers"},
  {"op":"replace","path":"/spec/template/spec/containers/0/readinessProbe/tcpSocket/port","value":666},
  {"op":"replace","path":"/spec/template/spec/containers/0/resources","value":{"requests":{"cpu":"100m"},"limits":{"cpu":"500m","memory":"256Mi"}}},
  {"op":"replace","path":"/spec/template/spec/containers/0/image","value":"ghcr.io/rawkode-academy/klustered:v2"}
]'
kubectl rollout status deployment/klustered --timeout=300s
kb_wait 120 kb_app_ok v2
