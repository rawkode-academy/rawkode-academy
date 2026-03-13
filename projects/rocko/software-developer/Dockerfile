FROM nixos/nix:latest AS base

RUN nix-channel --update

# Install kubectl and crane via nix
RUN nix-env -iA nixpkgs.kubectl nixpkgs.crane nixpkgs.deno nixpkgs.git

# Enable flakes
RUN mkdir -p /etc/nix && \
	echo "experimental-features = nix-command flakes" >> /etc/nix/nix.conf

WORKDIR /workspace

# Copy the template flake for app image builds
COPY flake.nix /opt/templates/flake.nix

CMD ["sleep", "infinity"]
