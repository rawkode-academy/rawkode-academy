set -euo pipefail
kubectl set image deployment/klustered klustered=ghcr.io/rawkode-academy/klustered:v1.0
kb_wait 180 bash -c 'kubectl get pod -l app=klustered -o jsonpath="{.items[*].status.containerStatuses[*].state.waiting.reason}" | grep -Eq "ErrImagePull|ImagePullBackOff"'
