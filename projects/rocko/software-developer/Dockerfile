FROM nixos/nix:2.28.3

# Enable flakes and disable sandbox (required inside Docker)
RUN mkdir -p /etc/nix && \
	printf '%s\n' \
		'experimental-features = nix-command flakes' \
		'filter-syscalls = false' \
		'sandbox = false' \
	>> /etc/nix/nix.conf

# Install kubectl and crane via nix profile (flake-based, no channels)
RUN nix profile install nixpkgs#kubectl nixpkgs#crane nixpkgs#deno nixpkgs#git

WORKDIR /workspace

# Copy the template flake for app image builds
COPY flake.nix /opt/templates/flake.nix

CMD ["sleep", "infinity"]
