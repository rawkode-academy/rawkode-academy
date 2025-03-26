{ pkgs, ... }:
{
  name = "web.rawkode.academy";

  languages.nix.enable = true;

  languages.javascript = {
    enable = true;
  };
  languages.typescript.enable = true;

  packages = with pkgs; [
    bun
    d2
    nixfmt-rfc-style
  ];
}
