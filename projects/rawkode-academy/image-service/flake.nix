{
  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    systems.url = "github:nix-systems/default";
    devenv.url = "github:cachix/devenv";
  };

  nixConfig = {
    extra-trusted-public-keys = "devenv.cachix.org-1:w1cLUi8dv3hnoSPGAuibQv+f9TZLr6cv/Hm9XgU50cw=";
    extra-substituters = "https://devenv.cachix.org";
  };

  outputs =
    inputs@{ flake-parts, ... }:
    flake-parts.lib.mkFlake { inherit inputs; } {
      imports = [ inputs.devenv.flakeModule ];

      systems = [
        "x86_64-linux"
        "x86_64-darwin"
        "aarch64-darwin"
      ];

      perSystem =
        {
          config,
          self',
          inputs',
          pkgs,
          system,
          ...
        }:
        {
          devenv.shells = {
            default = {
              languages = {
                nix.enable = true;
              };

              packages = with pkgs; [
                alejandra
                bun
                nodejs
              ];

              # See: https://github.com/cloudflare/workerd/issues/1482
              enterShell = ''
								bun install
                __patchTarget="./node_modules/@cloudflare/workerd-linux-64/bin/workerd"
                if [[ -f "$__patchTarget" ]]; then
                  ${pkgs.patchelf}/bin/patchelf --set-interpreter ${pkgs.glibc}/lib/ld-linux-x86-64.so.2 "$__patchTarget"
                fi
              '';
            };
          };
        };
    };
}
