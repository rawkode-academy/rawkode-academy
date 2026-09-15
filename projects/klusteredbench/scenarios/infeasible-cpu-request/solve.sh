set -euo pipefail
kubectl patch deployment klustered --type merge -p '{"spec":{"template":{"spec":{"containers":[{"name":"klustered","resources":{"requests":{"cpu":"100m"},"limits":{"cpu":"500m","memory":"128Mi"}}}]}}}}'
kubectl rollout status deployment/klustered --timeout=300s
kb_wait 120 kb_app_ok
