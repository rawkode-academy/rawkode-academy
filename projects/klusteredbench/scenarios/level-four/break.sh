set -euo pipefail
kubectl patch deployment klustered --type merge -p '{"spec":{"template":{"spec":{"initContainers":[{"name":"wait-for-db","image":"busybox:1.36","command":["sh","-c","until nc -z postgresql 5432; do echo waiting for db; sleep 2; done"]}],"containers":[{"name":"klustered","readinessProbe":{"tcpSocket":{"port":8080},"initialDelaySeconds":3,"periodSeconds":5},"resources":{"requests":{"cpu":"64"},"limits":{"cpu":"64","memory":"256Mi"}}}]}}}}'
kb_wait 120 bash -c '[ "$(kubectl get pod -l app=klustered -o jsonpath="{.items[*].status.phase}")" = "Pending" ]'
