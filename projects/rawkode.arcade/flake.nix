{
  description = "Rawkode Arcade development environment";

  # The toolchains are the repository's shared flakes. They follow this flake's
  # nixpkgs, so flake.lock here pins every tool in the shell.
  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    bun = {
      url = "path:../../flakes/bun";
      inputs.nixpkgs.follows = "nixpkgs";
    };
    node = {
      url = "path:../../flakes/node";
      inputs.nixpkgs.follows = "nixpkgs";
    };
  };

  outputs =
    {
      nixpkgs,
      bun,
      node,
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
        in
        {
          default = pkgs.mkShell {
            inputsFrom = [
              bun.devShells.${system}.default
              node.devShells.${system}.default
            ];
          };
        }
      );
    };
}
