set -euo pipefail
kubectl patch deployment database --type merge -p '{"spec":{"template":{"spec":{"schedulingGates":[{"name":"example.com/quota-check"}]}}}}'
kubectl patch svc klustered -p '{"spec":{"selector":{"app":"klustred"}}}'
kubectl patch deployment klustered --type merge -p '{"spec":{"template":{"spec":{"dnsPolicy":"Default"}}}}'
kb_wait 120 bash -c '[ "$(kubectl get pod -l app=postgresql -o jsonpath="{.items[*].status.phase}")" = "Pending" ]'
kb_wait 60 bash -c '! kb_app_ok' || true
