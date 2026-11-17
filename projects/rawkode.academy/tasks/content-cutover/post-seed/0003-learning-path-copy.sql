UPDATE learning_paths
SET description = 'Package apps with Timoni, deploy with Flux, and manage add-ons across clusters with Sveltos.',
    body = json_set(body, '$.content[0].content[0].text', 'Package apps with Timoni, deploy with Flux, and manage add-ons across clusters with Sveltos. The path also covers deploying to multiple environments with Kluctl and setting up a developer workflow with Gimlet.'),
    updated_at = unixepoch()
WHERE id = 'gitops-landscape'
  AND description = 'Build a GitOps-first operating model. This path layers modern packaging, reconciliation, and developer experience tooling—Timoni, Kluctl, FluxCD, Gimlet, and Sveltos—so you can run fleets with confidence.'
  AND json_extract(body, '$.content[0].content[0].text') = 'GitOps is more than a controller—you need packaging discipline, environment orchestration, reconciliation pipelines, and developer UX. This path assembles opinionated tools so platform engineers can scale fleets while keeping guardrails intact.';

UPDATE learning_paths
SET description = 'Diagnose failing nodes, broken networking, and control-plane outages using Kubernetes and host logs.',
    body = json_set(body, '$.content[0].content[0].text', 'Diagnose failing nodes, broken networking, and control-plane outages using Kubernetes and host logs. The episodes also show how to recover when the API server is down.'),
    updated_at = unixepoch()
WHERE id = 'klustered-advanced-cluster-triage'
  AND description = 'Master the craft of rescuing broken clusters. This path walks through real war‑room incidents so you can debug the control plane, container runtime, and host OS when kubectl alone is useless.'
  AND json_extract(body, '$.content[0].content[0].text') = 'Go beyond kubectl and develop a battle-tested methodology for diagnosing multi-layer outages. Each scenario highlights a different failure domain—nodes, networking, security, and host-level manipulation—so you can bring clusters back from the dead.';
