set -euo pipefail
M=/etc/kubernetes/manifests/kube-controller-manager.yaml
if grep -q -- "--controllers=" "$M"; then
  sed -i 's#^\([[:space:]]*- --controllers=\).*#\1*,-replicaset-controller#' "$M"
else
  sed -i '/^[[:space:]]*- kube-controller-manager$/a\    - --controllers=*,-replicaset-controller' "$M"
fi
# kubelet notices the manifest change and restarts the static pod.
kb_wait 180 bash -c 'kubectl -n kube-system get pod -l component=kube-controller-manager -o jsonpath="{.items[0].spec.containers[0].command}" | grep -q -- "-replicaset-controller"'
kb_wait 180 bash -c 'kubectl -n kube-system get pod -l component=kube-controller-manager -o jsonpath="{.items[0].status.containerStatuses[0].ready}" | grep -q true'
sleep 10
kubectl delete pod -l app=klustered --wait=true
sleep 15
[ -z "$(kb_app_pod)" ] || { echo "replicaset controller still active" >&2; exit 1; }
