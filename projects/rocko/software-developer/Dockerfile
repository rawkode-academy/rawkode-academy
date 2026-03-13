FROM nixos/nix:2.28.3

# Enable flakes and disable sandbox (required inside Docker)
RUN mkdir -p /etc/nix && \
	printf '%s\n' \
		'experimental-features = nix-command flakes' \
		'filter-syscalls = false' \
		'sandbox = false' \
	>> /etc/nix/nix.conf

# Install tools via nix-env with pinned channel
RUN nix-channel --add https://nixos.org/channels/nixos-25.05 nixpkgs && \
	nix-channel --update && \
	nix-env -iA nixpkgs.kubectl nixpkgs.crane nixpkgs.deno nixpkgs.git

WORKDIR /workspace

# Copy the template flake for app image builds
COPY flake.nix /opt/templates/flake.nix

CMD ["sleep", "infinity"]
