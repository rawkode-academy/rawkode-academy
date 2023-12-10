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
              # AsciiDoc
              asciidoctor

              # Nix
              rnix-lsp
            ]++ [
              cdktf
            ] ++ optionals pkgs.stdenv.isDarwin (with pkgs.darwin.apple_sdk.frameworks; [
              CoreFoundation
              CoreServices
              SystemConfiguration
            ]++ lib.optionals stdenv.isDarwin [
              shfmt
            ]);
          };
        }
      );
}
