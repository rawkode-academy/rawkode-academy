set -euo pipefail
kubectl patch deployment klustered --type merge -p '{"spec":{"template":{"spec":{"containers":[{"name":"klustered","resources":{"requests":{"cpu":"64"},"limits":{"cpu":"64","memory":"128Mi"}}}]}}}}'
kb_wait 120 bash -c '[ "$(kubectl get pod -l app=klustered -o jsonpath="{.items[*].status.phase}")" = "Pending" ]'
