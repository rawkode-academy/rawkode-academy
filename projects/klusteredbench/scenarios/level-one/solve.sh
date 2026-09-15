set -euo pipefail
kubectl patch deployment database --type json -p '[{"op":"remove","path":"/spec/template/spec/schedulingGates"}]'
kubectl patch svc klustered -p '{"spec":{"selector":{"app":"klustered"}}}'
kubectl patch deployment klustered --type merge -p '{"spec":{"template":{"spec":{"dnsPolicy":"ClusterFirst"}}}}'
kubectl set image deployment/klustered klustered=ghcr.io/rawkode-academy/klustered:v2
kubectl rollout status deployment/database --timeout=300s
kubectl rollout status deployment/klustered --timeout=300s
kb_wait 120 kb_app_ok v2
