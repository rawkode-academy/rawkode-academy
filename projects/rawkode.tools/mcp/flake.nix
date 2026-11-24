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
          # the Worker and its tests, Python with google-auth-oauthlib for
          # `cuenv task owner`, and gh to start the deploy afterwards.
          default = pkgs.mkShell {
            packages = with pkgs; [
              (python3.withPackages (p: [ p.google-auth-oauthlib ]))
              nodejs_24
              gh
              curl
              jq
            ];
          };
        });
    };
}
