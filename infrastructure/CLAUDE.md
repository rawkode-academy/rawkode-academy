# CLAUDE.md - Infrastructure

This directory contains infrastructure-as-code configurations for DNS, GitHub organization, and Google Cloud resources.

## Directory Structure

| Directory | Tool | Purpose |
|-----------|------|---------|
| `dns/` | Terraform CDK (TypeScript) | DNS records for all domains |
| `github/` | Terraform | GitHub organization and repository settings |
| `google-cloud/` | Scripts | Workload Identity and secret access |

## dns/

Manages DNS records using Terraform CDK with TypeScript.

**Setup:**
```bash
cd infrastructure/dns
# Uses devenv for Nix-based development environment
devenv shell
```

**Tasks (via cuenv):**
```bash
cuenv task install    # Install dependencies
cuenv task plan       # Plan changes
cuenv task apply      # Apply changes
```

**Domain files:** Each domain has its own file in `src/domains/`. Add new domains by creating a new file following existing patterns.

**Secrets:** Uses 1Password for API tokens (Cloudflare, DNSimple) via `env.cue`.

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
- `TF_HTTP_USERNAME` / `TF_HTTP_PASSWORD` - Terraform state backend
- `CLOUDFLARE_API_KEY` - Cloudflare DNS
- `DNSIMPLE_TOKEN` - DNSimple DNS

All secrets are sourced from 1Password via cuenv.
