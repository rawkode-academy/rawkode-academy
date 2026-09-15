set -euo pipefail
kubectl patch deployment klustered --type merge -p '{"spec":{"template":{"spec":{"dnsPolicy":"ClusterFirst"}}}}'
kubectl rollout status deployment/klustered --timeout=300s
kb_wait 120 kb_app_ok
