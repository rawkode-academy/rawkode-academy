{
  description = "Rawkode Tools MCP server";

  # The toolchains are the repository's shared flakes. They follow this flake's
  # nixpkgs, so flake.lock here pins every tool in the shell.
  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    node = {
      url = "path:../../../flakes/node";
      inputs.nixpkgs.follows = "nixpkgs";
    };
  };

  outputs =
    { nixpkgs, node, ... }:
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
          # cuenv's Nix runtime enters this shell for every task: Node for
          # the Worker and its tests.
          default = pkgs.mkShell {
            inputsFrom = [
              node.devShells.${system}.default
            ];
          };
        }
      );
    };
}
