set -euo pipefail
kubectl delete validatingadmissionpolicybinding namespace-guard-binding
kubectl delete validatingadmissionpolicy namespace-guard
kubectl rollout status deployment/klustered --timeout=300s
kb_wait 120 kb_app_ok
