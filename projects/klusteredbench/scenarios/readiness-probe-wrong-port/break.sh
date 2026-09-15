set -euo pipefail
kubectl patch deployment klustered --type merge -p '{"spec":{"template":{"spec":{"containers":[{"name":"klustered","readinessProbe":{"tcpSocket":{"port":8080},"initialDelaySeconds":3,"periodSeconds":5}}]}}}}'
kb_wait 120 bash -c '[ "$(kubectl get endpoints klustered -o jsonpath="{.subsets}")" = "" ]'
