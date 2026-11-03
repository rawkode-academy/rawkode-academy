# CLAUDE.md - Infrastructure

This directory contains infrastructure-as-code configurations for DNS, GitHub organization, and Google Cloud resources.

## Directory Structure

| Directory | Tool | Purpose |
|-----------|------|---------|
| `dns/` | cuenv infrastructure | DNS records for all domains |
| `github/` | Terraform | GitHub organization and repository settings |
| `google-cloud/` | Scripts | Workload Identity and secret access |

## dns/

Manages DNS with cuenv infrastructure (`cuenv infrastructure`, alias `cuenv i`), which drives the Cloudflare and DNSimple Terraform providers directly. State lives in the `rawkode-academy-cuenv-infrastructure` Cloudflare D1 database.

**Layout:**
- `env.cue` - the cuenv project; 1Password-backed credentials limited to infrastructure actions
- `infrastructure.cue` - state, providers, and every zone's resources flattened together
- `zone/` - package `zone`: `#Zone` (records, settings) and one file per mixin: registrars (`cloudflare_registrar.cue`, `dnsimple_registrar.cue`) and services (`gmail.cue`, `fastmail.cue`, `cloudflare_email_routing.cue`, `no_email.cue`, `transistor.cue`)
- `domains/` - package `domains`: one file per domain, named after it, composing mixins

```cue
zones: "rawkode.com": zone.#CloudflareRegistrar & zone.#Gmail & {
	id: "<zone id>"
	gmail: domainKey: "<key>"
	mx: "@": "smtp.google.com": ttl: 3600
	txt: "@": "google-site-verification": {value: "google-site-verification=…", ttl: 300}
}
```

Records are keyed by DNS identity (`a`, `cname`, `mx`, `ns`, `txt`, `srv`), so conflicting values fail to unify. Every record takes the zone's `ttl` (default `1`, Cloudflare's auto) unless it sets its own. Every zone takes exactly one registrar mixin (`registrar!` is required, and two conflict). Email mixins all claim `txt: "@": spf`, so a zone can use at most one. Variation is expressed with mixins, never `if`.

The config replicates production. Records that Cloudflare marks read-only are owned by other products and are left out: Workers custom domains (proxied `AAAA 100::`), R2 custom domains, and Email Routing's MX and DKIM records. A mixin with parameters declares them on `#Zone` in its own file (`#Zone: gmail?: {...}`).

Validate with CUE 0.16 (the version cuenv embeds): `cue vet -c ./...`. CUE 0.17 rejects the cuenv schema.

**Commands:**
```bash
cd infrastructure/dns
cuenv i plan
cuenv i apply
```

**Adding a domain:** add its zone to Cloudflare first, then create `domains/<domain>.cue` with its zone `id`. Zones themselves are not managed here.

**Importing:** bring an existing object under management with `cuenv i import <type>.<name> <provider id>` (DNS records take `<zone id>/<record id>`), then `cuenv i plan`.

**Provider types:** pinned in the root `cuenv.lock`; generated into `cue.mod/gen` (gitignored). Run `cuenv sync infrastructure` after cloning.

## github/

Standard Terraform configuration for GitHub organization management.

**Files:**
- `organization.tf` - Organization settings
- `monorepo.tf` - Repository configuration
- `providers.tf` - GitHub provider config

**Applying changes:**
```bash
cd infrastructure/github
terraform init
terraform plan
terraform apply
```

## google-cloud/

Scripts for Google Cloud Workload Identity configuration.

**Granting secret access:** See `README.md` for the gcloud command to grant repository access to secrets.

## Environment Variables

DNS infrastructure requires these secrets (configured in `dns/env.cue`):
- `CLOUDFLARE_API_TOKEN` - Cloudflare DNS, and the D1 state store (as `state: d1: token` in `infrastructure.cue`)
- `DNSIMPLE_TOKEN` - DNSimple delegation

All secrets are sourced from 1Password via cuenv.
