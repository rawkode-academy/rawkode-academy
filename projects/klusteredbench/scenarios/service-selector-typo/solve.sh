set -euo pipefail
kubectl patch svc klustered -p '{"spec":{"selector":{"app":"klustered"}}}'
kb_wait 60 kb_app_ok
