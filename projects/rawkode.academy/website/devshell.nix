{ pkgs, base }:
pkgs.mkShell {
  inputsFrom = [ base ];
  packages = with pkgs; [
    biome
    d2
  ];
}
