# The app must be back AND the controller must be reconciling: a fresh
# ReplicaSet with replicas=1 has to produce a pod on its own.
kb_app_ok || exit 1
kubectl delete replicaset kb-probe --ignore-not-found >/dev/null 2>&1
kubectl apply -f - >/dev/null <<'YAML'
apiVersion: apps/v1
kind: ReplicaSet
metadata:
  name: kb-probe
spec:
  replicas: 1
  selector:
    matchLabels: { app: kb-probe }
  template:
    metadata:
      labels: { app: kb-probe }
    spec:
      containers:
      - name: pause
        image: registry.k8s.io/pause:3.9
YAML
ok=1
if kb_wait 45 bash -c '[ -n "$(kubectl get pod -l app=kb-probe -o name)" ]'; then ok=0; fi
kubectl delete replicaset kb-probe --ignore-not-found --wait=false >/dev/null 2>&1
exit $ok
