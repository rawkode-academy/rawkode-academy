set -euo pipefail
kubectl patch deployment klustered --type merge -p '{"spec":{"template":{"spec":{"initContainers":[{"name":"wait-for-db","image":"busybox:1.36","command":["sh","-c","until nc -z postgres 5432; do echo waiting for db; sleep 2; done"]}]}}}}'
kubectl rollout status deployment/klustered --timeout=300s
kb_wait 120 kb_app_ok
