{
  description = "Rawkode Academy repository development shell";

  # The toolchains are the shared flakes in ./flakes. They follow this flake's
  # nixpkgs, so flake.lock here pins every tool in the shell.
  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixpkgs-unstable";
    bun = {
      url = "path:./flakes/bun";
      inputs.nixpkgs.follows = "nixpkgs";
    };
    nix = {
      url = "path:./flakes/nix";
      inputs.nixpkgs.follows = "nixpkgs";
    };
  };

  outputs =
    {
      nixpkgs,
      bun,
      nix,
      ...
    }:
    {
      devShells =
        nixpkgs.lib.genAttrs
          [
            "x86_64-linux"
            "aarch64-linux"
            "aarch64-darwin"
          ]
          (
            system:
            let
              pkgs = nixpkgs.legacyPackages.${system};
            in
            {
              default = pkgs.mkShell {
                inputsFrom = [
                  bun.devShells.${system}.default
                  nix.devShells.${system}.default
                ];
              };
            }
          );
    };
}
