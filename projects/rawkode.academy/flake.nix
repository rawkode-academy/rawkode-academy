{
  inputs = {
    nixpkgs.url = "nixpkgs/release-23.11";
    devenv.url = "github:cachix/devenv/v0.6.3";
    flake-utils.url = "github:numtide/flake-utils";
  };

  nixConfig = {
    extra-trusted-public-keys = "devenv.cachix.org-1:w1cLUi8dv3hnoSPGAuibQv+f9TZLr6cv/Hm9XgU50cw=";
    extra-substituters = "https://devenv.cachix.org";
  };

  outputs = { self, nixpkgs, devenv, flake-utils, ... } @ inputs:
    flake-utils.lib.eachDefaultSystem (system:
      let
          pkgs = import nixpkgs {
            inherit system;
          };
        in with pkgs; {
          devShells.default = devenv.lib.mkShell {
              inherit inputs pkgs;

              modules = [{

              packages = [
                biome
                bun
                libiconv
                mprocs
                nodejs
                nodePackages.typescript
                supabase-cli
              ] ++ lib.optionals stdenv.isDarwin [
                darwin.apple_sdk.frameworks.SystemConfiguration
              ];

              processes.run.exec = "supabase start";
              }];
            };
        }
      );
}
