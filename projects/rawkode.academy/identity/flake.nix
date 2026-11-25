{
  description = "Rawkode Academy identity development environment";

  # The toolchains are the repository's shared flakes. They follow this flake's
  # nixpkgs, so flake.lock here pins every tool in the shell.
  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    bun = {
      url = "path:../../../flakes/bun";
      inputs.nixpkgs.follows = "nixpkgs";
    };
    node = {
      url = "path:../../../flakes/node";
      inputs.nixpkgs.follows = "nixpkgs";
    };
    workerd = {
      url = "path:../../../flakes/workerd";
      inputs.nixpkgs.follows = "nixpkgs";
    };
  };

  outputs =
    {
      nixpkgs,
      bun,
      node,
      workerd,
      ...
    }:
    let
      forAllSystems = nixpkgs.lib.genAttrs [
        "x86_64-linux"
        "aarch64-linux"
        "aarch64-darwin"
      ];
    in
    {
      devShells = forAllSystems (
        system:
        let
          pkgs = nixpkgs.legacyPackages.${system};
          # Tasks run through identity-bun, so workerd is patched even when
          # node_modules was installed after the shell was entered.
          identityBun = pkgs.writeShellScriptBin "identity-bun" ''
            set -e
            ${workerd.packages.${system}.default}/bin/prepare-workerd
            exec ${pkgs.bun}/bin/bun "$@"
          '';
        in
        {
          default = pkgs.mkShell {
            inputsFrom = [
              bun.devShells.${system}.default
              node.devShells.${system}.default
              workerd.devShells.${system}.default
            ];

            packages = with pkgs; [
              biome
              identityBun
              nixfmt
            ];
          };
        }
      );
    };
}
