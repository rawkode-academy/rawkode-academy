{ pkgs, base }:
let
  # `bun install` creates workerd after the shell is entered, so patch it
  # again right after every bun invocation's dependencies exist.
  identityBun = pkgs.writeShellScriptBin "identity-bun" ''
    set -e
    prepare-workerd
    exec ${pkgs.bun}/bin/bun "$@"
  '';
in
pkgs.mkShell {
  inputsFrom = [ base ];
  packages = [
    pkgs.biome
    identityBun
  ];
}
