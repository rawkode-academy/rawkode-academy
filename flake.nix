{
  description = "Rawkode Academy monorepo development shells";

  inputs.nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";

  outputs =
    { nixpkgs, ... }:
    let
      systems = [
        "x86_64-linux"
        "aarch64-linux"
        "x86_64-darwin"
        "aarch64-darwin"
      ];
      forAllSystems = nixpkgs.lib.genAttrs systems;

      # Layering: `default` is the base shell every project inherits. A
      # directory that needs more ships a `devshell.nix` beside its code, a
      # function `{ pkgs, base }: <mkShell>` that sets `inputsFrom = [ base ]`
      # and appends its own packages and shellHook. Register it here under the
      # name the project's env.cue passes as `_nixShell`.
      shells = {
        website = ./projects/rawkode.academy/website/devshell.nix;
        identity = ./projects/rawkode.academy/identity/devshell.nix;
        youtube-control = ./projects/rawkode.academy/platform/youtube-control/devshell.nix;
        video-importer = ./projects/rawkode.academy/tasks/video-importer/devshell.nix;
        video-to-post = ./projects/rawkode.social/video-to-post/devshell.nix;
        observability-collector = ./projects/rawkode.tools/observability-collector/devshell.nix;
      };
    in
    {
      devShells = forAllSystems (
        system:
        let
          pkgs = nixpkgs.legacyPackages.${system};
          base = import ./nix/base.nix { inherit pkgs; };
        in
        {
          default = base;
        }
        // builtins.mapAttrs (_: path: import path { inherit pkgs base; }) shells
      );
    };
}
