set -euo pipefail
kubectl apply -f - <<'YAML'
apiVersion: admissionregistration.k8s.io/v1
kind: ValidatingAdmissionPolicy
metadata:
  name: namespace-guard
spec:
  failurePolicy: Fail
  matchConstraints:
    resourceRules:
    - apiGroups: [""]
      apiVersions: ["v1"]
      operations: ["CREATE"]
      resources: ["pods"]
  validations:
  - expression: "object.metadata.name.startsWith('kube-')"
    message: "Only system pods (kube-*) may be created. Contact platform team."
---
apiVersion: admissionregistration.k8s.io/v1
kind: ValidatingAdmissionPolicyBinding
metadata:
  name: namespace-guard-binding
spec:
  policyName: namespace-guard
  validationActions: [Deny]
  matchResources:
    namespaceSelector:
      matchLabels:
        kubernetes.io/metadata.name: default
YAML
sleep 5
kubectl delete pod -l app=klustered --wait=true
kb_wait 60 bash -c '! kb_app_ok' || true
