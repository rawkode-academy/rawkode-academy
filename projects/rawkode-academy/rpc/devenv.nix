{ pkgs, ... }:
{
  languages.nix.enable = true;

  languages.javascript = {
    enable = true;
    bun = {
      enable = true;
      install.enable = true;
    };
  };

  languages.typescript.enable = true;

  packages = with pkgs; [ biome hurl just ];
}
