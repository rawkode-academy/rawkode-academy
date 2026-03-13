FROM nixpkgs/nix-flakes

RUN nix-env -iA nixpkgs.kubectl nixpkgs.crane nixpkgs.deno nixpkgs.git

WORKDIR /workspace

# Copy the template flake for app image builds
COPY flake.nix /opt/templates/flake.nix

CMD ["sleep", "infinity"]
