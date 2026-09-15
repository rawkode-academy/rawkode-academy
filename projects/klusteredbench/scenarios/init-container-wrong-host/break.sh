set -euo pipefail
kubectl patch deployment klustered --type merge -p '{"spec":{"template":{"spec":{"initContainers":[{"name":"wait-for-db","image":"busybox:1.36","command":["sh","-c","until nc -z postgresql 5432; do echo waiting for db; sleep 2; done"]}]}}}}'
kb_wait 180 bash -c 'kubectl get pod -l app=klustered -o jsonpath="{.items[*].status.phase}" | grep -q Pending'
