#!/usr/bin/env bash
set -xeo pipefail

echo "NodeJS setup"
corepack enable
corepack prepare pnpm@latest --activate
pnpm install --prod --frozen-lockfile --force
