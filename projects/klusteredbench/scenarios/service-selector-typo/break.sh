set -euo pipefail
kubectl patch svc klustered -p '{"spec":{"selector":{"app":"klustred"}}}'
kb_wait 60 bash -c '! kb_app_ok' || true
