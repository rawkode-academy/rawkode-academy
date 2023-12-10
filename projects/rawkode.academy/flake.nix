{
  inputs = {
    nixpkgs.url = "nixpkgs/release-23.11";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils }:
    flake-utils.lib.eachDefaultSystem
      (system:
        let
          pkgs = import nixpkgs {
            inherit system;
          };
        in
        with pkgs; {
          devShells.default = mkShell
            {
              buildInputs = [
                biome
                bun
                libiconv
                nodejs
                nodePackages.typescript
                supabase-cli
              ] ++ lib.optionals stdenv.isDarwin [
                darwin.apple_sdk.frameworks.SystemConfiguration
              ];
            };
        }
      );
}
