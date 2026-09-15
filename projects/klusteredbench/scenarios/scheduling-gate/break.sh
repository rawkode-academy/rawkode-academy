set -euo pipefail
kubectl patch deployment database --type merge -p '{"spec":{"template":{"spec":{"schedulingGates":[{"name":"example.com/quota-check"}]}}}}'
kb_wait 120 bash -c '[ "$(kubectl get pod -l app=postgresql -o jsonpath="{.items[*].status.phase}")" = "Pending" ]'
