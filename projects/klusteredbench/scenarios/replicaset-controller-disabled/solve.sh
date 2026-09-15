set -euo pipefail
M=/etc/kubernetes/manifests/kube-controller-manager.yaml
sed -i '/^[[:space:]]*- --controllers=\*,-replicaset-controller$/d' "$M"
kb_wait 180 bash -c '! kubectl -n kube-system get pod -l component=kube-controller-manager -o jsonpath="{.items[0].spec.containers[0].command}" | grep -q -- "-replicaset-controller"'
kb_wait 180 bash -c 'kubectl -n kube-system get pod -l component=kube-controller-manager -o jsonpath="{.items[0].status.containerStatuses[0].ready}" | grep -q true'
kubectl rollout status deployment/klustered --timeout=300s
kb_wait 120 kb_app_ok
