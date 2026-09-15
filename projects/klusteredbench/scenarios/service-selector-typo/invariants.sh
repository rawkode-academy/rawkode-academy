# The fix must be the Service, not a rebuilt app. Deployments must survive.
kubectl get deployment klustered >/dev/null
kubectl get deployment database >/dev/null
kubectl get svc klustered -o jsonpath='{.spec.type}' | grep -q NodePort
