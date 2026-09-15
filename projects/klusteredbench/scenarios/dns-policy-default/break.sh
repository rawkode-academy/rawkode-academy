set -euo pipefail
kubectl patch deployment klustered --type merge -p '{"spec":{"template":{"spec":{"dnsPolicy":"Default"}}}}'
kubectl rollout status deployment/klustered --timeout=300s
kb_wait 60 bash -c '! kb_app_ok' || true
