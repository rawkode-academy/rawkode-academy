{
  description = "Rawkode Academy video importer";

  # The toolchains are the repository's shared flakes. They follow this flake's
  # nixpkgs, so flake.lock here pins every tool in the shell.
  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    python = {
      url = "path:../../../../flakes/python";
      inputs.nixpkgs.follows = "nixpkgs";
    };
  };

  outputs =
    { nixpkgs, python, ... }:
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
              python.devShells.${system}.default
            ];

            packages = with pkgs; [
              ffmpeg
            ];

            shellHook = ''
              uv sync
              . .venv/bin/activate
            '';
          };
        }
      );
    };
}
