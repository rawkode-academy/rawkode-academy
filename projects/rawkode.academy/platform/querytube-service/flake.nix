{
  description = "Rawkode Academy Querytube Service";

  inputs = {
    devenv.url = "github:cachix/devenv";
    grafbase.url = "github:grafbase/grafbase";
    flake-parts.url = "github:hercules-ci/flake-parts";
    nixpkgs.url = "github:NixOS/nixpkgs/master";
  };

  outputs =
    inputs@{ flake-parts, ... }:
    flake-parts.lib.mkFlake { inherit inputs; } {
      flake = { };

      imports = [ inputs.devenv.flakeModule ];

      systems = [
        "aarch64-darwin"
        "aarch64-linux"
        "x86_64-darwin"
        "x86_64-linux"
      ];

      perSystem =
        {
          config,
          inputs',
          pkgs,
          self',
          system,
          ...
        }:
        {
          devenv.shells.default = {
            name = "querytube.rawkode.academy";

            languages.typescript.enable = true;

            processes = {
              turso.exec = "turso dev";
              grafbase.exec = "just dev";
            };

            packages = with pkgs; [
              biome
              bun
              inputs.grafbase.packages.${system}.cli
              just
              nodejs
              sqld
              turso-cli
            ];
          };
        };
    };
}
