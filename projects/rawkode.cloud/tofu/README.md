# i2 OpenTofu Bootstrap

This stack is the first automation layer for `i2`:

1. Provision Scaleway bare metal nodes.
2. Create and attach a private network.
3. Generate Salt handoff files from this repo:
   - `i2/salt/roster`
   - `i2/salt/pillar/generated/cluster.auto.sls`

## Usage

```bash
cd i2/tofu
cp terraform.tfvars.example terraform.tfvars
# fill in credentials and offer/os values

tofu init
tofu plan
tofu apply
```

## Notes

- This is intentionally bootstrap-first: it creates infra and emits Salt inputs.
- `host: CHANGE_ME_AFTER_APPLY` in `i2/salt/roster` is a placeholder until we lock exact provider-exposed management IP fields and wire them directly.
- Next step is to add Salt states/orchestration that consume generated pillar and bootstrap Cloud Hypervisor + kubeadm.
- Salt key enrollment is hardened:
  - control-plane key is preseeded on master and is not autosigned.
  - non-control-plane keys are accepted only by reactor verification against Scaleway API + minion grain `scw_instance_id`.
- Minion bootstrap template is available at `tofu/templates/cloud-init-salt-minion.yaml.tftpl`.
  - Required template vars: `private_network_interface`, `salt_master_private_ip`, `minion_id`.
  - `minion_id` can be empty to default to Scaleway metadata hostname.
- Minions are provisioned via `for_each` in `tofu/main.tf`.
  - Configure `minion_replica_count` (default: `0`) and `minion_name_prefix`.
  - `salt_master_private_ip` is optional; when unset, minions use the control-plane private IPv4 discovered from `private_ips`.
- Teleport OSS uses GitHub auth in this stack.
  - Set `teleport_auth_type = "github"` (default).
  - Set `teleport_github_org` and `teleport_github_team` (defaults: `rawkode-academy` / `platform`).
  - Salt ext_pillar fetches all secrets at runtime from Infisical path `/projects/rawkode-cloud` in `production` and exposes them as `infisical:secrets`.
  - Teleport maps key names from `teleport_github_client_id_key` and `teleport_github_client_secret_key` (defaults: `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET`).
- Infisical credentials are two-stage.
  - Bootstrap credentials are injected by cloud-init and only used to fetch runtime credentials from Infisical.
  - Terraform creates runtime machine-identity credentials and stores them as secrets (`SALT_PILLAR_INFISICAL_CLIENT_ID`, `SALT_PILLAR_INFISICAL_CLIENT_SECRET`, `SALT_PILLAR_INFISICAL_PROJECT_ID` by default).
  - Salt ext_pillar uses `/etc/salt/credentials/infisical-runtime.json` for steady-state reads.
