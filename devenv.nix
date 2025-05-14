{ pkgs, ... }:
{
	# Nix is added as a dependency because,
	# we need it to work with VSCode and editing this file.
  languages.nix = {
    enable = true;
    lsp.package = pkgs.nixd;
  };
}
