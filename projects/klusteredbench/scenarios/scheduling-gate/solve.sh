set -euo pipefail
kubectl patch deployment database --type json -p '[{"op":"remove","path":"/spec/template/spec/schedulingGates"}]'
kubectl rollout status deployment/database --timeout=300s
kb_wait 120 kb_app_ok
