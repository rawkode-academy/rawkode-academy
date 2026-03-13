{
  description = "Template flake for building TypeScript app OCI images";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-25.05";
  };

  outputs = { self, nixpkgs }:
    let
      system = "x86_64-linux";
      pkgs = nixpkgs.legacyPackages.${system};

      # The agent copies generated app source into ./src/ before building
      appSrc = ./src;
    in
    {
      packages.${system}.docker-image = pkgs.dockerTools.buildLayeredImage {
        name = "app";
        tag = "latest";
        contents = [
          pkgs.deno
          pkgs.cacert
        ];
        config = {
          WorkingDir = "/app";
          Cmd = [ "${pkgs.deno}/bin/deno" "run" "--allow-net" "--allow-env" "--allow-read" "main.ts" ];
        };
        extraCommands = ''
          mkdir -p app
          cp -r ${appSrc}/* app/
        '';
      };
    };
}
