kubectl get deployment klustered >/dev/null
kubectl get deployment database >/dev/null
kubectl get deployment klustered -o jsonpath='{.spec.template.spec.containers[0].image}' | grep -q ':v2$'
