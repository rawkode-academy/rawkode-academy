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
