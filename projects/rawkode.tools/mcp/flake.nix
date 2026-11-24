{
  description = "Rawkode Tools MCP server";

  inputs.nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";

  outputs = { nixpkgs, ... }:
    let
      systems = [
        "x86_64-linux"
        "aarch64-linux"
        "x86_64-darwin"
        "aarch64-darwin"
      ];
      forAllSystems = nixpkgs.lib.genAttrs systems;
    in
    {
      devShells = forAllSystems (system:
        let
          pkgs = nixpkgs.legacyPackages.${system};
        in
        {
          # cuenv's Nix runtime enters this shell for every task: Node for
          # the Worker and its tests.
          default = pkgs.mkShell {
            packages = with pkgs; [
              nodejs_24
            ];
          };
        });
    };
}
