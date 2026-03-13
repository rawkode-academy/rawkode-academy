FROM nixpkgs/nix-flakes AS nix-tools

# Build standalone tool binaries we need
RUN nix profile install --profile /nix/var/nix/profiles/default \
  nixpkgs#nix \
  nixpkgs#kubectl \
  nixpkgs#crane \
  nixpkgs#deno \
  nixpkgs#git

FROM ghcr.io/kagent-dev/kagent/kagent-adk:0.7.23

# Copy nix-installed tools from builder
COPY --from=nix-tools /nix /nix
ENV PATH="/nix/var/nix/profiles/default/bin:${PATH}"
USER root
RUN chown -R 1001:1001 /nix
USER 1001:1001

WORKDIR /app

COPY pyproject.toml README.md ./
COPY software_developer/ software_developer/
COPY flake.nix /opt/templates/flake.nix

RUN uv sync --refresh

CMD ["software_developer"]
