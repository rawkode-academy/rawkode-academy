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

  outputs = inputs@{ flake-parts, ... }:
    flake-parts.lib.mkFlake { inherit inputs; } {
      imports = [
        inputs.devenv.flakeModule
      ];

      systems = [ "x86_64-linux" "x86_64-darwin" "aarch64-darwin" ];

      perSystem = { config, self', inputs', pkgs, system, ... }: rec {
        devenv.shells = {
          default = {
            languages = {
              nix.enable = true;
            };

            packages = with pkgs; [
              alejandra
              bun
              # Grafbase currently uses node under the hood and only 18
              # works. We can remove this when Bun support is added.
              nodejs_18
              turso-cli

            ];

            process.implementation = "process-compose";

            processes = {
              turso.exec = "turso dev --port 4021";
              grafbase.exec = "just dev";
            };

            enterShell = ''
              turso config set autoupdate off
            '';

            scripts.kurl.exec = ''
              curl "https://httpbin.org/get?$1" | jq '.args'
            '';

          };
        };
      };
    };
}
