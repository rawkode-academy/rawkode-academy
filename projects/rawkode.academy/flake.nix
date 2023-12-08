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
          devShells.default = mkShell {
            buildInputs = [
              asciidoctor
              rnix-lsp
              nodejs
              nodePackages.typescript
              rubyPackages.rouge
              biome
              bun
              supabase-cli
            ];
          };
        }
      );
}
