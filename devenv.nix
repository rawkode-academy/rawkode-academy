{ pkgs, ... }:
{
  languages.go.enable = true;
  languages.javascript = {
    enable = true;
    bun.enable = true;
    npm.enable = true;
  };
  languages.typescript.enable = true;

  packages = with pkgs; [
    biome
    runme
    sqld
    turso-cli
    wrangler
  ];
}
