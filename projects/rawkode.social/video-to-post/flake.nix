{
  description = "Rawkode Social video-to-post notebook";

  # The toolchains are the repository's shared flakes. They follow this flake's
  # nixpkgs, so flake.lock here pins every tool in the shell.
  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    python = {
      url = "path:../../../flakes/python";
      inputs.nixpkgs.follows = "nixpkgs";
    };
    node = {
      url = "path:../../../flakes/node";
      inputs.nixpkgs.follows = "nixpkgs";
    };
  };

  outputs =
    {
      nixpkgs,
      python,
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
          # Node is for Marimo's AI assistant.
          default = pkgs.mkShell {
            inputsFrom = [
              python.devShells.${system}.default
              node.devShells.${system}.default
            ];

            packages = with pkgs; [
              ffmpeg
              just
              ruff
            ];

            shellHook = ''
              [ -d .venv ] || uv venv
              uv pip install --quiet --requirement requirements.txt
              . .venv/bin/activate
            '';
          };
        }
      );
    };
}
