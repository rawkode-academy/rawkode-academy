set -euo pipefail
kubectl set image deployment/klustered klustered=ghcr.io/rawkode-academy/klustered:v1
kubectl rollout status deployment/klustered --timeout=300s
kb_wait 120 kb_app_ok
