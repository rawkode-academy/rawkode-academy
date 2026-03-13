FROM nixos/nix:2.28.3

# Enable flakes
RUN mkdir -p /etc/nix && \
	echo "experimental-features = nix-command flakes" >> /etc/nix/nix.conf

# Install kubectl and crane via nix profile (flake-based, no channels)
RUN nix profile install nixpkgs#kubectl nixpkgs#crane nixpkgs#deno nixpkgs#git

WORKDIR /workspace

# Copy the template flake for app image builds
COPY flake.nix /opt/templates/flake.nix

CMD ["sleep", "infinity"]
